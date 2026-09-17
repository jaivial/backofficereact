import type {
  RestaurantAd,
  RestaurantAdContentElement,
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

/** A step card background resolves to a CSS background value. */
export function stepBackground(step: Pick<RestaurantAdStep, "background_mode" | "background_color" | "background_image">): string {
  if (step.background_mode === "color") return step.background_color?.trim() || AD_DEFAULT_COLOR;
  if (step.background_mode === "image") return step.background_image ? `url("${step.background_image}") center / cover no-repeat` : "transparent";
  return "transparent";
}

export function buttonLimit(): number {
  return MAX_BUTTONS;
}
