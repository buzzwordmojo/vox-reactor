"use client";

import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import type {
  ToolDefinition,
  ToolResult,
  VoiceProviderName,
} from "@vox-reactor/core";

// ═══════════════════════════════════════════════════════════
// Backend Adapter Interface
// ═══════════════════════════════════════════════════════════

export interface VoxReactorAdapter {
  /** Get an ephemeral token for realtime providers */
  getRealtimeToken: (provider: VoiceProviderName) => Promise<{ token: string }>;

  /** Upload audio blob for VAD mode (returns storage ID) */
  uploadAudio?: (blob: Blob) => Promise<string>;

  /** Process a voice command (VAD mode) */
  processCommand?: (
    audioId: string,
    history: { role: string; content: string }[]
  ) => Promise<{
    transcript: string;
    actions: Array<{ type: string; tool: string; params: Record<string, unknown> }>;
    feedback?: string;
    error?: string;
  }>;

  /** Generate speech from text (VAD mode) */
  generateSpeech?: (text: string) => Promise<{ audioUrl: string }>;

  /** Server-side tool execution fallback */
  executeAction?: (
    tool: string,
    params: Record<string, unknown>
  ) => Promise<ToolResult>;
}

// ═══════════════════════════════════════════════════════════
// Configuration
// ═══════════════════════════════════════════════════════════

export interface VoxReactorConfig {
  adapter: VoxReactorAdapter;
  tools?: ToolDefinition[];
  systemInstructions?: string;
  defaultProvider?: VoiceProviderName;
  autoFallback?: boolean;
  idleTimeout?: number;
  voice?: string;
}

// ═══════════════════════════════════════════════════════════
// Context
// ═══════════════════════════════════════════════════════════

const VoxReactorContext = createContext<VoxReactorConfig | null>(null);

export function VoxReactorProvider({
  config,
  children,
}: {
  config: VoxReactorConfig;
  children: ReactNode;
}) {
  const value = useMemo(() => config, [config]);
  return (
    <VoxReactorContext.Provider value={value}>
      {children}
    </VoxReactorContext.Provider>
  );
}

export function useVoxReactorConfig(): VoxReactorConfig {
  const ctx = useContext(VoxReactorContext);
  if (!ctx) {
    throw new Error(
      "useVoxReactorConfig must be used within a <VoxReactorProvider>"
    );
  }
  return ctx;
}
