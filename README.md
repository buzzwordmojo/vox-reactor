# Vox Reactor

Hooks-only voice control library for React apps. No UI components shipped — you build your own mic buttons, waveforms, and conversation panels using the hooks.

Supports OpenAI Realtime API (WebRTC) and xAI Realtime API (WebSocket) with automatic provider fallback, VAD-based voice detection, conversation history, tool execution, idle coaching, and barge-in.

## Packages

| Package | Description | Size |
|---------|-------------|------|
| `@vox-reactor/core` | Framework-agnostic primitives (zero runtime deps) | ~24 KB |
| `@vox-reactor/react` | React hooks + context provider | ~20 KB |

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Your App                                                │
│  ┌──────────────────────────────────────────────────┐   │
│  │  <VoxReactorProvider config={...}>               │   │
│  │    ┌──────────────┐  ┌──────────────────────┐   │   │
│  │    │ Your VoiceBar│  │ useRealtimeVoice()   │   │   │
│  │    │ (custom UI)  │──│ useIdleCoaching()    │   │   │
│  │    │              │  │ useConversation()    │   │   │
│  │    └──────────────┘  └──────────┬───────────┘   │   │
│  └─────────────────────────────────┼────────────────┘   │
│                                    │                     │
│  ┌─────────────────────────────────▼────────────────┐   │
│  │  @vox-reactor/core                                │   │
│  │  ┌────────────┐ ┌──────────────┐ ┌────────────┐ │   │
│  │  │ Provider   │ │ Event Handler│ │ Conversation│ │   │
│  │  │ Manager    │ │ (unified)    │ │ History     │ │   │
│  │  │ ┌────────┐ │ │              │ │             │ │   │
│  │  │ │ OpenAI │ │ │              │ │ Tool        │ │   │
│  │  │ │ WebRTC │ │ │              │ │ Executor    │ │   │
│  │  │ ├────────┤ │ │              │ │             │ │   │
│  │  │ │ xAI    │ │ │              │ │ Idle        │ │   │
│  │  │ │ WS     │ │ │              │ │ Detector    │ │   │
│  │  │ └────────┘ │ │              │ │             │ │   │
│  │  └────────────┘ └──────────────┘ └────────────┘ │   │
│  └──────────────────────────────────────────────────┘   │
│                          │                               │
│              ┌───────────▼──────────┐                    │
│              │  Your Backend Adapter │                    │
│              │  (API route / action) │                    │
│              └──────────────────────┘                    │
└─────────────────────────────────────────────────────────┘
```

## Quick Start

### 1. Install

```bash
pnpm add @vox-reactor/core @vox-reactor/react
```

### 2. Create a Backend Adapter

The adapter is a plain object that tells vox-reactor how to talk to your backend. At minimum, you need `getRealtimeToken` — a function that returns an ephemeral API token from your server (so the real API key never reaches the browser).

```ts
// lib/vox-adapter.ts
import type { VoxReactorAdapter } from "@vox-reactor/react";

export function createAdapter(): VoxReactorAdapter {
  return {
    getRealtimeToken: async (provider) => {
      const res = await fetch("/api/realtime-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider }),
      });
      if (!res.ok) throw new Error("Failed to get token");
      return res.json(); // must return { token: string }
    },

    // Optional: for VAD mode (useVadVoice)
    // uploadAudio: async (blob) => { ... },
    // processCommand: async (audioId, history) => { ... },
    // generateSpeech: async (text) => { ... },

    // Optional: server-side tool execution fallback
    // executeAction: async (tool, params) => { ... },
  };
}
```

### 3. Create the Token API Route

The token route runs server-side so your API key stays secret. For OpenAI, you request an ephemeral session token. For xAI, you return the API key directly (it's used as a WebSocket subprotocol).

```ts
// app/api/realtime-token/route.ts (Next.js App Router)
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const { provider } = await request.json();

  if (provider === "xai") {
    return NextResponse.json({ token: process.env.XAI_API_KEY });
  }

  // OpenAI ephemeral token
  const response = await fetch("https://api.openai.com/v1/realtime/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-realtime-preview-2024-12-17",
      voice: "echo",
    }),
  });

  const data = await response.json();
  return NextResponse.json({ token: data.client_secret?.value });
}
```

### 4. Define Tools

Tools are what the voice assistant can *do* — navigate, create records, show toasts, etc. Use the helper builders or define them manually.

```ts
import { createNavigationTool, createCrudTools } from "@vox-reactor/react";

