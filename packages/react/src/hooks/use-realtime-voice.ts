"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import {
  ProviderManager,
  ConversationHistory,
  ToolExecutor,
  createRealtimeEventHandler,
  base64Pcm16ToFloat32,
  AudioQueuePlayer,
  type VoiceConnectionState,
  type VoiceProviderName,
  type ConversationMessage,
  type ToolResult,
  type RealtimeProvider,
} from "@vox-reactor/core";
import { useVoxReactorConfig } from "../context/vox-provider";

// ═══════════════════════════════════════════════════════════
// useRealtimeVoice Hook
// Realtime streaming voice via OpenAI WebRTC or xAI WebSocket
// ═══════════════════════════════════════════════════════════

export interface UseRealtimeVoiceOptions {
  /** Client-side tool handler */
  onToolCall?: (
    name: string,
    args: Record<string, unknown>
  ) => Promise<ToolResult>;
  /** Notification callback (for toast-like UIs) */
  onNotification?: (message: string, variant: "success" | "error" | "info") => void;
  /** Callback when bulk data is imported */
  onImportedData?: (data: Record<string, unknown>) => void;
}

export interface UseRealtimeVoiceReturn {
  // Connection
  connectionState: VoiceConnectionState;
  isConnected: boolean;
  provider: VoiceProviderName;
  connect: () => Promise<void>;
  disconnect: () => void;

  // Audio state
  isListening: boolean;
  isSpeaking: boolean;
  userIsSpeaking: boolean;

  // Transcripts
  streamingTranscript: string;
  finalTranscript: string;

  // Conversation
  conversationHistory: ConversationMessage[];
  clearConversationHistory: () => void;

  // Actions
  interruptSpeech: () => void;
  sendTextMessage: (text: string) => void;
  sendProactivePrompt: (promptText?: string) => void;

  error: string | null;
}

const DEFAULT_PROACTIVE_PROMPT =
  "[System: The user has been idle. Give them a friendly, brief suggestion about what to work on next. Keep it natural and encouraging, like a coach checking in.]";

