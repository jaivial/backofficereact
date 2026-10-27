import {
  CLASS_GROUP_IDS,
  EB_ID,
  EB_ROLE,
  UNSUBSCRIBE_PLACEHOLDER,
  builderSafeUrl,
  classGroupMatches,
  duplicateElement,
  elementHtml,
  elementKind,
  elementLabel,
  findById,
  insertSnippet,
  isTextElement,
  moveElement,
  moveElementTo,
  mutate,
  normalizeDesign,
  parseFragment,
  removeElement,
  sanitize,
  splitClasses,
  stripIds,
  updateElement,
  writeGroup,
  writeVisibility,
  readChannel,
  writeChannel,
  type BlockChannel,
  type ClassGroupId,
  type InsertPosition,
  type Visibility,
} from "../ui/htmlBuilder/document";
import { EMAIL_BLOCKS, blockByKind, defaultDesign, legacyDesign, type BlockContext } from "../pages/app/campanas/functionalComponents/builder/emailBuilderBlocks";
import { renderCampaignEmailBody } from "../pages/app/campanas/functionalComponents/campaignEmailBody";
import type { CampaignTheme } from "../api/types";
import { compileCampaignEmail } from "./campaignEmailCompile";
import { runAdDesignAction, type AdDesignRequest } from "./adDesign";

/*
 * Design engine of the campaign tools (coordination id campaign_tools_v1).
 *
 * Forky and the WhatsApp bot edit a campaign design with the SAME operations
 * the visual builder performs (palette blocks, layers, inspector fields,
 * duplicate / move / delete, raw HTML), because they run the builder's own
 * document model (ui/htmlBuilder/document.ts / emailBuilderBlocks.ts) here with a
 * jsdom parser. The Go backend owns persistence, permissions, confirmations
 * and the AI; this module is a pure function: design in, design out.
 *
 * Element ids: the stored design carries no editing ids, so this engine
 * numbers every element in document order ("e1", "e2"...). The numbering only
 * depends on the HTML, so the ids a read returns stay valid until the design
 * changes; every edit answers with the renumbered layers.
 */

export const CAMPAIGN_DESIGN_PATH = "/bo-tools/campaign-design";
export const CAMPAIGN_DESIGN_MAX_BYTES = 1024 * 1024;

const ROOT_ID = "e1";
const OP_NAMES = ["add_block", "insert_html", "set_text", "set_html", "set_attrs", "set_style", "set_classes", "set_visibility", "move", "duplicate", "remove", "replace_element", "replace_html"];
const MAX_OPS = 40;

export type DesignOp = {
  op?: string;
  /** Aliases models often write instead of `op`. */
  type?: string;
  action?: string;
  id?: string;
  target?: string;
  position?: string;
  block?: string;
  html?: string;
  text?: string;
  href?: string;
  src?: string;
  alt?: string;
  scope?: string;
  styles?: Record<string, string | null>;
  classes?: string;
  add?: string[];
  remove?: string[];
  visibility?: string;
  channel?: string;
  direction?: string;
};

export type DesignRequest = {
  action?: string;
  html?: string;
  id?: string;
  ops?: DesignOp[];
  ctx?: Partial<BlockContext>;
  markdown?: string;
  theme?: Partial<CampaignTheme>;
  compile?: { title?: string } | null;
} & Omit<AdDesignRequest, "action">;

type Layer = {
  id: string;
  depth: number;
  label: string;
  kind: string;
  role?: string;
  text?: string;
  href?: string;
  src?: string;
  alt?: string;
  classes?: string;
  hidden?: boolean;
  /** campaign_block_channel_v1: "email" or "whatsapp" when the block is sent on one channel only. */
  channel?: "email" | "whatsapp";
  children: number;
};

class DesignOpError extends Error {}

function fail(message: string): never {
  throw new DesignOpError(message);
}

function blockContext(raw: Partial<BlockContext> | undefined): BlockContext {
  return {
    brandName: String(raw?.brandName ?? "").trim(),
    logoUrl: String(raw?.logoUrl ?? "").trim(),
    websiteUrl: String(raw?.websiteUrl ?? "").trim(),
    accent: String(raw?.accent ?? "").trim(),
  };
}

