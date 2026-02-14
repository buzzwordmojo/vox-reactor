// ═══════════════════════════════════════════════════════════
// VAD (Voice Activity Detection) Engine
// Extracted from use-voice-assistant.ts
// ═══════════════════════════════════════════════════════════

export interface VadConfig {
  /** Threshold for detecting speech start (0-100 RMS scale). Lower = more sensitive. */
  speechThreshold: number;
  /** Higher threshold for barge-in (interrupting TTS). Must speak louder to interrupt. */
  bargeInThreshold: number;
  /** Volume must drop below this to count as silence. */
  silenceThreshold: number;
  /** How long silence must persist before stopping (ms). */
  silenceDuration: number;
  /** Minimum speech duration before processing (ms). */
  minSpeechDuration: number;
  /** How often to check audio levels (ms). */
  checkInterval: number;
}

export const DEFAULT_VAD_CONFIG: VadConfig = {
  speechThreshold: 35,
  bargeInThreshold: 55,
  silenceThreshold: 28,
  silenceDuration: 2000,
  minSpeechDuration: 300,
  checkInterval: 50,
};

export type VadEvent =
  | { type: "speech_start" }
  | { type: "speech_end"; duration: number }
  | { type: "barge_in" }
  | { type: "level"; volume: number; peak: number };

export class VadEngine {
  private analyser: AnalyserNode;
  private config: VadConfig;
  private onEvent: (event: VadEvent) => void;

  private intervalId: ReturnType<typeof setInterval> | null = null;
  private dataArray: Uint8Array<ArrayBuffer>;

  // VAD state
  private speaking = false;
  private speechStartTime = 0;
  private silenceStartTime = 0;
  private ttsActive = false;

  constructor(
    analyser: AnalyserNode,
    config: Partial<VadConfig>,
    onEvent: (event: VadEvent) => void
  ) {
    this.analyser = analyser;
    this.config = { ...DEFAULT_VAD_CONFIG, ...config };
    this.onEvent = onEvent;
    this.dataArray = new Uint8Array(analyser.fftSize) as Uint8Array<ArrayBuffer>;
  }

  start(): void {
    if (this.intervalId) return;

    this.intervalId = setInterval(() => {
      this.tick();
    }, this.config.checkInterval);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.speaking = false;
    this.silenceStartTime = 0;
  }

  setTtsActive(active: boolean): void {
    this.ttsActive = active;
  }

  dispose(): void {
    this.stop();
  }

  private tick(): void {
    this.analyser.getByteTimeDomainData(this.dataArray);

    // Calculate peak and RMS volume
    let maxPeak = 0;
    let sumSquares = 0;
    for (let i = 0; i < this.dataArray.length; i++) {
      const v = Math.abs(this.dataArray[i]! - 128);
      if (v > maxPeak) maxPeak = v;
      const normalized = (this.dataArray[i]! - 128) / 128;
      sumSquares += normalized * normalized;
    }
    const rms = Math.sqrt(sumSquares / this.dataArray.length);
    const volume = Math.min(100, rms * 200);

    // Emit level events (consumers can use for waveform visualization)
    this.onEvent({ type: "level", volume, peak: maxPeak });

    const now = Date.now();
    const threshold = this.ttsActive
      ? this.config.bargeInThreshold
      : this.config.speechThreshold;

    if (volume > threshold) {
      if (!this.speaking) {
        // Barge-in detection
        if (this.ttsActive) {
          this.onEvent({ type: "barge_in" });
        }

        this.speaking = true;
        this.speechStartTime = now;
        this.silenceStartTime = 0;
        this.onEvent({ type: "speech_start" });
      } else {
        // Still speaking - reset silence timer
        this.silenceStartTime = 0;
      }
    } else if (volume < this.config.silenceThreshold) {
      if (this.speaking) {
        if (this.silenceStartTime === 0) {
          this.silenceStartTime = now;
        }

        const silenceDuration = now - this.silenceStartTime;
        const speechDuration = now - this.speechStartTime;

        if (
          silenceDuration >= this.config.silenceDuration &&
          speechDuration >= this.config.minSpeechDuration
        ) {
          this.speaking = false;
          this.silenceStartTime = 0;
          this.onEvent({ type: "speech_end", duration: speechDuration });
        }
      }
    } else {
      // Volume between thresholds - reset silence timer if speaking
      if (this.speaking) {
        this.silenceStartTime = 0;
      }
    }
  }
}
