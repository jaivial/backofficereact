/*
 * CSS side of the HTML builder (coordination ids campaign_html_builder_v1,
 * html_builder_shared_v1): the Tailwind CSS of a design, compiled by the
 * backoffice server, and the pure CSS value helpers the server inliners share.
 * Used by every builder profile (campaign email, web ads). Nothing here may
 * touch window/CSS/document directly: the server runs it too.
 */

/** Compiles the Tailwind classes of a design (same endpoint for every profile). */
export const DESIGN_CSS_ENDPOINT = "/bo-tools/campaign-email-css";
export type Decl = { prop: string; value: string; important: boolean };

/** Base reset shared by the canvas and the email so both render the same. */
export const EMAIL_RESET_CSS =
  "body{margin:0;padding:0;width:100%!important;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}" +
  "img{border:0;outline:none;text-decoration:none;-ms-interpolation-mode:bicubic}table{border-collapse:collapse}";

/**
 * Tailwind's preflight for borders (`border` alone draws a solid #e5e7eb
 * line). Emails have no preflight, so the canvas applies it as CSS and the
 * inliner writes it on every element that sets a border width.
 */
export const BORDER_PREFLIGHT_CSS = "*,::before,::after{border-width:0;border-style:solid;border-color:#e5e7eb}hr{border-top-width:1px}";
export const BORDER_PREFLIGHT: Decl[] = [
  { prop: "border-width", value: "0", important: false },
  { prop: "border-style", value: "solid", important: false },
  { prop: "border-color", value: "#e5e7eb", important: false },
];

const cssCache = new Map<string, string>();

/** Tailwind CSS of one design, memoised (undo/redo and the canvas reuse it). */
export async function fetchDesignCss(html: string, coordId: string, signal?: AbortSignal): Promise<string> {
  const cached = cssCache.get(html);
  if (cached !== undefined) return cached;
  const res = await fetch(DESIGN_CSS_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ html, coord_id: coordId }),
    signal,
  });
  const data = (await res.json().catch(() => null)) as { success?: boolean; css?: string; message?: string } | null;
  if (!res.ok || !data?.success) throw new Error(data?.message || `No se pudo compilar el CSS (HTTP ${res.status})`);
  const css = data.css ?? "";
  if (cssCache.size > 40) cssCache.delete(cssCache.keys().next().value as string);
  cssCache.set(html, css);
  return css;
}

// ── Pure CSS value helpers (shared with the server inliner) ──────────────

/** Splits a declaration block on top-level `;` (values may hold parentheses). */
export function parseDecls(text: string): Decl[] {
  const out: Decl[] = [];
  let depth = 0;
  let start = 0;
  const push = (chunk: string) => {
    const i = chunk.indexOf(":");
    if (i <= 0) return;
    let value = chunk.slice(i + 1).trim();
    const important = /!\s*important$/i.test(value);
    if (important) value = value.replace(/!\s*important$/i, "").trim();
    out.push({ prop: chunk.slice(0, i).trim(), value, important });
  };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    else if (ch === ";" && depth === 0) {
      push(text.slice(start, i));
      start = i + 1;
    }
  }
  push(text.slice(start));
  return out;
}

/** Substitutes var(--x, fallback) with the element's own custom properties. */
export function resolveVars(value: string, vars: Map<string, string>, depth = 0): string {
  if (depth > 8) return value;
  let out = "";
  let i = 0;
  while (i < value.length) {
    const at = value.indexOf("var(", i);
    if (at < 0) {
      out += value.slice(i);
      break;
    }
    out += value.slice(i, at);
    let level = 0;
    let end = at + 3;
    let comma = -1;
    for (; end < value.length; end++) {
      if (value[end] === "(") level++;
      else if (value[end] === ")" && --level === 0) break;
      else if (value[end] === "," && level === 1 && comma < 0) comma = end;
    }
    const name = value.slice(at + 4, comma > 0 ? comma : end).trim();
    const fallback = comma > 0 ? value.slice(comma + 1, end).trim() : "";
    out += resolveVars(vars.get(name) ?? fallback, vars, depth + 1);
    i = end + 1;
  }
  return out;
}

