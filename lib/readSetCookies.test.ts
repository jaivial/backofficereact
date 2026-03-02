import { describe, expect, it } from "vitest";

import { readSetCookies } from "./http/readSetCookies";

describe("readSetCookies", () => {
  it("falls back to header value when getSetCookie returns empty", () => {
    const headers = new Headers();
    headers.set("set-cookie", "bo_session=abc123; Path=/; HttpOnly");
    (headers as any).getSetCookie = () => [];

    expect(readSetCookies(headers)).toEqual(["bo_session=abc123; Path=/; HttpOnly"]);
  });
});
