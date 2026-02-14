// ═══════════════════════════════════════════════════════════
// OpenAI Realtime API via WebRTC
// ═══════════════════════════════════════════════════════════

import type {
  RealtimeProvider,
  RealtimeSessionConfig,
  RealtimeEventHandler,
} from "./types";

export class OpenAiWebRtcProvider implements RealtimeProvider {
  readonly name = "openai" as const;

  private pc: RTCPeerConnection | null = null;
  private dc: RTCDataChannel | null = null;
  private audioEl: HTMLAudioElement | null = null;
  private mediaStream: MediaStream | null = null;
  private eventHandler: RealtimeEventHandler | null = null;
  private connected = false;

  get isConnected(): boolean {
    return this.connected;
  }

  onEvent(handler: RealtimeEventHandler): void {
    this.eventHandler = handler;
  }

  async connect(token: string, config: RealtimeSessionConfig): Promise<void> {
    // Get microphone
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
    this.mediaStream = stream;

    // Create peer connection
    const pc = new RTCPeerConnection();
    this.pc = pc;

    // Audio element for playback
    const audioEl = document.createElement("audio");
    audioEl.autoplay = true;
    audioEl.setAttribute("playsinline", "true");
    this.audioEl = audioEl;

    pc.ontrack = (event) => {
      audioEl.srcObject = event.streams[0] ?? null;
      audioEl.play().catch(() => {});
    };

    stream.getTracks().forEach((track) => pc.addTrack(track, stream));

    // Data channel for events
    const dc = pc.createDataChannel("oai-events");
    this.dc = dc;

    return new Promise<void>((resolve, reject) => {
      dc.onopen = () => {
        dc.send(
          JSON.stringify({
            type: "session.update",
            session: {
              modalities: ["audio", "text"],
              instructions: config.instructions,
              tools: config.tools,
              tool_choice: "auto",
              turn_detection: {
                type: "server_vad",
                threshold: config.vadThreshold ?? 0.5,
                prefix_padding_ms: 300,
                silence_duration_ms: config.silenceDurationMs ?? 800,
              },
              input_audio_transcription: {
                model: config.transcriptionModel ?? "whisper-1",
              },
              voice: config.voice ?? "echo",
            },
          })
        );
        this.connected = true;
        resolve();
      };

      dc.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          this.eventHandler?.(parsed);
        } catch {
          // Ignore parse errors
        }
      };

      dc.onerror = () => reject(new Error("Data channel error"));
      dc.onclose = () => {
        this.connected = false;
      };

      // WebRTC signaling
      (async () => {
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);

          const response = await fetch(
            "https://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17",
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/sdp",
              },
              body: offer.sdp,
            }
          );

          if (!response.ok) {
            const errorText = await response.text().catch(() => "Unknown error");
            reject(
              new Error(
                `Connection failed: ${response.status} - ${errorText}`
              )
            );
            return;
          }

          const answerSdp = await response.text();
          await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });
        } catch (err) {
          reject(
            err instanceof Error ? err : new Error("SDP exchange failed")
          );
        }
      })();
    });
  }

  disconnect(): void {
    this.connected = false;

    if (this.dc) {
      this.dc.close();
      this.dc = null;
    }
    if (this.pc) {
      this.pc.close();
      this.pc = null;
    }
    if (this.audioEl) {
      this.audioEl.pause();
      this.audioEl.srcObject = null;
      this.audioEl.remove();
      this.audioEl = null;
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }
  }

  sendEvent(event: Record<string, unknown>): void {
    if (this.dc?.readyState === "open") {
      this.dc.send(JSON.stringify(event));
    }
  }

  setMicMuted(muted: boolean): void {
    if (this.mediaStream) {
      for (const track of this.mediaStream.getAudioTracks()) {
        track.enabled = !muted;
      }
    }
  }
}
