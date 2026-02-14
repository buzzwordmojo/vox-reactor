// ═══════════════════════════════════════════════════════════
// Conversation History with Pub/Sub
// ═══════════════════════════════════════════════════════════

import type { ConversationMessage } from "./types";

export type ConversationListener = (messages: ConversationMessage[]) => void;

export class ConversationHistory {
  private messages: ConversationMessage[] = [];
  private listeners = new Set<ConversationListener>();

  addUserMessage(content: string): ConversationMessage {
    const msg: ConversationMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content,
      timestamp: Date.now(),
    };
    this.messages = [...this.messages, msg];
    this.notify();
    return msg;
  }

  addAssistantMessage(
    content: string,
    status: "success" | "error" | "pending" = "success"
  ): ConversationMessage {
    const msg: ConversationMessage = {
      id: `assistant-${Date.now()}`,
      role: "assistant",
      content,
      timestamp: Date.now(),
      status,
    };
    this.messages = [...this.messages, msg];
    this.notify();
    return msg;
  }

  getMessages(): ConversationMessage[] {
    return this.messages;
  }

  clear(): void {
    this.messages = [];
    this.notify();
  }

  subscribe(listener: ConversationListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener(this.messages);
    }
  }
}
