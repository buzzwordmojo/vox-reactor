// ═══════════════════════════════════════════════════════════
// Unified Event Router for OpenAI/xAI Realtime APIs
// Both providers use the same event protocol
// ═══════════════════════════════════════════════════════════

import type { RealtimeCallbacks } from "./types";

/**
 * Create an event handler function that routes realtime events
 * from either OpenAI or xAI to the appropriate callbacks.
 */
export function createRealtimeEventHandler(
  callbacks: RealtimeCallbacks
): (event: Record<string, unknown>) => void {
  let streamingText = "";

  return async (event: Record<string, unknown>) => {
    const eventType = event.type as string;

    switch (eventType) {
      case "session.created":
      case "session.updated":
        // Session ready - no action needed
        break;

      case "input_audio_buffer.speech_started":
        callbacks.onUserSpeakingChange(true);
        streamingText = "";
        callbacks.onStreamingTranscript("");
        break;

      case "input_audio_buffer.speech_stopped":
        callbacks.onUserSpeakingChange(false);
        break;

      case "conversation.item.input_audio_transcription.completed": {
        const transcript = event.transcript as string;
        if (transcript) {
          callbacks.onFinalTranscript(transcript);
          streamingText = "";
          callbacks.onStreamingTranscript("");
        }
        break;
      }

      case "conversation.item.input_audio_transcription.failed":
        // Transcription failed - log but don't error (audio was still processed)
        break;

      case "response.created":
        callbacks.onAssistantSpeakingChange(true);
        break;

      case "response.audio.delta": {
        const audioBase64 = event.delta as string;
        if (audioBase64) {
          callbacks.onAudioDelta?.(audioBase64);
        }
        break;
      }

      case "response.audio_transcript.delta": {
        const delta = event.delta as string;
        if (delta) {
          streamingText += delta;
          callbacks.onStreamingTranscript(streamingText);
        }
        break;
      }

      case "response.done": {
        callbacks.onAssistantSpeakingChange(false);

        // Extract assistant transcript from response
        const response = event.response as Record<string, unknown> | undefined;
        const output = response?.output as
          | Array<Record<string, unknown>>
          | undefined;
        if (output) {
          for (const item of output) {
            if (item.type === "message" && item.role === "assistant") {
              const content = item.content as
                | Array<Record<string, unknown>>
                | undefined;
              if (content) {
                for (const c of content) {
                  if (c.type === "audio" && c.transcript) {
                    callbacks.onAssistantTranscript(c.transcript as string);
                  }
                }
              }
            }
          }
        }
        break;
      }

      case "response.cancelled":
        callbacks.onAssistantSpeakingChange(false);
        break;

      case "response.function_call_arguments.done": {
        const callId = event.call_id as string;
        const name = event.name as string;
        const argsJson = event.arguments as string;

        let args: Record<string, unknown>;
        try {
          args = JSON.parse(argsJson);
        } catch {
          args = {};
        }

        await callbacks.onToolCall(callId, name, args);
        break;
      }

      case "error": {
        const errorData = event.error as
          | Record<string, unknown>
          | undefined;
        const errorMsg =
          (errorData?.message as string) || "Unknown error";

        // Ignore known benign errors
        if (
          errorMsg.includes("buffer is empty") ||
          errorMsg.includes("already has an active response")
        ) {
          break;
        }

        callbacks.onError(errorMsg);
        break;
      }
    }
  };
}
