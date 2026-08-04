import { describe, expect, it } from "vitest";

import config from "./+config";

describe("Vike client page context", () => {
  it("does not serialize server request cookies", () => {
    expect(config.passToClient).toEqual(["bo"]);
  });
});
