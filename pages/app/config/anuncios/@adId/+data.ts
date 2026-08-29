import type { PageContextServer } from "vike/types";
import { useConfig } from "vike-react/useConfig";
import { createClient } from "../../../../../api/client";
import type { RestaurantAd } from "../../../../../api/types";

export type Data = Awaited<ReturnType<typeof data>>;

export async function data(pageContext: PageContextServer) {
  const config = useConfig();
  const rawAdId = String((pageContext as { routeParams?: { adId?: string } }).routeParams?.adId ?? "");
  const adId = Number(rawAdId);
  const valid = Number.isFinite(adId) && adId > 0;

  config({
    title: valid ? `Editar anuncio ${adId} · Anuncios` : "Anuncio no válido",
  });

  let initialAd: RestaurantAd | null = null;
  if (valid) {
    const backendOrigin = pageContext.boRequest?.backendOrigin ?? "http://127.0.0.1:8080";
    const cookieHeader = pageContext.boRequest?.cookieHeader ?? "";
    try {
      const api = createClient({ baseUrl: backendOrigin, cookieHeader });
      const res = await api.config.listAds();
      if (res.success) {
        initialAd = res.ads?.find((item) => item.id === adId) ?? null;
      }
    } catch {
      initialAd = null;
    }
  }

  return { adId: valid ? adId : null, initialAd };
}
