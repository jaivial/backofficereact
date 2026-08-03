import { useSyncExternalStore } from "react";

/**
 * Forky visual state — a tiny external store driven by the chat adapter and
 * read by the 3D viewer (via useSyncExternalStore). Kept outside assistant-ui
 * so the animation mapping is version-proof and unit-testable.
 */
export type ForkyVisualState = "idle" | "greet" | "talk" | "think" | "happy" | "bend_active";

let state: ForkyVisualState = "idle";
const listeners = new Set<() => void>();

export function setForkyVisualState(next: ForkyVisualState): void {
  if (state === next) return;
  state = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useForkyVisualState(): ForkyVisualState {
  // React requires a third snapshot getter when this hook renders on the
  // server. Without it, SSR throws and protected app routes return HTTP 500.
  return useSyncExternalStore(subscribe, () => state, () => "idle");
}
