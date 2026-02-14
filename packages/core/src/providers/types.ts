// ═══════════════════════════════════════════════════════════
// Realtime Provider Interface
// ═══════════════════════════════════════════════════════════

export type VoiceProviderName = "openai" | "xai";

export type VoiceConnectionState =
  | "disconnected"
  | "connecting"
  | "connected"
  | "error";

export interface RealtimeSessionConfig {
  instructions: string;
  tools: unknown[];
  voice?: string;
  /** Server VAD threshold (0-1). Default: 0.5 */
  vadThreshold?: number;
  /** Silence duration before end-of-turn (ms). Default: 800 */
  silenceDurationMs?: number;
  /** Transcription model. Default: "whisper-1" */
  transcriptionModel?: string;
}

export type RealtimeEventHandler = (event: Record<string, unknown>) => void;

export interface RealtimeProvider {
  readonly name: VoiceProviderName;

  connect(token: string, config: RealtimeSessionConfig): Promise<void>;
  disconnect(): void;

  /** Send an event/message to the provider */
  sendEvent(event: Record<string, unknown>): void;

  /** Register handler for incoming events */
  onEvent(handler: RealtimeEventHandler): void;

  /** Attenuate mic during assistant speech (low gain preserves barge-in) */
  setMicMuted(muted: boolean): void;

  readonly isConnected: boolean;
}
