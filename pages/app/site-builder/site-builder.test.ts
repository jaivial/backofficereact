import { describe, expect, it } from "vitest";

import { editorUrl } from "./site-builder";

describe("editorUrl", () => {
  it("targets the active restaurant", () => {
    expect(editorUrl(343)).toBe("https://editor-dev.menustudioai.com/admin/site?rid=343");
  });

  it("encodes the restaurant id as a query value", () => {
    expect(editorUrl(0)).toContain("?rid=0");
  });
});
