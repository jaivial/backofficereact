import { describe, expect, it, vi } from "vitest";

import { POSOfflineQueue } from "./offlineQueue";
import { offlineDecision, offlineRejectMessage } from "./offlinePolicy";

/** In-memory Storage stand-in so the test never touches a real browser. */
function memoryStorage(seed: Record<string, string> = {}): Storage {
  const map = new Map(Object.entries(seed));
  return {
    get length() { return map.size; },
    clear: () => map.clear(),
    getItem: (key: string) => map.get(key) ?? null,
    key: (index: number) => [...map.keys()][index] ?? null,
    removeItem: (key: string) => { map.delete(key); },
    setItem: (key: string, value: string) => { map.set(key, value); },
  };
}

describe("POSOfflineQueue", () => {
  it("keeps entries in order and survives a reload", () => {
    const storage = memoryStorage();
    const queue = new POSOfflineQueue(storage);
    queue.enqueue({ idempotencyKey: "a", path: "/tickets/1/lines", method: "POST", body: { idempotencyKey: "a" } });
    queue.enqueue({ idempotencyKey: "b", path: "/tickets/1/lines", method: "POST", body: { idempotencyKey: "b" } });
    expect(queue.list().map((entry) => entry.idempotencyKey)).toEqual(["a", "b"]);

    const reloaded = new POSOfflineQueue(storage);
    expect(reloaded.list().map((entry) => entry.idempotencyKey)).toEqual(["a", "b"]);
  });

  it("ignores a replay of the same key so an offline retry does not ring twice", () => {
    const queue = new POSOfflineQueue(memoryStorage());
    queue.enqueue({ idempotencyKey: "a", path: "/tickets/1/lines", method: "POST", body: { idempotencyKey: "a" } });
    queue.enqueue({ idempotencyKey: "a", path: "/tickets/1/lines", method: "POST", body: { idempotencyKey: "a" } });
    expect(queue.size).toBe(1);
  });

  it("replays in order and stops at the first failure, keeping the rest", async () => {
    const queue = new POSOfflineQueue(memoryStorage());
    queue.enqueue({ idempotencyKey: "a", path: "/x", method: "POST", body: { idempotencyKey: "a" } });
    queue.enqueue({ idempotencyKey: "b", path: "/x", method: "POST", body: { idempotencyKey: "b" } });
    queue.enqueue({ idempotencyKey: "c", path: "/x", method: "POST", body: { idempotencyKey: "c" } });

    const seen: string[] = [];
    const sent = await queue.flush(async (entry) => {
      seen.push(entry.idempotencyKey);
      if (entry.idempotencyKey === "b") throw new Error("network still down");
    });
    expect(seen).toEqual(["a", "b"]);
    expect(sent).toBe(1);
    // "b" stays at the head with its attempt count, "c" keeps its place behind it.
    expect(queue.list().map((entry) => entry.idempotencyKey)).toEqual(["b", "c"]);
    expect(queue.list()[0].attempts).toBe(1);
  });

  it("drains fully once the network is back", async () => {
    const queue = new POSOfflineQueue(memoryStorage());
    for (const key of ["a", "b", "c"]) queue.enqueue({ idempotencyKey: key, path: "/x", method: "POST", body: { idempotencyKey: key } });
    const send = vi.fn(async () => {});
    expect(await queue.flush(send)).toBe(3);
    expect(send).toHaveBeenCalledTimes(3);
    expect(queue.size).toBe(0);
  });

  it("notifies subscribers and survives a corrupted storage payload", () => {
    const storage = memoryStorage({ "villacarmen.pos.offlineQueue.v1": "{not json" });
    const queue = new POSOfflineQueue(storage);
    expect(queue.list()).toEqual([]);
    const listener = vi.fn();
    queue.subscribe(listener);
    queue.enqueue({ idempotencyKey: "a", path: "/x", method: "POST", body: { idempotencyKey: "a" } });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(queue.list()).toHaveLength(1);
  });
});

describe("offlineDecision", () => {
  it("queues a write that carries an idempotency key", () => {
    expect(offlineDecision("/tickets/7/lines", "POST", { idempotencyKey: "k1" })).toBe("queue");
  });

  it("refuses reads and writes with no idempotency key", () => {
    expect(offlineDecision("/tickets/7", "GET", undefined)).toBe("reject");
    expect(offlineDecision("/tickets/7/lines", "POST", { productId: 3 })).toBe("reject");
    expect(offlineDecision("/tickets/7/lines", "POST", { idempotencyKey: "  " })).toBe("reject");
  });

  it("never queues money, drawer, cash-day, shift or PIN writes", () => {
    expect(offlineDecision("/tickets/7/checkout", "POST", { idempotencyKey: "k" })).toBe("reject");
    expect(offlineDecision("/drawer/open", "POST", { idempotencyKey: "k" })).toBe("reject");
    expect(offlineDecision("/cash-days/3/close", "POST", { idempotencyKey: "k" })).toBe("reject");
    expect(offlineDecision("/shifts/2/close", "POST", { idempotencyKey: "k" })).toBe("reject");
    expect(offlineDecision("/pin", "POST", { idempotencyKey: "k" })).toBe("reject");
  });

  it("explains the refusal in the operator's language", () => {
    expect(offlineRejectMessage("/tickets/7/checkout")).toContain("no se puede cobrar");
    expect(offlineRejectMessage("/drawer/open")).toContain("caj\u00f3n");
  });
});
