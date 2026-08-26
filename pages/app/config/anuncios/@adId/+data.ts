import type { PageContextServer } from "vike/types";
import { useConfig } from "vike-react/useConfig";

export type Data = Awaited<ReturnType<typeof data>>;

export async function data(pageContext: PageContextServer) {
  const config = useConfig();
  const rawAdId = String((pageContext as { routeParams?: { adId?: string } }).routeParams?.adId ?? "");
  const adId = Number(rawAdId);
  config({ title: Number.isFinite(adId) && adId > 0 ? `Editar anuncio ${adId} · Anuncios` : "Anuncio no válido" });
  return { adId: Number.isFinite(adId) && adId > 0 ? adId : null };
}