const tools = [
  // Navigation tool (auto-generates description with aliases)
  createNavigationTool({
    routes: ["/", "/dashboard", "/settings", "/profile"],
    aliases: {
      "go home": "/",
      home: "/",
      settings: "/settings",
      "my profile": "/profile",
    },
  }),

  // CRUD tools (generates createSkill, updateSkill, etc.)
  ...createCrudTools({
    table: "skills",
    fields: {
      name: "string",
      category: { type: "string", enum: ["Technical", "Soft Skills", "Leadership"] },
      level: { type: "number", minimum: 1, maximum: 5 },
    },
    operations: ["create", "update"],
    requiredFields: ["name"],
  }),

  // Manual tool definition
  {
    type: "function" as const,
    name: "disconnect",
    description: 'Stop listening. Use when user says "stop listening", "goodbye", etc.',
    parameters: { type: "object" as const, properties: {}, required: [] },
  },
];
```

### 5. Set Up the Provider

Wrap your app in `<VoxReactorProvider>`. This goes in your root layout (or a client-side providers wrapper).

```tsx
"use client";
import { useMemo, type ReactNode } from "react";
import { VoxReactorProvider, type VoxReactorConfig } from "@vox-reactor/react";
import { createAdapter } from "@/lib/vox-adapter";

const systemInstructions = `You are a friendly voice assistant for MyApp.
Keep responses SHORT and conversational.
ALWAYS call a tool when the user gives a command.`;

export function Providers({ children }: { children: ReactNode }) {
  const config: VoxReactorConfig = useMemo(() => ({
    adapter: createAdapter(),
    tools,
    systemInstructions,
    defaultProvider: "openai",  // "openai" (WebRTC) or "xai" (WebSocket)
    autoFallback: false,        // try other provider if primary fails
    voice: "echo",              // OpenAI voice ID
  }), []);

  return <VoxReactorProvider config={config}>{children}</VoxReactorProvider>;
}
```

### 6. Build Your Voice UI

Use `useRealtimeVoice` to drive your custom UI. Put this component in the **root layout** so it survives page navigation.

```tsx
"use client";
import { useRealtimeVoice, useIdleCoaching, type ToolResult } from "@vox-reactor/react";
import { useRouter } from "next/navigation";

