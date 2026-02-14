"use client";

import { useEffect, useRef } from "react";
import { IdleDetector } from "@vox-reactor/core";

// ═══════════════════════════════════════════════════════════
// useIdleCoaching Hook
// Wraps IdleDetector for React lifecycle
// ═══════════════════════════════════════════════════════════

export interface UseIdleCoachingOptions {
  /** Whether the voice session is active */
  isActive: boolean;
  /** Whether the system is busy (speaking, processing) */
  isBusy: boolean;
  /** Idle timeout in ms (default: 30000) */
  timeoutMs?: number;
  /** Callback when idle timeout fires */
  onIdle: () => void;
}

export function useIdleCoaching({
  isActive,
  isBusy,
  timeoutMs = 30_000,
  onIdle,
}: UseIdleCoachingOptions): void {
  const detectorRef = useRef<IdleDetector | null>(null);
  const onIdleRef = useRef(onIdle);
  onIdleRef.current = onIdle;

  useEffect(() => {
    if (!isActive) {
      detectorRef.current?.stop();
      detectorRef.current = null;
      return;
    }

    const detector = new IdleDetector(
      { timeoutMs },
      () => onIdleRef.current()
    );
    detectorRef.current = detector;
    detector.start();

    return () => {
      detector.stop();
    };
  }, [isActive, timeoutMs]);

  useEffect(() => {
    detectorRef.current?.setBusy(isBusy);
  }, [isBusy]);
}
