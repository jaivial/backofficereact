import { EB_ROLE, UNSUBSCRIBE_PLACEHOLDER, parseFragment, stripIds } from "./emailBuilderDocument";

/*
 * Design -> email (coordination ids campaign_html_builder_v1, campaign_tools_v1).
 *
 * The backoffice server compiles a design into the email SMTP sends
 * (POST /bo-tools/campaign-email-compile): Tailwind turns the classes of the
 * design into CSS, the plain utility rules become style attributes (Tailwind
 * --tw-* variables resolved, rem turned into px, colours in the legacy rgb()
 * syntax every client reads) and responsive (@media) / interactive (:hover)
 * rules stay in a <style> block with !important. Class names are made
 * email-safe (no `:` `/` `[` escapes, which Gmail drops).
 *
 * It is ONE implementation on purpose: the editor (save, "Vista previa",
 * "Previsualización") and the campaign tools of Forky and the WhatsApp bot all
 * call the same server code, so a design edited from a chat produces exactly
 * the email the editor would. This module keeps the pure helpers both sides
 * share; nothing here may touch window/CSS/document directly (the server runs
 * it with a jsdom parser, see setDesignDomParser).
 */

export const CAMPAIGN_EMAIL_CSS_ENDPOINT = "/bo-tools/campaign-email-css";
export const CAMPAIGN_EMAIL_COMPILE_ENDPOINT = "/bo-tools/campaign-email-compile";

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
  const res = await fetch(CAMPAIGN_EMAIL_CSS_ENDPOINT, {
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

const emailCache = new Map<string, string>();

/** Full pipeline on the server: design -> compiled, inlined, sendable email. */
export async function compileCampaignEmail(design: string, title: string, coordId: string, signal?: AbortSignal): Promise<string> {
  const html = stripIds(design);
  const key = `${title}\u0000${html}`;
  const cached = emailCache.get(key);
  if (cached !== undefined) return cached;
  const res = await fetch(CAMPAIGN_EMAIL_COMPILE_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ html, title, coord_id: coordId }),
    signal,
  });
  const data = (await res.json().catch(() => null)) as { success?: boolean; email_html?: string; message?: string } | null;
  if (!res.ok || !data?.success) throw new Error(data?.message || `No se pudo compilar el email (HTTP ${res.status})`);
  const email = data.email_html ?? "";
  if (emailCache.size > 20) emailCache.delete(emailCache.keys().next().value as string);
  emailCache.set(key, email);
  return email;
}

/** Previews show the opt-out link a recipient would get. */
export function fillPreviewPlaceholders(html: string, unsubscribeUrl: string): string {
  return html.split(UNSUBSCRIBE_PLACEHOLDER).join(unsubscribeUrl || "#");
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

// ── WhatsApp text from the design ────────────────────────────────────────

const BLOCK_TAGS = new Set(["div", "section", "header", "footer", "article", "aside", "main", "nav", "center", "p", "h1", "h2", "h3", "h4", "h5", "h6", "ul", "ol", "li", "hr", "img", "table", "tbody", "thead", "tfoot", "tr", "td", "th", "blockquote", "figure", "figcaption", "pre"]);
// nodeType instead of `instanceof Element`/`Node`: the server parses with
// jsdom, whose classes are not the global ones.
const ELEMENT_NODE = 1;
const TEXT_NODE = 3;
const isElement = (node: Node): node is Element => node.nodeType === ELEMENT_NODE;

function inlineMarkdown(node: Node): string {
  if (node.nodeType === TEXT_NODE) return (node.textContent ?? "").replace(/\s+/g, " ");
  if (!isElement(node)) return "";
  const tag = node.tagName.toLowerCase();
  const inner = Array.from(node.childNodes).map(inlineMarkdown).join("");
  if (tag === "br") return "\n";
  if (tag === "strong" || tag === "b") return inner.trim() ? `**${inner.trim()}**` : "";
  if (tag === "em" || tag === "i") return inner.trim() ? `*${inner.trim()}*` : "";
  if (tag === "a") {
    const href = node.getAttribute("href") ?? "";
    if (!/^https?:\/\//i.test(href)) return inner;
    return `[${inner.trim() || href}](${href})`;
  }
  return inner;
}

function blockMarkdown(el: Element, out: string[]): void {
  const role = el.getAttribute(EB_ROLE);
  if (role === "header" || role === "footer") return; // WhatsApp carries its own brand header and opt-out.
  const tag = el.tagName.toLowerCase();
  if (tag === "img") {
    const src = el.getAttribute("src") ?? "";
    if (/^https:\/\//i.test(src)) out.push(`![${el.getAttribute("alt") ?? ""}](${src})`);
    return;
  }
  if (tag === "hr") return void out.push("---");
  if (tag === "ul" || tag === "ol") {
    const items = Array.from(el.children).map((li, i) => `${tag === "ol" ? `${i + 1}.` : "-"} ${inlineMarkdown(li).trim()}`);
    if (items.length) out.push(items.join("\n"));
    return;
  }
  const hasBlocks = Array.from(el.children).some((c) => BLOCK_TAGS.has(c.tagName.toLowerCase()));
  if (!hasBlocks) {
    const text = inlineMarkdown(el).replace(/[ \t]+\n/g, "\n").trim();
    if (!text) return;
    const level = /^h([1-6])$/.exec(tag)?.[1];
    out.push(level ? `${"#".repeat(Math.min(3, Number(level)))} ${text}` : text);
    return;
  }
  let run = "";
  const flush = () => {
    if (run.trim()) out.push(run.trim());
    run = "";
  };
  for (const child of Array.from(el.childNodes)) {
    if (isElement(child) && BLOCK_TAGS.has(child.tagName.toLowerCase())) {
      flush();
      blockMarkdown(child, out);
    } else run += inlineMarkdown(child);
  }
  flush();
}

/** Markdown the WhatsApp sender understands (headings, bold, links as buttons, lead image). */
export function designToWhatsAppMarkdown(design: string): string {
  const out: string[] = [];
  for (const child of Array.from(parseFragment(stripIds(design)).children)) blockMarkdown(child, out);
  return out.join("\n\n").trim();
}
