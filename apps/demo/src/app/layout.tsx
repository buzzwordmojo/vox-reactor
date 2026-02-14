import type { Metadata } from "next";
import { Toaster } from "sonner";
import { Providers } from "./providers";
import { VoiceBar } from "./voice-bar";
import "./globals.css";

export const metadata: Metadata = {
  title: "Vox Reactor Demo",
  description: "Voice control library demo",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Providers>
          {children}
          <VoiceBar />
          <Toaster position="top-right" theme="dark" />
        </Providers>
      </body>
    </html>
  );
}
