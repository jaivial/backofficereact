/**
 * Which POS writes may be held while the network is down.
 *
 * The rule is not "offline is fine" but "offline is fine exactly when the
 * server can recognise the replay". Every queued request must carry an
 * idempotencyKey that the server already dedupes on, and it must be a write the
 * waiter intends to make anyway. Anything involving money, a drawer, a cash
 * day or an approval is refused offline so the operator sees the truth.
 */

export type POSOfflineDecision = "queue" | "reject";

const QUEUEABLE_METHODS = new Set(["POST", "PATCH", "PUT", "DELETE"]);

/**
 * Paths that must never be replayed from a queue: taking money, opening a
 * drawer, closing or opening a cash day, changing a PIN, and anything settings
 * or catalog related (a stale product price must not be written on reconnect).
 */
const NEVER_QUEUE_PATHS = [
  "/checkout",
  "/drawer/open",
  "/cash-days",
  "/shifts/",
  "/pin",
  "/settings",
  "/refunds",
  "/merge",
  "/recall",
  "/kitchen-dispatches",
  "/courses/fire",
  // Naming a check is presentational and cheap to retype; queuing it would
  // mean a guest name silently appearing minutes later on the wrong check.
  "/guest-label",
];

function normalizePath(path: string): string {
  return path.startsWith("/api/admin/pos") ? path.slice("/api/admin/pos".length) : path;
}

/**
 * Decides what to do with one POS request while the device is offline.
 *
 * A request is queueable only when all of the following hold, and the reason is
 * returned so the caller can tell the operator *why* it cannot be held:
 *  - it is a write (GET while offline simply fails; there is nothing to defer)
 *  - its JSON body carries a non-empty idempotencyKey
 *  - its path is not in the never-queue list above
 */
export function offlineDecision(path: string, method: string, body: unknown): POSOfflineDecision {
  const verb = (method || "GET").toUpperCase();
  if (!QUEUEABLE_METHODS.has(verb)) return "reject";
  const relative = normalizePath(path);
  if (NEVER_QUEUE_PATHS.some((fragment) => relative.includes(fragment))) return "reject";
  if (!body || typeof body !== "object") return "reject";
  const key = (body as { idempotencyKey?: unknown }).idempotencyKey;
  if (typeof key !== "string" || key.trim() === "") return "reject";
  return "queue";
}

/**
 * The message shown when a write cannot be held. It has to name the missing
 * connection, not blame the operator, because in a cellar with no signal that
 * is exactly what happened.
 */
export function offlineRejectMessage(path: string): string {
  const relative = normalizePath(path);
  if (relative.includes("/checkout")) return "Sin conexi\u00f3n: no se puede cobrar. El cobro necesita el TPV\u2019\u2019s\u2019; espera a que vuelva la red o cobra en otra terminal.";
  if (relative.includes("drawer/open")) return "Sin conexi\u00f3n: no se puede abrir el caj\u00f3n.";
  if (relative.includes("cash-days")) return "Sin conexi\u00f3n: el d\u00eda de caja necesita el servidor.";
  if (relative.includes("shifts/")) return "Sin conexi\u00f3n: el turno necesita el servidor.";
  if (relative.includes("pin")) return "Sin conexi\u00f3n: el PIN se guarda en el servidor.";
  return "Sin conexi\u00f3n: esta acci\u00f3n necesita el servidor.";
}
