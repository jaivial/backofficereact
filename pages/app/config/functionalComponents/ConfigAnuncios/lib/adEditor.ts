import type { CSSProperties } from "react";
import type {
  RestaurantAd,
  RestaurantAdContentElement,
  RestaurantAdElementSize,
  RestaurantAdElementStyle,
  RestaurantAdContentType,
  RestaurantAdCTA,
  RestaurantAdLayout,
  RestaurantAdLayoutMode,
  RestaurantAdStep,
  RestaurantAdStepBackground,
} from "../../../../../../api/types";

export const WEBSITE_ROUTE_OPTIONS = [
  { value: "/", label: "Inicio" },
  { value: "/contacto", label: "Contacto" },
  { value: "/eventos", label: "Eventos" },
  { value: "/menufindesemana", label: "Menú fin de semana" },
  { value: "/menudeldia", label: "Menú del día" },
  { value: "/menusdegrupos", label: "Menús de grupos" },
  { value: "/postres", label: "Postres" },
  { value: "/vinos", label: "Vinos" },
  { value: "/cafes", label: "Cafés" },
  { value: "/bebidas", label: "Bebidas" },
  { value: "/reservas", label: "Reservas" },
  { value: "/reservas.php", label: "Reservas (legacy)" },
  { value: "/avisolegal", label: "Aviso legal" },
  { value: "/avisolegal.html", label: "Aviso legal (legacy)" },
  { value: "/booking-policies", label: "Políticas de reserva" },
  { value: "/booking_policies.php", label: "Políticas de reserva (legacy)" },
  { value: "/confirm", label: "Confirmar reserva" },
  { value: "/cancel", label: "Cancelar reserva" },
  { value: "/update-rice", label: "Actualizar arroz" },
  { value: "/protecciondatos", label: "Protección de datos" },
  { value: "/protecciondatos.html", label: "Protección de datos (legacy)" },
  { value: "/menusanvalentin", label: "San Valentín" },
  { value: "/regala", label: "Regala" },
] as const;

const MAX_TEXT_ITEMS = 5;
const MAX_BUTTONS = 5;
const MAX_STEPS = 20;
export const AD_DEFAULT_COLOR = "#436754";

/** WhatsApp button copy (coord id ad-cta-whatsapp-v1). */
export const WHATSAPP_DEFAULT_MESSAGE = "Hola, me gustaría más información";
export const WHATSAPP_HOSTS = new Set(["wa.me", "api.whatsapp.com", "wa.link"]);

/** Server payloads omit empty fields (`omitempty`), so any text coming from an
 * ad can be undefined. Coerce once here instead of guarding every call site. */
export function asText(value: unknown): string {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "";
  return String(value);
}

export function createClientID(prefix: string): string {
  const id = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${id}`;
}

// ---------------------------------------------------------------------------
// Buttons (formerly "llamadas a la acción"). Three actions share one payload:
// internal route, custom URL and WhatsApp. WhatsApp is stored as a wa.me custom
// URL so the public site renders it without any extra contract.
// ---------------------------------------------------------------------------

/** What a button does, derived from the payload (never stored explicitly). */
export type ButtonAction = "route" | "url" | "whatsapp";

/**
 * Coordination id: ad_cta_custom_url_fix_v1.
 * Operators type "ejemplo.com/promo" or "/oferta" far more often than a full
 * URL. Bare domains get https://, site-relative paths hang off the restaurant
 * website, and anything else is kept untouched.
 */
export function normalizeButtonURL(value: unknown, website = ""): string {
  const raw = asText(value).trim();
  if (!raw) return "";
  if (/^(https?:|mailto:|tel:)/i.test(raw)) return raw;
  if (raw.startsWith("/")) {
    const base = website.trim().replace(/\/+$/, "");
    return base ? `${base}${raw}` : raw;
  }
  return `https://${raw.replace(/^\/+/, "")}`;
}

