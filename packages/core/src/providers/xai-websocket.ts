// ═══════════════════════════════════════════════════════════
// xAI Realtime API via WebSocket
// Uses subprotocol auth (browsers can't set WS headers)
// ═══════════════════════════════════════════════════════════

import type {
  RealtimeProvider,
  RealtimeSessionConfig,
  RealtimeEventHandler,
} from "./types";
import { float32ToBase64Pcm16 } from "../audio/pcm-codec";

export class XaiWebSocketProvider implements RealtimeProvider {
  readonly name = "xai" as const;

  private ws: WebSocket | null = null;
  private audioCtx: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private processor: ScriptProcessorNode | null = null;
  private eventHandler: RealtimeEventHandler | null = null;
  private connected = false;

  get isConnected(): boolean {
    return this.connected;
  }

  onEvent(handler: RealtimeEventHandler): void {
    this.eventHandler = handler;
  }

  async connect(token: string, config: RealtimeSessionConfig): Promise<void> {
    // Set up audio context at 24kHz
    const audioCtx = new AudioContext({ sampleRate: 24000 });
    this.audioCtx = audioCtx;

    // Get microphone
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        sampleRate: 24000,
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
    this.mediaStream = stream;

    // Connect via subprotocol auth
    const wsUrl = `wss://api.x.ai/v1/realtime?model=grok-2-voice`;
    const ws = new WebSocket(wsUrl, [
      "realtime",
      `openai-insecure-api-key.${token}`,
    ]);
    this.ws = ws;

    return new Promise<void>((resolve, reject) => {
      ws.onopen = () => {
        // Configure session
        ws.send(
          JSON.stringify({
            type: "session.update",
            session: {
              modalities: ["audio", "text"],
              instructions: config.instructions,
              tools: config.tools,
              tool_choice: "auto",
              input_audio_format: "pcm16",
              output_audio_format: "pcm16",
              turn_detection: {
                type: "server_vad",
                threshold: config.vadThreshold ?? 0.5,
                silence_duration_ms: config.silenceDurationMs ?? 800,
              },
              input_audio_transcription: {
                model: config.transcriptionModel ?? "whisper-1",
              },
              voice: config.voice ?? "cove",
            },
          })
        );

        // Start audio capture pipeline
        const source = audioCtx.createMediaStreamSource(stream);
        const processor = audioCtx.createScriptProcessor(4096, 1, 1);
        this.processor = processor;

        processor.onaudioprocess = (e) => {
          if (ws.readyState !== WebSocket.OPEN) return;
          const inputData = e.inputBuffer.getChannelData(0);
          const audioBase64 = float32ToBase64Pcm16(inputData);
          ws.send(
            JSON.stringify({
              type: "input_audio_buffer.append",
              audio: audioBase64,
            })
          );
        };

        source.connect(processor);
        processor.connect(audioCtx.destination);

        this.connected = true;
        resolve();
      };

      ws.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          this.eventHandler?.(parsed);
        } catch {
          // Ignore parse errors
        }
      };

      ws.onerror = () => reject(new Error("WebSocket connection failed"));
      ws.onclose = () => {
        this.connected = false;
      };
    });
  }

  disconnect(): void {
    this.connected = false;

    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }
    if (this.audioCtx) {
      this.audioCtx.close().catch(() => {});
      this.audioCtx = null;
    }
  }

  sendEvent(event: Record<string, unknown>): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(event));
    }
  }
}
