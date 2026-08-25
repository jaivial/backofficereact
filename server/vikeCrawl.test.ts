import { describe, expect, it } from "vitest";
import { minimatch } from "minimatch";

import { defaultVikeCrawl } from "./vikeCrawl";

/**
 * Regression guard for the 500 we hit when stale `+*.build-*.mjs` files
 * (left over from previous Vike transpilations) caused the chokidar watcher
 * to fire reload events on them, which then raced with Vike's own
 * writeFileSync/unlinkSync of the new build artifact and produced ENOENT.
 *
 * The fix is to keep `+*.build-*.mjs` in the VIKE_CRAWL.ignore list so Vike
 * does not treat those temp files as routable / config files.
 */
describe("defaultVikeCrawl", () => {
  const ignore = defaultVikeCrawl().ignore;

  const shouldIgnore = (relativePath: string): boolean =>
    ignore.some((pattern) => minimatch(relativePath, pattern));

  it("ignores the canonical +config.ts transpilation temp file", () => {
    expect(shouldIgnore("pages/+config.ts.build-efd4f537bd4e.mjs")).toBe(true);
    expect(shouldIgnore("pages/+config.ts.build-8aa76c265d54.mjs")).toBe(true);
  });

  it("ignores nested temp files inside pages/app/", () => {
    expect(shouldIgnore("pages/app/+Layout.ts.build-abc123def456.mjs")).toBe(true);
  });

  it("still ignores vitest + spec files", () => {
    expect(shouldIgnore("pages/+data.test.ts")).toBe(true);
    expect(shouldIgnore("pages/+config.spec.ts")).toBe(true);
    expect(shouldIgnore("pages/app/+data.test.ts")).toBe(true);
  });

  it("does NOT ignore legitimate + route files", () => {
    // Real + config / + data files must still be crawled by Vike.
    expect(shouldIgnore("pages/+config.ts")).toBe(false);
    expect(shouldIgnore("pages/app/+data.ts")).toBe(false);
    expect(shouldIgnore("pages/index/+Page.tsx")).toBe(false);
  });

  it("does NOT ignore unrelated source files", () => {
    expect(shouldIgnore("pages/foo.bar.ts")).toBe(false);
  });
});