export function buildWhatsAppURL(phone: unknown, message: unknown = ""): string {
  const digits = asText(phone).replace(/[^\d]/g, "");
  if (!digits) return "";
  const text = asText(message).trim();
  const query = text ? `?text=${encodeURIComponent(text)}` : "";
  return `https://wa.me/${digits}${query}`;
}

/** Reads a wa.me / api.whatsapp.com URL back into phone + message. */
export function parseWhatsAppURL(value: unknown): { phone: string; message: string } | null {
  const raw = asText(value).trim();
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    if (!WHATSAPP_HOSTS.has(parsed.hostname.toLowerCase())) return null;
    const phone = `${parsed.pathname || ""}`.replace(/[^\d]/g, "");
    if (!phone) return null;
    return { phone, message: parsed.searchParams.get("text") ?? "" };
  } catch {
    return null;
  }
}

export function buttonAction(cta: Pick<RestaurantAdCTA, "navigation_mode" | "custom_url">): ButtonAction {
  const mode = asText(cta.navigation_mode);
  if (mode === "custom" && parseWhatsAppURL(cta.custom_url)) return "whatsapp";
  return mode === "custom" ? "url" : "route";
}

/**
 * Final href of a button. Always absolute (and always non-empty for internal
 * routes) so both the editor preview and the public site can link it.
 */
export function buildCTAURL(website: string, cta: Pick<RestaurantAdCTA, "navigation_mode" | "route" | "custom_url">): string {
  if (asText(cta.navigation_mode) === "custom") return normalizeButtonURL(cta.custom_url, website);
  const base = asText(website).trim().replace(/\/+$/, "");
  const stored = asText(cta.route) || "/";
  const route = stored.startsWith("/") ? stored : `/${stored}`;
  return base ? `${base}${route === "/" ? "" : route}` : route;
}

export function createCTA(): RestaurantAdCTA {
  return { id: createClientID("cta"), text: "Más información", color: AD_DEFAULT_COLOR, navigation_mode: "route", route: "/reservas", custom_url: "" };
}

/** Button payload for the chosen action, keeping the shared CTA contract. */
export function setButtonAction(cta: RestaurantAdCTA, action: ButtonAction, restaurantPhone = ""): RestaurantAdCTA {
  const next: RestaurantAdCTA = { ...cta };
  if (action === "route") {
    next.navigation_mode = "route";
    if (!next.route) next.route = "/reservas";
    return next;
  }
  next.navigation_mode = "custom";
  if (action === "whatsapp") {
    const existing = parseWhatsAppURL(cta.custom_url);
    const phone = existing?.phone || restaurantPhone.replace(/[^\d]/g, "");
    next.custom_url = buildWhatsAppURL(phone, existing?.message || WHATSAPP_DEFAULT_MESSAGE);
    next.text = next.text && next.text !== "Más información" ? next.text : "Escríbenos por WhatsApp";
    return next;
  }
  const isWhatsApp = parseWhatsAppURL(cta.custom_url);
  if (isWhatsApp || !next.custom_url) next.custom_url = "";
  if (next.text === "Escríbenos por WhatsApp") next.text = "Más información";
  return next;
}

/** Updates only the phone / message of a WhatsApp button, keeping its text. */
export function patchWhatsAppButton(cta: RestaurantAdCTA, patch: { phone?: string; message?: string }): RestaurantAdCTA {
  const current = parseWhatsAppURL(cta.custom_url) ?? { phone: "", message: WHATSAPP_DEFAULT_MESSAGE };
  return { ...cta, custom_url: buildWhatsAppURL(patch.phone ?? current.phone, patch.message ?? current.message) };
}

// ---------------------------------------------------------------------------
// Element sizing (coord id ads_element_size_v1) - the same bounds the backend
// enforces in normalizeBOAdElementSize, so the canvas never shows a value the
// API would silently clamp away.
// ---------------------------------------------------------------------------

