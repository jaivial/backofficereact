// Bridge between the rich text editor (HTML in, HTML out) and the persisted
// campaign model, which stays markdown (`body_markdown`) because the backend
// renderer, the WhatsApp twin and every stored campaign already speak markdown.
// Only the subset both sides support is converted, so a round trip is stable.

const BLOCK_TAGS = new Set(["P", "H1", "H2", "H3", "H4", "H5", "H6", "UL", "OL", "LI", "BLOCKQUOTE", "PRE", "HR", "DIV", "BR", "IMG"]);

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/**
 * Image size contract shared with the Go renderer (`internal/api/campaign_markdown.go`):
 * `![alt](URL =W)` carries an optional integer pixel width, separated by ONE space and
 * without quotes. Height is never stored, the rendered `<img>` keeps `height:auto` so
 * the aspect ratio always comes from the source image.
 */
export const IMAGE_WIDTH_MIN = 40;
export const IMAGE_WIDTH_MAX = 600;

/** `![alt](URL)` or `![alt](URL =W)`; the hint is anything after one whitespace. */
const IMAGE_RE = /!\[([^\]]*)\]\(([^)\s]+)(?:\s+([^\s)]+))?\)/g;

/** A width counts only when it is an integer inside the agreed range, anything else means "none". */
function usableImageWidth(raw: string | null | undefined): number | null {
  const value = (raw ?? "").trim();
  if (!/^\d+$/.test(value)) return null;
  const width = Number.parseInt(value, 10);
  return width >= IMAGE_WIDTH_MIN && width <= IMAGE_WIDTH_MAX ? width : null;
}

/** Validated pixel width of a markdown hint (`=W`), or null when there is no usable one. */
export function imageWidthFromHint(hint: string | null | undefined): number | null {
  return usableImageWidth((hint ?? "").trim().replace(/^=\s*/, ""));
}

/** Validated width hint of every image of a markdown body, in document order. */
export function markdownImages(markdown: string): { alt: string; src: string; width: number | null }[] {
  return Array.from((markdown || "").matchAll(IMAGE_RE), ([, alt, src, hint]) => ({
    alt: alt ?? "",
    src: src ?? "",
    width: imageWidthFromHint(hint),
  }));
}

/** Markdown inline marks to HTML, images and links included. */
function inlineToHtml(text: string): string {
  return escapeHtml(text)
    .replace(IMAGE_RE, (_match, alt: string, src: string, hint?: string) => {
      const width = imageWidthFromHint(hint);
      return `<img src="${src}" alt="${alt}"${width ? ` width="${width}"` : ""}/>`;
    })
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");
}

/** Markdown -> HTML, used to seed the editor with an existing campaign body. */
export function markdownToHtml(markdown: string): string {
  let html = "";
  let list: "ul" | "ol" | null = null;
  const closeList = () => {
    if (list) {
      html += `</${list}>`;
      list = null;
    }
  };
  const openList = (kind: "ul" | "ol") => {
    if (list !== kind) {
      closeList();
      html += `<${kind}>`;
      list = kind;
    }
  };
  for (const raw of (markdown || "").replace(/\r\n/g, "\n").split("\n")) {
    const line = raw.trim();
    if (!line) {
      closeList();
      continue;
    }
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    const bullet = /^[-*]\s+(.*)$/.exec(line);
    const ordered = /^\d+[.)]\s+(.*)$/.exec(line);
    if (heading) {
      closeList();
      const level = (heading[1] ?? "#").length;
      html += `<h${level}>${inlineToHtml(heading[2] ?? "")}</h${level}>`;
    } else if (/^(---|\*\*\*|___)$/.test(line)) {
      closeList();
      html += "<hr>";
    } else if (line.startsWith("> ")) {
      closeList();
      html += `<blockquote><p>${inlineToHtml(line.slice(2))}</p></blockquote>`;
    } else if (bullet) {
      openList("ul");
      html += `<li><p>${inlineToHtml(bullet[1] ?? "")}</p></li>`;
    } else if (ordered) {
      openList("ol");
      html += `<li><p>${inlineToHtml(ordered[1] ?? "")}</p></li>`;
    } else {
      closeList();
      html += `<p>${inlineToHtml(line)}</p>`;
    }
  }
  closeList();
  return html;
}

