/**
 * extract-bui-island-css.mjs
 *
 * Generates components/styles/features/forky/forky-bui-island.css — the
 * scoped stylesheet that lets the literal beautifului.dev components in
 * ui/forky/bui/ render exactly as on beautifului.dev, without the backoffice
 * global styles interfering and without leaking anything back out.
 *
 * How it works:
 *   1. Reads the verbatim component sources and collects every utility /
 *      custom class name they use.
 *   2. Reads beautifului.dev's compiled stylesheet (fetched with curl).
 *   3. Re-emits every matching rule, prefixed under `.bui-scope`, plus the
 *      site's keyframes and the design tokens (dark default, light via
 *      :root[data-theme="light"], matching forky-bui.css convention).
 *   4. Re-emits a second, portal-scoped block for the ToolChips diff preview
 *      (that component portals to document.body, outside any .bui-scope).
 *
 * Usage:
 *   node scripts/extract-bui-island-css.mjs --css /tmp/bui/main.css
 *   node scripts/extract-bui-island-css.mjs   # fetches the live css via curl
 *
 * The generated file is committed; re-run only when the components change.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";
import { globSync } from "node:fs";

const ROOT = path.resolve(import.meta.dirname, "..");
const COMPONENT_DIR = path.join(ROOT, "ui/forky/bui");
const OUT = path.join(ROOT, "components/styles/features/forky/forky-bui-island.css");
const CSS_URL =
  "https://www.beautifului.dev/_next/static/css/687c5d92cdad73f5.css";

/* ── 1. css source ─────────────────────────────────────────── */
const argIdx = process.argv.indexOf("--css");
let cssFile = argIdx !== -1 ? process.argv[argIdx + 1] : null;
if (!cssFile || !existsSync(cssFile)) {
  cssFile = "/tmp/bui-main.css";
  execSync(`curl -sL --max-time 30 ${CSS_URL} -o ${cssFile}`);
}
const css = readFileSync(cssFile, "utf8");

