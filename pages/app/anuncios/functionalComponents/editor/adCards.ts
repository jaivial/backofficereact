import { AD_STEP_ATTR } from "./adBlocks";

/*
 * Card design controls of a multiple ad (ads_html_editor_v1): the cards of a
 * grid share one look, so every control applies to the whole grid at once.
 * Everything is plain Tailwind classes on the card elements.
 *
 * The window of an ad is about as wide on a tablet as on a desktop, so the
 * layout goes by DEVICE, not by width: every page is rendered with
 * <html class="group/vp" data-vp="mobile|tablet|desktop">. The base classes
 * are the tablet and phone layout; the desktop one is written with the
 * DESKTOP variant (group-data-[vp=desktop]/vp:) only where it differs.
 *
 *   layout       desktop: horizontal (image beside) | vertical (image on top)
 *   mobileLayout tablet and phone: horizontal | vertical
 *   imageSize    s | m | l | xl (per layout: side square or top band height)
 *   columns      1 | 2 | 3 on desktop (tablet and phone: one card per row)
 *   width        full | medium | narrow (max width of the grid, centred)
 *   more         text | dark | light (the «Ver más» of each card)
 *
 * Each control rewrites its own family of classes (with or without the
 * device or old sm:/md: prefixes), so colours and texts set by the person or
 * the AI stay as they are.
 */

export type CardLayout = "horizontal" | "vertical";
export type CardImageSize = "s" | "m" | "l" | "xl";
export type CardColumns = "1" | "2" | "3";
export type CardWidth = "full" | "medium" | "narrow";
export type CardMore = "text" | "dark" | "light";

export type CardDesign = {
  layout: CardLayout;
  mobileLayout: CardLayout;
  imageSize: CardImageSize;
  columns: CardColumns;
  width: CardWidth;
  more: CardMore;
};

export type CardGroup = { grid: Element; cards: Element[] };

/** Variant of the desktop layout (the page <html> carries data-vp). */
export const DESKTOP = "group-data-[vp=desktop]/vp:";

const MORE_RE = /^\s*ver\s+m[aá]s/i;

const classesOf = (el: Element) => (el.getAttribute("class") ?? "").split(/\s+/).filter(Boolean);

/** A class without its responsive / device prefix. */
const bare = (c: string) => c.replace(/^(sm:|md:|lg:)/, "").replace(DESKTOP, "");

/** Replaces the classes whose bare form matches `drop` with `add` (kept order, no repeats). */
function swap(el: Element, drop: RegExp, add: string[]) {
  const kept = classesOf(el).filter((c) => !drop.test(bare(c)));
  const next = [...kept, ...add.filter((c) => !kept.includes(c))];
  if (next.length) el.setAttribute("class", next.join(" "));
  else el.removeAttribute("class");
}

const directCards = (grid: Element) => Array.from(grid.children).filter((c) => c.hasAttribute(AD_STEP_ATTR));

/**
 * The grid the element belongs to: from a card (or anything inside one) its
 * parent; from a container, the first grid of cards inside it.
 */
export function cardGroupOf(el: Element): CardGroup | null {
  const card = el.closest(`[${AD_STEP_ATTR}]`);
  if (card?.parentElement) return { grid: card.parentElement, cards: directCards(card.parentElement) };
  const inner = el.querySelector(`[${AD_STEP_ATTR}]`);
  if (inner?.parentElement) return { grid: inner.parentElement, cards: directCards(inner.parentElement) };
  return null;
}

const imageOf = (card: Element) => card.querySelector("img");
/** The text block of a card: the first child element without the image. */
const bodyOf = (card: Element) => Array.from(card.children).find((c) => c.tagName !== "IMG" && !c.querySelector("img")) ?? null;
/** The «Ver más» of a card (named, or the deepest element whose text starts with it). */
export function moreOf(card: Element): Element | null {
  const named = card.querySelector('[data-eb-name="Ver más"]');
  if (named) return named;
  const hits = Array.from(card.querySelectorAll("p, span, div")).filter((e) => MORE_RE.test(e.textContent ?? ""));
  return hits.find((e) => !Array.from(e.children).some((c) => MORE_RE.test(c.textContent ?? ""))) ?? null;
}

