// ═══════════════════════════════════════════════════════════
// MediaRecorder Pipeline with Auto-Recreation
// Records audio chunks, produces Blobs, auto-creates new
// recorder after each stop (MediaRecorder can't restart)
// ═══════════════════════════════════════════════════════════

export interface RecorderEvents {
  onAudioReady: (blob: Blob) => void;
  onError: (error: string) => void;
  /** Called when audio was too short to be useful */
  onTooShort?: () => void;
}

/** Minimum audio size in bytes (WebM header alone is ~200 bytes) */
const MIN_AUDIO_SIZE = 1000;

export class AudioRecorder {
  private recorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private stream: MediaStream;
  private events: RecorderEvents;
  private recording = false;

  constructor(stream: MediaStream, events: RecorderEvents) {
    this.stream = stream;
    this.events = events;
    this.recorder = this.createRecorder();
  }

  get isRecording(): boolean {
    return this.recording;
  }

  start(): void {
    if (this.recording) return;
    if (!this.recorder || this.recorder.state !== "inactive") {
      // Recreate if needed
      this.recorder = this.createRecorder();
    }

    this.recording = true;
    this.chunks = [];
    this.recorder.start(100); // Capture every 100ms
  }

  stop(): void {
    if (!this.recording) return;
    this.recording = false;

    if (this.recorder && this.recorder.state === "recording") {
      this.recorder.stop();
    }
  }

  /** Cancel current recording without processing */
  cancel(): void {
    this.recording = false;
    this.chunks = [];
    if (this.recorder && this.recorder.state === "recording") {
      this.recorder.stop();
    }
  }

  dispose(): void {
    this.cancel();
    this.recorder = null;
  }

  private createRecorder(): MediaRecorder {
    const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : "audio/webm";

    const recorder = new MediaRecorder(this.stream, { mimeType });

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        this.chunks.push(event.data);
      }
    };

    recorder.onstop = () => {
      if (this.chunks.length > 0) {
        const blob = new Blob(this.chunks, { type: "audio/webm" });

        if (blob.size >= MIN_AUDIO_SIZE) {
          this.events.onAudioReady(blob);
        } else if (blob.size > 0) {
          this.events.onTooShort?.();
        }
      }

      // Reset chunks and auto-create new recorder for next utterance
      this.chunks = [];
      if (this.stream.active) {
        this.recorder = this.createRecorder();
      }
    };

    recorder.onerror = () => {
      this.events.onError("Recording error");
    };

    return recorder;
  }
}
