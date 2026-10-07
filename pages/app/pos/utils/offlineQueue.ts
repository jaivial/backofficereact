/**
 * Offline queue for the POS sell screen.
 *
 * A restaurant cellar or terrace routinely has no usable network. Losing an
 * order because of that is not acceptable, so the till keeps ringing lines and
 * holds them here until the connection returns.
 *
 * Two rules make this safe rather than a source of double charges:
 *
 *  1. Only mutations that carry an idempotency key are queued. Every POST the
 *     till writes carries one, and the server has a unique index on
 *     (restaurant_id, idempotency_key), so a replay of the same entry is a
 *     no-op that returns the current state instead of a second line or a second
 *     payment. Money movement (checkout, drawer, cash-day close) is deliberately
 *     NOT queued: the operator has to be told there is no connection rather than
 *     believing money moved when it did not.
 *  2. Entries replay strictly in order and stop at the first failure. A later
 *     entry may depend on an earlier one (add line, then void that line), so
 *     replaying out of order could apply a void to a line that does not exist
 *     yet. A failed entry is kept and the queue is paused, so nothing is lost.
 */

export type POSQueuedRequest = {
  /** Client-generated idempotency key; also the dedupe identity. */
  idempotencyKey: string;
  /** Path relative to /api/admin/pos, e.g. "/tickets/12/lines". */
  path: string;
  method: string;
  /** Parsed JSON body; always an object so it survives localStorage. */
  body: Record<string, unknown>;
  /** Epoch millis the waiter rang it, for the operator-facing age. */
  queuedAt: number;
  /** Attempts so far; the UI shows this so a stuck entry is visible. */
  attempts: number;
};

const STORAGE_KEY = "villacarmen.pos.offlineQueue.v1";

/** Storage surface the queue needs; injectable so tests and SSR stay honest. */
export type POSOfflineStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function defaultStorage(): POSOfflineStorage | null {
  if (typeof window === "undefined" || !window.localStorage) return null;
  return window.localStorage;
}

function parseEntries(raw: string | null): POSQueuedRequest[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // A queue entry from an older build may be missing fields; dropping the
    // malformed ones is better than replaying a request with no body.
    return parsed.filter((entry): entry is POSQueuedRequest => Boolean(entry) && typeof (entry as POSQueuedRequest).idempotencyKey === "string" && typeof (entry as POSQueuedRequest).path === "string" && typeof (entry as POSQueuedRequest).body === "object");
  } catch {
    return [];
  }
}

/**
 * Per-terminal queue of POS writes waiting for the network. One instance is
 * shared by the whole sell screen; it notifies subscribers on every change so
 * the offline banner can render pending/attempt state without polling.
 */
export class POSOfflineQueue {
  private entries: POSQueuedRequest[] = [];
  private storage: POSOfflineStorage | null;
  private listeners = new Set<(entries: POSQueuedRequest[]) => void>();
  private flushing = false;

  constructor(storage?: POSOfflineStorage | null) {
    this.storage = storage === undefined ? defaultStorage() : storage;
    this.entries = parseEntries(this.storage?.getItem(STORAGE_KEY) ?? null);
  }

  subscribe(listener: (entries: POSQueuedRequest[]) => void): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  private persist(): void {
    this.storage?.setItem(STORAGE_KEY, JSON.stringify(this.entries));
    for (const listener of this.listeners) listener(this.entries);
  }

  /** Entries waiting to replay, oldest first. The slice is a copy. */
  list(): POSQueuedRequest[] {
    return [...this.entries];
  }

  get size(): number {
    return this.entries.length;
  }

  /**
   * Adds a write to the queue. Re-queuing the same idempotency key is a no-op:
   * the key means "this exact intent", so a retry while offline must not ring it
   * up twice. Returns true when it was stored (including as a duplicate no-op).
   */
  enqueue(entry: Omit<POSQueuedRequest, "queuedAt" | "attempts"> & { queuedAt?: number; attempts?: number }): boolean {
    if (this.entries.some((existing) => existing.idempotencyKey === entry.idempotencyKey)) return true;
    this.entries = [...this.entries, {
      idempotencyKey: entry.idempotencyKey,
      path: entry.path,
      method: entry.method,
      body: entry.body ?? {},
      queuedAt: entry.queuedAt ?? Date.now(),
      attempts: entry.attempts ?? 0,
    }];
    this.persist();
    return true;
  }

  /** Number of seconds since an entry was rung, for the "waiting 5 min" label. */
  ageSeconds(entry: POSQueuedRequest, now = Date.now()): number {
    return Math.max(0, Math.round((now - entry.queuedAt) / 1000));
  }

  /**
   * Replays queued writes in order using the supplied sender. Stops at the
   * first failure and keeps that entry plus everything after it, so a transient
   * error does not reorder the operator's work. Resolves with how many entries
   * were successfully sent.
   */
  async flush(send: (entry: POSQueuedRequest) => Promise<void>): Promise<number> {
    if (this.flushing) return 0;
    this.flushing = true;
    let sent = 0;
    try {
      while (this.entries.length) {
        const [head, ...rest] = this.entries;
        try {
          await send(head);
        } catch {
          // Keep the failing entry at the head with its attempt count bumped, so
          // the waiter can see something is stuck rather than a silent stall.
          this.entries = [{ ...head, attempts: head.attempts + 1 }, ...rest];
          this.persist();
          break;
        }
        this.entries = rest;
        sent += 1;
        this.persist();
      }
    } finally {
      this.flushing = false;
    }
    return sent;
  }

  /** Drops an entry the operator gave up on. Used only by an explicit retry/drop UI. */
  remove(idempotencyKey: string): void {
    const next = this.entries.filter((entry) => entry.idempotencyKey !== idempotencyKey);
    if (next.length === this.entries.length) return;
    this.entries = next;
    this.persist();
  }

  clear(): void {
    if (!this.entries.length) return;
    this.entries = [];
    this.persist();
  }
}

/** True when the browser says the device is offline. SSR-safe. */
export function posBrowserOffline(): boolean {
  if (typeof navigator === "undefined" || typeof navigator.onLine !== "boolean") return false;
  return !navigator.onLine;
}
