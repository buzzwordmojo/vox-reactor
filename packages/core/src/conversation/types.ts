// ═══════════════════════════════════════════════════════════
// Conversation & Tool Types
// ═══════════════════════════════════════════════════════════

export interface ConversationMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  status?: "success" | "error" | "pending";
}

export interface ToolDefinition {
  type: "function";
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, unknown>;
    required: string[];
  };
}

export interface ToolResult {
  success: boolean;
  message: string;
  data?: Record<string, unknown>;
  error?: string;
}

export type ToolHandler = (
  name: string,
  args: Record<string, unknown>
) => Promise<ToolResult>;

export type VoiceAssistantStatus =
  | "idle"
  | "recording"
  | "processing"
  | "executing"
  | "error";
