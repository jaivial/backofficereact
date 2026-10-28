import { AD_STEP_ATTR } from "./adBlocks";

/*
 * Card design controls of a multiple ad (ads_html_editor_v1): the cards of a
 * grid share one look, so every control applies to the whole grid at once.
 * Everything is plain Tailwind classes on the card elements:
 *
 *   layout     horizontal (image left) | vertical (image on top)
 *   imageSize  s | m | l | xl
 *   columns    1 | 2 | 3 (from 640px, i.e. tablet and desktop windows)
 *   width      full | medium | narrow (max width of the grid, centred)
 *   more       text | dark | light (the «Ver más» of each card)
 *
 * Each control removes its own family of classes and writes its own, so the
 * rest of a card (colours, borders, texts) stays as the person or the AI left it.
 */

export type CardLayout = "horizontal" | "vertical";
export type CardImageSize = "s" | "m" | "l" | "xl";
export type CardColumns = "1" | "2" | "3";
export type CardWidth = "full" | "medium" | "narrow";
export type CardMore = "text" | "dark" | "light";

export type CardDesign = { layout: CardLayout; imageSize: CardImageSize; columns: CardColumns; width: CardWidth; more: CardMore };

export type CardGroup = { grid: Element; cards: Element[] };

const MORE_RE = /^\s*ver\s+m[aá]s/i;

const classesOf = (el: Element) => (el.getAttribute("class") ?? "").split(/\s+/).filter(Boolean);

/** Replaces the classes matching `drop` with `add` (kept order, no repeats). */
function swap(el: Element, drop: RegExp, add: string[]) {
  const kept = classesOf(el).filter((c) => !drop.test(c));
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

const CARD_LAYOUT_RE = /^(sm:|md:)?(flex|flex-col|flex-row|block|inline-block|grid|items-\S+|justify-\S+|gap-\S+|p-\S+|px-\S+|py-\S+|pt-\S+|pb-\S+|pl-\S+|pr-\S+|overflow-\S+|text-(left|center|right))$/;
const IMAGE_RE = /^(sm:|md:)?(block|size-\S+|w-\S+|h-\S+|min-w-\S+|max-w-\S+|min-h-\S+|max-h-\S+|aspect-\S+|shrink-\S+|object-\S+|rounded(-\S+)?)$/;
const BODY_PAD_RE = /^(sm:|md:)?(p-\S+|px-\S+|py-\S+|pt-\S+|pb-\S+)$/;
const COLUMNS_RE = /^(sm:|md:|lg:)?grid-cols-\d+$/;
const WIDTH_RE = /^(max-w-\S+|mx-auto|w-full)$/;
const MORE_STYLE_RE = /^(inline-block|block|rounded(-\S+)?|bg-\S+|px-\S+|py-\S+|m-\S+|mt-\S+|mb-\S+|text-(xs|sm|base|lg|\[[^\]]*\]|white|black|gray-\S+)|font-\S+|border(-\S+)?|ring(-\S+)?|shadow(-\S+)?|no-underline|underline)$/;

const IMAGE_SIZES: Record<CardLayout, Record<CardImageSize, string[]>> = {
  horizontal: {
    s: ["size-20"],
    m: ["size-24", "sm:size-28"],
    l: ["size-28", "sm:size-36"],
    xl: ["size-36", "sm:size-48"],
  },
  vertical: {
    s: ["h-32"],
    m: ["h-40"],
    l: ["h-52"],
    xl: ["h-64"],
  },
};

/** Reads the current design of a grid (from its first card). */
export function readCardDesign(group: CardGroup): CardDesign {
  const first = group.cards[0];
  const cardClasses = first ? classesOf(first) : [];
  const layout: CardLayout = cardClasses.includes("flex-col") ? "vertical" : "horizontal";
  const img = first ? imageOf(first) : null;
  const imgClasses = img ? classesOf(img) : [];
  const sizes = IMAGE_SIZES[layout];
  const imageSize = (Object.keys(sizes) as CardImageSize[]).find((k) => sizes[k].every((c) => imgClasses.includes(c))) ?? "m";
  const gridClasses = classesOf(group.grid);
  const cols = gridClasses.map((c) => /^sm:grid-cols-(\d)$/.exec(c)?.[1]).find(Boolean);
  const columns: CardColumns = cols === "2" || cols === "3" ? cols : "1";
  const width: CardWidth = gridClasses.includes("max-w-md") ? "narrow" : gridClasses.includes("max-w-xl") ? "medium" : "full";
  const more = first ? moreOf(first) : null;
  const moreClasses = more ? classesOf(more) : [];
  const moreStyle: CardMore = !moreClasses.some((c) => c.startsWith("bg-")) ? "text" : moreClasses.includes("bg-white") ? "light" : "dark";
  return { layout, imageSize, columns, width, more: moreStyle };
}

function applyLayout(card: Element, layout: CardLayout, size: CardImageSize) {
  swap(card, CARD_LAYOUT_RE, layout === "vertical" ? ["flex", "flex-col", "overflow-hidden", "text-left"] : ["flex", "items-center", "gap-4", "p-3", "text-left"]);
  const img = imageOf(card);
  if (img) {
    const base = layout === "vertical" ? ["block", "w-full", "object-cover"] : ["block", "shrink-0", "rounded-xl", "object-cover"];
    swap(img, IMAGE_RE, [...base, ...IMAGE_SIZES[layout][size]]);
  }
  const body = bodyOf(card);
  if (body) swap(body, BODY_PAD_RE, layout === "vertical" ? ["p-4"] : []);
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
  if (patch.layout || patch.imageSize) for (const card of group.cards) applyLayout(card, next.layout, next.imageSize);
  if (patch.columns) swap(group.grid, COLUMNS_RE, ["grid", ...(next.columns === "1" ? [] : [`sm:grid-cols-${next.columns}`])]);
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
