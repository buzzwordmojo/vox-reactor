import { VoiceBar } from "../voice-bar";

export default function About() {
  return (
    <main style={{ padding: "40px 20px", paddingBottom: "200px" }}>
      <h1 style={{ fontSize: "32px", fontWeight: 700, marginBottom: "8px" }}>
        About
      </h1>
      <p style={{ color: "var(--muted)", marginBottom: "24px" }}>
        Vox Reactor is a hooks-only voice control library for React.
      </p>

      <div
        style={{
          background: "var(--card-bg)",
          borderRadius: "12px",
          padding: "24px",
          border: "1px solid var(--border)",
        }}
      >
        <h2
          style={{ fontSize: "18px", fontWeight: 600, marginBottom: "12px" }}
        >
          Features
        </h2>
        <ul
          style={{
            listStyle: "disc",
            paddingLeft: "20px",
            color: "var(--muted)",
            display: "grid",
            gap: "6px",
          }}
        >
          <li>OpenAI Realtime API via WebRTC</li>
          <li>xAI Realtime API via WebSocket</li>
          <li>VAD (Voice Activity Detection) engine</li>
          <li>Automatic provider fallback</li>
          <li>Conversation history with pub/sub</li>
          <li>Tool execution framework</li>
          <li>Idle detection / proactive coaching</li>
          <li>Barge-in support</li>
        </ul>
      </div>

      <nav style={{ marginTop: "24px", display: "flex", gap: "16px" }}>
        <a href="/">Home</a>
        <a href="/settings">Settings</a>
      </nav>

      <VoiceBar />
    </main>
  );
}