export function useRealtimeVoice(
  options: UseRealtimeVoiceOptions = {}
): UseRealtimeVoiceReturn {
  const config = useVoxReactorConfig();
  const { onToolCall, onNotification, onImportedData } = options;

  // State
  const [connectionState, setConnectionState] =
    useState<VoiceConnectionState>("disconnected");
  const [error, setError] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [userIsSpeaking, setUserIsSpeaking] = useState(false);
  const [streamingTranscript, setStreamingTranscript] = useState("");
  const [finalTranscript, setFinalTranscript] = useState("");
  const [conversationHistory, setConversationHistory] = useState<
    ConversationMessage[]
  >([]);

  // Stable refs
  const providerManagerRef = useRef<ProviderManager | null>(null);
  const activeProviderRef = useRef<RealtimeProvider | null>(null);
  const audioPlayerRef = useRef<AudioQueuePlayer | null>(null);
  const conversationRef = useRef(new ConversationHistory());
  const toolExecutorRef = useRef<ToolExecutor | null>(null);

  // Keep callbacks ref current
  const callbacksRef = useRef({ onToolCall, onNotification, onImportedData });
  callbacksRef.current = { onToolCall, onNotification, onImportedData };

  // Sync ConversationHistory -> React state
  useEffect(() => {
    const unsub = conversationRef.current.subscribe(setConversationHistory);
    return unsub;
  }, []);

  // Current provider name for display
  const [providerName, setProviderName] = useState<VoiceProviderName>(
    config.defaultProvider ?? "openai"
  );

  // Tool executor
  const toolExecutor = useMemo(() => {
    const executor = new ToolExecutor({
      onToolCall: async (name, args) => {
        if (callbacksRef.current.onToolCall) {
          return callbacksRef.current.onToolCall(name, args);
        }
        if (config.adapter.executeAction) {
          return config.adapter.executeAction(name, args);
        }
        return { success: false, message: `No handler for tool: ${name}` };
      },
      onNotification: (msg, variant) => {
        callbacksRef.current.onNotification?.(msg, variant);
      },
    });
    toolExecutorRef.current = executor;
    return executor;
  }, [config.adapter]);

  // Send helper
  const sendEvent = useCallback((event: Record<string, unknown>) => {
    activeProviderRef.current?.sendEvent(event);
  }, []);

  // Connect
  const connect = useCallback(async () => {
    if (
      connectionState === "connecting" ||
      connectionState === "connected"
    ) {
      return;
    }

    setConnectionState("connecting");
    setError(null);
    setStreamingTranscript("");
    setFinalTranscript("");

    try {
      const pm = new ProviderManager({
        defaultProvider: config.defaultProvider ?? "openai",
        autoFallback: config.autoFallback ?? true,
      });
      providerManagerRef.current = pm;

      const provider = await pm.connect(
        async (providerName) => {
          const result = await config.adapter.getRealtimeToken(providerName);
          return result.token;
        },
        {
          instructions: config.systemInstructions ?? "",
          tools: config.tools ?? [],
          voice: config.voice,
        }
      );

      activeProviderRef.current = provider;
      setProviderName(pm.currentProviderName);

      // Set up audio player for xAI (WebSocket sends audio as base64)
      if (pm.currentProviderName === "xai") {
        const audioCtx = new AudioContext({ sampleRate: 24000 });
        audioPlayerRef.current = new AudioQueuePlayer(audioCtx);
        audioPlayerRef.current.onPlaybackChange((playing) => {
          setIsSpeaking(playing);
        });
      }

      // Wire up event handler
      const handleEvent = createRealtimeEventHandler({
        onUserSpeakingChange: setUserIsSpeaking,
        onAssistantSpeakingChange: (speaking) => {
          // For OpenAI (WebRTC handles audio playback natively)
          if (pm.currentProviderName === "openai") {
            setIsSpeaking(speaking);
          }
        },
        onMicMute: (muted) => {
          activeProviderRef.current?.setMicMuted(muted);
        },
        onStreamingTranscript: setStreamingTranscript,
        onFinalTranscript: (text) => {
          setFinalTranscript(text);
          setStreamingTranscript("");
          conversationRef.current.addUserMessage(text);
        },
        onAssistantTranscript: (text) => {
          conversationRef.current.addAssistantMessage(text);
        },
        onAudioDelta: (base64Audio) => {
          if (pm.currentProviderName === "xai" && audioPlayerRef.current) {
            const audioData = base64Pcm16ToFloat32(base64Audio);
            audioPlayerRef.current.enqueue(audioData);
          }
        },
        onToolCall: async (callId, name, args) => {
          const result = await toolExecutor.execute(name, args);

          // Check for imported data
          if (result.data) {
            callbacksRef.current.onImportedData?.(result.data);
          }

          // Send result back to provider
          sendEvent({
            type: "conversation.item.create",
            item: {
              type: "function_call_output",
              call_id: callId,
              output: JSON.stringify(result),
            },
          });
          sendEvent({ type: "response.create" });
        },
        onError: setError,
      });

      provider.onEvent(handleEvent);
      setConnectionState("connected");
      setIsListening(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connection failed");
      setConnectionState("error");
    }
  }, [connectionState, config, toolExecutor, sendEvent]);

  // Disconnect
  const disconnect = useCallback(() => {
    providerManagerRef.current?.disconnect();
    activeProviderRef.current = null;
    audioPlayerRef.current?.flush();
    audioPlayerRef.current = null;
    setConnectionState("disconnected");
    setIsListening(false);
    setIsSpeaking(false);
    setUserIsSpeaking(false);
    setError(null);
  }, []);

  // Interrupt speech
  const interruptSpeech = useCallback(() => {
    audioPlayerRef.current?.flush();
    setIsSpeaking(false);
    sendEvent({ type: "response.cancel" });
  }, [sendEvent]);

  // Send text message
  const sendTextMessage = useCallback(
    (text: string) => {
      if (!text.trim()) return;

      conversationRef.current.addUserMessage(text.trim());

      sendEvent({
        type: "conversation.item.create",
        item: {
          type: "message",
          role: "user",
          content: [{ type: "input_text", text: text.trim() }],
        },
      });
      sendEvent({ type: "response.create" });
    },
    [sendEvent]
  );

  // Proactive prompt
  const sendProactivePrompt = useCallback(
    (promptText?: string) => {
      if (connectionState !== "connected") return;

      sendEvent({
        type: "conversation.item.create",
        item: {
          type: "message",
          role: "user",
          content: [
            {
              type: "input_text",
              text: promptText ?? DEFAULT_PROACTIVE_PROMPT,
            },
          ],
        },
      });
      sendEvent({ type: "response.create" });
    },
    [connectionState, sendEvent]
  );

  // Clear history
  const clearConversationHistory = useCallback(() => {
    conversationRef.current.clear();
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      providerManagerRef.current?.disconnect();
    };
  }, []);

  return {
    connectionState,
    isConnected: connectionState === "connected",
    provider: providerName,
    connect,
    disconnect,

    isListening,
    isSpeaking,
    userIsSpeaking,

    streamingTranscript,
    finalTranscript,

    conversationHistory,
    clearConversationHistory,

    interruptSpeech,
    sendTextMessage,
    sendProactivePrompt,

    error,
  };
}
