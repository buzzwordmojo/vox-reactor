// ═══════════════════════════════════════════════════════════
// @vox-reactor/core - Framework-agnostic voice control primitives
// ═══════════════════════════════════════════════════════════

// Audio
export { VadEngine, DEFAULT_VAD_CONFIG } from "./audio/vad-engine";
export type { VadConfig, VadEvent } from "./audio/vad-engine";

export { AudioQueuePlayer } from "./audio/playback";
export type { PlaybackListener } from "./audio/playback";

export { AudioRecorder } from "./audio/recorder";
export type { RecorderEvents } from "./audio/recorder";

export { selectBestMicrophone } from "./audio/mic-selector";
export type { MicSelectionResult } from "./audio/mic-selector";

export { float32ToBase64Pcm16, base64Pcm16ToFloat32 } from "./audio/pcm-codec";

// Providers
export { OpenAiWebRtcProvider } from "./providers/openai-webrtc";
export { XaiWebSocketProvider } from "./providers/xai-websocket";
export { ProviderManager } from "./providers/provider-manager";
export type {
  RealtimeProvider,
  RealtimeSessionConfig,
  RealtimeEventHandler,
  VoiceProviderName,
  VoiceConnectionState,
} from "./providers/types";
export type { ProviderManagerConfig } from "./providers/provider-manager";

// Realtime
export { createRealtimeEventHandler } from "./realtime/event-handler";
export type { RealtimeCallbacks } from "./realtime/types";

// Conversation
export { ConversationHistory } from "./conversation/history";
export type { ConversationListener } from "./conversation/history";

export { ToolExecutor } from "./conversation/tool-executor";
export type { ToolExecutorConfig } from "./conversation/tool-executor";

export type {
  ConversationMessage,
  ToolDefinition,
  ToolResult,
  ToolHandler,
  VoiceAssistantStatus,
} from "./conversation/types";

// Idle
export { IdleDetector } from "./idle/idle-detector";
export type { IdleDetectorConfig } from "./idle/idle-detector";
