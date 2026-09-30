// Forky observational helper â the local stand-in for Cortex's `sageObserve`.
// Named observational points of the chat surfaces log here with the shared
// coordination id, so the frontend checkpoints of the assistant grep as ONE
// trail. Coordination id: FORKY-ADMIN-TOOLS-S01 (forky.admin.thread).
export const FORKY_OBS_PREFIX = "[forky:observe]";
export const FORKY_COORD = "FORKY-ADMIN-TOOLS-S01";

/** Named observational point of a chat surface (`forky.admin.thread`, ...). */
export function forkyObserve(checkpoint: string, ctx?: Record<string, unknown>): void {
  try {
    console.info(FORKY_OBS_PREFIX, checkpoint, JSON.stringify({ coord: FORKY_COORD, ...(ctx ?? {}) }));
  } catch { /* circular/absent console - never break the UI for a log line */ }
}