const CARD_LAYOUT_RE = /^(flex|flex-col|flex-row|block|inline-block|grid|items-\S+|justify-\S+|gap-\S+|p-\S+|px-\S+|py-\S+|pt-\S+|pb-\S+|pl-\S+|pr-\S+|overflow-\S+|text-(left|center|right))$/;
const IMAGE_RE = /^(block|size-\S+|w-\S+|h-\S+|min-w-\S+|max-w-\S+|min-h-\S+|max-h-\S+|aspect-\S+|shrink-\S+|object-\S+|rounded(-\S+)?)$/;
const BODY_PAD_RE = /^(p-\S+|px-\S+|py-\S+|pt-\S+|pb-\S+)$/;
const COLUMNS_RE = /^grid-cols-\d+$/;
const WIDTH_RE = /^(max-w-\S+|mx-auto|w-full)$/;
const MORE_STYLE_RE = /^(inline-block|block|rounded(-\S+)?|bg-\S+|px-\S+|py-\S+|m-\S+|mt-\S+|mb-\S+|text-(xs|sm|base|lg|\[[^\]]*\]|white|black|gray-\S+)|font-\S+|border(-\S+)?|ring(-\S+)?|shadow(-\S+)?|no-underline|underline)$/;

/** Card layout: every property one layout sets, the other overrides. */
const CARD_SET: Record<CardLayout, string[]> = {
  horizontal: ["flex-row", "items-center", "gap-4", "p-3"],
  vertical: ["flex-col", "items-stretch", "gap-0", "p-0"],
};
const CARD_BASE = ["flex", "overflow-hidden", "text-left"];

/** Side square (horizontal) or top band height (vertical), per size. */
const SIDE: Record<CardImageSize, string> = { s: "20", m: "24", l: "28", xl: "36" };
const BAND: Record<CardImageSize, string> = { s: "32", m: "40", l: "52", xl: "64" };
const imageSet = (layout: CardLayout, size: CardImageSize) =>
  layout === "vertical" ? ["w-full", `h-${BAND[size]}`, "rounded-none"] : [`w-${SIDE[size]}`, `h-${SIDE[size]}`, "rounded-xl"];
const IMAGE_BASE = ["block", "shrink-0", "object-cover"];
const BODY_SET: Record<CardLayout, string[]> = { horizontal: ["p-0"], vertical: ["p-4"] };

const desktop = (classes: string[]) => classes.map((c) => DESKTOP + c);

function layoutOf(classes: string[], device: "base" | "desktop"): CardLayout | null {
  const scoped = device === "desktop" ? classes.filter((c) => c.startsWith(DESKTOP)).map(bare) : classes.filter((c) => !c.includes(":"));
  if (scoped.includes("flex-col")) return "vertical";
  if (scoped.includes("flex-row") || (device === "base" && scoped.includes("flex"))) return "horizontal";
  return null;
}

function sizeOf(classes: string[], layout: CardLayout, device: "base" | "desktop"): CardImageSize | null {
  const scoped = device === "desktop" ? classes.filter((c) => c.startsWith(DESKTOP)).map(bare) : classes.filter((c) => !c.includes(":"));
  const table = layout === "vertical" ? BAND : SIDE;
  const prefix = layout === "vertical" ? "h-" : "w-";
  const found = (Object.keys(table) as CardImageSize[]).find((k) => scoped.includes(prefix + table[k]));
  if (found) return found;
  // Cards written before this model: size-24 sm:size-28, size-36 sm:size-48…
  const legacy = classes.map((c) => /^size-(\d+)$/.exec(c)?.[1]).find(Boolean);
  return legacy ? ({ "20": "s", "24": "m", "28": "l", "36": "xl" } as Record<string, CardImageSize>)[legacy] ?? "m" : null;
}

