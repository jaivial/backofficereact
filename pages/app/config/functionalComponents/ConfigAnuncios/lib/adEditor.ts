import type { CSSProperties } from "react";
import type {
  RestaurantAd,
  RestaurantAdCanvas,
  RestaurantAdCanvasBackground,
  RestaurantAdCanvasContainer,
  RestaurantAdCanvasElement,
  RestaurantAdCanvasVariant,
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

/**
 * Coordination id: ad_save_payload_v1. The one payload every save path sends
 * (REST and WS). Autosave fires mid-typing, before the URL field blur runs
 * normalizeButtonURL, so custom URLs are normalized here too: "ejemplo.com"
 * or "/oferta" no longer reach the backend and come back as a 400.
 */
export function adSavePayload(ad: RestaurantAd, website = "") {
  // Coordination id: ads_draft_image_guard_v1 - incomplete canvas elements are
  // held back instead of rejecting the payload that carries every other edit.
  const clean = sanitizeAdForSave(ad).ad;
  const ctas = (list: RestaurantAdCTA[] = []) =>
    list.map((cta) => (asText(cta.navigation_mode) === "custom" ? { ...cta, custom_url: normalizeButtonURL(cta.custom_url, website) } : cta));
  const layout = adLayout(clean);
  return {
    name: clean.name,
    active: clean.active,
    content: clean.content,
    ctas: ctas(clean.ctas),
    layout: layout.mode === "multiple" ? { ...layout, steps: layout.steps.map((step) => ({ ...step, buttons: ctas(step.buttons) })) } : layout,
    starts_at: clean.starts_at ?? null,
    ends_at: clean.ends_at ?? null,
    ...(clean.canvas ? { canvas: clean.canvas } : {}),
  };
}

// ---------------------------------------------------------------------------
// Canvas save guard (coord id ads_draft_image_guard_v1) - client mirror of
// validateBOAdCanvas + validateAdCanvasElements (backend internal/api/
// ads_canvas.go). One incomplete element used to 400 the whole payload and
// silently block every other edit; now the payload is sanitized instead:
// unfixable elements (an image without a usable URL, a button whose href is
// not a safeURL, oversized props, elements past the 200 cap, unknown types)
// stay in the editor as an explicit draft and only they are left out of the
// request, while everything the backend tolerates is adjusted in place
// (text limits, enums, colors, id and size bounds), so the rest of the work
// always lands (BIZ-79.2).
// ---------------------------------------------------------------------------

const CANVAS_TEXT_FONT_MIN = 4;
const CANVAS_TEXT_FONT_MAX = 400;
const CANVAS_BUTTON_FONT_MIN = 4;
const CANVAS_BUTTON_FONT_MAX = 200;
// Backend caps mirrored one-to-one from internal/api/ads_canvas.go so a value
// the API would reject is caught (fixed or held back) before the save.
const CANVAS_MAX_ELEMENTS = 200; // adCanvasMaxElements, per doc and per variant
const CANVAS_MAX_TEXT_LENGTH = 2000; // adCanvasMaxTextLength
const CANVAS_BUTTON_TEXT_MAX_LENGTH = 120;
const CANVAS_MAX_URL_LENGTH = 2048; // adCanvasMaxURLLength
const CANVAS_MAX_PROPS_BYTES = 32 * 1024; // element props budget
const CANVAS_MAX_ELEMENT_DIM = 4096 * 2; // element w/h upper bound
const CANVAS_MAX_FONT_FAMILY_LENGTH = 120;
const CANVAS_IMAGE_MAX_ALT_LENGTH = 200;

/** True for the absolute http(s) URLs the backend accepts as an image src. */
export function isCanvasHttpURL(value: unknown): boolean {
  const raw = asText(value).trim();
  return raw.length <= CANVAS_MAX_URL_LENGTH && /^https?:\/\/\S+$/i.test(raw);
}

/** Exact mirror of adCanvasSafeURL (backend ads_canvas.go): http(s), mailto,
 * tel and root-relative links only, at most 2048 chars. This is what the
 * backend demands from a canvas button href. */
export function isCanvasSafeURL(value: unknown): boolean {
  const raw = asText(value).trim();
  if (!raw || raw.length > CANVAS_MAX_URL_LENGTH) return false;
  if (raw.startsWith("/") && !raw.startsWith("//")) return true;
  try {
    return ["http:", "https:", "mailto:", "tel:"].includes(new URL(raw).protocol);
  } catch {
    return false;
  }
}

/** Byte length of a props object the way the backend receives it (JSON). */
function canvasPropsByteLength(props: unknown): number {
  try {
    return new TextEncoder().encode(JSON.stringify(props ?? {})).length;
  } catch {
    return Number.POSITIVE_INFINITY; // unserializable props would fail the backend decode too
  }
}

/** Backend mirror of adCanvasSafeColor (hex, rgb()/hsl() families, named). */
export function isCanvasSafeColor(value: unknown): boolean {
  const raw = asText(value).trim();
  if (!raw || raw.length > 64) return false;
  if (raw.startsWith("#")) return raw.length >= 4 && raw.length <= 9 && /^#[0-9a-fA-F]+$/.test(raw);
  const lower = raw.toLowerCase();
  if (/^(rgb|rgba|hsl|hsla)\([\s\S]*\)$/.test(lower)) return true;
  return /^[a-z]{3,}$/.test(lower);
}

function clampCanvasNumber(value: number, min: number, max: number, fallback: number): number {
  return Number.isFinite(value) ? Math.min(Math.max(value, min), max) : fallback;
}

/** Why the backend would reject this element; "" when it can be persisted. */
export function canvasElementDraftReason(el: RestaurantAdCanvasElement): string {
  if (el.w <= 0 || el.h <= 0) return "Tamaño inválido";
  const props = (el.props ?? {}) as Record<string, unknown>;
  if (el.type === "image") return isCanvasHttpURL(props.src) ? "" : "Imagen sin URL http(s)";
  if (el.type === "button") return asText(props.text).trim() ? "" : "Botón sin texto";
  if (el.type === "text") {
    const size = Number(props.fontSize);
    return size >= CANVAS_TEXT_FONT_MIN && size <= CANVAS_TEXT_FONT_MAX ? "" : "Texto con tamaño fuera de rango";
  }
  return "";
}

/**
 * What the backend HELD BACK rather than fixed (BIZ-79.3). The save chip used
 * to count an empty-button or an out-of-range font size as a draft, but the
 * backend sanitizes those in place and persists them, so the badge stayed at
 * "N en borrador" after everything actually saved. Only a draft the backend
 * drops (no size, image with no http(s) src, unusable background image,
 * button href that is not a safeURL, props over the 32KB budget, unknown
 * element type, elements past the 200 cap) counts here; the inspector keeps
 * `canvasElementDraftReason` for its per-field hint.
 */
export function canvasElementHardDraftReason(el: RestaurantAdCanvasElement): string {
  if (!Number.isFinite(el.w) || !Number.isFinite(el.h) || el.w <= 0 || el.h <= 0) return "Tamaño inválido";
  const props = (el.props ?? {}) as Record<string, unknown>;
  if (canvasPropsByteLength(props) > CANVAS_MAX_PROPS_BYTES) return "Propiedades demasiado grandes";
  if (el.type !== "text" && el.type !== "image" && el.type !== "button" && el.type !== "shape") return "Tipo de elemento desconocido";
  if (el.type === "image") {
    return isCanvasHttpURL(props.src) ? "" : "Imagen sin URL http(s)";
  }
  if (el.type === "button") {
    return isCanvasSafeURL(props.href) ? "" : "Botón con enlace no válido";
  }
  return "";
}

/**
 * Fixes in place whatever the backend would clamp or truncate, and holds back
 * whatever it would reject as-is (BIZ-79.2, mirror of validateAdCanvasElements
 * in internal/api/ads_canvas.go): element id (present, unique, max 64), size
 * bounds, text/button length limits, enum props (align, fit, shape, type),
 * safe colors and the button fontSize range. Elements past the backend cap of
 * 200 stay as local drafts so the first 200 always land.
 */
function sanitizeCanvasElements(elements: RestaurantAdCanvasElement[], onDraft: () => void): RestaurantAdCanvasElement[] {
  const out: RestaurantAdCanvasElement[] = [];
  const seen = new Set<string>();
  for (const el of elements) {
    if (out.length >= CANVAS_MAX_ELEMENTS) { onDraft(); continue; }
    if (canvasElementHardDraftReason(el)) { onDraft(); continue; }
    let id = asText(el.id).trim();
    let adjusted = false;
    if (!id) { id = createClientID("el"); adjusted = true; } else if (id.length > 64) { id = id.slice(0, 64); adjusted = true; }
    if (seen.has(id)) { id = createClientID("el"); adjusted = true; }
    seen.add(id);
    const w = Math.min(el.w, CANVAS_MAX_ELEMENT_DIM);
    const h = Math.min(el.h, CANVAS_MAX_ELEMENT_DIM);
    if (w !== el.w || h !== el.h) adjusted = true;
    const props = { ...(el.props as Record<string, unknown>) };
    if (el.type === "text") {
      const text = asText(props.text);
      if (text.length > CANVAS_MAX_TEXT_LENGTH) { props.text = text.slice(0, CANVAS_MAX_TEXT_LENGTH); adjusted = true; }
      const size = Number(props.fontSize);
      if (!(size >= CANVAS_TEXT_FONT_MIN && size <= CANVAS_TEXT_FONT_MAX)) { props.fontSize = clampCanvasNumber(size, CANVAS_TEXT_FONT_MIN, CANVAS_TEXT_FONT_MAX, 16); adjusted = true; }
      if (props.color && !isCanvasSafeColor(props.color)) { delete props.color; adjusted = true; }
      if (props.align !== "left" && props.align !== "center" && props.align !== "right") { props.align = "left"; adjusted = true; }
      const family = asText(props.fontFamily);
      if (family.length > CANVAS_MAX_FONT_FAMILY_LENGTH) { props.fontFamily = family.slice(0, CANVAS_MAX_FONT_FAMILY_LENGTH); adjusted = true; }
    } else if (el.type === "image") {
      if (props.fit !== "cover" && props.fit !== "contain") { props.fit = "cover"; adjusted = true; }
      const alt = asText(props.alt);
      if (alt.length > CANVAS_IMAGE_MAX_ALT_LENGTH) { props.alt = alt.slice(0, CANVAS_IMAGE_MAX_ALT_LENGTH); adjusted = true; }
    } else if (el.type === "button") {
      const text = asText(props.text);
      if (!text.trim()) { props.text = "Botón"; adjusted = true; }
      else if (text.length > CANVAS_BUTTON_TEXT_MAX_LENGTH) { props.text = text.slice(0, CANVAS_BUTTON_TEXT_MAX_LENGTH); adjusted = true; }
      if (props.bg && !isCanvasSafeColor(props.bg)) { delete props.bg; adjusted = true; }
      if (props.color && !isCanvasSafeColor(props.color)) { delete props.color; adjusted = true; }
      const size = Number(props.fontSize);
      if (!(size >= CANVAS_BUTTON_FONT_MIN && size <= CANVAS_BUTTON_FONT_MAX)) { props.fontSize = clampCanvasNumber(size, CANVAS_BUTTON_FONT_MIN, CANVAS_BUTTON_FONT_MAX, 16); adjusted = true; }
    } else if (el.type === "shape") {
      if (props.shape !== "rect" && props.shape !== "ellipse") { props.shape = "rect"; adjusted = true; }
      if (props.fill && !isCanvasSafeColor(props.fill)) { delete props.fill; adjusted = true; }
      if (props.stroke && !isCanvasSafeColor(props.stroke)) { delete props.stroke; adjusted = true; }
    }
    out.push(adjusted ? { ...el, id, w, h, props } : el);
    if (adjusted) onDraft();
  }
  return out;
}

function sanitizeCanvasBackground(bg: RestaurantAdCanvasBackground | undefined, onDraft: () => void): RestaurantAdCanvasBackground {
  const base = bg ?? { type: "color" as const, value: "" };
  if (base.type !== "color" && base.type !== "image") {
    onDraft();
    return { type: "color", value: "" };
  }
  if (base.type === "image" && !isCanvasHttpURL(base.value)) {
    onDraft();
    return { type: "color", value: "" };
  }
  if (base.type === "color" && base.value && !isCanvasSafeColor(base.value)) {
    onDraft();
    return { type: "color", value: "" };
  }
  return base;
}

function sanitizeCanvasContainer(c: RestaurantAdCanvasContainer | null | undefined, onDraft: () => void): RestaurantAdCanvasContainer | null | undefined {
  if (!c) return c;
  const out: RestaurantAdCanvasContainer = { ...c };
  if (typeof out.maxWidth === "number" && (out.maxWidth < 240 || out.maxWidth > 2000)) {
    out.maxWidth = clampCanvasNumber(out.maxWidth, 240, 2000, 240);
    onDraft();
  }
  if (typeof out.radius === "number" && (out.radius < 0 || out.radius > 96)) {
    out.radius = clampCanvasNumber(out.radius, 0, 96, 0);
    onDraft();
  }
  if (out.overlay && !isCanvasSafeColor(out.overlay)) {
    delete out.overlay;
    onDraft();
  }
  return out;
}

function sanitizeCanvasVariant(v: RestaurantAdCanvasVariant, onDraft: () => void): RestaurantAdCanvasVariant {
  return {
    ...v,
    width: v.width ? clampCanvasNumber(v.width, 100, 4096, 100) : v.width,
    height: v.height ? clampCanvasNumber(v.height, 100, 4096, 100) : v.height,
    elements: sanitizeCanvasElements(v.elements ?? [], onDraft),
    background: v.background ? sanitizeCanvasBackground(v.background, onDraft) : v.background,
    container: sanitizeCanvasContainer(v.container, onDraft),
  };
}

function sanitizeCanvasDoc(doc: RestaurantAdCanvas, onDraft: () => void): RestaurantAdCanvas {
  const variants = doc.variants
    ? {
        ...(doc.variants.tablet ? { tablet: sanitizeCanvasVariant(doc.variants.tablet, onDraft) } : {}),
        ...(doc.variants.mobile ? { mobile: sanitizeCanvasVariant(doc.variants.mobile, onDraft) } : {}),
      }
    : undefined;
  return {
    ...doc,
    width: clampCanvasNumber(doc.width, 100, 4096, 800),
    height: clampCanvasNumber(doc.height, 100, 4096, 600),
    background: sanitizeCanvasBackground(doc.background, onDraft),
    elements: sanitizeCanvasElements(doc.elements ?? [], onDraft),
    variants,
    container: sanitizeCanvasContainer(doc.container, onDraft),
  };
}

/** Sanitized copy of every canvas an ad persists, plus the draft count. */
export function sanitizeAdForSave(ad: RestaurantAd): { ad: RestaurantAd; drafts: number } {
  let drafts = 0;
  const onDraft = () => { drafts += 1; };
  const layout = adLayout(ad);
  const nextLayout: RestaurantAdLayout = layout.mode === "multiple"
    ? {
        ...layout,
        steps: layout.steps.map((step) => ({
          ...step,
          canvas: step.canvas ? sanitizeCanvasDoc(step.canvas, onDraft) : step.canvas,
          card_canvas: step.card_canvas ? sanitizeCanvasDoc(step.card_canvas, onDraft) : step.card_canvas,
        })),
      }
    : layout;
  const canvas = ad.canvas ? sanitizeCanvasDoc(ad.canvas, onDraft) : ad.canvas;
  return { ad: { ...ad, layout: nextLayout, canvas }, drafts };
}

export function canvasDocDraftCount(doc: RestaurantAdCanvas | null | undefined): number {
  if (!doc) return 0;
  const elements = doc.elements ?? [];
  let count = elements.slice(0, CANVAS_MAX_ELEMENTS).filter((el) => canvasElementHardDraftReason(el) !== "").length;
  // Elements past the backend cap are held back whole (BIZ-79.2).
  count += Math.max(0, elements.length - CANVAS_MAX_ELEMENTS);
  if (doc.background?.type === "image" && !isCanvasHttpURL(doc.background.value)) count += 1;
  if (doc.variants?.tablet) count += canvasDocDraftCount({ ...doc, ...doc.variants.tablet, variants: undefined });
  if (doc.variants?.mobile) count += canvasDocDraftCount({ ...doc, ...doc.variants.mobile, variants: undefined });
  return count;
}

/** Draft elements of a wizard layout (every step canvas and card canvas). */
export function layoutCanvasDraftCount(layout: RestaurantAd["layout"]): number {
  const normalized = normalizeLayout(layout);
  if (normalized.mode !== "multiple") return 0;
  return normalized.steps.reduce((total, step) => total + canvasDocDraftCount(step.canvas) + canvasDocDraftCount(step.card_canvas), 0);
}

/** Draft elements of the whole ad: shown in the save badge (ads_draft_image_guard_v1). */
export function adCanvasDraftCount(ad: RestaurantAd | null | undefined): number {
  if (!ad) return 0;
  return canvasDocDraftCount(ad.canvas ?? null) + layoutCanvasDraftCount(ad?.layout);
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
    canvas: step.canvas,
    card_canvas: step.card_canvas,
    detail_background_mode: step.detail_background_mode,
    detail_background_color: step.detail_background_color,
    detail_background_image: step.detail_background_image,
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
  const seed = () => {
    const step = withStepContent(createDraftStep(), ad);
    return { ...step, content: ad.content.length ? ad.content.map((item) => ({ ...item })) : step.content, canvas: ad.canvas };
  };
  const steps = mode === "multiple" && current.steps.length === 0
    ? [seed()]
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

/**
 * Background of the opened announcement (coord id ads_step_detail_background_v1).
 * Independent from the card: an unset mode keeps the public cream sheet.
 */
export function stepDetailBackground(step: Pick<RestaurantAdStep, "detail_background_mode" | "detail_background_color" | "detail_background_image">): string | undefined {
  if (!step.detail_background_mode) return undefined;
  return stepBackground({ background_mode: step.detail_background_mode, background_color: step.detail_background_color, background_image: step.detail_background_image });
}

// ---------------------------------------------------------------------------
// Block flow (coord id ads_button_slot_v1): buttons are no longer pinned to
// the actions row; a button with a `slot` renders before that content index,
// so the canvas shows one mixed order of content and buttons.
// ---------------------------------------------------------------------------

export type AdFlowBlock =
  | { kind: "content"; item: RestaurantAdContentElement }
  | { kind: "button"; item: RestaurantAdCTA };

/** Mixed render order: slotted buttons interleave with content, the rest trail. */
export function blockFlow(content: RestaurantAdContentElement[], buttons: RestaurantAdCTA[]): AdFlowBlock[] {
  const out: AdFlowBlock[] = [];
  const slotted = buttons.filter((cta) => typeof cta.slot === "number");
  const trailing = buttons.filter((cta) => typeof cta.slot !== "number");
  content.forEach((item, index) => {
    slotted.filter((cta) => (cta.slot as number) === index).forEach((cta) => out.push({ kind: "button", item: cta }));
    out.push({ kind: "content", item });
  });
  slotted.filter((cta) => (cta.slot as number) >= content.length).forEach((cta) => out.push({ kind: "button", item: cta }));
  trailing.forEach((cta) => out.push({ kind: "button", item: cta }));
  return out;
}

/**
 * Splits a mixed order back into the stored lists, writing button slots.
 * Rule: a button's slot is the number of content blocks before it; any button
 * with no content after it (the tail of the flow) belongs to the actions row
 * and loses its slot, even if it came before other tail buttons.
 */
export function fromBlockFlow(flow: AdFlowBlock[]): { content: RestaurantAdContentElement[]; buttons: RestaurantAdCTA[] } {
  const content: RestaurantAdContentElement[] = [];
  const buttons: RestaurantAdCTA[] = [];
  flow.forEach((block) => {
    if (block.kind === "content") content.push(block.item);
    else buttons.push({ ...block.item, slot: content.length });
  });
  return { content, buttons: buttons.map((cta) => (cta.slot === content.length ? { ...cta, slot: undefined } : cta)) };
}

type Flow = { content: RestaurantAdContentElement[]; buttons: RestaurantAdCTA[] };

/** Applies a list edit to the mixed order so button slots follow the content. */
function editFlow(content: RestaurantAdContentElement[], buttons: RestaurantAdCTA[], edit: (flow: Array<AdFlowBlock & { id: string }>) => Array<AdFlowBlock & { id: string }>): Flow {
  return fromBlockFlow(edit(blockFlow(content, buttons).map((block) => ({ ...block, id: block.item.id }))));
}

/** Moves any block (content or button) to `toIndex` of the mixed order. */
export function moveBlock(content: RestaurantAdContentElement[], buttons: RestaurantAdCTA[], id: string, toIndex: number): Flow {
  return editFlow(content, buttons, (flow) => moveItem(flow, id, toIndex));
}

/** Removes a block; slots of the buttons after it shift with the content. */
export function removeBlock(content: RestaurantAdContentElement[], buttons: RestaurantAdCTA[], id: string): Flow {
  return editFlow(content, buttons, (flow) => flow.filter((block) => block.id !== id));
}

/** Duplicates a block right after itself (same limits as add), slots follow. */
export function duplicateBlock(content: RestaurantAdContentElement[], buttons: RestaurantAdCTA[], id: string): Flow {
  const source = content.find((item) => item.id === id);
  const nextContent = source ? duplicateContentItem(content, id) : content;
  const nextButtons = source ? buttons : duplicateButton(buttons, id);
  const copy = source ? nextContent.find((item, index) => index > 0 && nextContent[index - 1].id === id) : nextButtons.find((cta, index) => index > 0 && nextButtons[index - 1].id === id);
  if (!copy) return { content, buttons };
  return editFlow(content, buttons, (flow) => {
    const index = flow.findIndex((block) => block.id === id);
    const block = source ? ({ kind: "content", item: copy as RestaurantAdContentElement, id: copy.id } as const) : ({ kind: "button", item: copy as RestaurantAdCTA, id: copy.id } as const);
    return [...flow.slice(0, index + 1), block, ...flow.slice(index + 1)];
  });
}

export function buttonLimit(): number {
  return MAX_BUTTONS;
}

/**
 * Origin of the public site rendered inside the ad editor preview. By default
 * it is the restaurant's own website. A non-production build can set
 * VITE_AD_PREVIEW_ORIGIN so the editor previews against its matching public
 * renderer without editing the restaurant's website setting.
 */
export function adPreviewOrigin(website: string): string {
  const override = String(import.meta.env.VITE_AD_PREVIEW_ORIGIN ?? "").trim();
  return (override || website).replace(/\/+$/, "");
}
