#!/usr/bin/env node
/**
 * Regression Test Runner
 *
 * Runs all regression checks in order (fast to slow), failing fast on any error:
 *   1. data-testid lint (interactive elements must have selectors)
 *   2. E2E smoke tests (desktop only, critical user journeys)
 *   3. E2E full suite (optional, gated by --full flag)
 *
 * Usage:
 *   node scripts/regression.js          # linter + smoke
 *   node scripts/regression.js --full   # linter + smoke + full E2E
 *   node scripts/regression.js --smoke-only  # only smoke tests, skip linter
 *   node scripts/regression.js --ci     # CI mode (fail-fast, no retries)
 *
 * Exit code 0 = all pass, exit code 1 = failures found.
 */

import { spawnSync } from "child_process";
import { existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

// ─── Config ──────────────────────────────────────────────────────────────────

const STEPS = [
  {
    name: "data-testid Lint (Critical Paths)",
    description: "Verify interactive elements have data-testid in login, comida, and UI components",
    run: () => runNodeScript("scripts/check-data-testid.js", ["pages/login", "pages/app/comida", "ui"]),
  },
  {
    name: "TypeScript Check",
    description: "Verify no type errors",
    run: () => runCommand("bunx", ["tsc", "--noEmit"], { cwd: ROOT }),
  },
  {
    name: "Unit Tests",
    description: "Run Vitest unit tests",
    run: () => runCommand("bunx", ["vitest", "run"], { cwd: ROOT }),
  },
  {
    name: "E2E Smoke Tests",
    description: "Run critical path E2E tests (desktop only)",
    run: () => runCommand("npx", ["playwright", "test", "--project=chromium", "--grep=@smoke"], { cwd: ROOT, timeout: 300_000 }),
  },
];

const FULL_STEPS = [
  ...STEPS,
  {
    name: "E2E Full Suite",
    description: "Run all E2E tests across all viewports",
    run: () => runCommand("npx", ["playwright", "test"], { cwd: ROOT, timeout: 600_000 }),
  },
];

// ─── Runner ──────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const isFull = args.includes("--full");
const isSmokeOnly = args.includes("--smoke-only");
const isCI = args.includes("--ci");

const steps = isFull ? FULL_STEPS : isSmokeOnly ? STEPS.slice(3) : STEPS;

console.log("╔══════════════════════════════════════════════════════════╗");
console.log("║         BACKOFFICE REGRESSION TEST SUITE                 ║");
console.log("╚══════════════════════════════════════════════════════════╝");
console.log("");
console.log(`Mode: ${isFull ? "FULL (linter + typecheck + unit + smoke + full E2E)" : isSmokeOnly ? "SMOKE ONLY (E2E smoke tests only)" : "STANDARD (linter + typecheck + unit + smoke)"}`);
console.log(`CI: ${isCI ? "yes" : "no"}`);
console.log(`Steps: ${steps.length}`);
console.log("");

const results = [];
let allPassed = true;

for (let i = 0; i < steps.length; i++) {
  const step = steps[i];
  console.log(`\n${"─".repeat(60)}`);
  console.log(`[${i + 1}/${steps.length}] ${step.name}`);
  console.log(`    ${step.description}`);
  console.log(`${"─".repeat(60)}`);

  const start = Date.now();
  const result = step.run();
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);

  const passed = result.status === 0;
  results.push({ name: step.name, passed, elapsed });

  if (passed) {
    console.log(`\n  ✅ PASSED (${elapsed}s)`);
  } else {
    console.error(`\n  ❌ FAILED (${elapsed}s)`);
    allPassed = false;

    if (isCI) {
      console.error("\n  CI mode: failing fast. Remaining steps skipped.");
      break;
    }
  }
}

// ─── Summary ─────────────────────────────────────────────────────────────────

console.log(`\n${"═".repeat(60)}`);
console.log("  REGRESSION TEST RESULTS");
console.log(`${"═".repeat(60)}`);

for (const r of results) {
  const icon = r.passed ? "✅" : "❌";
  console.log(`  ${icon} ${r.name.padEnd(25)} ${r.elapsed.padStart(6)}s`);
}

console.log(`${"═".repeat(60)}`);

if (allPassed) {
  console.log("\n  ✅ ALL CHECKS PASSED");
  console.log(`${"═".repeat(60)}\n`);
  process.exit(0);
} else {
  const failed = results.filter((r) => !r.passed).map((r) => r.name);
  console.error(`\n  ❌ ${failed.length} CHECK(S) FAILED:`);
  for (const f of failed) console.error(`    - ${f}`);
  console.log("");
  process.exit(1);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function runCommand(cmd, args, opts = {}) {
  return spawnSync(cmd, args, {
    stdio: "inherit",
    cwd: opts.cwd || ROOT,
    timeout: opts.timeout || 120_000,
    env: { ...process.env, CI: isCI ? "1" : process.env.CI },
  });
}

function runNodeScript(scriptPath, scriptArgs = []) {
  const fullPath = join(ROOT, scriptPath);
  if (!existsSync(fullPath)) {
    console.error(`  Script not found: ${fullPath}`);
    return { status: 1 };
  }
  return runCommand("node", [fullPath, ...scriptArgs]);
}
