import { describe, it, expect } from "vitest";
import { execSync } from "node:child_process";

// Regression guard: vike crawls every git-tracked script file whose basename
// starts with "+" (e.g. `+data.ts`) and loads it as a route/value file. A
// `+data.test.ts` would therefore be imported during SSR and crash the page
// with a 500 (a test importing `vitest` throws at import time). Never allow
// test/spec files to use the "+" prefix.
describe("vike crawl safety", () => {
  it("no +*.test.* / +*.spec.* files are tracked", () => {
    const files = execSync("git ls-files", { encoding: "utf8" }).split("\n").filter(Boolean);
    const offenders = files.filter((f) => {
      const base = f.split("/").pop() ?? "";
      return base.startsWith("+") && (base.includes(".test.") || base.includes(".spec."));
    });
    expect(offenders).toEqual([]);
  });
});