export function VoiceBar() {
  const router = useRouter();

  const {
    connectionState,
    isConnected,
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
        case "navigate":
          router.push(args.route as string);
          return { success: true, message: `Navigated to ${args.route}` };
        case "disconnect":
          setTimeout(() => disconnect(), 1500); // let goodbye audio play
          return { success: true, message: "Disconnecting" };
        default:
          return { success: false, message: `Unknown tool: ${name}` };
      }
    },
    onNotification: (msg, variant) => {
      // Wire to your toast library
    },
  });

  // Proactive coaching after 30s idle
  useIdleCoaching({
    isActive: isConnected,
    isBusy: isSpeaking || userIsSpeaking,
    timeoutMs: 30_000,
    onIdle: () => sendProactivePrompt(),
  });

  return (
    <div>
      <button onClick={isConnected ? disconnect : connect}>
        {isConnected ? "Disconnect" : "Connect"}
      </button>
      {streamingTranscript && <p>{streamingTranscript}</p>}
      {/* Build whatever UI you want here */}
    </div>
  );
}
```

## Key Concepts

### Two Voice Modes

| Mode | Hook | How It Works | Best For |
|------|------|-------------|----------|
| **Realtime** | `useRealtimeVoice` | Streams audio to OpenAI/xAI via WebRTC/WebSocket. Server handles VAD, transcription, TTS, and tool calls. | Production apps, low latency |
| **VAD** | `useVadVoice` | Local VAD detects speech, records audio, uploads to your backend for processing. You handle transcription + AI + TTS server-side. | Custom pipelines, non-OpenAI backends |

Most apps should use **Realtime mode** — it's simpler and handles everything server-side.

### Mic Muting During Playback

The library automatically mutes the mic track while the assistant is speaking. This prevents the assistant's audio from feeding back through the speakers into the mic and triggering false "user is speaking" events. The mic unmutes when the response finishes or is cancelled.

### Barge-In

Users can interrupt the assistant mid-speech. In Realtime mode, the server VAD detects the user speaking and cancels the current response. In VAD mode, the `VadEngine` uses a higher threshold (`bargeInThreshold`) during TTS playback — the user must speak louder to interrupt, which prevents ambient noise from cutting off the assistant.

### Idle Coaching

`useIdleCoaching` monitors user activity (mouse, keyboard, touch, scroll) and fires a callback after a configurable timeout. Use it with `sendProactivePrompt()` to have the assistant check in when the user goes quiet.

### Provider Fallback

Set `autoFallback: true` in the config. If the primary provider (e.g. OpenAI) fails to connect, the library automatically tries the other (xAI). Both providers use the same event protocol, so your tool handlers and UI work identically regardless of which connects.

### The Adapter Pattern

The adapter decouples the library from your backend. Instead of importing Convex, tRPC, or fetch directly, you pass an adapter object that implements the required methods. This means:

- The library has zero backend dependencies
- You can swap backends without changing hook code
- Testing is easy — just mock the adapter

### Tool Execution Flow (Realtime Mode)

```
User speaks → Server VAD detects speech → Server transcribes
  → AI decides to call a tool → Event: response.function_call_arguments.done
  → Library calls your onToolCall handler → You execute the action
  → Library sends result back to provider → AI generates spoken confirmation
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENAI_API_KEY` | For OpenAI provider | Server-side only. Used to generate ephemeral tokens. |
| `XAI_API_KEY` | For xAI provider | Server-side only. Passed as WebSocket subprotocol token. |

**These must never reach the browser.** The adapter's `getRealtimeToken` function calls your API route, which uses the key server-side and returns an ephemeral token.

## API Reference

### `@vox-reactor/react`

#### `<VoxReactorProvider config={...}>`

Wraps your app and provides configuration to all hooks.

```ts
interface VoxReactorConfig {
  adapter: VoxReactorAdapter;       // Required: backend integration
  tools?: ToolDefinition[];         // Tools the AI can call
  systemInstructions?: string;      // AI system prompt
  defaultProvider?: "openai" | "xai"; // Default: "openai"
  autoFallback?: boolean;           // Default: true
  voice?: string;                   // Voice ID (e.g., "echo", "cove")
  idleTimeout?: number;             // Idle timeout (ms)
}
```

#### `useRealtimeVoice(options?)`

Main hook for realtime streaming voice.

**Options:**
- `onToolCall(name, args) => Promise<ToolResult>` — handle tool calls client-side
- `onNotification(message, variant)` — toast/notification callback
- `onImportedData(data)` — bulk data import callback

**Returns:**
- `connectionState` — `"disconnected" | "connecting" | "connected" | "error"`
- `isConnected`, `isListening`, `isSpeaking`, `userIsSpeaking` — boolean states
- `streamingTranscript` — live transcript as the user speaks
- `finalTranscript` — completed transcript after speech ends
- `conversationHistory` — array of `ConversationMessage`
- `connect()`, `disconnect()` — session control
- `interruptSpeech()` — stop the assistant mid-sentence
- `sendTextMessage(text)` — send typed input
- `sendProactivePrompt(text?)` — trigger a coaching prompt
- `clearConversationHistory()` — reset conversation
- `error` — error string or null
- `provider` — which provider is active

#### `useVadVoice(options?)`

Hook for VAD-based voice (local recording + server processing).

#### `useIdleCoaching(options)`

Fires a callback after user goes idle.

```ts
useIdleCoaching({
  isActive: boolean,    // enable when voice is connected
  isBusy: boolean,      // pause during speech
  timeoutMs: number,    // default: 30000
  onIdle: () => void,   // called on timeout
});
```

#### `useConversation()`

Standalone conversation history management (for custom UIs).

#### `createNavigationTool(config)`

Generates a navigation tool definition from routes and aliases.

#### `createCrudTools(config)`

Generates create/update/delete/get tool definitions from a table schema.

### `@vox-reactor/core`

All core classes are also exported if you need them directly:

- `VadEngine` — voice activity detection state machine
- `AudioRecorder` — MediaRecorder wrapper with auto-recreation
- `AudioQueuePlayer` — WebAudio playback queue
- `selectBestMicrophone()` — smart mic selection (hardware > default)
- `float32ToBase64Pcm16()` / `base64Pcm16ToFloat32()` — PCM codec
- `OpenAiWebRtcProvider` / `XaiWebSocketProvider` — provider implementations
- `ProviderManager` — fallback orchestration
- `ConversationHistory` — pub/sub message store
- `ToolExecutor` — dispatch framework
- `IdleDetector` — activity-based timeout
- `createRealtimeEventHandler()` — unified event routing

## Recipes: Common Voice Actions

Every voice action follows the same pattern:

1. **Define a tool** — tell the AI what it can do (name, description, parameters)
2. **Handle the call** — in your `onToolCall`, execute the action and return a `ToolResult`
3. **Return a result** — the AI speaks a confirmation based on the `message` you return

### Navigate to a Page

Use `createNavigationTool` for a ready-made tool, or define your own.

```ts
// Tool definition (using helper):
createNavigationTool({
  routes: ["/", "/dashboard", "/settings", "/profile"],
  aliases: { home: "/", "my profile": "/profile" },
})

