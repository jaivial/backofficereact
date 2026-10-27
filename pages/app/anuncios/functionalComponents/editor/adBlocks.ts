import { EB_NAME, EB_ROLE } from "../../../../../ui/htmlBuilder/document";
import type { BlockContext, BlockDef } from "../../../../../ui/htmlBuilder/blocks";

/*
 * Palette of the ad editor (ads_html_editor_v1): blocks for a popover shown
 * over the restaurant website, mobile-first Tailwind HTML like the campaign
 * blocks, but without email constraints. The ad window is 280-1200px wide, so
 * blocks fill its width and stack on phones.
 *
 * A multiple ad has a cards page: every element carrying data-ad-step is a
 * card that opens its step (the detail page of that offer).
 */

export const AD_STEP_ATTR = "data-ad-step";

export type AdBlockKind =
  | "hero" | "heading" | "text" | "button" | "buttons" | "image" | "columns" | "list"
  | "price" | "date" | "coupon" | "divider" | "spacer" | "card";

export type AdBlockDef = BlockDef & { kind: AdBlockKind };

const PAD = "px-6 sm:px-8";
export const esc = (v: string) => v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
export const accentOf = (ctx: BlockContext) => (/^#[0-9a-fA-F]{3,8}$/.test(ctx.accent) ? ctx.accent : "#1e4636");
const site = (ctx: BlockContext) => (ctx.websiteUrl || "https://").replace(/\/+$/, "");
const reserve = (ctx: BlockContext) => esc(ctx.websiteUrl ? `${site(ctx)}/reservas` : "https://");
const placeholder = (w: number, h: number, text: string) => `https://placehold.co/${w}x${h}/e5e7eb/6b7280/png?text=${encodeURIComponent(text)}`;
const section = (name: string, inner: string, extra = "") => `<div ${EB_NAME}="${name}" class="${PAD} pt-5 ${extra}">${inner}</div>`;
const button = (ctx: BlockContext, label: string, href: string, solid = true) =>
  solid
    ? `<a href="${href}" class="inline-block rounded-xl bg-[${accentOf(ctx)}] px-6 py-3 text-base font-bold text-white no-underline">${label}</a>`
    : `<a href="${href}" class="inline-block rounded-xl border-2 border-solid border-[${accentOf(ctx)}] px-6 py-3 text-base font-bold text-[${accentOf(ctx)}] no-underline">${label}</a>`;

/** New step id for a card (unique enough within one ad; the backend checks it). */
export function newStepId(): string {
  return `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/** One card of the cards page, opening step `id`. */
export function cardHtml(ctx: BlockContext, id: string, title = "Título de la propuesta", text = "Una frase que invite a abrirla.", image = ""): string {
  return (
    `<a ${EB_NAME}="Tarjeta" ${AD_STEP_ATTR}="${esc(id)}" href="#" class="block overflow-hidden rounded-2xl border border-solid border-gray-200 bg-white text-left no-underline shadow-sm">` +
    `<img src="${esc(image || placeholder(800, 500, "Imagen"))}" alt="${esc(title)}" class="block h-40 w-full object-cover">` +
    `<div class="p-4"><h3 class="m-0 text-lg font-bold leading-snug text-gray-900">${esc(title)}</h3>` +
    `<p class="mb-0 mt-1 text-sm leading-relaxed text-gray-600">${esc(text)}</p>` +
    `<p class="mb-0 mt-3 text-sm font-bold text-[${accentOf(ctx)}]">Ver más ›</p></div></a>`
  );
}

export const AD_BLOCKS: AdBlockDef[] = [
  {
    kind: "hero",
    label: "Portada",
    description: "Imagen a sangre, titular y entradilla",
    html: (ctx) =>
      `<div ${EB_NAME}="Portada"><img src="${placeholder(1200, 675, "Imagen principal")}" alt="Imagen principal del anuncio" class="block h-auto w-full">` +
      `<div class="${PAD} pt-6"><p class="m-0 text-xs font-bold uppercase tracking-widest text-[${accentOf(ctx)}]">Novedad</p>` +
      `<h2 class="mb-0 mt-2 text-2xl font-bold leading-tight text-gray-900 sm:text-3xl">Un titular que invite a reservar</h2>` +
      `<p class="mb-0 mt-2 text-base leading-relaxed text-gray-600">Cuenta en una frase qué ofreces y por qué no se lo pueden perder.</p></div></div>`,
  },
  { kind: "heading", label: "Título", description: "Encabezado de sección", html: () => section("Título", `<h2 class="m-0 text-xl font-bold leading-snug text-gray-900 sm:text-2xl">Título de la sección</h2>`) },
  { kind: "text", label: "Texto", description: "Párrafo", html: () => section("Texto", `<p class="m-0 text-base leading-relaxed text-gray-700">Escribe aquí el mensaje. Doble clic sobre el texto para editarlo en el lienzo.</p>`) },
  { kind: "button", label: "Botón", description: "Llamada a la acción", html: (ctx) => section("Botón", button(ctx, "Reservar mesa", reserve(ctx)), "text-center") },
  {
    kind: "buttons",
    label: "Dos botones",
    description: "Acción principal y secundaria",
    html: (ctx) => section("Botones", `${button(ctx, "Reservar mesa", reserve(ctx))} ${button(ctx, "Ver la carta", esc(site(ctx) || "https://"), false)}`, "flex flex-wrap justify-center gap-3"),
  },
  { kind: "image", label: "Imagen", description: "Imagen a todo el ancho", html: () => section("Imagen", `<img src="${placeholder(1200, 700, "Tu imagen")}" alt="Imagen del anuncio" class="block h-auto w-full rounded-xl">`) },
  {
    kind: "columns",
    label: "Dos columnas",
    description: "Se apilan en el móvil",
    html: () => {
      const col = (n: number) =>
        `<div ${EB_NAME}="Columna ${n}"><img src="${placeholder(600, 400, `Plato ${n}`)}" alt="Plato ${n}" class="block h-auto w-full rounded-xl">` +
        `<h3 class="mb-0 mt-3 text-lg font-bold text-gray-900">Plato destacado ${n}</h3><p class="mb-0 mt-1 text-sm leading-relaxed text-gray-600">Una frase que lo haga irresistible.</p></div>`;
      return section("Dos columnas", col(1) + col(2), "grid gap-4 sm:grid-cols-2");
    },
  },
  { kind: "list", label: "Lista", description: "Puntos clave o menú", html: () => section("Lista", `<ul class="m-0 pl-5 text-base leading-relaxed text-gray-700"><li>Entrantes para compartir</li><li class="mt-1">Principal a elegir</li><li class="mt-1">Postre y bebida</li></ul>`) },
  {
    kind: "price",
    label: "Precio",
    description: "Precio destacado",
    html: (ctx) =>
      section("Precio", `<div class="rounded-2xl bg-gray-50 px-6 py-4 text-center"><p class="m-0 text-xs font-bold uppercase tracking-widest text-gray-500">Menú completo</p><p class="mb-0 mt-1 text-4xl font-extrabold text-[${accentOf(ctx)}]">45 €</p><p class="mb-0 mt-1 text-sm text-gray-600">por persona · bebida incluida</p></div>`),
  },
  {
    kind: "date",
    label: "Fecha",
    description: "Día y horario del evento",
    html: (ctx) =>
      section("Fecha", `<div class="flex items-center gap-4 rounded-2xl border border-solid border-gray-200 px-4 py-3"><div class="rounded-xl bg-[${accentOf(ctx)}] px-3 py-2 text-center text-white"><p class="m-0 text-2xl font-extrabold leading-none">24</p><p class="m-0 mt-1 text-xs font-bold uppercase">dic</p></div><div><p class="m-0 text-base font-bold text-gray-900">Nochebuena</p><p class="mb-0 mt-0.5 text-sm text-gray-600">Comida · de 13:30 a 16:00</p></div></div>`),
  },
  {
    kind: "coupon",
    label: "Cupón",
    description: "Código o descuento",
    html: (ctx) =>
      section("Cupón", `<div class="rounded-2xl border-2 border-dashed border-[${accentOf(ctx)}] bg-gray-50 px-6 py-4 text-center"><p class="m-0 text-xs font-bold uppercase tracking-widest text-gray-500">Código de descuento</p><p class="mb-0 mt-1 text-3xl font-extrabold tracking-wider text-[${accentOf(ctx)}]">OTONO10</p><p class="mb-0 mt-1 text-sm text-gray-600">10 % en tu próxima reserva.</p></div>`),
  },
  { kind: "divider", label: "Separador", description: "Línea fina", html: () => section("Separador", `<hr class="m-0 border-0 border-t border-solid border-gray-200">`) },
  { kind: "spacer", label: "Espacio", description: "Aire entre bloques", html: () => `<div ${EB_NAME}="Espacio" class="h-6"></div>` },
  { kind: "card", label: "Tarjeta de paso", description: "Abre un paso nuevo del anuncio", html: (ctx) => cardHtml(ctx, newStepId()) },
];

/** Blocks offered on each page: the step card only on the cards page. */
export function adBlocksFor(page: "single" | "cards" | "step"): AdBlockDef[] {
  return AD_BLOCKS.filter((b) => (b.kind === "card" ? page === "cards" : true));
}

/** The root every ad page lives in: full width of the ad window, bottom air. */
export function adFrame(name: string, inner: string): string {
  return `<div ${EB_NAME}="${name}" ${EB_ROLE}="content" class="w-full bg-white pb-6 font-sans text-gray-800">${inner}</div>`;
}

/** Starting design of a single ad. */
export function defaultSingleDesign(ctx: BlockContext): string {
  const html = (kind: AdBlockKind) => AD_BLOCKS.find((b) => b.kind === kind)?.html(ctx) ?? "";
  return adFrame("Anuncio", html("hero") + html("buttons"));
}

/** Cards page of a multiple ad, with one card per step. */
export function cardsDesign(ctx: BlockContext, cards: string[], title = "Nuestras propuestas", subtitle = "Elige una para ver todos los detalles."): string {
  return adFrame(
    "Tarjetas",
    `<div ${EB_NAME}="Cabecera" class="${PAD} pt-6"><h2 class="m-0 text-2xl font-bold leading-tight text-gray-900">${esc(title)}</h2>` +
      `<p class="mb-0 mt-1 text-base text-gray-600">${esc(subtitle)}</p></div>` +
      `<div ${EB_NAME}="Rejilla de tarjetas" class="${PAD} grid gap-4 pt-5 sm:grid-cols-2">${cards.join("")}</div>`,
  );
}

/** Detail page of one step: what its card opens. */
export function stepDesign(ctx: BlockContext, title: string): string {
  return adFrame(
    title || "Paso",
    `<div ${EB_NAME}="Portada"><img src="${placeholder(1200, 675, "Imagen")}" alt="${esc(title || "Imagen")}" class="block h-auto w-full">` +
      `<div class="${PAD} pt-6"><h2 class="m-0 text-2xl font-bold leading-tight text-gray-900 sm:text-3xl">${esc(title || "Título")}</h2>` +
      `<p class="mb-0 mt-2 text-base leading-relaxed text-gray-600">Cuenta aquí todos los detalles de esta propuesta.</p></div></div>` +
      AD_BLOCKS.find((b) => b.kind === "button")!.html(ctx),
  );
}
