import { EB_NAME, EB_ROLE, UNSUBSCRIBE_PLACEHOLDER } from "./emailBuilderDocument";

/*
 * Component palette of the campaign HTML builder (campaign_html_builder_v1).
 * Every block is plain HTML written with Tailwind classes, mobile-first and
 * responsive by default: base classes are the phone, `sm:` / `md:` widen it for
 * tablet and desktop, and a 600px centred column keeps it readable in any
 * inbox. Blocks wrap their content in a padded section so they stack with the
 * same rhythm whatever order the operator picks.
 */

export type BlockContext = {
  brandName: string;
  logoUrl: string;
  websiteUrl: string;
  /** Brand accent (campaign theme), used for buttons and highlights. */
  accent: string;
};

export type BlockKind =
  | "header" | "hero" | "heading" | "text" | "button" | "image" | "columns" | "list"
  | "coupon" | "quote" | "divider" | "spacer" | "footer";

export type BlockDef = { kind: BlockKind; label: string; description: string; html: (ctx: BlockContext) => string };

const PAD = "px-6 sm:px-10";
const esc = (v: string) => v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const accentOf = (ctx: BlockContext) => (/^#[0-9a-fA-F]{3,8}$/.test(ctx.accent) ? ctx.accent : "#097969");
const site = (ctx: BlockContext) => esc(ctx.websiteUrl || "https://");
const placeholder = (w: number, h: number, text: string) => `https://placehold.co/${w}x${h}/e5e7eb/6b7280/png?text=${encodeURIComponent(text)}`;
const section = (name: string, inner: string, extra = "") => `<div ${EB_NAME}="${name}" class="${PAD} pt-6 ${extra}">${inner}</div>`;

export const EMAIL_BLOCKS: BlockDef[] = [
  {
    kind: "header",
    label: "Cabecera",
    description: "Banda de marca con el logo",
    html: (ctx) =>
      `<div ${EB_NAME}="Cabecera" ${EB_ROLE}="header" class="bg-[${accentOf(ctx)}] px-6 py-8 text-center">${
        ctx.logoUrl
          ? `<img src="${esc(ctx.logoUrl)}" alt="${esc(ctx.brandName || "Restaurante")}" class="mx-auto block h-auto max-w-[180px]">`
          : `<p class="m-0 text-2xl font-bold text-white">${esc(ctx.brandName || "Restaurante")}</p>`
      }</div>`,
  },
  {
    kind: "hero",
    label: "Portada",
    description: "Imagen grande, titular y entradilla",
    html: () =>
      section(
        "Portada",
        `<img src="${placeholder(1200, 600, "Imagen principal")}" alt="Imagen principal de la campaña" class="block h-auto w-full rounded-xl">` +
          `<h1 class="mb-0 mt-6 text-2xl font-bold leading-tight text-gray-900 sm:text-3xl">Un titular que invite a reservar</h1>` +
          `<p class="mb-0 mt-3 text-base leading-relaxed text-gray-600">Cuenta en una o dos frases qué ofreces y por qué no se lo pueden perder.</p>`,
        "sm:pt-8",
      ),
  },
  {
    kind: "heading",
    label: "Título",
    description: "Encabezado de sección",
    html: () => section("Título", `<h2 class="m-0 text-xl font-bold leading-snug text-gray-900 sm:text-2xl">Título de la sección</h2>`),
  },
  {
    kind: "text",
    label: "Texto",
    description: "Párrafo de texto",
    html: () =>
      section("Texto", `<p class="m-0 text-base leading-relaxed text-gray-700">Escribe aquí el mensaje. Doble clic sobre el texto para editarlo directamente en el lienzo.</p>`),
  },
  {
    kind: "button",
    label: "Botón",
    description: "Llamada a la acción centrada",
    html: (ctx) =>
      section(
        "Botón",
        `<a href="${site(ctx)}" class="inline-block rounded-lg bg-[${accentOf(ctx)}] px-6 py-3 text-base font-bold text-white no-underline">Reservar mesa</a>`,
        "text-center",
      ),
  },
  {
    kind: "image",
    label: "Imagen",
    description: "Imagen a todo el ancho",
    html: () => section("Imagen", `<img src="${placeholder(1200, 700, "Tu imagen")}" alt="Imagen de la campaña" class="block h-auto w-full rounded-xl">`),
  },
  {
    kind: "columns",
    label: "Dos columnas",
    description: "Se apilan en el móvil",
    html: () => {
      const col = (n: number, extra: string) =>
        `<div ${EB_NAME}="Columna ${n}" class="${extra}"><img src="${placeholder(600, 400, `Plato ${n}`)}" alt="Plato ${n}" class="block h-auto w-full rounded-xl">` +
        `<h3 class="mb-0 mt-3 text-lg font-bold text-gray-900">Plato destacado ${n}</h3>` +
        `<p class="mb-0 mt-1 text-sm leading-relaxed text-gray-600">Una frase que lo haga irresistible.</p></div>`;
      return section("Dos columnas", col(1, "md:w-1/2 md:pr-3") + col(2, "mt-6 md:mt-0 md:w-1/2 md:pl-3"), "md:flex");
    },
  },
  {
    kind: "list",
    label: "Lista",
    description: "Puntos clave o menú",
    html: () =>
      section(
        "Lista",
        `<ul class="m-0 pl-5 text-base leading-relaxed text-gray-700"><li>Entrante de temporada</li><li class="mt-1">Arroz del día</li><li class="mt-1">Postre casero</li></ul>`,
      ),
  },
  {
    kind: "coupon",
    label: "Cupón",
    description: "Código o descuento destacado",
    html: (ctx) =>
      section(
        "Cupón",
        `<div class="rounded-xl border-2 border-dashed border-[${accentOf(ctx)}] bg-gray-50 px-6 py-5 text-center">` +
          `<p class="m-0 text-xs font-bold uppercase tracking-widest text-gray-500">Código de descuento</p>` +
          `<p class="mb-0 mt-2 text-3xl font-extrabold tracking-wider text-[${accentOf(ctx)}]">VERANO10</p>` +
          `<p class="mb-0 mt-2 text-sm text-gray-600">10 % en tu próxima reserva hasta el 31 de agosto.</p></div>`,
      ),
  },
  {
    kind: "quote",
    label: "Opinión",
    description: "Cita de un cliente",
    html: (ctx) =>
      section(
        "Opinión",
        `<div class="rounded-xl bg-gray-50 px-6 py-5"><p class="m-0 text-base italic leading-relaxed text-gray-700">“Una cena perfecta: el servicio, el arroz y las vistas. Volveremos.”</p>` +
          `<p class="mb-0 mt-3 text-sm font-bold text-[${accentOf(ctx)}]">María G. · Cliente</p></div>`,
      ),
  },
  {
    kind: "divider",
    label: "Separador",
    description: "Línea fina",
    html: () => section("Separador", `<hr class="m-0 border-0 border-t border-solid border-gray-200">`),
  },
  {
    kind: "spacer",
    label: "Espacio",
    description: "Aire entre bloques",
    html: () => `<div ${EB_NAME}="Espacio" class="h-8"></div>`,
  },
  {
    kind: "footer",
    label: "Pie con baja",
    description: "Obligatorio: enlace para darse de baja",
    html: (ctx) =>
      `<div ${EB_NAME}="Pie" ${EB_ROLE}="footer" class="mt-8 border-0 border-t border-solid border-gray-200 ${PAD} py-6 text-center">` +
      `<p class="m-0 text-xs leading-relaxed text-gray-500">Recibes este email porque has reservado en ${esc(ctx.brandName || "nuestro restaurante")}.</p>` +
      `<p class="mb-0 mt-2 text-xs leading-relaxed text-gray-500"><a href="${site(ctx)}" class="text-gray-500 underline">Visita nuestra web</a> · <a href="${UNSUBSCRIBE_PLACEHOLDER}" class="text-gray-500 underline">Darme de baja</a></p>` +
      `<p class="mb-0 mt-2 text-xs text-gray-400">© ${new Date().getFullYear()} ${esc(ctx.brandName || "Restaurante")}</p></div>`,
  },
];

export const blockByKind = (kind: string) => EMAIL_BLOCKS.find((b) => b.kind === kind) ?? null;

/** Email frame every design lives in: page background + 600px card + content slot. */
function frame(inner: string): string {
  return (
    `<div ${EB_NAME}="Fondo" class="bg-gray-100 font-sans sm:px-4 sm:py-10">` +
    `<div ${EB_NAME}="Email" ${EB_ROLE}="content" class="mx-auto w-full max-w-[600px] overflow-hidden bg-white sm:rounded-2xl">${inner}</div></div>`
  );
}

/** Starting design of a new campaign: header, hero, text, call to action and footer. */
export function defaultDesign(ctx: BlockContext): string {
  const html = (kind: BlockKind) => blockByKind(kind)?.html(ctx) ?? "";
  return frame(html("header") + html("hero") + html("text") + html("button") + html("footer"));
}

/** Design of a campaign written before the builder: its rendered body inside the same frame. */
export function legacyDesign(ctx: BlockContext, bodyHtml: string): string {
  const html = (kind: BlockKind) => blockByKind(kind)?.html(ctx) ?? "";
  return frame(html("header") + `<div ${EB_NAME}="Contenido" class="${PAD} pt-6 text-base leading-relaxed text-gray-700">${bodyHtml}</div>` + html("button") + html("footer"));
}
