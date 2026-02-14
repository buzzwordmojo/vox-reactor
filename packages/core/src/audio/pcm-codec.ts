// ═══════════════════════════════════════════════════════════
// PCM16 <-> Float32 Conversion
// Used by xAI WebSocket provider (audio sent as base64 PCM16)
// ═══════════════════════════════════════════════════════════

/**
 * Convert Float32Array audio samples to base64-encoded PCM16
 */
export function float32ToBase64Pcm16(float32Array: Float32Array): string {
  const pcm16 = new Int16Array(float32Array.length);
  for (let i = 0; i < float32Array.length; i++) {
    const s = Math.max(-1, Math.min(1, float32Array[i]!));
    pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  const bytes = new Uint8Array(pcm16.buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

/**
 * Convert base64-encoded PCM16 to Float32Array audio samples
 */
export function base64Pcm16ToFloat32(base64: string): Float32Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const pcm16 = new Int16Array(bytes.buffer);
  const float32 = new Float32Array(pcm16.length);
  for (let i = 0; i < pcm16.length; i++) {
    float32[i] = pcm16[i]! / (pcm16[i]! < 0 ? 0x8000 : 0x7fff);
  }
  return float32;
}
