import type {
  RestaurantAd, RestaurantAdCanvas, RestaurantAdCanvasElement, RestaurantAdContentElement, RestaurantAdCTA, RestaurantAdStep,
} from "../../../../../api/types";
import type { BlockContext } from "../../../../../ui/htmlBuilder/blocks";
import { EB_NAME } from "../../../../../ui/htmlBuilder/document";
import { AD_STEP_ATTR, accentOf, adFrame, esc } from "./adBlocks";
import { AD_DEFAULT_OVERLAY, defaultContainer, type AdDraft } from "./adDesign";

/*
 * One-way conversion of the ads made with the previous editor
 * (ads_html_editor_v1): classic content + buttons, the free canvas
 * (ads_canvas_v1, absolute boxes) and the multiple wizard (cards + steps).
 * The free canvas becomes flow layout: boxes are grouped in rows (overlapping
 * vertical spans) and, inside a row, in columns (overlapping horizontal
 * spans); a row with several columns is a grid that stacks on phones. The
 * result is a starting point the operator reviews before saving.
 */

const hex = (v: unknown) => (typeof v === "string" && /^#[0-9a-fA-F]{3,8}$/.test(v.trim()) ? v.trim() : "");
const num = (v: unknown, fallback = 0) => (typeof v === "number" && Number.isFinite(v) ? v : fallback);
const str = (v: unknown) => (typeof v === "string" ? v : "");
const safeUrl = (v: unknown) => {
  const raw = str(v).trim();
  return /^(https?:|mailto:|tel:)/i.test(raw) ? raw : "";
};
const multiline = (text: string) => esc(text).replace(/\r?\n/g, "<br>");
const align = (v: unknown) => (v === "center" ? "text-center" : v === "right" ? "text-right" : "text-left");

/** Absolute href of a legacy button (route = path of the restaurant website). */
function ctaHref(cta: RestaurantAdCTA, website: string): string {
  if (cta.navigation_mode === "custom") return safeUrl(cta.custom_url) || (str(cta.custom_url).startsWith("/") ? `${website}${cta.custom_url}` : "");
  const route = str(cta.route) || "/";
  return `${website}${route.startsWith("/") ? route : `/${route}`}`.replace(/(?<!:)\/\/+/g, "/") || "/";
}

function buttonHtml(text: string, href: string, bg: string, color: string, radius: number, bold: boolean): string {
  const r = radius > 0 ? `rounded-[${Math.round(radius)}px]` : "rounded-xl";
  return (
    `<div ${EB_NAME}="Botón" class="pt-3"><a href="${esc(href || "#")}" class="inline-block ${r} bg-[${bg}] px-6 py-3 text-base ${bold ? "font-bold" : "font-semibold"} text-[${color}] no-underline">${esc(text || "Ver más")}</a></div>`
  );
}

function textHtml(text: string, size: number, color: string, alignment: unknown, bold: boolean, italic: boolean): string {
  const cls = [align(alignment), color ? `text-[${color}]` : "text-gray-800", bold ? "font-bold" : "", italic ? "italic" : ""].filter(Boolean);
  if (size >= 28) return `<h2 class="m-0 pt-2 text-2xl leading-tight sm:text-3xl ${cls.join(" ")}">${multiline(text)}</h2>`;
  if (size >= 20) return `<h3 class="m-0 pt-2 text-xl leading-snug ${cls.join(" ")}">${multiline(text)}</h3>`;
  return `<p class="m-0 pt-2 text-base leading-relaxed ${cls.join(" ")}">${multiline(text)}</p>`;
}

function imageHtml(src: string, alt: string, w: number, h: number, radius: number, cover: boolean): string {
  const ratio = cover && w > 0 && h > 0 ? ` aspect-[${Math.round(w)}/${Math.round(h)}] object-cover` : " h-auto";
  const r = radius > 0 ? ` rounded-[${Math.round(radius)}px]` : "";
  return `<img src="${esc(src)}" alt="${esc(alt || "Imagen del anuncio")}" class="block w-full${ratio}${r}">`;
}

function canvasElementHtml(el: RestaurantAdCanvasElement): string {
  const p = el.props ?? {};
  if (el.type === "text") {
    const text = str(p.text).trim();
    return text ? textHtml(text, num(p.fontSize, 16), hex(p.color), p.align, Boolean(p.bold), Boolean(p.italic)) : "";
  }
  if (el.type === "image") {
    const src = safeUrl(p.src);
    return src ? `<div ${EB_NAME}="Imagen" class="pt-2">${imageHtml(src, str(p.alt), el.w, el.h, num(p.radius), p.fit !== "contain")}</div>` : "";
  }
  if (el.type === "button") return buttonHtml(str(p.text), safeUrl(p.href), hex(p.bg) || "#1e4636", hex(p.color) || "#ffffff", num(p.radius), Boolean(p.bold));
  return "";
}

type Box = { top: number; bottom: number; left: number; right: number; items: RestaurantAdCanvasElement[] };

function group(elements: RestaurantAdCanvasElement[], start: (e: RestaurantAdCanvasElement) => number, size: (e: RestaurantAdCanvasElement) => number): RestaurantAdCanvasElement[][] {
  const out: { end: number; items: RestaurantAdCanvasElement[] }[] = [];
  for (const el of [...elements].sort((a, b) => start(a) - start(b))) {
    const current = out[out.length - 1];
    if (current && start(el) < current.end - 4) {
      current.items.push(el);
      current.end = Math.max(current.end, start(el) + size(el));
    } else out.push({ end: start(el) + size(el), items: [el] });
  }
  return out.map((g) => g.items);
}

/** Free canvas -> flow HTML (rows of stacked or side-by-side columns). */
export function canvasToFlow(canvas: RestaurantAdCanvas): string {
  const elements = (canvas.elements ?? []).filter((el) => el.type !== "shape");
  const rows = group(elements, (e) => e.y, (e) => e.h);
  const html: string[] = [];
  rows.forEach((row, i) => {
    const columns = group(row, (e) => e.x, (e) => e.w).map((col) => [...col].sort((a, b) => a.y - b.y || a.x - b.x));
    const stack = (col: RestaurantAdCanvasElement[]) => col.map(canvasElementHtml).join("");
    if (columns.length === 1) html.push(`<div ${EB_NAME}="Fila ${i + 1}">${stack(columns[0])}</div>`);
    else
      html.push(
        `<div ${EB_NAME}="Fila ${i + 1}" class="grid items-center gap-6 sm:grid-cols-${Math.min(columns.length, 4)}">` +
          columns.map((col, c) => `<div ${EB_NAME}="Columna ${c + 1}">${stack(col)}</div>`).join("") +
          `</div>`,
      );
  });
  return html.join("");
}

/** Background of a page from the legacy canvas (shape filling it counts). */
function canvasBackground(canvas: RestaurantAdCanvas): { color: string; image: string } {
  const bg = canvas.background ?? { type: "color", value: "" };
  if (bg.type === "image") return { color: "", image: safeUrl(bg.value) };
  const area = Math.max(1, canvas.width * canvas.height);
  const fill = (canvas.elements ?? []).find((el) => el.type === "shape" && el.w * el.h >= area * 0.8);
  return { color: hex(bg.value) || hex(fill?.props?.fill), image: "" };
}

/** Top padding of a page's content: a step leaves room for the «Volver» and close chips. */
const STEP_TOP = "pt-16";

function canvasPage(name: string, canvas: RestaurantAdCanvas, step = false): string {
  const bg = canvasBackground(canvas);
  const cover = bg.image ? `<img src="${esc(bg.image)}" alt="" class="block h-auto w-full">` : "";
  const top = step && !cover ? STEP_TOP : "pt-6 sm:pt-10";
  const root = adFrame(name, `${cover}<div ${EB_NAME}="Contenido" class="px-6 ${top} sm:px-10">${canvasToFlow(canvas)}</div>`);
  return bg.color ? root.replace("bg-white", `bg-[${bg.color}]`) : root;
}

/** Classic content + buttons (title, subtitle, text, image; buttons by slot). */
function contentPage(name: string, content: RestaurantAdContentElement[], buttons: RestaurantAdCTA[], ctx: BlockContext, website: string, bgColor = "", step = false): string {
  const out: string[] = [];
  const btn = (cta: RestaurantAdCTA) => buttonHtml(cta.text, ctaHref(cta, website), hex(cta.color) || accentOf(ctx), "#ffffff", 12, true);
  content.forEach((item, index) => {
    for (const cta of buttons) if (cta.slot === index) out.push(btn(cta));
    const value = str(item.value).trim();
    if (!value) return;
    const color = hex(item.style?.color);
    if (item.type === "image") {
      if (safeUrl(value)) out.push(`<div ${EB_NAME}="Imagen" class="pt-3">${imageHtml(value, name, 0, 0, num(item.style?.radius, 16), false)}</div>`);
    } else if (item.type === "title") out.push(textHtml(value, 30, color, item.align, true, false));
    else if (item.type === "subtitle") out.push(textHtml(value, 20, color, item.align, true, false));
    else out.push(textHtml(value, 16, color, item.align, false, false));
  });
  const actions = buttons.filter((cta) => typeof cta.slot !== "number" || cta.slot >= content.length);
  if (actions.length) out.push(`<div ${EB_NAME}="Botones" class="flex flex-wrap justify-center gap-3">${actions.map(btn).join("")}</div>`);
  const root = adFrame(name, `<div ${EB_NAME}="Contenido" class="px-6 ${step ? STEP_TOP : "pt-6"} sm:px-8">${out.join("") || textHtml(name, 30, "", "center", true, false)}</div>`);
  return bgColor ? root.replace("bg-white", `bg-[${bgColor}]`) : root;
}

/** Card of a legacy wizard step: its card canvas look, or the classic card. */
function legacyCard(step: RestaurantAdStep, ctx: BlockContext): string {
  const cc = step.card_canvas;
  const image =
    safeUrl(cc?.elements?.find((el) => el.type === "image")?.props?.src) ||
    (step.background_mode === "image" ? safeUrl(step.background_image) : "") ||
    safeUrl(step.content?.find((c) => c.type === "image")?.value);
  const titleEl = cc?.elements?.find((el) => el.type === "text");
  const title = str(titleEl?.props?.text).trim() || step.title || "Ver propuesta";
  const bg = (cc ? canvasBackground(cc).color : "") || (step.background_mode === "color" ? hex(step.background_color) : "") || "#ffffff";
  const color = hex(titleEl?.props?.color) || (bg === "#ffffff" ? "#111827" : "#ffffff");
  const img = image ? `<img src="${esc(image)}" alt="${esc(title)}" class="block size-24 shrink-0 rounded-xl object-cover sm:size-28">` : "";
  const desc = step.description?.trim() ? `<p class="mb-0 mt-1 text-sm leading-snug text-[${color}] opacity-80">${esc(step.description.trim())}</p>` : "";
  return (
    `<a ${EB_NAME}="Tarjeta" ${AD_STEP_ATTR}="${esc(step.id)}" href="#" class="flex items-center gap-4 rounded-2xl bg-[${bg}] p-3 text-left no-underline shadow-sm">${img}` +
    `<div class="min-w-0"><h3 class="m-0 text-lg font-bold leading-snug text-[${color}] sm:text-xl">${esc(title)}</h3>${desc}` +
    `<p data-eb-name="Ver más" class="mb-0 mt-2 text-sm font-bold text-[${color}]">Ver más ›</p></div></a>`
  );
}

const STEP_ID_RE = /^[A-Za-z0-9_-]{1,40}$/;

/** True when the ad has something the converter can turn into a design. */
export function isLegacyAd(ad: RestaurantAd): boolean {
  return !ad.design && Boolean(ad.canvas || ad.layout?.mode === "multiple" || ad.content?.length || ad.ctas?.length);
}

/** Legacy ad -> editor draft (the operator reviews it and saves). */
export function draftFromLegacy(ad: RestaurantAd, ctx: BlockContext, website: string): AdDraft {
  const site = website.replace(/\/+$/, "");
  const legacyChrome = ad.canvas?.container ?? null;
  const steps = ad.layout?.mode === "multiple" ? (ad.layout.steps ?? []) : [];
  if (steps.length) {
    // Old step ids are UUID-like ("step-<uuid>", 41 chars): keep them when they
    // fit the new rule, otherwise give the step a short one.
    const ids = steps.map((s, i) => (STEP_ID_RE.test(s.id) ? s.id : `p${i + 1}${Math.random().toString(36).slice(2, 6)}`));
    const fixed = steps.map((s, i) => ({ ...s, id: ids[i] }));
    const widest = Math.max(0, ...steps.map((s) => s.canvas?.width ?? 0));
    const cards = fixed.map((s) => legacyCard(s, ctx)).join("");
    const main = adFrame(
      "Tarjetas",
      `<div ${EB_NAME}="Cabecera" class="px-6 pt-6 sm:px-8"><h2 class="m-0 text-2xl font-bold leading-tight text-gray-900">${esc(ad.name)}</h2>` +
        `<p class="mb-0 mt-1 text-base text-gray-600">Elige una opción para ver todos los detalles.</p></div>` +
        `<div ${EB_NAME}="Tarjetas" class="grid gap-4 px-6 pt-5 sm:px-8">${cards}</div>`,
    );
    return {
      kind: "multiple",
      container: { ...defaultContainer("multiple"), max_width: Math.min(1200, Math.max(560, widest || 760)) },
      main,
      steps: Object.fromEntries(
        fixed.map((s) => [
          s.id,
          {
            title: s.title || "Paso",
            html: s.canvas
              ? canvasPage(s.title || "Paso", s.canvas, true)
              : contentPage(s.title || "Paso", s.content ?? [], s.buttons ?? [], ctx, site, s.detail_background_mode === "color" ? hex(s.detail_background_color) : "", true),
          },
        ]),
      ),
    };
  }
  const container = {
    ...defaultContainer("single"),
    ...(legacyChrome?.maxWidth ? { max_width: Math.min(1200, Math.max(280, legacyChrome.maxWidth)) } : ad.canvas ? { max_width: Math.min(1200, Math.max(280, ad.canvas.width)) } : {}),
    overlay: legacyChrome?.overlay || AD_DEFAULT_OVERLAY,
    ...(typeof legacyChrome?.radius === "number" ? { radius: Math.min(48, Math.max(0, legacyChrome.radius)) } : {}),
  };
  return {
    kind: "single",
    container,
    main: ad.canvas ? canvasPage(ad.name || "Anuncio", ad.canvas) : contentPage(ad.name || "Anuncio", ad.content ?? [], ad.ctas ?? [], ctx, site),
    steps: {},
  };
}
