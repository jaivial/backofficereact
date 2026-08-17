import { describe, expect, it } from "vitest";

import { readSetCookies } from "./readSetCookies";

describe("readSetCookies", () => {
  it("preserves separate getSetCookie values", () => {
    const headers = new Headers();
    Object.defineProperty(headers, "getSetCookie", {
      value: () => ["bo_session=one; Path=/", "tracking=two; Path=/"],
    });

    expect(readSetCookies(headers)).toEqual(["bo_session=one; Path=/", "tracking=two; Path=/"]);
  });

  it("splits a combined fallback without splitting Expires commas", () => {
    const headers = new Headers({
      "set-cookie": "bo_session=one; Expires=Wed, 21 Oct 2030 07:28:00 GMT; Path=/, tracking=two; Path=/",
    });

    expect(readSetCookies(headers)).toEqual([
      "bo_session=one; Expires=Wed, 21 Oct 2030 07:28:00 GMT; Path=/",
      "tracking=two; Path=/",
    ]);
  });
});
