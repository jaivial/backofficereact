#!/usr/bin/env node
/**
 * Auto-add data-testid to structural elements that have warnings but no errors.
 * Strategy:
 *   - <div> → data-slot="{component}-{role}"
 *   - <span> → data-slot="{component}-{role}"
 *   - <label> → data-slot="{component}-{role}"
 *   - <p>, <h1-h6> → data-slot="{component}-{role}"
 *   - <table>, <thead>, <tbody>, <tr>, <td>, <th> → data-slot="{component}-{role}"
 *   - <ul>, <li>, <ol> → data-slot="{component}-{role}"
 *
 * Usage: node scripts/add-structural-testids.js [path...]
 */

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from "fs";
import { join, extname, basename, dirname, relative } from "path";

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

// ─── Derive component name from file path ────────────────────────────────────

function getComponentName(filePath) {
  const rel = filePath.replace(/.*\/backoffice\//, "");
  // Use directory name or file name
  const dir = basename(dirname(filePath));
  const file = basename(filePath, ".tsx");
  if (file === "+Page" || file === "index") {
    return dir.replace(/^[A-Z]/, (c) => c.toLowerCase());
  }
  return file.replace(/^[A-Z]/, (c) => c.toLowerCase()).replace(/\+/g, "");
}

// ─── Add data-testid to a line ───────────────────────────────────────────────

function addTestIdToLine(line, componentName, tagIndex) {
  // Only process lines with HTML tags (not JSX components starting with uppercase)
  const tagMatch = line.match(/^(\s*)<(div|span|label|p|h[1-6]|table|thead|tbody|tr|td|th|ul|ol|li)\b/i);
  if (!tagMatch) return line;

  // Skip if already has any data-* attribute
  if (/\bdata-testid=|\bdata-role=|\bdata-ui=|\bdata-slot=/.test(line)) return line;

  const [, indent, tagName] = tagMatch;
  const tagLower = tagName.toLowerCase();

  // Build a meaningful role from context
  const trimmed = line.trim();
  let role = tagLower;

  // Try to extract role from aria-label, className, or content
  const ariaMatch = trimmed.match(/aria-label="([^"]+)"/);
  if (ariaMatch) {
    role = ariaMatch[1].toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 20);
  } else {
    const classMatch = trimmed.match(/className="([^"]*)"/);
    if (classMatch) {
      // Extract last meaningful class part
      const classes = classMatch[1].split(" ");
      const lastClass = classes[classes.length - 1] || "";
      const clean = lastClass.replace(/^(bo-|is-|--)/, "").split("-").slice(0, 3).join("-");
      if (clean) role = clean;
    } else {
      // Try to extract text content
      const textMatch = trimmed.match(/>[^<]*([A-Za-z]{3,})[^<]*</);
      if (textMatch) {
        role = textMatch[1].toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 15);
      }
    }
  }

  // Insert data-slot before closing >
  const testId = `data-slot="${componentName}-${role}"`;

  // Find the position to insert (before the closing > or />)
  // Must be careful not to insert inside attribute values
  let insertPos = -1;
  let depth = 0;
  let inString = false;
  let stringChar = "";

  for (let i = tagMatch[0].length; i < line.length; i++) {
    const ch = line[i];
    if (inString) {
      if (ch === stringChar && line[i - 1] !== "\\") inString = false;
    } else {
      if (ch === '"' || ch === "'") {
        inString = true;
        stringChar = ch;
      } else if (ch === "{" ) {
        depth++;
      } else if (ch === "}") {
        depth--;
      } else if (ch === ">" && depth === 0) {
        insertPos = i;
        break;
      }
    }
  }

  if (insertPos > 0) {
    return line.slice(0, insertPos) + ` ${testId}` + line.slice(insertPos);
  }

  return line;
}

// ─── Process a file ──────────────────────────────────────────────────────────

function processFile(filePath) {
  const content = readFileSync(filePath, "utf-8");
  const componentName = getComponentName(filePath);
  const lines = content.split("\n");
  let modified = false;
  let changes = 0;

  const newLines = lines.map((line) => {
    const result = addTestIdToLine(line, componentName, 0);
    if (result !== line) {
      modified = true;
      changes++;
    }
    return result;
  });

  if (modified) {
    writeFileSync(filePath, newLines.join("\n"), "utf-8");
  }

  return { modified, changes };
}

// ─── Main ────────────────────────────────────────────────────────────────────

const dirs = process.argv.slice(2);
const scanDirs = dirs.length > 0 ? dirs : ["pages", "ui"];

const allFiles = scanDirs.flatMap((d) => collectFiles(d));

if (allFiles.length === 0) {
  console.log("No .tsx files found in:", scanDirs.join(", "));
  process.exit(0);
}

console.log(`Processing ${allFiles.length} .tsx files...\n`);

let totalModified = 0;
let totalChanges = 0;

for (const file of allFiles) {
  const { modified, changes } = processFile(file);
  if (modified) {
    totalModified++;
    totalChanges += changes;
    console.log(`  ✓ ${relative(process.cwd(), file)} (+${changes})`);
  }
}

console.log(`\n${totalModified} files modified, ${totalChanges} data-slot attributes added.`);
