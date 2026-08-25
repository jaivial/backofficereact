/**
 * Default VIKE_CRAWL config used by `server/index.ts`.
 *
 * - The test/spec patterns prevent vike from importing test files during SSR
 *   (a test importing `vitest` throws "Vitest failed to access its internal
 *   state", which Vike surfaces as a 500).
 * - The build pattern keeps Vike from treating its own transpilation temp
 *   files (e.g. `pages/+config.ts.build-efd4f537bd4e.mjs`) as config files.
 *   When those files linger on disk across container restarts or build hash
 *   mismatches, the chokidar watcher fires reload events on them, the
 *   `unlink` of the new build artifact races with the watcher, and the dev
 *   server returns 500 for every page request.
 */
export function defaultVikeCrawl(): { ignore: string[] } {
  return {
    ignore: [
      "**/*.test.*",
      "**/*.spec.*",
      "**/+*.build-*.mjs",
    ],
  };
}
