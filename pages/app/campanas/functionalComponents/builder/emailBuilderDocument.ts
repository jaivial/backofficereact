/*
 * Document model of the campaign HTML builder (coordination id
 * campaign_html_builder_v1). The design is a plain HTML fragment styled with
 * Tailwind classes: the canvas, the layers panel, the inspector and the AI all
 * read and write that one string. Every edit parses it, changes the DOM and
 * serializes it back, so there is no second representation to keep in sync.
 *
 * Shared by the browser (native DOMParser) and the backoffice server, which
 * runs the very same operations for the campaign tools of Forky and the
 * WhatsApp bot (campaign_tools_v1) with a jsdom parser injected through
 * setDesignDomParser. Nothing here may touch window/CSS/document directly.
 */

/** Stable element id while editing; stripped from what is stored and sent. */
export const EB_ID = "data-eb-id";
/** Human name of a block in the layers panel ("Cabecera", "Botón"...). */
export const EB_NAME = "data-eb-name";
/** Structural roles: the content slot new blocks go into, header and footer. */
export const EB_ROLE = "data-eb-role";
export const UNSUBSCRIBE_PLACEHOLDER = "{{unsubscribe_url}}";

export type InsertPosition = "before" | "after" | "inside";

let idSeq = 0;
const newId = () => `eb${Date.now().toString(36)}${(idSeq++).toString(36)}`;

// Email-safe vocabulary: anything else is unwrapped (kept text) or dropped.
const ALLOWED_TAGS = new Set([
  "div", "section", "header", "footer", "article", "aside", "main", "nav", "center",
  "h1", "h2", "h3", "h4", "h5", "h6", "p", "span", "a", "img", "br", "hr",
  "ul", "ol", "li", "strong", "b", "em", "i", "u", "s", "small", "sup", "sub", "blockquote", "code", "pre",
  "table", "thead", "tbody", "tfoot", "tr", "td", "th", "figure", "figcaption",
]);
const DROPPED_TAGS = new Set([
  "script", "style", "iframe", "frame", "object", "embed", "form", "input", "textarea", "select", "button",
  "svg", "math", "video", "audio", "canvas", "noscript", "template", "link", "meta", "base", "title", "head",
]);
const ALLOWED_ATTRS = new Set([
  "class", "style", "href", "src", "alt", "title", "width", "height", "align", "valign", "colspan", "rowspan",
  "cellpadding", "cellspacing", "border", "bgcolor", "role", "target", "rel", "dir", "lang",
]);

/** Same allowlist as campaignSafeUrl (campaign_url_allowlist_v1) plus the opt-out placeholder. */
export function builderSafeUrl(raw: string): boolean {
  const url = raw.trim();
  if (!url || url.startsWith("#") || url === UNSUBSCRIBE_PLACEHOLDER) return true;
  if (url.startsWith("/") && !url.startsWith("//")) return true;
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(url)?.[1]?.toLowerCase();
  return scheme === "http" || scheme === "https" || scheme === "mailto" || scheme === "tel";
}

type DesignDomParser = { parseFromString(source: string, type: "text/html"): Document };

let domParserFactory: () => DesignDomParser = () => new DOMParser();

/** Server only: the HTML parser (jsdom) used where there is no browser DOMParser. */
export function setDesignDomParser(factory: () => DesignDomParser): void {
  domParserFactory = factory;
}

/** Parses a fragment (or a whole document) into a detached <body>. */
export function parseFragment(html: string): HTMLElement {
  return domParserFactory().parseFromString(`<!DOCTYPE html><html><body>${html}</body></html>`, "text/html").body;
}

