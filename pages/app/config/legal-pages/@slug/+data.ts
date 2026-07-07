import type { PageContextServer } from "vike/types";
import { useConfig } from "vike-react/useConfig";

import type { LegalPageSlug } from "../../../../../api/types";

const VALID_SLUGS: LegalPageSlug[] = ["aviso-legal", "booking-policies", "proteccion-datos"];
const SLUG_TITLES: Record<LegalPageSlug, string> = {
  "aviso-legal": "Aviso Legal",
  "booking-policies": "Políticas de Reserva",
  "proteccion-datos": "Protección de Datos",
};

export type Data = Awaited<ReturnType<typeof data>>;

export async function data(pageContext: PageContextServer) {
  const config = useConfig();
  const rawSlug = String((pageContext as { routeParams?: { slug?: string } }).routeParams?.slug ?? "");
  const slug = VALID_SLUGS.includes(rawSlug as LegalPageSlug) ? (rawSlug as LegalPageSlug) : null;

  config({ title: slug ? `${SLUG_TITLES[slug]} · Páginas legales` : "Páginas legales" });

  return {
    slug,
    error: slug ? null : "Página legal no válida",
  };
}
