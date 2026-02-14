import { VoiceBar } from "./voice-bar";

export default function Home() {
  return (
    <main style={{ padding: "40px 20px", paddingBottom: "200px" }}>
      <h1 style={{ fontSize: "32px", fontWeight: 700, marginBottom: "8px" }}>
        Vox Reactor Demo
      </h1>
      <p style={{ color: "var(--muted)", marginBottom: "32px" }}>
        Voice control library for React apps. Click the mic button below to
        start.
      </p>

      <div
        style={{
          background: "var(--card-bg)",
          borderRadius: "12px",
          padding: "24px",
          border: "1px solid var(--border)",
          marginBottom: "20px",
        }}
      >
        <h2
          style={{ fontSize: "18px", fontWeight: 600, marginBottom: "12px" }}
        >
          Try these voice commands:
        </h2>
        <ul
          style={{
            listStyle: "none",
            display: "grid",
            gap: "8px",
            color: "var(--muted)",
          }}
        >
          <li>&quot;Go to settings&quot;</li>
          <li>&quot;Navigate to the about page&quot;</li>
          <li>&quot;Show a success toast that says hello&quot;</li>
          <li>&quot;Change the theme color to blue&quot;</li>
          <li>&quot;Create a note called Shopping List&quot;</li>
          <li>&quot;Go home&quot;</li>
        </ul>
      </div>

      <nav style={{ display: "flex", gap: "16px" }}>
        <a href="/about">About</a>
        <a href="/settings">Settings</a>
      </nav>

      <VoiceBar />
    </main>
  );
}
