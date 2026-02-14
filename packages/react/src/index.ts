// ═══════════════════════════════════════════════════════════
// @vox-reactor/react - React hooks for voice control
// ═══════════════════════════════════════════════════════════

// Context
export { VoxReactorProvider, useVoxReactorConfig } from "./context/vox-provider";
export type {
  VoxReactorAdapter,
  VoxReactorConfig,
} from "./context/vox-provider";

// Hooks
export { useRealtimeVoice } from "./hooks/use-realtime-voice";
export type {
  UseRealtimeVoiceOptions,
  UseRealtimeVoiceReturn,
} from "./hooks/use-realtime-voice";

export { useVadVoice } from "./hooks/use-vad-voice";
export type {
  UseVadVoiceOptions,
  UseVadVoiceReturn,
} from "./hooks/use-vad-voice";

export { useIdleCoaching } from "./hooks/use-idle-coaching";
export type { UseIdleCoachingOptions } from "./hooks/use-idle-coaching";

export { useConversation } from "./hooks/use-conversation";
export type { UseConversationReturn } from "./hooks/use-conversation";

// Helpers
export { createNavigationTool, createCrudTools } from "./helpers/tool-builders";
export type {
  NavigationToolConfig,
  CrudToolsConfig,
} from "./helpers/tool-builders";

// Re-export core types consumers commonly need
export type {
  ConversationMessage,
  ToolDefinition,
  ToolResult,
  VoiceConnectionState,
  VoiceProviderName,
  VoiceAssistantStatus,
  VadConfig,
} from "@vox-reactor/core";
