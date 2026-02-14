"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  useRealtimeVoice,
  useIdleCoaching,
  type ToolResult,
} from "@vox-reactor/react";

export function VoiceBar() {
  const router = useRouter();
  const [accentColor, setAccentColor] = useState("#ff6b35");

  const {
    connectionState,
    isConnected,
    isListening,
    isSpeaking,
    userIsSpeaking,
    streamingTranscript,
    conversationHistory,
    connect,
    disconnect,
    interruptSpeech,
    sendTextMessage,
    sendProactivePrompt,
    error,
    provider,
  } = useRealtimeVoice({
    onToolCall: async (name, args): Promise<ToolResult> => {
      switch (name) {
        case "navigate": {
          const route = args.route as string;
          router.push(route);
          return { success: true, message: `Navigated to ${route}` };
        }
        case "showToast": {
          const msg = args.message as string;
          const variant = (args.variant as string) ?? "info";
          if (variant === "success") toast.success(msg);
          else if (variant === "error") toast.error(msg);
          else toast.info(msg);
          return { success: true, message: `Showed toast: ${msg}` };
        }
        case "changeTheme": {
          const color = args.color as string;
          document.documentElement.style.setProperty("--accent", color);
          setAccentColor(color);
          return { success: true, message: `Changed theme to ${color}` };
        }
        case "createNote": {
          const title = args.title as string;
          toast.success(`Note created: ${title}`);
          return { success: true, message: `Created note: ${title}` };
        }
        case "disconnect": {
          // Small delay so the goodbye audio can start playing
          setTimeout(() => disconnect(), 1500);
          return { success: true, message: "Disconnecting voice assistant" };
        }
        default:
          return { success: false, message: `Unknown tool: ${name}` };
      }
    },
    onNotification: (msg, variant) => {
      if (variant === "success") toast.success(msg);
      else if (variant === "error") toast.error(msg);
      else toast.info(msg);
    },
  });

  // Idle coaching - send proactive prompt after 30s idle
  useIdleCoaching({
    isActive: isConnected,
    isBusy: isSpeaking || userIsSpeaking,
    timeoutMs: 30_000,
    onIdle: () => sendProactivePrompt(),
  });

  const [textInput, setTextInput] = useState("");

  const handleTextSubmit = () => {
    if (!textInput.trim()) return;
    sendTextMessage(textInput.trim());
    setTextInput("");
  };

  // Status indicator
  const statusDot = isConnected
    ? userIsSpeaking
      ? "bg-red-500 animate-pulse"
      : isSpeaking
        ? "bg-green-500 animate-pulse"
        : "bg-green-500"
    : connectionState === "connecting"
      ? "bg-yellow-500 animate-pulse"
      : "bg-gray-500";

  const statusText = isConnected
    ? userIsSpeaking
      ? "Listening..."
      : isSpeaking
        ? "Speaking..."
        : isListening
          ? "Ready"
          : "Connected"
    : connectionState === "connecting"
      ? "Connecting..."
      : connectionState === "error"
        ? `Error: ${error}`
        : "Disconnected";

  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        borderTop: "1px solid var(--border)",
        background: "var(--card-bg)",
        padding: "12px 20px",
        zIndex: 50,
      }}
    >
      {/* Streaming transcript */}
      {streamingTranscript && (
        <div
          style={{
            fontSize: "13px",
            color: "var(--muted)",
            marginBottom: "8px",
            fontStyle: "italic",
          }}
        >
          {streamingTranscript}
        </div>
      )}

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
        }}
      >
        {/* Connect/Disconnect button */}
        <button
          onClick={isConnected ? disconnect : connect}
          disabled={connectionState === "connecting"}
          style={{
            width: "48px",
            height: "48px",
            borderRadius: "50%",
            border: "none",
            background: isConnected ? accentColor : "#333",
            color: "white",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "20px",
            transition: "all 0.2s",
            opacity: connectionState === "connecting" ? 0.5 : 1,
          }}
          title={isConnected ? "Disconnect" : "Connect"}
        >
          {isConnected ? "🎙️" : "🔇"}
        </button>

        {/* Status */}
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span
              className={statusDot}
              style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                display: "inline-block",
                backgroundColor: isConnected
                  ? userIsSpeaking
                    ? "#ef4444"
                    : isSpeaking
                      ? "#22c55e"
                      : "#22c55e"
                  : connectionState === "connecting"
                    ? "#eab308"
                    : "#6b7280",
              }}
            />
            <span style={{ fontSize: "13px", color: "var(--muted)" }}>
              {statusText}
              {isConnected && (
                <span style={{ marginLeft: "8px", opacity: 0.5 }}>
                  via {provider}
                </span>
              )}
            </span>
          </div>

          {/* Text input */}
          {isConnected && (
            <div
              style={{
                display: "flex",
                gap: "8px",
                marginTop: "6px",
              }}
            >
              <input
                type="text"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleTextSubmit()}
                placeholder="Type a message..."
                style={{
                  flex: 1,
                  padding: "6px 10px",
                  borderRadius: "6px",
                  border: "1px solid var(--border)",
                  background: "var(--bg)",
                  color: "var(--fg)",
                  fontSize: "13px",
                  outline: "none",
                }}
              />
              <button
                onClick={handleTextSubmit}
                style={{
                  padding: "6px 12px",
                  borderRadius: "6px",
                  border: "none",
                  background: accentColor,
                  color: "white",
                  cursor: "pointer",
                  fontSize: "13px",
                }}
              >
                Send
              </button>
            </div>
          )}
        </div>

        {/* Interrupt button */}
        {isSpeaking && (
          <button
            onClick={interruptSpeech}
            style={{
              padding: "6px 12px",
              borderRadius: "6px",
              border: "1px solid var(--border)",
              background: "transparent",
              color: "var(--fg)",
              cursor: "pointer",
              fontSize: "12px",
            }}
          >
            Stop
          </button>
        )}
      </div>

      {/* Conversation history */}
      {conversationHistory.length > 0 && (
        <div
          style={{
            maxHeight: "150px",
            overflowY: "auto",
            marginTop: "8px",
            padding: "8px",
            borderRadius: "6px",
            background: "var(--bg)",
            fontSize: "12px",
          }}
        >
          {conversationHistory.map((msg) => (
            <div
              key={msg.id}
              style={{
                marginBottom: "4px",
                color: msg.role === "user" ? "var(--fg)" : accentColor,
              }}
            >
              <strong>{msg.role === "user" ? "You" : "AI"}:</strong>{" "}
              {msg.content}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
