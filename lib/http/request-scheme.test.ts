import { describe, expect, it } from "vitest";

import { requestScheme } from "./request-scheme";

describe("requestScheme", () => {
  it("uses the first trusted forwarded protocol value", () => {
    expect(requestScheme({ headers: { "x-forwarded-proto": "https, http" } })).toBe("https");
  });

  it("prefers Cloudflare's public scheme over an internal hop header", () => {
    expect(
      requestScheme({
        headers: {
          "x-forwarded-proto": "http",
          "cf-visitor": '{"scheme":"https"}',
        },
      }),
    ).toBe("https");
  });

  it("uses the encrypted socket for direct TLS requests", () => {
    expect(requestScheme({ headers: {}, socket: { encrypted: true } })).toBe("https");
  });

  it("defaults to http for local plain HTTP", () => {
    expect(requestScheme({ headers: {} })).toBe("http");
  });
});