/** Attribute-value escape for selectors (CSS.escape is browser-only). */
const attrValue = (value: string) => value.replace(/["\\]/g, "\\$&");

export function sanitize(root: Element): void {
  for (const el of Array.from(root.querySelectorAll("*"))) {
    if (!el.isConnected) continue;
    const tag = el.tagName.toLowerCase();
    if (DROPPED_TAGS.has(tag)) {
      el.remove();
      continue;
    }
    if (!ALLOWED_TAGS.has(tag)) {
      el.replaceWith(...Array.from(el.childNodes));
      continue;
    }
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase();
      const keep = ALLOWED_ATTRS.has(name) || name.startsWith("aria-") || name.startsWith("data-");
      const unsafeUrl = (name === "href" || name === "src") && !builderSafeUrl(attr.value);
      if (!keep || unsafeUrl) el.removeAttribute(attr.name);
    }
  }
}

export function ensureIds(root: Element): void {
  for (const el of Array.from(root.querySelectorAll("*"))) {
    if (!el.getAttribute(EB_ID)) el.setAttribute(EB_ID, newId());
  }
}

/** Sanitized design with an editing id on every element: the builder state. */
export function normalizeDesign(html: string): string {
  const body = parseFragment(html);
  sanitize(body);
  ensureIds(body);
  return body.innerHTML.trim();
}

/** Design without editing ids: what is stored, compiled and sent to the AI. */
export function stripIds(html: string): string {
  const body = parseFragment(html);
  for (const el of Array.from(body.querySelectorAll(`[${EB_ID}]`))) el.removeAttribute(EB_ID);
  return body.innerHTML.trim();
}

/** Parses, lets `fn` change the DOM and serializes again with ids ensured. */
export function mutate(html: string, fn: (body: HTMLElement) => void): string {
  const body = parseFragment(html);
  fn(body);
  sanitize(body);
  ensureIds(body);
  return body.innerHTML.trim();
}

export function findById(root: ParentNode, id: string | null): HTMLElement | null {
  if (!id) return null;
  return root.querySelector<HTMLElement>(`[${EB_ID}="${attrValue(id)}"]`);
}

/** Outer HTML of one element without editing ids (AI context, inspector). */
export function elementHtml(html: string, id: string | null): string {
  const el = findById(parseFragment(html), id);
  if (!el) return "";
  for (const node of [el, ...Array.from(el.querySelectorAll(`[${EB_ID}]`))]) node.removeAttribute(EB_ID);
  return el.outerHTML;
}

/** Where a block lands when it is added without dropping it somewhere precise. */
function defaultSlot(body: HTMLElement): { parent: Element; before: Element | null } {
  const slot = body.querySelector(`[${EB_ROLE}="content"]`) ?? body.firstElementChild ?? body;
  const footer = Array.from(slot.children).find((c) => c.getAttribute(EB_ROLE) === "footer") ?? null;
  return { parent: slot, before: footer };
}

/** Top-level block (direct child of the content slot) that contains `el`. */
function blockOf(body: HTMLElement, el: Element): Element {
  const slot = body.querySelector(`[${EB_ROLE}="content"]`);
  let node: Element = el;
  while (slot && node.parentElement && node.parentElement !== slot && node.parentElement !== body) node = node.parentElement;
  return slot && node.parentElement === slot ? node : el;
}

function place(body: HTMLElement, nodes: Node[], targetId: string | null, position: InsertPosition | "block-after") {
  const target = findById(body, targetId);
  const slot = body.querySelector(`[${EB_ROLE}="content"]`);
  // The design root and the content slot are frames, not blocks: anything
  // dropped or added on them goes into the slot, above the footer.
  if (!target || target === slot || (target === body.firstElementChild && (slot || position !== "inside"))) {
    const { parent, before } = defaultSlot(body);
    for (const node of nodes) parent.insertBefore(node, before);
    return;
  }
  if (position === "inside") {
    for (const node of nodes) target.appendChild(node);
  } else if (position === "before") {
    for (const node of nodes) target.before(node);
  } else {
    const anchor = position === "block-after" ? blockOf(body, target) : target;
    anchor.after(...nodes);
  }
}

/** Inserts `snippet` relative to `targetId` and returns the new design and the id of its first element. */
export function insertSnippet(html: string, snippet: string, targetId: string | null, position: InsertPosition | "block-after"): { html: string; id: string | null } {
  let insertedId: string | null = null;
  const next = mutate(html, (body) => {
    const frag = parseFragment(snippet);
    sanitize(frag);
    ensureIds(frag);
    insertedId = frag.firstElementChild?.getAttribute(EB_ID) ?? null;
    place(body, Array.from(frag.childNodes), targetId, position);
  });
  return { html: next, id: insertedId };
}

/** Moves an element next to (or into) another one; a no-op when it would land inside itself. */
export function moveElementTo(html: string, id: string, targetId: string | null, position: InsertPosition): string {
  return mutate(html, (body) => {
    const el = findById(body, id);
    const target = findById(body, targetId);
    if (!el || el === target || (target && el.contains(target))) return;
    place(body, [el], targetId, position);
  });
}

export function moveElement(html: string, id: string, direction: -1 | 1): string {
  return mutate(html, (body) => {
    const el = findById(body, id);
    if (!el) return;
    if (direction < 0 && el.previousElementSibling) el.previousElementSibling.before(el);
    if (direction > 0 && el.nextElementSibling) el.nextElementSibling.after(el);
  });
}

export function duplicateElement(html: string, id: string): { html: string; id: string | null } {
  let copyId: string | null = null;
  const next = mutate(html, (body) => {
    const el = findById(body, id);
    if (!el) return;
    const copy = el.cloneNode(true) as HTMLElement;
    for (const node of [copy, ...Array.from(copy.querySelectorAll(`[${EB_ID}]`))]) node.removeAttribute(EB_ID);
    copy.removeAttribute(EB_ROLE);
    el.after(copy);
    ensureIds(copy);
    copyId = copy.getAttribute(EB_ID);
  });
  return { html: next, id: copyId };
}

export function removeElement(html: string, id: string): string {
  return mutate(html, (body) => findById(body, id)?.remove());
}

export function updateElement(html: string, id: string, fn: (el: HTMLElement) => void): string {
  return mutate(html, (body) => {
    const el = findById(body, id);
    if (el) fn(el);
  });
}

export function parentId(html: string, id: string | null): string | null {
  const el = findById(parseFragment(html), id);
  return el?.parentElement?.getAttribute(EB_ID) ?? null;
}

/** Text-only elements are edited in place (double click) and as plain text. */
const INLINE_TAGS = new Set(["a", "span", "strong", "b", "em", "i", "u", "s", "small", "sup", "sub", "br", "code"]);
export function isTextElement(el: Element | null): boolean {
  if (!el || el.tagName === "IMG" || el.tagName === "HR") return false;
  const children = Array.from(el.children);
  return el.textContent?.trim() !== "" && children.every((c) => INLINE_TAGS.has(c.tagName.toLowerCase()));
}

// ── Layers ────────────────────────────────────────────────────────────────

export type LayerNode = {
  id: string;
  depth: number;
  label: string;
  kind: string;
  hint: string;
  hidden: boolean;
  /** Last child of its parent: its tree connector ends here (└ instead of ├). */
  last: boolean;
  /** Per ancestor level, whether that ancestor has a later sibling (the │ guide keeps going). */
  guides: boolean[];
  hasChildren: boolean;
  /** Ids of every ancestor layer, outermost first (collapsing any of them hides this one). */
  ancestors: string[];
};

const TAG_LABELS: Record<string, string> = {
  div: "Bloque", section: "Sección", h1: "Título 1", h2: "Título 2", h3: "Título 3", h4: "Título 4", p: "Párrafo",
  span: "Texto", a: "Enlace", img: "Imagen", ul: "Lista", ol: "Lista numerada", li: "Elemento", hr: "Separador",
  table: "Tabla", tr: "Fila", td: "Celda", strong: "Negrita", em: "Cursiva", blockquote: "Cita", br: "Salto",
};

export function elementKind(el: Element): string {
  const tag = el.tagName.toLowerCase();
  if (tag === "a" && /\bbg-/.test(el.getAttribute("class") ?? "")) return "button";
  if (/^h[1-6]$/.test(tag)) return "heading";
  if (tag === "p" || tag === "span" || tag === "li") return "text";
  if (tag === "img") return "image";
  if (tag === "a") return "link";
  if (tag === "hr") return "divider";
  if (tag === "ul" || tag === "ol") return "list";
  return "box";
}

export function elementLabel(el: Element): string {
  const named = el.getAttribute(EB_NAME);
  if (named) return named;
  if (elementKind(el) === "button") return "Botón";
  return TAG_LABELS[el.tagName.toLowerCase()] ?? el.tagName.toLowerCase();
}

/** Layer children of an element: text elements keep their inline markup inside one layer. */
function layerChildren(el: Element): Element[] {
  if (el.tagName !== "BODY" && isTextElement(el)) return [];
  return Array.from(el.children).filter((c) => c.getAttribute(EB_ID) && c.tagName !== "BR");
}

/** The design as a file-tree: one row per element with its connectors and ancestors. */
export function layerTree(html: string): LayerNode[] {
  const out: LayerNode[] = [];
  const visit = (parent: Element, depth: number, guides: boolean[], ancestors: string[]) => {
    const kids = layerChildren(parent);
    kids.forEach((el, i) => {
      const id = el.getAttribute(EB_ID) as string;
      const last = i === kids.length - 1;
      const cls = el.getAttribute("class") ?? "";
      const hint = el.tagName === "IMG" ? el.getAttribute("alt") ?? "" : isTextElement(el) ? (el.textContent ?? "").trim().slice(0, 32) : "";
      const children = layerChildren(el);
      out.push({
        id,
        depth,
        label: elementLabel(el),
        kind: elementKind(el),
        hint,
        hidden: /(^|\s)hidden(\s|$)|max-\[639px\]:hidden|(^|\s)sm:hidden/.test(cls),
        last,
        guides,
        hasChildren: children.length > 0,
        ancestors,
      });
      if (children.length) visit(el, depth + 1, [...guides, !last], [...ancestors, id]);
    });
  };
  visit(parseFragment(html), 0, [], []);
  return out;
}

// ── Tailwind class groups (inspector) ────────────────────────────────────

export type ClassGroupId =
  | "fontSize" | "fontWeight" | "textAlign" | "textColor" | "bgColor" | "lineHeight"
  | "paddingX" | "paddingY" | "marginTop" | "marginBottom" | "radius" | "maxWidth" | "width";

const COLOR = String.raw`(?:white|black|transparent|current|inherit|\[#[0-9a-fA-F]{3,8}\]|[a-z]+-(?:50|[1-9]00|950))`;
const GROUPS: Record<ClassGroupId, RegExp> = {
  fontSize: /^text-(?:xs|sm|base|lg|xl|[2-9]xl|\[\d+(?:\.\d+)?(?:px|rem)\])$/,
  fontWeight: /^font-(?:thin|extralight|light|normal|medium|semibold|bold|extrabold|black)$/,
  textAlign: /^text-(?:left|center|right|justify)$/,
  textColor: new RegExp(`^text-${COLOR}$`),
  bgColor: new RegExp(`^bg-${COLOR}$`),
  lineHeight: /^leading-/,
  paddingX: /^(?:px|pl|pr)-/,
  paddingY: /^(?:py|pt|pb)-/,
  marginTop: /^(?:mt|my)-/,
  marginBottom: /^mb-/,
  radius: /^rounded(?:-.+)?$/,
  maxWidth: /^max-w-/,
  width: /^w-/,
};

/** Every inspector group, in the order the inspector shows them (campaign tools vocabulary). */
export const CLASS_GROUP_IDS = Object.keys(GROUPS) as ClassGroupId[];

/** Whether a Tailwind class (without breakpoint prefix) belongs to a group. */
export function classGroupMatches(group: ClassGroupId, cls: string): boolean {
  return GROUPS[group].test(cls);
}

/** Classes split, with `p-N` / `m-N` shorthands expanded so each axis is editable alone. */
function expandShorthands(classes: string[], prefix: string): string[] {
  return classes.flatMap((c) => {
    if (!c.startsWith(prefix)) return [c];
    const bare = c.slice(prefix.length);
    const p = /^p-(.+)$/.exec(bare);
    if (p) return [`${prefix}px-${p[1]}`, `${prefix}py-${p[1]}`];
    const m = /^m-(.+)$/.exec(bare);
    if (m) return [`${prefix}mx-${m[1]}`, `${prefix}mt-${m[1]}`, `${prefix}mb-${m[1]}`];
    return [c];
  });
}

export function splitClasses(value: string | null | undefined): string[] {
  return (value ?? "").split(/\s+/).filter(Boolean);
}

/** Current value of a group for one breakpoint prefix ("" = every size, "md:" = tablet and up). */
export function readGroup(classes: string[], group: ClassGroupId, prefix = ""): string | null {
  const found = expandShorthands(classes, prefix)
    .filter((c) => c.startsWith(prefix) && !c.slice(prefix.length).includes(":"))
    .map((c) => c.slice(prefix.length))
    .filter((c) => GROUPS[group].test(c));
  return found.length ? found[found.length - 1] : null;
}

/** Replaces a group for one breakpoint prefix; `null` removes it. */
export function writeGroup(classes: string[], group: ClassGroupId, value: string | null, prefix = ""): string[] {
  const kept = expandShorthands(classes, prefix).filter((c) => !(c.startsWith(prefix) && !c.slice(prefix.length).includes(":") && GROUPS[group].test(c.slice(prefix.length))));
  return value ? [...kept, `${prefix}${value}`] : kept;
}

export type Visibility = "all" | "mobile" | "desktop";
const VISIBILITY_CLASSES = ["sm:hidden", "max-[639px]:hidden"];

export function readVisibility(classes: string[]): Visibility {
  if (classes.includes("sm:hidden")) return "mobile";
  if (classes.includes("max-[639px]:hidden")) return "desktop";
  return "all";
}

/** Responsive visibility without touching the element's own display. */
export function writeVisibility(classes: string[], value: Visibility): string[] {
  const kept = classes.filter((c) => !VISIBILITY_CLASSES.includes(c));
  if (value === "mobile") return [...kept, "sm:hidden"];
  if (value === "desktop") return [...kept, "max-[639px]:hidden"];
  return kept;
}
