import React, { Suspense, useEffect, useRef, useState } from "react";
import { usePageContext } from "vike-react/usePageContext";
import { useAdsController } from "../../../config/functionalComponents/ConfigAnuncios/hooks/useAdsController";
import type { RestaurantAd, RestaurantAdInput } from "../../../../../api/types";
import type { Data } from "./+data";

// Coordination id: puck_alt_v1 — alternativa visual Puck (MIT) al editor clásico.
const Missing = (label: string) => (_: any) => <p data-testid={`anuncio-puck-missing-${label}`}>No disponible: {label}.</p>;
const AdPuckEditor: any = React.lazy(() =>
  import("../../../config/functionalComponents/ConfigAnuncios/puck/AdPuckEditor")
    .then((m: any) => ({ default: m.AdPuckEditor }))
    .catch(() => ({ default: Missing("editor") })),
);
const AdPuckRender: any = React.lazy(() =>
  import("../../../config/functionalComponents/ConfigAnuncios/puck/AdPuckRender")
    .then((m: any) => ({ default: m.AdPuckRender }))
    .catch(() => ({ default: Missing("preview") })),
);
const toInput = (ad: RestaurantAd): RestaurantAdInput => ({
  name: ad.name, active: ad.active, content: ad.content, ctas: ad.ctas,
  starts_at: ad.starts_at ?? null, ends_at: ad.ends_at ?? null, layout: ad.layout,
});

export default function AnuncioPuckPage() {
  const ctx = usePageContext();
  const rawId = String((ctx as { routeParams?: { adId?: string } }).routeParams?.adId ?? "");
  const adId = Number(rawId);
  const valid = Number.isFinite(adId) && adId > 0;
  const { api, website, notify } = useAdsController();
  const data = (ctx.data ?? { adId: null, initialAd: null }) as Data;
  const [ad, setAd] = useState<RestaurantAd | null>(data.initialAd ?? null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  if (!valid) {
    return (
      <section aria-label="Anuncio Puck" data-testid="anuncio-puck-invalid">
        <p data-testid="anuncio-puck-invalid-msg">El identificador de anuncio no es válido.</p>
      </section>
    );
  }
  const onChange = (next: RestaurantAd) => {
    setAd(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      void api
        .updateAd(adId, toInput(next))
        .then((res) => {
          if (!res.success) notify("error", "Anuncios", res.message || "No se pudo guardar el anuncio");
        })
        .catch((error) => notify("error", "Anuncios", error instanceof Error ? error.message : "No se pudo guardar el anuncio"));
    }, 1000);
  };
  return (
    <section aria-label="Anuncio Puck" data-testid="anuncio-puck-page" data-slot="anuncio-puck-page" data-coord="puck_alt_v1">
      <nav data-testid="anuncio-puck-nav">
        <a href="/app/anuncios" data-testid="anuncio-puck-back-list">Volver a la lista</a>
        <a href={`/app/anuncios/${adId}`} data-testid="anuncio-puck-back-classic">Volver al editor clásico</a>
      </nav>
      <p data-testid="anuncio-puck-note">Alternativa visual con Puck (MIT).</p>
      {ad ? (
        <React.Fragment>
          <div data-testid="anuncio-puck-editor-wrap">
            <Suspense fallback={<p data-testid="anuncio-puck-editor-loading">Cargando editor…</p>}>
              <AdPuckEditor ad={ad} website={website} onChange={onChange} onImagePick={() => {}} />
            </Suspense>
          </div>
          <div data-testid="anuncio-puck-preview-wrap">
            <Suspense fallback={<p data-testid="anuncio-puck-preview-loading">Cargando vista previa…</p>}>
              <AdPuckRender ad={ad} />
            </Suspense>
          </div>
        </React.Fragment>
      ) : (
        <p data-testid="anuncio-puck-empty">Sin datos de anuncio.</p>
      )}
    </section>
  );
}
