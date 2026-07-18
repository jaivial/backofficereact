import { describe, expect, it } from "vitest";

import { deriveState, qrToSrc } from "./WhatsAppConnection";

describe("qrToSrc", () => {
  it("passes through data URLs", () => {
    expect(qrToSrc("data:image/png;base64,AAAA")).toBe("data:image/png;base64,AAAA");
  });
  it("wraps raw base64", () => {
    expect(qrToSrc("AAAA")).toBe("data:image/png;base64,AAAA");
  });
});

describe("deriveState", () => {
  it("detects missing subscription", () => {
    expect(deriveState({ code: "NEEDS_SUBSCRIPTION" })).toBe("not_subscribed");
  });
  it("detects connected", () => {
    expect(deriveState({ connected: true })).toBe("connected");
  });
  it("detects pending when a QR is present", () => {
    expect(deriveState({ connected: false, connection: { status: "connecting", connected: false, qr: "x" } })).toBe("pending");
  });
  it("detects pending when a pair code is present", () => {
    expect(deriveState({ connected: false, connection: { status: "pending", connected: false, pair_code: "123456" } })).toBe("pending");
  });
  it("falls back to disconnected", () => {
    expect(deriveState({ connected: false, connection: { status: "disconnected", connected: false } })).toBe("disconnected");
  });
});
