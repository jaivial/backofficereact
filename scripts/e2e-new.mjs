#!/usr/bin/env node
/**
 * Scaffold a new Playwright E2E spec wired to the mega-fixture.
 *
 *   node scripts/e2e-new.mjs <area/name> [--no-factory]
 *   bun run e2e:new reservas/my-feature
 *
 * - <area/name>  : "reservas/my-feature" → e2e/specs/reservas/my-feature.spec.ts
 * - --no-factory : omit the bookingFactory import/usage
 *
 * Refuses to overwrite an existing file. Prints the created path.
 */
import * as fs from "node:fs";
import * as path from "node:path";

const args = process.argv.slice(2);
const noFactory = args.includes("--no-factory");
const slug = args.filter((a) => !a.startsWith("--"))[0];

function fail(msg) {
  console.error(`✗ ${msg}`);
  console.error('Usage: bun run e2e:new <area/name> [--no-factory]');
  process.exit(1);
}

if (!slug) fail("Missing <area/name> argument (e.g. reservas/my-feature).");
if (!/^[a-z0-9][a-z0-9/_-]*$/i.test(slug)) fail(`Invalid slug "${slug}". Use letters, digits, "-", "/" only.`);

const parts = slug.split("/").filter(Boolean);
const name = parts[parts.length - 1];
if (!name) fail(`Could not derive a name from "${slug}".`);

const specsRoot = path.resolve(process.cwd(), "e2e/specs");
const relDir = parts.slice(0, -1).join("/");
const dir = relDir ? path.join(specsRoot, relDir) : specsRoot;
const file = path.join(dir, `${name}.spec.ts`);

if (fs.existsSync(file)) fail(`Already exists: ${path.relative(process.cwd(), file)}`);

const describeName = name
  .split(/[-_]/)
  .filter(Boolean)
  .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
  .join(" ");

const template = `import { test, expect, routes } from "../../fixtures/session";
import { captureConsole, assertNoCriticalErrors } from "../../helpers/console";
import { waitForHydration, waitForLoadingToFinish } from "../../helpers/wait";

// Available fixtures (all auto-cleanup on test end):
//   adminPage, session, api,
//   bookingFactory, comidaFactory, menuFactory,
//   stockItemFactory, warehouseFactory, stockCategoryFactory,
//   posProductFactory, posCategoryFactory, posVisitFactory,
//   scheduleFactory, compensationFactory

test.describe("${describeName}", () => {
  test("loads without console errors", async ({ adminPage${noFactory ? "" : ", api"} }) => {
    const consoleCapture = captureConsole(adminPage);

    // Navigate to the page under test (adjust the route).
    await adminPage.goto(routes.dashboard);
    await waitForHydration(adminPage);
    await waitForLoadingToFinish(adminPage);

    // TODO: replace with real assertions. Prefer data-testid selectors.
    await expect(adminPage).toHaveURL(/\\/app/);

    // No unhandled console errors / page errors.
    const { hasErrors } = assertNoCriticalErrors(consoleCapture);
    expect(hasErrors).toBeFalsy();
  });
});
`;

fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(file, template, "utf-8");

console.log(`✓ Created ${path.relative(process.cwd(), file)}`);
console.log(`  Run: bunx playwright test ${path.relative(process.cwd(), file)}`);