/**
 * Space-separated colour functions (`rgb(9 121 105 / 1)`, what Tailwind v3
 * emits) in the legacy comma syntax: Outlook and older webmails only read
 * `rgb(r, g, b)` / `rgba(r, g, b, a)`.
 */
export function legacyColors(value: string): string {
  return value.replace(/rgba?\(\s*(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s*(?:\/\s*(-?[\d.]+%?))?\s*\)/g, (_m, r: string, g: string, b: string, a?: string) => {
    if (a === undefined) return `rgb(${r}, ${g}, ${b})`;
    const alpha = a.endsWith("%") ? parseFloat(a) / 100 : parseFloat(a);
    return alpha >= 1 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${Number(alpha.toFixed(3))})`;
  });
}

/** `a op b op c` with + - * / and the usual precedence; null when it is anything else. */
function evalArithmetic(expr: string): number | null {
  const nums: number[] = [];
  const ops: string[] = [];
  const s = expr.trim();
  let i = 0;
  let wantNumber = true;
  while (i < s.length) {
    if (s[i] === " ") {
      i++;
      continue;
    }
    if (wantNumber) {
      const m = /^-?\d*\.?\d+/.exec(s.slice(i));
      if (!m) return null;
      nums.push(parseFloat(m[0]));
      i += m[0].length;
    } else {
      if (!"+-*/".includes(s[i])) return null;
      ops.push(s[i]);
      i++;
    }
    wantNumber = !wantNumber;
  }
  if (wantNumber || !nums.length) return null;
  const terms = [nums[0]];
  const sums: string[] = [];
  ops.forEach((op, k) => {
    const v = nums[k + 1];
    if (op === "*") terms[terms.length - 1] *= v;
    else if (op === "/") terms[terms.length - 1] = v === 0 ? NaN : terms[terms.length - 1] / v;
    else {
      sums.push(op);
      terms.push(v);
    }
  });
  let result = terms[0];
  sums.forEach((op, k) => {
    result = op === "+" ? result + terms[k + 1] : result - terms[k + 1];
  });
  return Number.isFinite(result) ? result : null;
}

/**
 * Folds calc() of a single unit (`calc(16px * calc(1 - 0))` -> `16px`), the
 * form a resolved Tailwind variable leaves behind. Anything it cannot fold
 * (mixed units, percentages against lengths) is kept as written.
 */
export function foldCalc(value: string): string {
  let out = value;
  for (let guard = 0; guard < 8; guard++) {
    const next = out.replace(/calc\(([^()]*)\)/g, (whole, expr: string) => {
      const units = new Set(Array.from(expr.matchAll(/\d([a-z%]+)/gi), (m) => m[1].toLowerCase()));
      if (units.size > 1) return whole;
      const result = evalArithmetic(expr.replace(/(\d)[a-z%]+/gi, "$1"));
      return result === null ? whole : `${Number(result.toFixed(4))}${units.size ? [...units][0] : ""}`;
    });
    if (next === out) break;
    out = next;
  }
  return out;
}

/** rem -> px (16px root): Outlook and several webmails ignore rem. */
export const emailValue = (value: string) =>
  legacyColors(foldCalc(value.replace(/(-?\d*\.?\d+)rem\b/g, (_m, n: string) => `${Number((parseFloat(n) * 16).toFixed(3))}px`)));

const unescapeCss = (s: string) => s.replace(/\\([0-9a-fA-F]{1,6}\s?|.)/g, (_m, c: string) => (/^[0-9a-fA-F]/.test(c) && c.trim().length > 1 ? String.fromCodePoint(parseInt(c, 16)) : c.trim() || c));
/** Email-safe class name: Gmail drops selectors with escaped characters. */
export const safeClassName = (name: string) => name.replace(/[^A-Za-z0-9_-]/g, "_");
export const safeSelector = (selector: string) => selector.replace(/\.((?:\\[0-9a-fA-F]{1,6}\s?|\\.|[\w-])+)/g, (_m, cls: string) => `.${safeClassName(unescapeCss(cls))}`);
/** A real pseudo-class/element, not an escaped `\:` of a variant class name. */
export const hasPseudo = (selector: string) => selector.replace(/\\./g, "").includes(":");
