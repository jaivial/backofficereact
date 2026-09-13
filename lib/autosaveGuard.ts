/**
 * Reusable autosave guard.
 *
 * Coordination id: autosave_local_edit_guard_v1
 *
 * Debounced autosaves have two systemic failure modes that every editor page
 * (menus, dishes, invoices, ads, ...) was hitting:
 *
 *  1. The save *echo* (server response / WS reconcile) is written straight back
 *     into state, so any keystroke the operator made while the request was in
 *     flight is rolled back to the value the server had at snapshot time.
 *  2. Empty values are treated as "no change" (filtered out, defaulted or
 *     dropped from the payload), so clearing a field never sticks and the old
 *     text reappears on the next reconcile.
 *
 * The primitive below is a per-field three-way merge:
 *   base   = value that was sent to the server (the snapshot)
 *   local  = the value the operator holds right now
 *   server = the value the server echoed back
 *
 * If the operator changed the field after the snapshot, `local` wins and the
 * server echo is ignored. Otherwise the server value is canonical. Empty
 * strings are first-class values, never coerced to a default.
 */

/**
 * Three-way merge for a single text field (the primitive the editors share).
 * `local` wins whenever it moved away from the snapshot; a whitespace-only
 * change still in progress is not rolled back by the trimmed server echo.
 */
export function mergeEditedText(base: string | undefined, local: string, server: string): string {
  if (base === undefined) return local;
  if (base !== local) return local;
  if (local !== server && local.trim() === server.trim()) return local;
  return server;
}

/**
 * Three-way merge for id-keyed lists (ad content, CTAs, dynamic rows...).
 * Server items keep the local copy when the operator changed it after the
 * snapshot; items added locally during the save are kept too.
 */
export function mergeIdList<T extends { id: string }>(base: T[], local: T[], server: T[]): T[] {
  const baseById = new Map(base.map((item) => [item.id, item]));
  const localById = new Map(local.map((item) => [item.id, item]));
  const serverIds = new Set(server.map((item) => item.id));
  const merged = server.map((serverItem) => {
    const localItem = localById.get(serverItem.id);
    if (!localItem) return serverItem;
    const baseItem = baseById.get(serverItem.id) ?? localItem;
    return JSON.stringify(baseItem) === JSON.stringify(localItem) ? serverItem : localItem;
  });
  for (const localItem of local) {
    if (!serverIds.has(localItem.id) && !baseById.has(localItem.id)) merged.push(localItem);
  }
  return merged;
}