/** Inline HTML nodes -> markdown marks. */
function inlineToMarkdown(node: Node): string {
  if (node.nodeType === 3) return (node.nodeValue ?? "").replace(/\s+/g, " ");
  if (node.nodeType !== 1) return "";
  const el = node as Element;
  const inner = childrenToMarkdown(el);
  switch (el.tagName) {
    case "BR":
      return "\n";
    case "IMG": {
      const width = usableImageWidth(el.getAttribute("width"));
      return `![${el.getAttribute("alt") ?? ""}](${el.getAttribute("src") ?? ""}${width ? ` =${width}` : ""})`;
    }
    case "A":
      return `[${inner || (el.getAttribute("href") ?? "")}](${el.getAttribute("href") ?? ""})`;
    case "STRONG":
    case "B":
      return inner ? `**${inner}**` : "";
    case "EM":
    case "I":
      return inner ? `*${inner}*` : "";
    // The email renderer has no underline/strikethrough: the marker would be
    // printed literally, so only the text survives.
    case "U":
    case "S":
    case "STRIKE":
    case "DEL":
      return inner;
    case "CODE":
      return inner ? `\`${inner}\`` : "";
    default:
      return inner;
  }
}

function childrenToMarkdown(el: Element): string {
  return Array.from(el.childNodes).map(inlineToMarkdown).join("");
}

/** Block level HTML nodes -> markdown lines. */
function blockToMarkdown(node: Node): string {
  if (node.nodeType === 3) {
    const text = (node.nodeValue ?? "").trim();
    return text ? `${text}\n\n` : "";
  }
  if (node.nodeType !== 1) return "";
  const el = node as Element;
  const tag = el.tagName;
  if (!BLOCK_TAGS.has(tag)) return inlineToMarkdown(el);
  switch (tag) {
    case "HR":
      return "---\n\n";
    case "BR":
      return "\n";
    case "IMG":
      return `${inlineToMarkdown(el)}\n\n`;
    case "H1":
    case "H2":
    case "H3":
    case "H4":
    case "H5":
    case "H6":
      // The campaign email renderer only knows h1-h3; deeper levels are clamped
      // so the hashes never leak into the delivered email as plain text.
      return `${"#".repeat(Math.min(Number(tag.slice(1)), 3))} ${childrenToMarkdown(el).trim()}\n\n`;
    case "BLOCKQUOTE":
      return `> ${blocksToMarkdown(el).trim().replace(/\n+/g, " ")}\n\n`;
    case "PRE":
      return `\`\`\`\n${el.textContent ?? ""}\n\`\`\`\n\n`;
    case "UL":
    case "OL": {
      const items = Array.from(el.children).filter((child) => child.tagName === "LI");
      // Both kinds degrade to "- ": the email renderer only emits <ul>, and an
      // "1. " prefix would survive as literal text in the delivered email.
      const lines = items.map((item) => `- ${blocksToMarkdown(item).trim().replace(/\n+/g, " ") || childrenToMarkdown(item).trim()}`);
      return lines.length ? `${lines.join("\n")}\n\n` : "";
    }
    default: {
      const text = /(UL|OL|BLOCKQUOTE|PRE|HR|DIV|H[1-6])/.test(Array.from(el.children).map((c) => c.tagName).join(" "))
        ? blocksToMarkdown(el)
        : childrenToMarkdown(el);
      const trimmed = text.replace(/[ \t]+$/gm, "").trim();
      return trimmed ? `${trimmed}\n\n` : "";
    }
  }
}

function blocksToMarkdown(parent: Element): string {
  return Array.from(parent.childNodes).map(blockToMarkdown).join("");
}

/**
 * HTML -> markdown, used on every editor change so `body_markdown` keeps being
 * the single source of truth for the backend renderer and WhatsApp.
 * Browser only (needs DOMParser); on the server the HTML is returned untouched
 * because the editor never runs there.
 */
export function htmlToMarkdown(html: string): string {
  const source = (html || "").replace(/^<html>/i, "").replace(/<\/html>$/i, "");
  if (typeof DOMParser === "undefined") return source;
  const doc = new DOMParser().parseFromString(`<body>${source}</body>`, "text/html");
  if (!doc.body) return source;
  return blocksToMarkdown(doc.body).replace(/\n{3,}/g, "\n\n").trim();
}

/**
 * Rewrites the width attribute of one `<img>` of an HTML fragment, addressed either by
 * its position or by its `src`. Used by the editor to persist the width the operator
 * chose: the markdown bridge turns that attribute back into the `=W` hint.
 */
export function setHtmlImageWidth(html: string, target: number | ((src: string) => boolean), width: number): string {
  let index = -1;
  return (html || "").replace(/<img\b[^>]*>/gi, (tag) => {
    index += 1;
    const matches = typeof target === "function" ? target(/\ssrc="([^"]*)"/i.exec(tag)?.[1] ?? "") : index === target;
    if (!matches) return tag;
    return tag.replace(/\s+width="[^"]*"/i, "").replace(/<img/i, `<img width="${width}"`);
  });
}
