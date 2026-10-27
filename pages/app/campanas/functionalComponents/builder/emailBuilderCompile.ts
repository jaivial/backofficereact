import { EB_ROLE, UNSUBSCRIBE_PLACEHOLDER, designForChannel, parseFragment, stripIds } from "../../../../../ui/htmlBuilder/document";

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

export * from "../../../../../ui/htmlBuilder/css";
/** Kept for callers of the campaign endpoints (same URL as DESIGN_CSS_ENDPOINT). */
export const CAMPAIGN_EMAIL_CSS_ENDPOINT = "/bo-tools/campaign-email-css";
export const CAMPAIGN_EMAIL_COMPILE_ENDPOINT = "/bo-tools/campaign-email-compile";

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

/**
 * Markdown the WhatsApp sender understands (headings, bold, links as buttons,
 * lead image). Blocks marked "Solo email" are left out (campaign_block_channel_v1).
 */
export function designToWhatsAppMarkdown(design: string): string {
  const out: string[] = [];
  for (const child of Array.from(parseFragment(designForChannel(stripIds(design), "whatsapp")).children)) blockMarkdown(child, out);
  return out.join("\n\n").trim();
}