export const ELEMENT_MIN_WIDTH_PCT = 10;
export const ELEMENT_MAX_WIDTH_PCT = 100;
export const ELEMENT_MIN_HEIGHT_PX = 40;
export const ELEMENT_MAX_HEIGHT_PX = 1200;

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(Math.round(value), min), max);
}

/** Server payloads omit empty fields, so a stored size may be partial. */
export function elementSize(item: Pick<RestaurantAdContentElement, "size">): RestaurantAdElementSize {
  return { width: item.size?.width, height: item.size?.height };
}

/** Inline style that applies the operator box to the replica element. */
export function elementSizeStyle(item: Pick<RestaurantAdContentElement, "type" | "size">): CSSProperties | undefined {
  const size = elementSize(item);
  const style: CSSProperties = {};
  if (typeof size.width === "number") style.width = `${size.width}%`;
  if (item.type === "image" && typeof size.height === "number") style.height = `${size.height}px`;
  return Object.keys(style).length ? style : undefined;
}

/** Applies a drag delta as a size patch, clamped to the contract bounds. */
export function resizeElement(
  item: Pick<RestaurantAdContentElement, "type" | "size">,
  patch: { width: number; height?: number },
): RestaurantAdElementSize {
  const next: RestaurantAdElementSize = {
    width: clamp(patch.width, ELEMENT_MIN_WIDTH_PCT, ELEMENT_MAX_WIDTH_PCT),
  };
  if (item.type === "image" && typeof patch.height === "number") {
    next.height = clamp(patch.height, ELEMENT_MIN_HEIGHT_PX, ELEMENT_MAX_HEIGHT_PX);
  }
  return next;
}

// Style bounds: identical to normalizeBOAdElementStyle on the backend, so the
// canvas never offers a value the API would clamp.
export const STYLE_FONT_SIZE_MIN = 8;
export const STYLE_FONT_SIZE_MAX = 120;
export const STYLE_FONT_WEIGHTS = [300, 400, 500, 600, 700] as const;
export const STYLE_LETTER_SPACING_MIN = -5;
export const STYLE_LETTER_SPACING_MAX = 20;
export const STYLE_LINE_HEIGHT_MIN = 0.8;
export const STYLE_LINE_HEIGHT_MAX = 3;
export const STYLE_OPACITY_MIN = 0.2;
export const STYLE_OPACITY_MAX = 1;
export const STYLE_RADIUS_MAX = 200;
export const STYLE_OFFSET_MIN = -2000;
export const STYLE_OFFSET_MAX = 2000;

export function elementStyle(item: Pick<RestaurantAdContentElement, "style">): RestaurantAdElementStyle {
  return {
    font_size: item.style?.font_size,
    font_weight: item.style?.font_weight,
    letter_spacing: item.style?.letter_spacing,
    line_height: item.style?.line_height,
    color: item.style?.color,
    opacity: item.style?.opacity,
    radius: item.style?.radius,
    offset_x: item.style?.offset_x,
    offset_y: item.style?.offset_y,
  };
}

/** Inline look of an element: only the properties the operator customised. */
export function elementStyleCSS(item: Pick<RestaurantAdContentElement, "type" | "style">): CSSProperties | undefined {
  const style = elementStyle(item);
  const css: CSSProperties = {};
  const isText = item.type !== "image";
  if (isText && typeof style.font_size === "number") css.fontSize = `${style.font_size}px`;
  if (isText && typeof style.font_weight === "number") css.fontWeight = style.font_weight;
  if (isText && typeof style.letter_spacing === "number") css.letterSpacing = `${style.letter_spacing}px`;
  if (isText && typeof style.line_height === "number") css.lineHeight = style.line_height;
  if (style.color) css.color = style.color;
  if (typeof style.opacity === "number") css.opacity = style.opacity;
  if (item.type === "image" && typeof style.radius === "number") css.borderRadius = `${style.radius}px`;
  // Drag on the X axis: the margin keeps the element in the document flow, so
  // the transform box of the design tool never fights the layout.
  if (typeof style.offset_x === "number") css.marginInlineStart = `${style.offset_x}px`;
  if (typeof style.offset_y === "number") css.marginBlockStart = `${style.offset_y}px`;
  return Object.keys(css).length ? css : undefined;
}

