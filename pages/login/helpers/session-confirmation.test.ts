import { describe, expect, it, vi } from "vitest";

import { confirmLoginSession } from "./session-confirmation";

describe("confirmLoginSession", () => {
  it("resolves when the first session check succeeds", async () => {
    const me = vi.fn().mockResolvedValue({ success: true, session: { user: {} } });

    await expect(confirmLoginSession(me, { retryDelayMs: 0 })).resolves.toBeUndefined();
    expect(me).toHaveBeenCalledTimes(1);
  });

  it("retries once when the first session check fails", async () => {
    const me = vi
      .fn()
      .mockRejectedValueOnce(new Error("session not visible yet"))
      .mockResolvedValueOnce({ success: true, session: { user: {} } });

    await expect(confirmLoginSession(me, { retryDelayMs: 0 })).resolves.toBeUndefined();
    expect(me).toHaveBeenCalledTimes(2);
  });

  it("rejects a malformed successful response", async () => {
    const me = vi.fn().mockResolvedValue({ success: true });

    await expect(confirmLoginSession(me, { retryDelayMs: 0 })).rejects.toThrow("Session could not be confirmed");
    expect(me).toHaveBeenCalledTimes(2);
  });

  it("rejects after the bounded retry", async () => {
    const error = new Error("unauthorized");
    const me = vi.fn().mockRejectedValue(error);

    await expect(confirmLoginSession(me, { retryDelayMs: 0 })).rejects.toBe(error);
    expect(me).toHaveBeenCalledTimes(2);
  });
});
