import { useCallback, useRef } from "react";

/**
 * Reusable command guard for POS mutations: one idempotency key per user
 * intent, reused on retry, and no concurrent execution of the same command.
 * Successful runs clear the key so the next intent gets a fresh one; failures
 * keep it so a retry is idempotent.
 */
export function usePOSCommand() {
  const inFlight = useRef(new Set<string>());
  const keys = useRef(new Map<string, string>());

  const isInFlight = useCallback((command: string) => inFlight.current.has(command), []);

  const keyFor = useCallback((command: string) => {
    const existing = keys.current.get(command);
    if (existing) return existing;
    const key = crypto.randomUUID();
    keys.current.set(command, key);
    return key;
  }, []);

  const clear = useCallback((command: string) => { keys.current.delete(command); }, []);

  const run = useCallback(async <T,>(command: string, fn: (key: string) => Promise<T>): Promise<T | undefined> => {
    if (inFlight.current.has(command)) return undefined;
    inFlight.current.add(command);
    try {
      const result = await fn(keyFor(command));
      keys.current.delete(command);
      return result;
    } finally {
      inFlight.current.delete(command);
    }
  }, [keyFor]);

  return { isInFlight, keyFor, clear, run };
}
