import type { RestaurantAd, RestaurantAdContentElement, RestaurantAdContentType, RestaurantAdCTA } from "../../../../../../api/types";

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

export function createClientID(prefix: string): string {
  const id = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${id}`;
}

export function createDraftAd(): RestaurantAd {
  return { id: 0, name: "Nuevo anuncio", active: false, content: [], ctas: [] };
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
}export function createCTA(): RestaurantAdCTA {
  return { id: createClientID("cta"), text: "Más información", color: "#436754", navigation_mode: "route", route: "/reservas", custom_url: "" };
}

export function buildCTAURL(website: string, cta: Pick<RestaurantAdCTA, "navigation_mode" | "route" | "custom_url">): string {
  if (cta.navigation_mode === "custom") {
    const value = cta.custom_url.trim();
    try {
      const parsed = new URL(value);
      return parsed.protocol === "http:" || parsed.protocol === "https:" ? value : "";
    } catch {
      return "";
    }
  }
  const base = website.trim().replace(/\/+$/, "");
  const route = (cta.route || "/").startsWith("/") ? cta.route || "/" : `/${cta.route}`;
  return base ? `${base}${route === "/" ? "" : route}` : route;
}