/* ── 2. collect class tokens from the verbatim components ──── */
const files = globSync(path.join(COMPONENT_DIR, "*.tsx")).filter((f) => !f.endsWith(".stories.tsx"));
const tokens = new Set();
for (const file of files) {
  const src = readFileSync(file, "utf8");
  const strings = [
    ...src.matchAll(/"([^"]*)"/g),
    ...src.matchAll(/'([^']*)'/g),
    ...src.matchAll(/`([^`]*)`/g),
  ];
  for (const [, s] of strings) {
    for (const chunk of s.split("${")) {
      for (const t of chunk.split(/\s+/)) {
        if (/^[a-zA-Z][\w:/.()[\]%,#-]*$/.test(t) && /[-:/.[]/.test(t)) tokens.add(t);
      }
    }
  }
}
// classes without dashes/colons that are still utilities used by the components
for (const plain of ["flex", "grid", "relative", "absolute", "fixed", "invisible",
  "truncate", "isolate", "tabular-nums", "font-mono", "inline", "whitespace-pre",
  "select-none", "shrink-0", "overflow-hidden", "items-center", "justify-center"]) {
  if (files.some((f) => readFileSync(f, "utf8").includes(`" ${plain}"`) || readFileSync(f, "utf8").includes(`"${plain}"`) || readFileSync(f, "utf8").includes(`${plain} `))) tokens.add(plain);
}

/* ── 3. parse the stylesheet into rules ────────────────────── */
/** Split a selector list into simple selectors (commas escaped as \, are part of a class). */
const simple = (sel) => sel.split(/(?<!\\),/).map((s) => s.trim()).filter(Boolean);
/** Extract class tokens (unescaped) from a simple selector. */
const classesIn = (sel) => [...sel.matchAll(/\.((?:\\.|[^\s.>+:~[{()])+)/g)].map((m) =>
  m[1].replace(/\\(.)/g, "$1"));
/** Tailwind-style selector escape for a raw class token. */
const esc = (t) => t.replace(/[^\w-]/g, (c) => `\\${c}`);

function parseBlocks(source, media = null, out = []) {
  let i = 0;
  while (i < source.length) {
    const open = source.indexOf("{", i);
    if (open === -1) break;
    const selector = source.slice(i, open).trim();
    // find matching close brace
    let depth = 1, j = open + 1;
    while (j < source.length && depth > 0) {
      if (source[j] === "{") depth++;
      else if (source[j] === "}") depth--;
      j++;
    }
    const body = source.slice(open + 1, j - 1);
    if (selector.startsWith("@keyframes")) {
      out.push({ at: selector, body: `{${body}}`, media });
    } else if (selector.startsWith("@")) {
      // @media / @layer / @supports — recurse, remembering media context
      parseBlocks(body, selector.startsWith("@media") ? selector : media, out);
    } else if (selector) {
      out.push({ selector, body, media });
    }
    i = j;
  }
  return out;
}
const rules = parseBlocks(css);

/* ── 4. pick the rules our classes need ────────────────────── */
const needed = new Set(tokens);
const skipClasses = new Set(["dark"]); // theme ancestor — handled as tokens
const picked = [];
const found = new Set();
for (const rule of rules) {
  if (rule.at) continue;
  const keep = simple(rule.selector).filter((s) => {
    const cls = classesIn(s);
    return cls.length > 0 && cls.every((c) => needed.has(c) && !skipClasses.has(c));
  });
  if (keep.length === 0) continue;
  // drop grouped selectors we did not keep
  for (const c of keep.flatMap(classesIn)) found.add(c);
  picked.push({ ...rule, selector: keep.join(",") });
}

/* ── 5. portal block (ToolChips diff preview → document.body) ─ */
const PORTAL_ROOT_CLASSES = ["fixed", "z-50", "w-72", "overflow-hidden", "rounded-[10px]", "bg-surface", "shadow-overlay"];
const PORTAL_INNER_CLASSES = [
  "flex", "items-center", "justify-between", "border-b", "border-line", "px-2.5",
  "py-1.5", "font-mono", "text-[11px]", "min-w-0", "truncate", "text-ink-2",
  "shrink-0", "tabular-nums", "text-green", "text-red", "py-1", "leading-[1.8]",
  "gap-2", "px-2.5", "whitespace-pre", "bg-green-tint", "bg-red-tint", "w-3",
  "select-none", "rounded-[10px]",
];
const portalNeed = new Set([...PORTAL_ROOT_CLASSES, ...PORTAL_INNER_CLASSES]);
const portalRootNeed = new Set(PORTAL_ROOT_CLASSES);
const portalInnerNeed = new Set(PORTAL_INNER_CLASSES);
/* Root-level classes sit ON the portal div itself → chained selector
 * (`body > div.fixed… .w-72` would only match descendants). */
const portalRootPicked = rules.filter((r) => {
  if (r.at) return false;
  return simple(r.selector).some((s) => {
    const cls = classesIn(s);
    return cls.length > 0 && cls.every((c) => portalRootNeed.has(c));
  });
});
/* Inner classes style the portal's children → descendant selector. */
const portalInnerPicked = rules.filter((r) => {
  if (r.at) return false;
  return simple(r.selector).some((s) => {
    const cls = classesIn(s);
    return cls.length > 0 && cls.every((c) => portalInnerNeed.has(c));
  });
});
const portalRootSel = `body > div.${PORTAL_ROOT_CLASSES.map((c) => esc(c)).join(".")}`;

/* ── 6. keyframes ──────────────────────────────────────────── */
const KEYFRAMES = ["pop-in", "fade-up", "fade-in", "stream-in", "eq-bounce", "pixel-on", "shimmer-text"];
const keyframeCss = rules
  .filter((r) => r.at && KEYFRAMES.some((k) => r.at === `@keyframes ${k}`))
  .map((r) => `${r.at} ${r.body}`)
  .join("\n\n");

/* ── 7. undefined var audit ────────────────────────────────── */
const varRefs = new Set();
for (const r of [...picked, ...portalRootPicked, ...portalInnerPicked]) {
  for (const m of r.body.matchAll(/var\((--[\w-]+)/g)) varRefs.add(m[1]);
  for (const m in {}) void m;
}
const TOKENS_DEFINED = new Set([
  "--canvas","--surface","--inset","--hover","--hover-2","--ink","--ink-2","--ink-3",
  "--line","--line-strong","--field","--accent","--accent-ink","--accent-tint",
  "--green","--green-tint","--orange","--orange-tint","--red","--red-tint",
  "--tooltip-bg","--tooltip-fg","--tooltip-muted","--tooltip-border",
  "--radius-card","--radius-chip","--radius-control",
  "--shadow-hairline","--shadow-btn","--shadow-card","--shadow-raised","--shadow-overlay",
  "--ease-link","--ease-out-strong","--default-transition-timing-function",
  "--default-transition-duration","--shadow-xs","--shadow-sm","--shadow-md","--shadow-lg",
  "--font-mono-face","--ease-out","--ease-in-out","--ink-3",
  "--spacing","--aspect-video","--color-white","--leading-relaxed",
  "--font-weight-medium","--font-weight-semibold","--font-weight-bold",
]);
const unresolved = [...varRefs].filter((v) => !TOKENS_DEFINED.has(v));

/* ── 8. emit ───────────────────────────────────────────────── */
const indent = (s) => s.replace(/^/gm, "  ").trimEnd();
/* The site relies on global @property initial values for the --tw-* chain
 * variables (shadows, borders, translates). Inside the island we cannot
 * declare @property without touching the host app, so every bare var() gets
 * the same fallback value Tailwind v4 uses as the @property initial-value. */
const TW_FALLBACKS = {
  "--tw-inset-shadow": "0 0 #0000",
  "--tw-inset-ring-shadow": "0 0 #0000",
  "--tw-ring-offset-shadow": "0 0 #0000",
  "--tw-ring-shadow": "0 0 #0000",
  "--tw-shadow": "0 0 #0000",
  "--tw-border-style": "solid",
  "--tw-translate-x": "0",
  "--tw-translate-y": "0",
};
const withFallbacks = (body) =>
  body.replace(/var\((--tw-[a-z-]+)\)/g, (m, name) =>
    TW_FALLBACKS[name] ? `var(${name},${TW_FALLBACKS[name]})` : m);
const prefixRules = (list, prefix, chained = false) =>
  list
    .map((r) => {
      const joiner = chained ? "" : " ";
      const sel = simple(r.selector).map((s) => `${prefix}${joiner}${s}`).join(",\n");
      const body = withFallbacks(r.body).replace(/;\s*/g, ";\n  ").replace(/}\s*/g, "}\n  ");
      const open = r.media ? `${r.media} {\n` : "";
      const close = r.media ? "\n}" : "";
      return `${open}${sel} {\n  ${body.trim()}\n}${close}`;
    })
    .join("\n\n");

const out = `/* AUTO-GENERATED by scripts/extract-bui-island-css.mjs — do not edit by hand.
 *
 * Scoped beautifului.dev styles for the literal components in ui/forky/bui/.
 * Every rule below is prefixed with .bui-scope (the class added by
 * <BuiIsland>), so the backoffice global styles cannot override the
 * components and the components cannot leak into the rest of the app.
 *
 * Regenerate after changing the components:
 *   node scripts/extract-bui-island-css.mjs --css <beautifului.dev main.css>
 *
 * Theme convention (mirrors forky-bui.css): dark tokens are the default,
 * :root[data-theme="light"] flips to the light palette.
 */

/* ── design tokens (dark default) ─────────────────────────── */
.bui-scope {
  --canvas: oklch(23.1% 0.004 264.487);
  --surface: oklch(26% 0.006 271.191);
  --inset: oklch(24.3% 0.004 264.492);
  --hover: oklch(28.9% 0.006 271.22);
  --hover-2: oklch(31.8% 0.007 274.747);
  --ink: oklch(96.4% 0.002 247.839);
  --ink-2: oklch(73.1% 0.008 260.731);
  --ink-3: oklch(54.1% 0.01 264.484);
  --line: oklch(30.8% 0.006 258.354);
  --line-strong: oklch(35.6% 0.007 264.474);
  --field: oklch(29.3% 0.006 271.223);
  --accent: oklch(68% 0.173 253.301);
  --accent-ink: oklch(78.8% 0.113 248.33);
  --accent-tint: oklch(68% 0.173 253.301 / 0.16);
  --green: oklch(70.5% 0.154 153.814);
  --green-tint: oklch(70.5% 0.154 153.814 / 0.14);
  --orange: oklch(74.6% 0.156 55.642);
  --orange-tint: oklch(74.6% 0.156 55.642 / 0.14);
  --red: oklch(66.6% 0.18 21.433);
  --red-tint: oklch(66.6% 0.18 21.433 / 0.14);
  --tooltip-bg: oklch(18.2% 0.004 264.459);
  --tooltip-fg: oklch(96.4% 0.002 247.839);
  --tooltip-muted: oklch(73.1% 0.008 260.731);
  --tooltip-border: oklch(30.8% 0.006 258.354);
  --radius-card: 10px;
  --radius-chip: 6px;
  --radius-control: 8px;
  --shadow-hairline: 0 0 0 1px var(--line);
  --shadow-btn: 0 0 0 1px oklch(100% 0 0 / 0.1), 0 1px 2px oklch(0% 0 0 / 0.3);
  --shadow-card: 0 0 0 1px oklch(100% 0 0 / 0.11), 0 1px 2px oklch(0% 0 0 / 0.2), 0 2px 6px oklch(0% 0 0 / 0.2);
  --shadow-raised: 0 0 0 1px oklch(100% 0 0 / 0.13), 0 2px 10px oklch(0% 0 0 / 0.22);
  --shadow-overlay: 0 0 0 1px oklch(100% 0 0 / 0.15), 0 8px 28px oklch(0% 0 0 / 0.34);
  --ease-out: cubic-bezier(0, 0, 0.2, 1);
  --ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
  --ease-out-strong: cubic-bezier(0.23, 1, 0.32, 1);
  --ease-link: cubic-bezier(0.16, 1, 0.3, 1);
  --default-transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
  --default-transition-duration: 150ms;
  --font-mono-face: ui-monospace, "SF Mono", SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace;
  --spacing: 0.25rem;
  --aspect-video: 16 / 9;
  --color-white: #fff;
  --leading-relaxed: 1.625;
  --font-weight-medium: 500;
  --font-weight-semibold: 600;
  --font-weight-bold: 700;
  color: var(--ink);
  font-family: "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
}

/* ── design tokens (light) ────────────────────────────────── */
:root[data-theme="light"] .bui-scope {
  --canvas: oklch(96.1% 0.002 247.84);
  --surface: oklch(100% 0 0);
  --inset: oklch(97.9% 0.002 247.839);
  --hover: oklch(97% 0.002 247.839);
  --hover-2: oklch(93.3% 0.003 247.86);
  --ink: oklch(24.7% 0.006 258.361);
  --ink-2: oklch(50.6% 0.01 264.477);
  --ink-3: oklch(69.5% 0.009 264.505);
  --line: oklch(94.6% 0.003 264.542);
  --line-strong: oklch(91.2% 0.005 258.326);
  --field: oklch(96.1% 0.001 286.375);
  --accent: oklch(62.6% 0.205 254.947);
  --accent-ink: oklch(55.6% 0.187 255.617);
  --accent-tint: oklch(96% 0.019 252.878);
  --green: oklch(60.3% 0.155 150.883);
  --green-tint: oklch(95.8% 0.017 159.118);
  --orange: oklch(68.9% 0.179 49.902);
  --orange-tint: oklch(96.4% 0.021 67.581);
  --red: oklch(62.1% 0.192 23.042);
  --red-tint: oklch(95.6% 0.017 17.462);
  --tooltip-bg: oklch(27.2% 0.008 264.435);
  --tooltip-fg: oklch(97.6% 0.002 247.839);
  --tooltip-muted: oklch(73.1% 0.008 260.731);
  --tooltip-border: oklch(35.6% 0.007 264.474);
  --shadow-xs: 0 0 4px 0 #0000000a;
  --shadow-sm: 0 18px 47px 0 #00000008, 0 7.5px 19px 0 #00000005, 0 4px 10.5px 0 #00000005, 0 2.3px 5.8px 0 #00000003, 0 1.2px 3.1px 0 #00000003, 0 0.5px 1.3px 0 #00000003;
  --shadow-md: 0 17.54px 23.39px 0 #0000000a, 0 9.4px 12.5px 0 #00000008, 0 5.25px 7px 0 #00000005, 0 2.79px 3.72px 0 -2px #00000003, 0 1.16px 1.5px 0 #00000003;
  --shadow-lg: 0 25px 50px 0 #0000000d, 0 12px 24px 0 #0000000a, 0 6px 12px 0 #00000008, 0 3px 6px 0 #00000005, 0 1.5px 3px 0 #00000005;
  --shadow-hairline: 0 0 0 1px var(--line);
  --shadow-btn: 0 0 0 1px var(--line-strong), var(--shadow-xs);
  --shadow-card: 0 0 0 1px var(--line), var(--shadow-sm);
  --shadow-raised: 0 0 0 1px var(--line), var(--shadow-md);
  --shadow-overlay: 0 0 0 1px var(--line), var(--shadow-lg);
}

/* theme-dependent custom class (dark default on the site is .dark …) */
.bui-scope .source-avatar { box-shadow: 0 0 0 1px oklch(100% 0 0 / 0.08); }
:root[data-theme="light"] .bui-scope .source-avatar { box-shadow: 0 0 0 1px oklch(21% 0.034 263.436 / 0.1); }

/* ── keyframes (literal names — referenced by the components' inline styles) ── */
${keyframeCss}

/* ── scoped utilities + custom classes ────────────────────── */
${prefixRules(picked, ".bui-scope")}

/* ── ToolChips diff preview portal (document.body) ────────── */
/* ToolChips portals its diff preview to document.body, outside any
 * .bui-scope ancestor. The portal root is recognizable by its exact
 * class combo; re-apply the island tokens + the utilities it uses. */
${portalRootSel} {
  --surface: oklch(26% 0.006 271.191);
  --ink: oklch(96.4% 0.002 247.839);
  --ink-2: oklch(73.1% 0.008 260.731);
  --ink-3: oklch(54.1% 0.01 264.484);
  --line: oklch(30.8% 0.006 258.354);
  --line-strong: oklch(35.6% 0.007 264.474);
  --field: oklch(29.3% 0.006 271.223);
  --green: oklch(70.5% 0.154 153.814);
  --green-tint: oklch(70.5% 0.154 153.814 / 0.14);
  --red: oklch(66.6% 0.18 21.433);
  --red-tint: oklch(66.6% 0.18 21.433 / 0.14);
  --shadow-overlay: 0 0 0 1px oklch(100% 0 0 / 0.15), 0 8px 28px oklch(0% 0 0 / 0.34);
  --font-mono-face: ui-monospace, "SF Mono", SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace;
  --spacing: 0.25rem;
  --font-weight-medium: 500;
  --font-weight-semibold: 600;
  --ease-out: cubic-bezier(0, 0, 0.2, 1);
  --ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
  --default-transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
  --default-transition-duration: 150ms;
  color: var(--ink);
  font-family: "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
}
:root[data-theme="light"] ${portalRootSel} {
  --surface: oklch(100% 0 0);
  --ink: oklch(24.7% 0.006 258.361);
  --ink-2: oklch(50.6% 0.01 264.477);
  --ink-3: oklch(69.5% 0.009 264.505);
  --line: oklch(94.6% 0.003 264.542);
  --line-strong: oklch(91.2% 0.005 258.326);
  --field: oklch(96.1% 0.001 286.375);
  --green: oklch(60.3% 0.155 150.883);
  --green-tint: oklch(95.8% 0.017 159.118);
  --red: oklch(62.1% 0.192 23.042);
  --red-tint: oklch(95.6% 0.017 17.462);
  --shadow-overlay: 0 0 0 1px var(--line), 0 25px 50px 0 #0000000d, 0 12px 24px 0 #0000000a, 0 6px 12px 0 #00000008, 0 3px 6px 0 #00000005, 0 1.5px 3px 0 #00000005;
  --spacing: 0.25rem;
  --font-weight-medium: 500;
  --font-weight-semibold: 600;
  --line-strong: oklch(91.2% 0.005 258.326);
}
${prefixRules(portalRootPicked, portalRootSel, true)}
${prefixRules(portalInnerPicked, portalRootSel)}

/* ── reduced motion ───────────────────────────────────────── */
@media (prefers-reduced-motion: reduce) {
  .bui-scope, .bui-scope *, ${portalRootSel}, ${portalRootSel} * {
    transition-duration: 0.01ms !important;
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
  }
}
`;

writeFileSync(OUT, out);

/* ── 9. report ─────────────────────────────────────────────── */
const missing = [...needed].filter((t) => !found.has(t) && !portalNeed.has(t));
console.log(`components scanned : ${files.length}`);
console.log(`class tokens found  : ${[...needed].length}`);
console.log(`rules emitted       : ${picked.length} scoped + ${portalRootPicked.length + portalInnerPicked.length} portal`);
console.log(`keyframes emitted   : ${KEYFRAMES.filter((k) => rules.some((r) => r.at === "@keyframes " + k)).length}/${KEYFRAMES.length}`);
if (missing.length) console.log(`NOT FOUND in css   : ${missing.join(", ")}`);
if (unresolved.length) console.log(`UNRESOLVED vars    : ${unresolved.join(", ")}`);
console.log(`written             : ${path.relative(ROOT, OUT)}`);
