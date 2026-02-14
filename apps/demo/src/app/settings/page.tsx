import Link from "next/link";

export default function Settings() {
  return (
    <main style={{ padding: "40px 20px", paddingBottom: "200px" }}>
      <h1 style={{ fontSize: "32px", fontWeight: 700, marginBottom: "8px" }}>
        Settings
      </h1>
      <p style={{ color: "var(--muted)", marginBottom: "24px" }}>
        This is the settings page. Try saying &quot;go home&quot; or
        &quot;navigate to about&quot;.
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
          Voice Settings
        </h2>
        <div
          style={{
            display: "grid",
            gap: "12px",
            color: "var(--muted)",
            fontSize: "14px",
          }}
        >
          <div>Provider: OpenAI (WebRTC)</div>
          <div>Voice: Echo</div>
          <div>Idle Timeout: 30s</div>
          <div>Auto-fallback: Disabled</div>
        </div>
      </div>

      <nav style={{ marginTop: "24px", display: "flex", gap: "16px" }}>
        <Link href="/">Home</Link>
        <Link href="/about">About</Link>
      </nav>
    </main>
  );
}
