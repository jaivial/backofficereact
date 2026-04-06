import { useEffect, useState } from "react";

/**
 * Provides a tick value that updates every second.
 * Used for elapsed time display in fichaje.
 */
export function useTimerTick(shouldTick: boolean): number {
  const [tick, setTick] = useState(() => Date.now());

  useEffect(() => {
    if (!shouldTick) return;
    const timer = window.setInterval(() => setTick(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [shouldTick]);

  return tick;
}