/** Clamps a style patch to the contract, keeping only what the type supports. */
export function normalizeElementStyle(item: Pick<RestaurantAdContentElement, "type" | "style">, patch: RestaurantAdElementStyle): RestaurantAdElementStyle {
  const current = elementStyle(item);
  const next: RestaurantAdElementStyle = { ...current, ...patch };
  const isText = item.type !== "image";
  if (next.font_size !== undefined) next.font_size = clamp(next.font_size, STYLE_FONT_SIZE_MIN, STYLE_FONT_SIZE_MAX);
  if (next.font_weight !== undefined) next.font_weight = clamp(next.font_weight, 100, 900);
  if (next.letter_spacing !== undefined) next.letter_spacing = clamp(next.letter_spacing, STYLE_LETTER_SPACING_MIN, STYLE_LETTER_SPACING_MAX);
  if (next.line_height !== undefined) next.line_height = Math.min(Math.max(Math.round(next.line_height * 100) / 100, STYLE_LINE_HEIGHT_MIN), STYLE_LINE_HEIGHT_MAX);
  if (next.opacity !== undefined) next.opacity = Math.min(Math.max(Math.round(next.opacity * 100) / 100, STYLE_OPACITY_MIN), STYLE_OPACITY_MAX);
  if (next.radius !== undefined) next.radius = clamp(next.radius, 0, STYLE_RADIUS_MAX);
  if (next.offset_x !== undefined) next.offset_x = clamp(next.offset_x, STYLE_OFFSET_MIN, STYLE_OFFSET_MAX);
  if (next.offset_y !== undefined) next.offset_y = clamp(next.offset_y, STYLE_OFFSET_MIN, STYLE_OFFSET_MAX);
  if (!isText) {
    delete next.font_size;
    delete next.font_weight;
    delete next.letter_spacing;
    delete next.line_height;
  }
  if (item.type !== "image") delete next.radius;
  return next;
}

/** Clears every customised look so the element returns to the public template. */
export function resetElementStyle(content: RestaurantAdContentElement[], id: string): RestaurantAdContentElement[] {
  return content.map((item) => (item.id === id ? { ...item, style: undefined } : item));
}

/** Drops the operator box so the element renders at the template size again. */
export function resetElementSize(content: RestaurantAdContentElement[], id: string): RestaurantAdContentElement[] {
  return content.map((item) => (item.id === id ? { ...item, size: undefined } : item));
}

// ---------------------------------------------------------------------------
// Content + draft ads
// ---------------------------------------------------------------------------

export function createDraftAd(): RestaurantAd {
  return { id: 0, name: "Nuevo anuncio", active: false, content: [], ctas: [], layout: { mode: "unico", steps: [] } };
}

export function addContentItem(ad: RestaurantAd, type: RestaurantAdContentType): RestaurantAd {
  const count = ad.content.filter((item) => item.type === type).length;
  if (type === "image" && count >= 1) throw new Error("Solo se permite una imagen por anuncio");
  if (type !== "image" && count >= MAX_TEXT_ITEMS) throw new Error(`Máximo ${MAX_TEXT_ITEMS} elementos de tipo ${type}`);
  const item: RestaurantAdContentElement = { id: createClientID(type), type, value: "" };
  return { ...ad, content: [...ad.content, item] };
}

export function removeContentItem(ad: RestaurantAd, id: string): RestaurantAd {
  return { ...ad, content: ad.content.filter((item) => item.id !== id) };
}

