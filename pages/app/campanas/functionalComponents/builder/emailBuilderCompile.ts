import { EB_ROLE, UNSUBSCRIBE_PLACEHOLDER, parseFragment, stripIds } from "./emailBuilderDocument";

/*
 * Design -> email (coordination id campaign_html_builder_v1).
 *
 * 1. The backoffice server compiles the Tailwind classes of the design to CSS
 *    (POST /bo-tools/campaign-email-css, Tailwind needs Node).
 * 2. The browser inlines that CSS: plain utility rules become style attributes
 *    (with Tailwind's --tw-* variables resolved, rem turned into px and colours
 *    normalised by the CSSOM), while responsive (@media) and interactive
 *    (:hover) rules stay in a <style> block with !important so they can still
 *    override the inline styles. Class names are made email-safe (no `:` `/`
 *    `[` escapes, which Gmail drops).
 * The result is the document SMTP sends; the opt-out placeholder is filled per
 * recipient by the Go sender.
 */

export const CAMPAIGN_EMAIL_CSS_ENDPOINT = "/bo-tools/campaign-email-css";

type Decl = { prop: string; value: string; important: boolean };

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
const BORDER_PREFLIGHT: Decl[] = [
  { prop: "border-width", value: "0", important: false },
  { prop: "border-style", value: "solid", important: false },
  { prop: "border-color", value: "#e5e7eb", important: false },
];

const cssCache = new Map<string, string>();

/** Tailwind CSS of one design, memoised (undo/redo and previews reuse it). */
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

