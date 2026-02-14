"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  ConversationHistory,
  type ConversationMessage,
} from "@vox-reactor/core";

// ═══════════════════════════════════════════════════════════
// useConversation Hook
// Standalone conversation history management
// ═══════════════════════════════════════════════════════════

export interface UseConversationReturn {
  messages: ConversationMessage[];
  addUserMessage: (content: string) => ConversationMessage;
  addAssistantMessage: (
    content: string,
    status?: "success" | "error" | "pending"
  ) => ConversationMessage;
  clear: () => void;
  /** The underlying ConversationHistory instance (for passing to other hooks) */
  history: ConversationHistory;
}

export function useConversation(): UseConversationReturn {
  const historyRef = useRef(new ConversationHistory());
  const [messages, setMessages] = useState<ConversationMessage[]>([]);

  useEffect(() => {
    const unsub = historyRef.current.subscribe(setMessages);
    return unsub;
  }, []);

  const addUserMessage = useCallback((content: string) => {
    return historyRef.current.addUserMessage(content);
  }, []);

  const addAssistantMessage = useCallback(
    (
      content: string,
      status: "success" | "error" | "pending" = "success"
    ) => {
      return historyRef.current.addAssistantMessage(content, status);
    },
    []
  );

  const clear = useCallback(() => {
    historyRef.current.clear();
  }, []);

  return {
    messages,
    addUserMessage,
    addAssistantMessage,
    clear,
    history: historyRef.current,
  };
}