// ---------------------------------------------------------------------------
// Studio blocks (coord id ads_block_studio_v1) - every node of the editable
// area (text, image and button) is one block with the same chrome and the
// same list operations, so the canvas treats them all alike.
// ---------------------------------------------------------------------------

export type AdBlockKind = RestaurantAdContentType | "button";

export const BLOCK_LABEL: Record<AdBlockKind, string> = {
  title: "Titulo",
  subtitle: "Subtitulo",
  text: "Texto",
  image: "Imagen",
  button: "Boton",
};

/** Moves the item with `id` to `toIndex`, clamped to the list bounds. */
export function moveItem<T extends { id: string }>(items: T[], id: string, toIndex: number): T[] {
  const from = items.findIndex((item) => item.id === id);
  if (from < 0) return items;
  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(Math.min(Math.max(toIndex, 0), next.length), 0, moved);
  return next;
}

/** Inserts a copy right after the source, with a fresh id for the new block. */
export function duplicateItem<T extends { id: string }>(items: T[], id: string, prefix: string): T[] {
  const index = items.findIndex((item) => item.id === id);
  if (index < 0) return items;
  const copy = { ...items[index], id: createClientID(prefix) };
  return [...items.slice(0, index + 1), copy, ...items.slice(index + 1)];
}

/** Same bounds as normalizeBOAdContent on the backend: 1 image, 5 per text type. */
export function duplicateContentItem(content: RestaurantAdContentElement[], id: string): RestaurantAdContentElement[] {
  const source = content.find((item) => item.id === id);
  if (!source) return content;
  const count = content.filter((item) => item.type === source.type).length;
  if (source.type === "image" && count >= 1) throw new Error("Solo se permite una imagen por anuncio");
  if (source.type !== "image" && count >= MAX_TEXT_ITEMS) throw new Error(`Máximo ${MAX_TEXT_ITEMS} elementos de tipo ${source.type}`);
  return duplicateItem(content, id, source.type);
}

/** Same bound as normalizeBOAdCTAs on the backend: 5 buttons. */
export function duplicateButton(buttons: RestaurantAdCTA[], id: string): RestaurantAdCTA[] {
  if (buttons.length >= MAX_BUTTONS) throw new Error(`Máximo ${MAX_BUTTONS} botones`);
  return duplicateItem(buttons, id, "cta");
}

export function reorderContent(ad: RestaurantAd, orderedIDs: string[]): RestaurantAd {
  const byID = new Map(ad.content.map((item) => [item.id, item]));
  const ordered = orderedIDs.map((id) => byID.get(id)).filter((item): item is RestaurantAdContentElement => Boolean(item));
  if (ordered.length !== ad.content.length) return ad;
  return { ...ad, content: ordered };
}

// ---------------------------------------------------------------------------
// Layout: unico (single announcement) vs multiple (step wizard)
// ---------------------------------------------------------------------------

export const STEP_BACKGROUND_OPTIONS: Array<{ value: RestaurantAdStepBackground; label: string }> = [
  { value: "transparent", label: "Transparente" },
  { value: "color", label: "Color" },
  { value: "image", label: "Imagen" },
];

export function normalizeLayout(layout: RestaurantAd["layout"]): RestaurantAdLayout {
  const mode: RestaurantAdLayoutMode = layout?.mode === "multiple" ? "multiple" : "unico";
  const steps = (layout?.steps ?? []).map((step) => ({
    id: step.id || createClientID("step"),
    title: step.title ?? "",
    description: step.description ?? "",
    background_mode: (["image", "color", "transparent"] as RestaurantAdStepBackground[]).includes(step.background_mode) ? step.background_mode : "transparent",
    background_color: step.background_color ?? "",
    background_image: step.background_image ?? "",
    see_more: step.see_more ?? true,
    buttons: step.buttons ?? [],
    content: step.content ?? [],
  }));
  return { mode, steps };
}

