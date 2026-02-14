// ═══════════════════════════════════════════════════════════
// Activity-Based Idle Timeout
// Monitors user activity and fires callback when idle
// ═══════════════════════════════════════════════════════════

export interface IdleDetectorConfig {
  /** How long before triggering idle callback (ms) */
  timeoutMs: number;
  /** DOM events to treat as activity */
  activityEvents?: string[];
}

const DEFAULT_ACTIVITY_EVENTS = [
  "mousemove",
  "mousedown",
  "keydown",
  "touchstart",
  "scroll",
];

export class IdleDetector {
  private config: IdleDetectorConfig;
  private onIdle: () => void;
  private timerId: ReturnType<typeof setTimeout> | null = null;
  private hasTriggered = false;
  private active = false;
  private busy = false;

  private boundReset: () => void;
  private events: string[];

  constructor(config: IdleDetectorConfig, onIdle: () => void) {
    this.config = config;
    this.onIdle = onIdle;
    this.events = config.activityEvents ?? DEFAULT_ACTIVITY_EVENTS;
    this.boundReset = this.reset.bind(this);
  }

  start(): void {
    if (this.active) return;
    this.active = true;
    this.hasTriggered = false;

    for (const event of this.events) {
      window.addEventListener(event, this.boundReset, { passive: true });
    }

    this.scheduleTimer();
  }

  stop(): void {
    this.active = false;

    if (this.timerId) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }

    for (const event of this.events) {
      window.removeEventListener(event, this.boundReset);
    }

    this.hasTriggered = false;
  }

  /** Call when the system is busy (speaking, processing) to pause idle detection */
  setBusy(busy: boolean): void {
    this.busy = busy;
    if (!busy && this.active) {
      this.reset();
    }
  }

  private reset(): void {
    if (this.timerId) {
      clearTimeout(this.timerId);
    }
    this.hasTriggered = false;
    this.scheduleTimer();
  }

  private scheduleTimer(): void {
    if (!this.active || this.busy) return;

    this.timerId = setTimeout(() => {
      if (!this.hasTriggered && this.active && !this.busy) {
        this.hasTriggered = true;
        this.onIdle();
      }
    }, this.config.timeoutMs);
  }
}