/** Sanitized design numbered in document order: the addressing every op uses. */
function numbered(html: string): string {
  const body = parseFragment(html);
  sanitize(body);
  let n = 0;
  for (const el of Array.from(body.querySelectorAll("*"))) el.setAttribute(EB_ID, `e${++n}`);
  return body.innerHTML.trim();
}

function requireElement(html: string, id: string | undefined, op: string): HTMLElement {
  const el = findById(parseFragment(html), String(id ?? "").trim() || null);
  if (!el) fail(`${op}: no existe el elemento ${id ?? "(sin id)"}; lee las capas de nuevo`);
  return el;
}

function insertPosition(raw: string | undefined, fallback: InsertPosition | "block-after"): InsertPosition | "block-after" {
  const p = String(raw ?? "").trim();
  if (!p) return fallback;
  if (p === "before" || p === "after" || p === "inside") return p;
  return fail(`position inválida: ${p} (before, after o inside)`);
}

/** Inspector colours accept a hex (#0f766e) or a full Tailwind class. */
function groupClass(group: ClassGroupId, value: string): string {
  const v = value.trim();
  if (/^#[0-9a-fA-F]{3,8}$/.test(v) && (group === "textColor" || group === "bgColor")) return `${group === "textColor" ? "text" : "bg"}-[${v}]`;
  if (!classGroupMatches(group, v)) fail(`set_style: «${v}» no es un valor de ${group}`);
  return v;
}

const setClassAttr = (node: HTMLElement, classes: string[]) => (classes.length ? node.setAttribute("class", classes.join(" ")) : node.removeAttribute("class"));

/** Applies one op to the numbered design; returns the new design and the element it created, if any. */
function applyOp(html: string, op: DesignOp, ctx: BlockContext): { html: string; created?: string | null } {
  const kind = String(op.op ?? op.type ?? op.action ?? "").trim();
  const id = String(op.id ?? "").trim();
  switch (kind) {
    case "add_block": {
      const block = blockByKind(String(op.block ?? ""));
      if (!block) fail(`add_block: bloque desconocido «${op.block ?? ""}» (${EMAIL_BLOCKS.map((b) => b.kind).join(", ")})`);
      if (op.target) requireElement(html, op.target, kind);
      if (op.src !== undefined && !builderSafeUrl(String(op.src))) fail(`add_block: URL no permitida para src: ${op.src}`);
      const res = insertSnippet(html, block.html(ctx), op.target ?? null, insertPosition(op.position, "block-after"));
      if ((op.src === undefined && op.alt === undefined) || !res.id) return { html: res.html, created: res.id };
      // src/alt fill the first image of the new block (an image uploaded from
      // a chat lands in the palette's own image block, campaign_tools_v1).
      const created = res.id;
      let hasImage = false;
      const next = updateElement(res.html, created, (node) => {
        const img = node.tagName === "IMG" ? node : node.querySelector("img");
        if (!img) return;
        hasImage = true;
        if (op.src !== undefined) img.setAttribute("src", String(op.src).trim());
        if (op.alt !== undefined) img.setAttribute("alt", String(op.alt));
      });
      if (!hasImage) fail(`add_block: el bloque «${op.block}» no tiene imagen para src/alt`);
      return { html: next, created };
    }
    case "insert_html": {
      if (!String(op.html ?? "").trim()) fail("insert_html: falta html");
      if (op.target) requireElement(html, op.target, kind);
      const res = insertSnippet(html, String(op.html), op.target ?? null, insertPosition(op.position, "block-after"));
      if (!res.id) fail("insert_html: el html no contiene elementos permitidos");
      return { html: res.html, created: res.id };
    }
    case "set_text": {
      const el = requireElement(html, id, kind);
      if (typeof op.text !== "string") fail("set_text: falta text");
      // Plain text replaces every child: it must never wipe a link, an image
      // or bold text silently. Those are edited on the inner element (it has
      // its own id in the layers) or with set_html.
      const inner = Array.from(el.children).filter((c) => c.tagName !== "BR");
      if (inner.length) fail(`set_text: ${id} contiene otros elementos (${inner.map((c) => `${c.getAttribute(EB_ID) ?? "?"} <${c.tagName.toLowerCase()}>`).join(", ")}); edita el elemento interior o usa set_html`);
      const text = op.text;
      return {
        html: updateElement(html, id, (node) => {
          node.textContent = "";
          text.split("\n").forEach((line, i) => {
            if (i > 0) node.appendChild(node.ownerDocument.createElement("br"));
            node.appendChild(node.ownerDocument.createTextNode(line));
          });
        }),
      };
    }
    case "set_html": {
      requireElement(html, id, kind);
      if (typeof op.html !== "string") fail("set_html: falta html");
      const inner = op.html;
      return {
        html: updateElement(html, id, (node) => {
          node.innerHTML = inner;
        }),
      };
    }
    case "set_attrs": {
      const el = requireElement(html, id, kind);
      const tag = el.tagName.toLowerCase();
      if (op.href === undefined && op.src === undefined && op.alt === undefined) fail("set_attrs: indica href, src o alt");
      if (op.href !== undefined && tag !== "a") fail(`set_attrs: ${id} no es un enlace (<${tag}>)`);
      if ((op.src !== undefined || op.alt !== undefined) && tag !== "img") fail(`set_attrs: ${id} no es una imagen (<${tag}>)`);
      for (const [name, value] of [["href", op.href], ["src", op.src]] as const) {
        if (value !== undefined && !builderSafeUrl(String(value))) fail(`set_attrs: URL no permitida para ${name}: ${value}`);
      }
      return {
        html: updateElement(html, id, (node) => {
          if (op.href !== undefined) node.setAttribute("href", String(op.href).trim());
          if (op.src !== undefined) node.setAttribute("src", String(op.src).trim());
          if (op.alt !== undefined) node.setAttribute("alt", String(op.alt));
        }),
      };
    }
    case "set_style": {
      const el = requireElement(html, id, kind);
      const scope = String(op.scope ?? "all").trim() || "all";
      if (scope !== "all" && scope !== "md") fail(`set_style: scope inválido ${scope} (all o md)`);
      const prefix = scope === "md" ? "md:" : "";
      const styles = op.styles ?? {};
      if (!Object.keys(styles).length) fail("set_style: falta styles");
      let classes = splitClasses(el.getAttribute("class"));
      for (const [group, value] of Object.entries(styles)) {
        if (!CLASS_GROUP_IDS.includes(group as ClassGroupId)) fail(`set_style: grupo desconocido ${group} (${CLASS_GROUP_IDS.join(", ")})`);
        const g = group as ClassGroupId;
        classes = writeGroup(classes, g, value === null || String(value).trim() === "" ? null : groupClass(g, String(value)), prefix);
      }
      return { html: updateElement(html, id, (node) => setClassAttr(node, classes)) };
    }
    case "set_classes": {
      const el = requireElement(html, id, kind);
      let classes = typeof op.classes === "string" ? splitClasses(op.classes) : splitClasses(el.getAttribute("class"));
      const remove = new Set((op.remove ?? []).map((c) => String(c).trim()));
      classes = classes.filter((c) => !remove.has(c));
      for (const raw of op.add ?? []) {
        const c = String(raw).trim();
        if (c && !classes.includes(c)) classes.push(c);
      }
      return { html: updateElement(html, id, (node) => setClassAttr(node, classes)) };
    }
    case "set_visibility": {
      const el = requireElement(html, id, kind);
      const v = String(op.visibility ?? "").trim();
      // campaign_block_channel_v1: channel = all | email | whatsapp (which
      // channel sends the block); visibility = all | mobile | desktop (screen).
      const ch = String(op.channel ?? "").trim().toLowerCase();
      if (!v && !ch) fail("set_visibility: indica visibility (all, mobile, desktop) y/o channel (all, email, whatsapp)");
      if (v && v !== "all" && v !== "mobile" && v !== "desktop") fail("set_visibility: visibility debe ser all, mobile o desktop");
      if (ch && ch !== "all" && ch !== "email" && ch !== "whatsapp") fail("set_visibility: channel debe ser all, email o whatsapp");
      const classes = v ? writeVisibility(splitClasses(el.getAttribute("class")), v as Visibility) : null;
      return {
        html: updateElement(html, id, (node) => {
          if (classes) setClassAttr(node, classes);
          if (ch) writeChannel(node, ch as BlockChannel);
        }),
      };
    }
    case "move": {
      requireElement(html, id, kind);
      if (op.direction) {
        if (op.direction !== "up" && op.direction !== "down") fail("move: direction debe ser up o down");
        return { html: moveElement(html, id, op.direction === "up" ? -1 : 1) };
      }
      if (!op.target) fail("move: indica direction (up/down) o target + position");
      requireElement(html, op.target, kind);
      const position = insertPosition(op.position, "after");
      return { html: moveElementTo(html, id, op.target, position === "block-after" ? "after" : position) };
    }
    case "duplicate": {
      requireElement(html, id, kind);
      const res = duplicateElement(html, id);
      return { html: res.html, created: res.id };
    }
    case "remove": {
      const el = requireElement(html, id, kind);
      if (id === ROOT_ID || el.getAttribute(EB_ROLE) === "content") fail("remove: el fondo y el cuerpo del email no se pueden eliminar");
      return { html: removeElement(html, id) };
    }
    case "replace_element": {
      requireElement(html, id, kind);
      const snippet = String(op.html ?? "");
      if (!snippet.trim()) fail("replace_element: falta html");
      if (id === ROOT_ID) return { html: numbered(normalizeDesign(snippet)) };
      return {
        html: mutate(html, (body) => {
          const node = findById(body, id);
          if (node) node.replaceWith(...Array.from(parseFragment(snippet).childNodes));
        }),
      };
    }
    case "replace_html": {
      if (!String(op.html ?? "").trim()) fail("replace_html: falta html");
      return { html: numbered(normalizeDesign(String(op.html))) };
    }
    default:
      return fail(`${kind ? `operación desconocida: ${kind}` : "falta op"} (usa ${OP_NAMES.join(", ")})`);
  }
}

const HIDDEN_RE = /(^|\s)hidden(\s|$)|max-\[639px\]:hidden|(^|\s)sm:hidden/;

/**
 * The design as the tools see it: EVERY element in document order with what
 * the inspector shows. Unlike the Capas panel (which folds a text block and
 * its inline children into one row for the eye), a tool needs the id of the
 * link inside a button section or of the bold text inside a paragraph.
 */
export function inspectDesign(numberedHtml: string): Layer[] {
  const out: Layer[] = [];
  const visit = (parent: Element, depth: number) => {
    for (const el of Array.from(parent.children)) {
      if (el.tagName === "BR") continue;
      const kids = Array.from(el.children).filter((c) => c.tagName !== "BR");
      const layer: Layer = { id: el.getAttribute(EB_ID) ?? "", depth, label: elementLabel(el), kind: elementKind(el), children: kids.length };
      const role = el.getAttribute(EB_ROLE);
      if (role) layer.role = role;
      if (isTextElement(el)) layer.text = (el.textContent ?? "").trim().slice(0, 240);
      const tag = el.tagName.toLowerCase();
      if (tag === "a") layer.href = el.getAttribute("href") ?? "";
      if (tag === "img") {
        layer.src = el.getAttribute("src") ?? "";
        layer.alt = el.getAttribute("alt") ?? "";
      }
      const cls = el.getAttribute("class");
      if (cls) layer.classes = cls;
      if (HIDDEN_RE.test(cls ?? "")) layer.hidden = true;
      const channel = readChannel(el);
      if (channel !== "all") layer.channel = channel;
      out.push(layer);
      visit(el, depth + 1);
    }
  };
  visit(parseFragment(numberedHtml), 0);
  return out;
}

/** Maps the editing ids the ops created to their final document-order ids. */
function finalIds(html: string, created: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  let n = 0;
  for (const el of Array.from(parseFragment(html).querySelectorAll("*"))) {
    n++;
    const id = el.getAttribute(EB_ID);
    if (id && created.includes(id)) out[id] = `e${n}`;
  }
  return out;
}

function summary(html: string) {
  const content = parseFragment(html).querySelector(`[${EB_ROLE}="content"]`);
  return {
    bytes: html.length,
    has_unsubscribe_link: html.includes(UNSUBSCRIBE_PLACEHOLDER),
    blocks: content ? Array.from(content.children).map((c) => elementLabel(c)) : [],
  };
}

export type DesignResponse = { success: boolean } & Record<string, unknown>;

/** Entry point of POST /bo-tools/campaign-design. */
export async function runDesignRequest(req: DesignRequest): Promise<DesignResponse> {
  const action = String(req.action ?? "").trim();
  const ctx = blockContext(req.ctx);
  const respond = async (html: string, extra: Record<string, unknown>): Promise<DesignResponse> => {
    const out: DesignResponse = { success: true, html, layers: inspectDesign(numbered(html)), design: summary(html), ...extra };
    if (req.compile) {
      const compiled = await compileCampaignEmail(html, String(req.compile.title ?? ""));
      out.email_html = compiled.emailHtml;
      out.whatsapp_markdown = compiled.whatsappMarkdown;
    }
    return out;
  };
  switch (action) {
    case "blocks":
      return { success: true, blocks: EMAIL_BLOCKS.map(({ kind, label, description }) => ({ kind, label, description })), style_groups: CLASS_GROUP_IDS };
    case "ensure": {
      // Same rule as the editor: a design that exists stays; a campaign written
      // before the builder keeps its message inside the frame; anything else
      // starts from the default template.
      const current = String(req.html ?? "").trim();
      if (current) return respond(stripIds(normalizeDesign(current)), { created: false });
      const markdown = String(req.markdown ?? "").trim();
      const theme = { background: "", surface: "", text: "", accent: ctx.accent, fontFamily: "", maxWidth: 600, align: "center", ...(req.theme ?? {}) } as CampaignTheme;
      const design = markdown ? legacyDesign(ctx, renderCampaignEmailBody(markdown, theme)) : defaultDesign(ctx);
      return respond(stripIds(normalizeDesign(design)), { created: true, source: markdown ? "legacy" : "default" });
    }
    case "inspect":
      return respond(stripIds(normalizeDesign(String(req.html ?? ""))), {});
    case "ad_compile":
    case "ad_default":
    case "ad_sync":
    case "ad_kind":
    case "ad_convert":
      // ads_html_editor_v1: the ad model of the backoffice editor.
      return runAdDesignAction({ ...req, action }, ctx);
    case "compile":
      return respond(stripIds(normalizeDesign(String(req.html ?? ""))), {});
    case "element": {
      // Outer HTML of one element: the selection the AI assistant focuses on.
      const id = String(req.id ?? "").trim();
      const html = id ? elementHtml(numbered(String(req.html ?? "")), id) : "";
      if (!html) return { success: false, message: `No existe el elemento ${id || "(sin id)"}; lee las capas de nuevo` };
      return { success: true, html };
    }
    case "apply": {
      const ops = Array.isArray(req.ops) ? req.ops : [];
      if (!ops.length) return { success: false, message: "Faltan operaciones (ops)" };
      if (ops.length > MAX_OPS) return { success: false, message: `Máximo ${MAX_OPS} operaciones por llamada` };
      let html = numbered(String(req.html ?? ""));
      const created: { index: number; id: string }[] = [];
      for (const [index, op] of ops.entries()) {
        try {
          const res = applyOp(html, op ?? {}, ctx);
          html = res.html;
          if (res.created) created.push({ index, id: res.created });
        } catch (err) {
          if (err instanceof DesignOpError) return { success: false, message: `Operación ${index + 1} (${op?.op ?? op?.type ?? op?.action ?? "sin op"}): ${err.message}`, failed_op: index };
          throw err;
        }
      }
      // New nodes keep their editing id until here: report them by their final
      // document-order id, the one the returned layers use.
      const ids = finalIds(html, created.map((c) => c.id));
      return respond(stripIds(html), { created: created.map((c) => ({ op: c.index, id: ids[c.id] ?? null })) });
    }
    default:
      return { success: false, message: `action desconocida: ${action || "(vacía)"}` };
  }
}