/** Splits a declaration block on top-level `;` (values may hold parentheses). */
function parseDecls(text: string): Decl[] {
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
function resolveVars(value: string, vars: Map<string, string>, depth = 0): string {
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

/** rem -> px (16px root): Outlook and several webmails ignore rem. */
const emailValue = (value: string) => value.replace(/(-?\d*\.?\d+)rem\b/g, (_m, n: string) => `${Number((parseFloat(n) * 16).toFixed(3))}px`);

const unescapeCss = (s: string) => s.replace(/\\([0-9a-fA-F]{1,6}\s?|.)/g, (_m, c: string) => (/^[0-9a-fA-F]/.test(c) && c.trim().length > 1 ? String.fromCodePoint(parseInt(c, 16)) : c.trim() || c));
/** Email-safe class name: Gmail drops selectors with escaped characters. */
export const safeClassName = (name: string) => name.replace(/[^A-Za-z0-9_-]/g, "_");
const safeSelector = (selector: string) => selector.replace(/\.((?:\\[0-9a-fA-F]{1,6}\s?|\\.|[\w-])+)/g, (_m, cls: string) => `.${safeClassName(unescapeCss(cls))}`);
/** A real pseudo-class/element, not an escaped `\:` of a variant class name. */
const hasPseudo = (selector: string) => selector.replace(/\\./g, "").includes(":");

function declBlock(style: CSSStyleDeclaration, important: boolean): string {
  const decls = parseDecls(style.cssText);
  const vars = new Map(decls.filter((d) => d.prop.startsWith("--")).map((d) => [d.prop, d.value] as const));
  return decls
    .filter((d) => !d.prop.startsWith("--"))
    .map((d) => `${d.prop}:${emailValue(resolveVars(d.value, vars))}${important || d.important ? "!important" : ""}`)
    .join(";");
}

function residualRule(rule: CSSRule, important: boolean): string {
  if (rule instanceof CSSStyleRule) return `${safeSelector(rule.selectorText)}{${declBlock(rule.style, important)}}`;
  if (rule instanceof CSSMediaRule) return `@media ${rule.media.mediaText}{${Array.from(rule.cssRules).map((r) => residualRule(r, true)).join("")}}`;
  return rule.cssText;
}

const escapeText = (v: string) => v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Inlines compiled Tailwind CSS into a design and wraps it as a full email document. */
export function inlineEmail(design: string, css: string, title: string): string {
  const doc = new DOMParser().parseFromString(`<!DOCTYPE html><html><head></head><body>${stripIds(design)}</body></html>`, "text/html");
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(css);
  const perElement = new Map<HTMLElement, Decl[]>();
  const residual: string[] = [];
  for (const rule of Array.from(sheet.cssRules)) {
    if (rule instanceof CSSStyleRule && !hasPseudo(rule.selectorText)) {
      let targets: HTMLElement[] = [];
      try {
        targets = Array.from(doc.body.querySelectorAll<HTMLElement>(rule.selectorText));
      } catch {
        residual.push(residualRule(rule, false));
        continue;
      }
      const decls = parseDecls(rule.style.cssText);
      for (const el of targets) perElement.set(el, [...(perElement.get(el) ?? []), ...decls]);
    } else {
      residual.push(residualRule(rule, false));
    }
  }
  for (const [el, decls] of perElement) {
    const authored = parseDecls(el.getAttribute("style") ?? "");
    const vars = new Map(decls.filter((d) => d.prop.startsWith("--")).map((d) => [d.prop, d.value] as const));
    el.removeAttribute("style");
    const own = decls.filter((x) => !x.prop.startsWith("--"));
    const bordered = own.some((x) => /^border(-(top|right|bottom|left|x|y))?-width$|^border(-(top|right|bottom|left))?$/.test(x.prop));
    for (const d of [...(bordered ? BORDER_PREFLIGHT : []), ...own, ...authored]) {
      el.style.setProperty(d.prop, emailValue(resolveVars(d.value, vars)), d.important ? "important" : "");
    }
    // The CSSOM keeps calc() around plain lengths (space-y-*) and writes the
    // text-decoration longhand, which older clients ignore: email-safe forms.
    el.setAttribute("style", el.style.cssText.replace(/calc\((-?[\d.]+[a-z%]*)\)/g, "$1").replace(/text-decoration-line:/g, "text-decoration:"));
  }
  for (const el of Array.from(doc.body.querySelectorAll("*"))) {
    for (const attr of Array.from(el.attributes)) if (attr.name.startsWith("data-eb-")) el.removeAttribute(attr.name);
    const cls = el.getAttribute("class");
    if (cls) el.setAttribute("class", cls.split(/\s+/).filter(Boolean).map(safeClassName).join(" "));
  }
  // The page background of the design also paints the body (no white band under it).
  const rootBg = (doc.body.firstElementChild as HTMLElement | null)?.style.backgroundColor ?? "";
  const bodyStyle = `margin:0;padding:0;${rootBg ? `background-color:${rootBg};` : ""}`;
  return (
    `<!DOCTYPE html>\n<html lang="es">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n` +
    `<meta name="x-apple-disable-message-reformatting">\n<meta name="color-scheme" content="light">\n<title>${escapeText(title)}</title>\n` +
    `<style>${EMAIL_RESET_CSS}${residual.join("")}</style>\n</head>\n<body style="${bodyStyle}">\n${doc.body.innerHTML.trim()}\n</body>\n</html>\n`
  );
}

/** Full pipeline: design -> compiled, inlined, sendable email. */
export async function compileCampaignEmail(design: string, title: string, coordId: string): Promise<string> {
  const clean = stripIds(design);
  return inlineEmail(clean, await fetchDesignCss(clean, coordId), title);
}

/** Previews show the opt-out link a recipient would get. */
export function fillPreviewPlaceholders(html: string, unsubscribeUrl: string): string {
  return html.split(UNSUBSCRIBE_PLACEHOLDER).join(unsubscribeUrl || "#");
}

// ── WhatsApp text from the design ────────────────────────────────────────

const BLOCK_TAGS = new Set(["div", "section", "header", "footer", "article", "aside", "main", "nav", "center", "p", "h1", "h2", "h3", "h4", "h5", "h6", "ul", "ol", "li", "hr", "img", "table", "tbody", "thead", "tfoot", "tr", "td", "th", "blockquote", "figure", "figcaption", "pre"]);

function inlineMarkdown(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return (node.textContent ?? "").replace(/\s+/g, " ");
  if (!(node instanceof Element)) return "";
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
    if (child instanceof Element && BLOCK_TAGS.has(child.tagName.toLowerCase())) {
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
