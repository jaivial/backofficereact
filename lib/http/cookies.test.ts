import { describe, expect, it } from "vitest";

import { filterBOSessionCookie, filterBOSessionSetCookies, sessionCacheKey } from "./cookies";

describe("filterBOSessionCookie", () => {
  it("forwards only bo_session", () => {
    expect(filterBOSessionCookie("bo_theme=light; bo_session=secret-token; analytics=abc")).toBe(
      "bo_session=secret-token",
    );
  });

  it("returns undefined without bo_session", () => {
    expect(filterBOSessionCookie("bo_theme=dark; analytics=abc")).toBeUndefined();
  });

  it("ignores malformed cookie encoding", () => {
    expect(filterBOSessionCookie("broken=%E0%A4%A; bo_session=safe-token")).toBe("bo_session=safe-token");
  });
});

describe("filterBOSessionSetCookies", () => {
  it("keeps only bo_session response cookies", () => {
    expect(
      filterBOSessionSetCookies([
        "tracking=1; Path=/",
        "bo_session=token; Path=/; HttpOnly; Secure",
      ]),
    ).toEqual(["bo_session=token; Path=/; HttpOnly; Secure"]);
  });
});

describe("sessionCacheKey", () => {
  it("creates a stable sha256 key without retaining token", () => {
    const key = sessionCacheKey("secret-token");
    expect(key).toMatch(/^[a-f0-9]{64}$/);
    expect(key).not.toContain("secret-token");
    expect(sessionCacheKey("secret-token")).toBe(key);
    expect(sessionCacheKey("another-token")).not.toBe(key);
  });
});
