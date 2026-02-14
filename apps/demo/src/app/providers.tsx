"use client";

import { useMemo, type ReactNode } from "react";
import {
  VoxReactorProvider,
  createNavigationTool,
  createCrudTools,
  type VoxReactorAdapter,
  type VoxReactorConfig,
} from "@vox-reactor/react";

function createAdapter(): VoxReactorAdapter {
  return {
    getRealtimeToken: async (provider) => {
      const res = await fetch("/api/realtime-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to get token");
      }
      return res.json();
    },
  };
}

const tools = [
  createNavigationTool({
    routes: ["/", "/about", "/settings"],
    aliases: {
      "go home": "/",
      home: "/",
      about: "/about",
      "about page": "/about",
      settings: "/settings",
      preferences: "/settings",
    },
  }),
  ...createCrudTools({
    table: "notes",
    fields: {
      title: "string",
      content: "string",
    },
    operations: ["create"],
    requiredFields: ["title"],
  }),
  {
    type: "function" as const,
    name: "showToast",
    description: "Show a toast notification to the user.",
    parameters: {
      type: "object" as const,
      properties: {
        message: { type: "string", description: "The message to display" },
        variant: {
          type: "string",
          enum: ["success", "error", "info"],
          description: "Toast variant",
        },
      },
      required: ["message"],
    },
  },
  {
    type: "function" as const,
    name: "changeTheme",
    description:
      "Change the UI accent color. Accepts any valid CSS color value.",
    parameters: {
      type: "object" as const,
      properties: {
        color: { type: "string", description: "CSS color value" },
      },
      required: ["color"],
    },
  },
  {
    type: "function" as const,
    name: "disconnect",
    description:
      'Disconnect the voice assistant and stop listening. Use when the user says "stop listening", "stop chatting", "disconnect", "turn off", "goodbye", "bye", "I\'m done", or similar.',
    parameters: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
];

const systemInstructions = `You are a friendly voice assistant for the Vox Reactor demo app.

Available tools:
- navigate: Go to /, /about, or /settings
- createNote: Create a note with a title and content
- showToast: Show a notification
- changeTheme: Change the accent color
- disconnect: Stop listening / end the voice session

When the user says "stop listening", "stop chatting", "disconnect", "goodbye", "bye", "I'm done", or similar - say a brief goodbye and call the disconnect tool.

Keep responses SHORT and conversational. Confirm actions after completing them.
Today's date is ${new Date().toLocaleDateString()}.`;

export function Providers({ children }: { children: ReactNode }) {
  const config: VoxReactorConfig = useMemo(
    () => ({
      adapter: createAdapter(),
      tools,
      systemInstructions,
      defaultProvider: "openai",
      autoFallback: false,
      voice: "echo",
    }),
    []
  );

  return <VoxReactorProvider config={config}>{children}</VoxReactorProvider>;
}