// Handler:
case "navigate":
  router.push(args.route as string);
  return { success: true, message: `Navigated to ${args.route}` };
```

### Show a Toast / Notification

```ts
// Tool definition:
{
  type: "function",
  name: "showToast",
  description: "Show a toast notification to the user.",
  parameters: {
    type: "object",
    properties: {
      message: { type: "string", description: "The message to display" },
      variant: { type: "string", enum: ["success", "error", "info"] },
    },
    required: ["message"],
  },
}

// Handler (using sonner, but any toast library works):
case "showToast": {
  const msg = args.message as string;
  const variant = (args.variant as string) ?? "info";
  if (variant === "success") toast.success(msg);
  else if (variant === "error") toast.error(msg);
  else toast.info(msg);
  return { success: true, message: `Showed notification: ${msg}` };
}
```

### Open a Modal / Dialog

Pass a state setter into the `onToolCall` closure. The tool sets the state, React renders the dialog.

```ts
// In your VoiceBar component:
const [confirmDialog, setConfirmDialog] = useState<{ title: string; body: string } | null>(null);

// Tool definition:
{
  type: "function",
  name: "showConfirmation",
  description: "Show a confirmation dialog. Use for delete confirmations, important actions, etc.",
  parameters: {
    type: "object",
    properties: {
      title: { type: "string", description: "Dialog title" },
      body: { type: "string", description: "Dialog body text" },
    },
    required: ["title", "body"],
  },
}

// Handler:
case "showConfirmation":
  setConfirmDialog({ title: args.title as string, body: args.body as string });
  return { success: true, message: "Opened confirmation dialog" };

// In your JSX:
{confirmDialog && (
  <Dialog open onOpenChange={() => setConfirmDialog(null)}>
    <DialogContent>
      <DialogTitle>{confirmDialog.title}</DialogTitle>
      <DialogDescription>{confirmDialog.body}</DialogDescription>
      <Button onClick={() => setConfirmDialog(null)}>Got it</Button>
    </DialogContent>
  </Dialog>
)}
```

### Toggle UI State (Dark Mode, Sidebar, etc.)

```ts
// Tool definition:
{
  type: "function",
  name: "toggleDarkMode",
  description: "Toggle between light and dark mode.",
  parameters: { type: "object", properties: {}, required: [] },
}

// Handler:
case "toggleDarkMode": {
  const isDark = document.documentElement.classList.toggle("dark");
  return { success: true, message: `Switched to ${isDark ? "dark" : "light"} mode` };
}
```

### Create / Update Records (CRUD)

Use `createCrudTools` to auto-generate tool definitions from a schema, then handle them in `onToolCall`.

```ts
// Tool definitions (generates createTask, updateTask tools):
...createCrudTools({
  table: "tasks",
  fields: {
    title: "string",
    priority: { type: "string", enum: ["low", "medium", "high"] },
    done: "boolean",
  },
  operations: ["create", "update"],
  requiredFields: ["title"],
})

// Handler:
case "createTask": {
  // Call your backend - Convex mutation, API route, tRPC, etc.
  const id = await createTask(args as { title: string; priority?: string });
  return { success: true, message: `Created task: ${args.title}` };
}
case "updateTask": {
  await updateTask(args as { id: string; done?: boolean });
  return { success: true, message: `Updated task` };
}
```

### Change Theme / Accent Color

```ts
// Tool definition:
{
  type: "function",
  name: "changeTheme",
  description: "Change the UI accent color. Accepts any CSS color (e.g. 'blue', '#ff6b35', 'rgb(0,128,0)').",
  parameters: {
    type: "object",
    properties: {
      color: { type: "string", description: "CSS color value" },
    },
    required: ["color"],
  },
}

