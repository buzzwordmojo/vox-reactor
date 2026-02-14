// ═══════════════════════════════════════════════════════════
// Tool Execution Framework
// ═══════════════════════════════════════════════════════════

import type { ToolResult, ToolHandler } from "./types";

export interface ToolExecutorConfig {
  /** Client-side tool handler (runs in browser) */
  onToolCall?: ToolHandler;
  /** Server-side fallback (via adapter) */
  serverFallback?: ToolHandler;
  /** Notification callback */
  onNotification?: (message: string, variant: "success" | "error" | "info") => void;
}

export class ToolExecutor {
  private config: ToolExecutorConfig;

  constructor(config: ToolExecutorConfig) {
    this.config = config;
  }

  async execute(name: string, args: Record<string, unknown>): Promise<ToolResult> {
    try {
      // Try client-side handler first
      if (this.config.onToolCall) {
        const result = await this.config.onToolCall(name, args);
        if (result.success) {
          this.config.onNotification?.(result.message, "success");
        } else {
          this.config.onNotification?.(result.message, "error");
        }
        return result;
      }

      // Fall back to server-side execution
      if (this.config.serverFallback) {
        const result = await this.config.serverFallback(name, args);
        if (result.success) {
          this.config.onNotification?.(result.message, "success");
        } else {
          this.config.onNotification?.(result.message, "error");
        }
        return result;
      }

      return {
        success: false,
        message: `No handler registered for tool: ${name}`,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Tool execution failed";
      this.config.onNotification?.(message, "error");
      return { success: false, message };
    }
  }

  updateConfig(updates: Partial<ToolExecutorConfig>): void {
    this.config = { ...this.config, ...updates };
  }
}
