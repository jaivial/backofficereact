#!/usr/bin/env node
/**
 * Linter: Enforce data-testid on every interactive/semantic HTML element in .tsx files.
 *
 * Usage: node scripts/check-data-testid.js [path...]
 *   node scripts/check-data-testid.js                    # scan all pages/ and ui/
 *   node scripts/check-data-testid.js pages/login/       # scan specific dir
 *
 * Exit code 0 = all pass, exit code 1 = violations found.
 */

import { readFileSync, readdirSync, statSync, existsSync } from "fs";
import { join, extname } from "path";

// ─── Elements that MUST have data-testid ─────────────────────────────────────
const REQUIRED_ELEMENTS = new Set([
  "button", "input", "select", "textarea", "a", "form",
  "nav", "aside", "main", "section", "article", "header", "footer",
]);

// Elements that SHOULD have data-testid (warn, not fail)
const RECOMMENDED_ELEMENTS = new Set([
  "div", "span", "ul", "ol", "li", "h1", "h2", "h3", "h4", "h5", "h6",
  "p", "label", "table", "thead", "tbody", "tr", "td", "th",
]);

// Elements to skip entirely (decorative/structural or self-closing without content)
const SKIP_ELEMENTS = new Set([
  "br", "hr", "meta", "link", "style", "script", "noscript",
  "path", "circle", "rect", "line", "polyline", "polygon", "ellipse",
  "g", "svg", "use", "defs", "clipPath", "mask", "pattern",
]);

// ─── Collect .tsx files ──────────────────────────────────────────────────────

function collectFiles(dir, files = []) {
  if (!existsSync(dir)) return files;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (["node_modules", "dist", ".next", "build", "test-results"].includes(entry)) continue;
      collectFiles(full, files);
    } else if (extname(full) === ".tsx") {
      files.push(full);
    }
  }
  return files;
}

// ─── Check a single file ────────────────────────────────────────────────────

function checkFile(filePath) {
  const content = readFileSync(filePath, "utf-8");
  const lines = content.split("\n");
  const violations = [];
  const warnings = [];

  // Track brace depth to know when we're inside a JSX expression
  const TAG_OPEN_RE = /^[\s]*<(button|input|select|textarea|a|form|nav|aside|main|section|article|header|footer|div|span|ul|ol|li|h[1-6]|p|label|img|option|table|thead|tbody|tr|td|th)\b/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const tagMatch = TAG_OPEN_RE.exec(line);
    if (!tagMatch) continue;

    const tagName = tagMatch[1].toLowerCase();
    if (SKIP_ELEMENTS.has(tagName)) continue;

    // Collect the full tag text (may span multiple lines)
    // Track JSX expression depth: { } and stop when we hit > or />
    let braceDepth = 0;
    let tagText = line;
    let isComplete = false;

    // Check if tag closes on this line
    if (line.includes("/>") || /\bdata-testid=/.test(line)) {
      // Might be complete, but need to verify
      for (let j = i; j < lines.length && !isComplete; j++) {
        const checkLine = lines[j];
        for (let k = (j === i ? 0 : 0); k < checkLine.length; k++) {
          const ch = checkLine[k];
          if (ch === "{") braceDepth++;
          else if (ch === "}") braceDepth--;
          else if (ch === ">" && braceDepth === 0 && (k === 0 || checkLine[k-1] !== "/")) {
            isComplete = true;
            break;
          }
          else if (ch === "/" && k + 1 < checkLine.length && checkLine[k+1] === ">" && braceDepth === 0) {
            isComplete = true;
            break;
          }
        }
        if (!isComplete && j < lines.length - 1) {
          tagText += "\n" + lines[j + 1];
        }
      }
    } else {
      // Tag continues on next lines
      for (let j = i + 1; j < lines.length && !isComplete; j++) {
        tagText += "\n" + lines[j];
        for (let k = 0; k < lines[j].length; k++) {
          const ch = lines[j][k];
          if (ch === "{") braceDepth++;
          else if (ch === "}") braceDepth--;
          else if (ch === "/" && k + 1 < lines[j].length && lines[j][k+1] === ">" && braceDepth === 0) {
            isComplete = true;
            break;
          }
          else if (ch === ">" && braceDepth === 0 && (k === 0 || lines[j][k-1] !== "/" && lines[j][k-1] !== "=")) {
            // Handle standalone > in JSX like: disabled={busy}
            // Only count as close if it's not inside {}
            isComplete = true;
            break;
          }
        }
      }
    }

    // Check if the tag text contains data-testid, data-role, data-ui, or data-slot
    if (/\bdata-testid=|\bdata-role=|\bdata-ui=|\bdata-slot=/.test(tagText)) continue;

    const attrsPreview = tagText.replace(/\n\s*/g, " ").slice(0, 100).trim();
    const context = `<${tagName} ${attrsPreview}`;

    if (REQUIRED_ELEMENTS.has(tagName)) {
      violations.push({ file: filePath, line: i + 1, tag: tagName, context });
    } else if (RECOMMENDED_ELEMENTS.has(tagName)) {
      warnings.push({ file: filePath, line: i + 1, tag: tagName, context });
    }
  }

  return { violations, warnings };
}

// ─── Main ────────────────────────────────────────────────────────────────────

const dirs = process.argv.slice(2);
const scanDirs = dirs.length > 0 ? dirs : ["pages", "ui"];

const allFiles = scanDirs.flatMap((d) => collectFiles(d));

if (allFiles.length === 0) {
  console.log("No .tsx files found in:", scanDirs.join(", "));
  process.exit(0);
}

console.log(`Scanning ${allFiles.length} .tsx files...\n`);

let totalErrors = 0;
let totalWarnings = 0;

for (const file of allFiles) {
  const { violations, warnings } = checkFile(file);
  totalErrors += violations.length;
  totalWarnings += warnings.length;

  for (const v of violations) {
    console.error(`  ❌ ${v.file}:${v.line}  <${v.tag}> missing data-testid`);
    console.error(`     ${v.context}`);
  }
  for (const w of warnings) {
    console.warn(`  ⚠️  ${w.file}:${w.line}  <${w.tag}> missing data-testid (recommended)`);
  }
}

console.log(`\n${allFiles.length} files scanned.`);
console.log(`  ${totalErrors} errors   (interactive elements without data-testid)`);
console.log(`  ${totalWarnings} warnings (structural elements without data-testid)`);

if (totalErrors > 0) {
  console.error("\n❌ FAIL: Fix the errors above. Every interactive element must have data-testid.");
  process.exit(1);
}

if (totalWarnings > 0) {
  console.warn("\n⚠️  WARN: Consider adding data-testid to structural elements for better e2e coverage.");
}

console.log("\n✅ PASS: All interactive elements have data-testid attributes.");
process.exit(0);