// Handler:
case "changeTheme": {
  const color = args.color as string;
  document.documentElement.style.setProperty("--accent", color);
  return { success: true, message: `Changed accent color to ${color}` };
}
```

### Disconnect via Voice Command

```ts
// Tool definition:
{
  type: "function",
  name: "disconnect",
  description: 'Stop listening. Use when user says "stop", "goodbye", "I\'m done".',
  parameters: { type: "object", properties: {}, required: [] },
}

// Handler:
case "disconnect":
  setTimeout(() => disconnect(), 1500); // delay lets goodbye audio start
  return { success: true, message: "Disconnecting" };
```

### Server-Side Tool Execution (Fallback)

For tools that need backend access (database writes, API calls), you can handle them server-side via the adapter instead of in `onToolCall`:

```ts
// In your adapter:
const adapter: VoxReactorAdapter = {
  getRealtimeToken: async (provider) => { ... },
  executeAction: async (tool, params) => {
    // This runs when onToolCall doesn't handle a tool
    const res = await fetch("/api/voice-action", {
      method: "POST",
      body: JSON.stringify({ tool, params }),
    });
    return res.json(); // must return ToolResult
  },
};
```

The library tries `onToolCall` first. If it's not defined or doesn't handle the tool, it falls back to `adapter.executeAction`.

---

## Common Patterns

### VoiceBar in Root Layout

**Always put your VoiceBar in the root layout**, not individual pages. Otherwise the WebRTC connection drops on every navigation.

```tsx
// app/layout.tsx
export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <Providers>
          {children}
          <VoiceBar />  {/* Persists across all pages */}
        </Providers>
      </body>
    </html>
  );
}
```

### Use `<Link>` Not `<a>`

Regular `<a href>` tags cause full page reloads which kill the WebRTC connection. Always use Next.js `<Link>` (or your framework's equivalent) for client-side navigation.

### Text Input Fallback

`sendTextMessage(text)` lets users type when they can't speak. The AI responds the same way — with audio and tool calls.

### Writing Good Tool Descriptions

The AI decides which tool to call based on the `description` field. Be specific:

```ts
// Bad - too vague, AI won't know when to use it:
description: "Do something with the UI"

// Good - clear trigger phrases:
description: 'Show a confirmation dialog. Use for delete confirmations, important actions, etc.'

// Good - explicit synonyms help voice recognition:
description: 'Stop listening. Use when user says "stop", "goodbye", "I\'m done", "shut up".'
```

### System Instructions Tips

Your `systemInstructions` string shapes how the AI uses your tools. Include:

```ts
const systemInstructions = `You are a voice assistant for [MyApp].

Available tools:
- navigate: Go to pages (/, /dashboard, /settings)
- createTask: Create a new task
- showToast: Show notifications
- disconnect: Stop the voice session

Rules:
- Keep responses SHORT (1-2 sentences)
- ALWAYS call a tool when the user gives a command
- Confirm actions after completing them
- When the user says "goodbye" or "stop", call disconnect`;
```

Listing the tools explicitly in instructions helps the AI use them more reliably than relying on the tool descriptions alone.

## Development

```bash
pnpm install
pnpm build           # Build all packages
pnpm dev             # Watch mode for all packages
pnpm typecheck       # TypeScript validation

# Run the demo app
cd apps/demo
cp .env.local.example .env.local  # Add your API keys
pnpm dev                           # http://localhost:3005
```

## Project Structure

```
vox-reactor/
├── packages/
│   ├── core/src/
│   │   ├── audio/         # VadEngine, mic-selector, recorder, pcm-codec, playback
│   │   ├── providers/     # OpenAI WebRTC, xAI WebSocket, ProviderManager
│   │   ├── conversation/  # ConversationHistory, ToolExecutor, types
│   │   ├── realtime/      # Unified event handler
│   │   └── idle/          # IdleDetector
│   └── react/src/
│       ├── context/       # VoxReactorProvider
│       ├── hooks/         # useRealtimeVoice, useVadVoice, useIdleCoaching, useConversation
│       └── helpers/       # createNavigationTool, createCrudTools
└── apps/
    └── demo/              # Reference Next.js app (copy/adapt the VoiceBar)
```