/** Null tolerant so the editor can call it before the ad is loaded. */
export function adLayout(ad: RestaurantAd | null | undefined): RestaurantAdLayout {
  return normalizeLayout(ad?.layout);
}

/** Reads the wizard steps of an ad; unico ads always answer with none. */
export function adSteps(ad: RestaurantAd): RestaurantAdStep[] {
  return adLayout(ad).mode === "multiple" ? adLayout(ad).steps : [];
}

export function createDraftStep(): RestaurantAdStep {
  return {
    id: createClientID("step"),
    title: "Nuevo anuncio",
    description: "",
    background_mode: "color",
    background_color: AD_DEFAULT_COLOR,
    background_image: "",
    see_more: true,
    buttons: [],
    content: [],
  };
}

export function withLayout(ad: RestaurantAd, layout: RestaurantAdLayout): RestaurantAd {
  return { ...ad, layout };
}

export function setLayoutMode(ad: RestaurantAd, mode: RestaurantAdLayoutMode): RestaurantAd {
  const current = adLayout(ad);
  if (current.mode === mode) return ad;
  // Moving to multiple seeds one step from the current announcement so nothing
  // the operator wrote is lost; moving back keeps the steps but stops using them.
  const steps = mode === "multiple" && current.steps.length === 0
    ? [withStepContent(createDraftStep(), ad)]
    : current.steps;
  return withLayout(ad, { mode, steps });
}

export function withStepContent(step: RestaurantAdStep, ad: RestaurantAd): RestaurantAdStep {
  if (step.content.length > 0) return step;
  const content: RestaurantAdContentElement[] = [];
  if (step.title) content.push({ id: createClientID("title"), type: "title", value: step.title });
  if (step.description) content.push({ id: createClientID("text"), type: "text", value: step.description });
  const image = ad.content.find((item) => item.type === "image" && item.value);
  if (image) content.push({ ...image, id: createClientID("image") });
  return { ...step, content };
}

export function updateStep(ad: RestaurantAd, stepId: string, patch: Partial<RestaurantAdStep>): RestaurantAd {
  const layout = adLayout(ad);
  return withLayout(ad, {
    ...layout,
    steps: layout.steps.map((step) => (step.id === stepId ? { ...step, ...patch } : step)),
  });
}

export function addStep(ad: RestaurantAd): RestaurantAd {
  const layout = adLayout(ad);
  if (layout.steps.length >= MAX_STEPS) throw new Error(`Máximo ${MAX_STEPS} anuncios por campaña`);
  return withLayout(ad, { ...layout, steps: [...layout.steps, createDraftStep()] });
}

export function removeStep(ad: RestaurantAd, stepId: string): RestaurantAd {
  const layout = adLayout(ad);
  return withLayout(ad, { ...layout, steps: layout.steps.filter((step) => step.id !== stepId) });
}

export function reorderSteps(ad: RestaurantAd, orderedIDs: string[]): RestaurantAd {
  const layout = adLayout(ad);
  const byID = new Map(layout.steps.map((step) => [step.id, step]));
  const ordered = orderedIDs.map((id) => byID.get(id)).filter((step): step is RestaurantAdStep => Boolean(step));
  if (ordered.length !== layout.steps.length) return ad;
  return withLayout(ad, { ...layout, steps: ordered });
}

/**
 * A step card background as a CSS value (coord id ads_public_replica_v1).
 * Transparent returns undefined so the card keeps the public pine surface and
 * its scrim instead of turning into a hole in the page.
 */
export function stepBackground(step: Pick<RestaurantAdStep, "background_mode" | "background_color" | "background_image">): string | undefined {
  if (step.background_mode === "color") return step.background_color?.trim() || AD_DEFAULT_COLOR;
  if (step.background_mode === "image" && step.background_image) {
    return `url("${step.background_image}") center / cover no-repeat`;
  }
  return undefined;
}

export function buttonLimit(): number {
  return MAX_BUTTONS;
}