/** Reads the current design of a grid (from its first card). */
export function readCardDesign(group: CardGroup): CardDesign {
  const first = group.cards[0];
  const cardClasses = first ? classesOf(first) : [];
  const mobileLayout = layoutOf(cardClasses, "base") ?? "horizontal";
  const layout = layoutOf(cardClasses, "desktop") ?? mobileLayout;
  const img = first ? imageOf(first) : null;
  const imgClasses = img ? classesOf(img) : [];
  const imageSize = sizeOf(imgClasses, layout, layout === mobileLayout ? "base" : "desktop") ?? sizeOf(imgClasses, mobileLayout, "base") ?? "m";
  const gridClasses = classesOf(group.grid);
  const cols = gridClasses.map((c) => /^(?:sm:|md:|group-data-\[vp=desktop\]\/vp:)grid-cols-(\d)$/.exec(c)?.[1]).find(Boolean);
  const columns: CardColumns = cols === "2" || cols === "3" ? cols : "1";
  const width: CardWidth = gridClasses.includes("max-w-md") ? "narrow" : gridClasses.includes("max-w-xl") ? "medium" : "full";
  const more = first ? moreOf(first) : null;
  const moreClasses = more ? classesOf(more) : [];
  const moreStyle: CardMore = !moreClasses.some((c) => c.startsWith("bg-")) ? "text" : moreClasses.includes("bg-white") ? "light" : "dark";
  return { layout, mobileLayout, imageSize, columns, width, more: moreStyle };
}

function applyLayout(card: Element, d: CardDesign) {
  const same = d.layout === d.mobileLayout;
  swap(card, CARD_LAYOUT_RE, [...CARD_BASE, ...CARD_SET[d.mobileLayout], ...(same ? [] : desktop(CARD_SET[d.layout]))]);
  const img = imageOf(card);
  if (img) swap(img, IMAGE_RE, [...IMAGE_BASE, ...imageSet(d.mobileLayout, d.imageSize), ...(same ? [] : desktop(imageSet(d.layout, d.imageSize)))]);
  const body = bodyOf(card);
  if (body) swap(body, BODY_PAD_RE, [...BODY_SET[d.mobileLayout], ...(same ? [] : desktop(BODY_SET[d.layout]))]);
}

/** Title colour of a card: the «Ver más» as plain text takes it. */
function titleColor(card: Element): string {
  const heading = card.querySelector("h1,h2,h3,h4,h5,h6");
  return (heading ? classesOf(heading) : []).find((c) => /^text-\[#[0-9a-fA-F]{3,8}\]$/.test(c)) ?? "text-gray-900";
}

function applyMore(card: Element, style: CardMore) {
  const more = moreOf(card);
  if (!more) return;
  if (!more.getAttribute("data-eb-name")) more.setAttribute("data-eb-name", "Ver más");
  const add =
    style === "dark"
      ? ["mb-0", "mt-3", "inline-block", "rounded-full", "bg-[#111111]", "px-5", "py-2", "text-sm", "font-bold", "text-white", "ring-1", "ring-white/25"]
      : style === "light"
        ? ["mb-0", "mt-3", "inline-block", "rounded-full", "bg-white", "px-5", "py-2", "text-sm", "font-bold", "text-[#111111]"]
        : ["mb-0", "mt-2", "text-sm", "font-bold", titleColor(card)];
  swap(more, MORE_STYLE_RE, add);
}

/** Applies a change of design to every card of the grid. */
export function applyCardDesign(group: CardGroup, patch: Partial<CardDesign>) {
  const next = { ...readCardDesign(group), ...patch };
  if (patch.layout || patch.mobileLayout || patch.imageSize) for (const card of group.cards) applyLayout(card, next);
  // Columns are a desktop decision: tablets and phones show one card per row.
  if (patch.columns || patch.layout || patch.mobileLayout) swap(group.grid, COLUMNS_RE, next.columns === "1" ? [] : [`${DESKTOP}grid-cols-${next.columns}`]);
  if (patch.width) swap(group.grid, WIDTH_RE, next.width === "full" ? [] : ["mx-auto", "w-full", next.width === "narrow" ? "max-w-md" : "max-w-xl"]);
  if (patch.more) for (const card of group.cards) applyMore(card, next.more);
}

/**
 * Gives every other card of the grid the look of `source`: the classes of the
 * card and of each element at the same position (same tag), so texts, images
 * and links of each card stay its own.
 */
export function matchCardsTo(group: CardGroup, source: Element) {
  const walk = (from: Element, to: Element) => {
    const cls = from.getAttribute("class");
    if (cls) to.setAttribute("class", cls);
    else to.removeAttribute("class");
    const a = Array.from(from.children);
    const b = Array.from(to.children);
    a.forEach((child, i) => {
      if (b[i] && b[i].tagName === child.tagName) walk(child, b[i]);
    });
  };
  for (const card of group.cards) if (card !== source) walk(source, card);
}
