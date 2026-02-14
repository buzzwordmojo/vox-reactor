import { NextRequest, NextResponse } from "next/server";

/**
 * Generate an ephemeral OpenAI Realtime API token.
 * This proxies the request so the API key stays server-side.
 */
export async function POST(request: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY not configured" },
      { status: 500 }
    );
  }

  const { provider } = await request.json();

  if (provider === "xai") {
    // For xAI, just return the key directly (it's used as a subprotocol token)
    const xaiKey = process.env.XAI_API_KEY;
    if (!xaiKey) {
      return NextResponse.json(
        { error: "XAI_API_KEY not configured" },
        { status: 500 }
      );
    }
    return NextResponse.json({ token: xaiKey });
  }

  // OpenAI ephemeral token
  try {
    const response = await fetch(
      "https://api.openai.com/v1/realtime/sessions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-realtime-preview-2024-12-17",
          voice: "echo",
        }),
      }
    );

    if (!response.ok) {
      const text = await response.text();
      return NextResponse.json(
        { error: `OpenAI error: ${response.status} - ${text}` },
        { status: 500 }
      );
    }

    const data = await response.json();
    return NextResponse.json({ token: data.client_secret?.value ?? data.token });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Failed to generate token",
      },
      { status: 500 }
    );
  }
}
