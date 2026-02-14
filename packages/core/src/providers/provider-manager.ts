// ═══════════════════════════════════════════════════════════
// Provider Manager with Auto-Fallback
// Orchestrates connecting to primary/fallback providers
// ═══════════════════════════════════════════════════════════

import type {
  RealtimeProvider,
  RealtimeSessionConfig,
  VoiceProviderName,
} from "./types";
import { OpenAiWebRtcProvider } from "./openai-webrtc";
import { XaiWebSocketProvider } from "./xai-websocket";

export interface ProviderManagerConfig {
  defaultProvider: VoiceProviderName;
  autoFallback: boolean;
}

export class ProviderManager {
  private config: ProviderManagerConfig;
  private activeProvider: RealtimeProvider | null = null;
  private activeProviderName: VoiceProviderName;

  constructor(config: ProviderManagerConfig) {
    this.config = config;
    this.activeProviderName = config.defaultProvider;
  }

  get provider(): RealtimeProvider | null {
    return this.activeProvider;
  }

  get currentProviderName(): VoiceProviderName {
    return this.activeProviderName;
  }

  /**
   * Connect to the provider. If autoFallback is enabled and the primary
   * fails, tries the other provider automatically.
   */
  async connect(
    getToken: (provider: VoiceProviderName) => Promise<string>,
    sessionConfig: RealtimeSessionConfig
  ): Promise<RealtimeProvider> {
    const primary = this.createProvider(this.activeProviderName);

    try {
      const token = await getToken(this.activeProviderName);
      await primary.connect(token, sessionConfig);
      this.activeProvider = primary;
      return primary;
    } catch (err) {
      if (!this.config.autoFallback) {
        throw err;
      }

      // Try fallback
      const fallbackName: VoiceProviderName =
        this.activeProviderName === "openai" ? "xai" : "openai";
      const fallback = this.createProvider(fallbackName);

      try {
        const token = await getToken(fallbackName);
        await fallback.connect(token, sessionConfig);
        this.activeProviderName = fallbackName;
        this.activeProvider = fallback;
        return fallback;
      } catch (fallbackErr) {
        // Both failed
        throw new Error(
          `Both providers failed. Primary (${this.activeProviderName}): ${
            err instanceof Error ? err.message : "Unknown"
          }. Fallback (${fallbackName}): ${
            fallbackErr instanceof Error ? fallbackErr.message : "Unknown"
          }`
        );
      }
    }
  }

  disconnect(): void {
    this.activeProvider?.disconnect();
    this.activeProvider = null;
  }

  private createProvider(name: VoiceProviderName): RealtimeProvider {
    switch (name) {
      case "openai":
        return new OpenAiWebRtcProvider();
      case "xai":
        return new XaiWebSocketProvider();
    }
  }
}
