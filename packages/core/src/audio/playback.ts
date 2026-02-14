// ═══════════════════════════════════════════════════════════
// Audio Queue Playback via WebAudio
// Queues PCM audio chunks and plays them sequentially
// ═══════════════════════════════════════════════════════════

export type PlaybackListener = (playing: boolean) => void;

export class AudioQueuePlayer {
  private queue: Float32Array[] = [];
  private isPlaying = false;
  private ctx: AudioContext;
  private sampleRate: number;
  private listeners = new Set<PlaybackListener>();

  constructor(ctx: AudioContext, sampleRate = 24000) {
    this.ctx = ctx;
    this.sampleRate = sampleRate;
  }

  enqueue(audioData: Float32Array): void {
    this.queue.push(audioData);
    this.drain();
  }

  private async drain(): Promise<void> {
    if (this.isPlaying || this.queue.length === 0) return;

    this.isPlaying = true;
    this.notify(true);

    while (this.queue.length > 0) {
      const audioData = this.queue.shift()!;
      const buffer = this.ctx.createBuffer(1, audioData.length, this.sampleRate);
      buffer.getChannelData(0).set(audioData);

      const source = this.ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(this.ctx.destination);

      await new Promise<void>((resolve) => {
        source.onended = () => resolve();
        source.start();
      });
    }

    this.isPlaying = false;
    this.notify(false);
  }

  /** Interrupt playback and clear the queue */
  flush(): void {
    this.queue = [];
    this.isPlaying = false;
    this.notify(false);
  }

  get playing(): boolean {
    return this.isPlaying;
  }

  onPlaybackChange(listener: PlaybackListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(playing: boolean): void {
    for (const listener of this.listeners) {
      listener(playing);
    }
  }
}
