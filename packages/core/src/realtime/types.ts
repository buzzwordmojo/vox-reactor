// ═══════════════════════════════════════════════════════════
// Realtime Event Types
// ═══════════════════════════════════════════════════════════

export interface RealtimeCallbacks {
  onUserSpeakingChange: (speaking: boolean) => void;
  onAssistantSpeakingChange: (speaking: boolean) => void;
  onStreamingTranscript: (text: string) => void;
  onFinalTranscript: (text: string) => void;
  onAssistantTranscript: (text: string) => void;
  onToolCall: (callId: string, name: string, args: Record<string, unknown>) => Promise<void>;
  onAudioDelta?: (base64Audio: string) => void;
  /** Mute/unmute mic to prevent self-hearing during assistant speech */
  onMicMute?: (muted: boolean) => void;
  onError: (message: string) => void;
}
