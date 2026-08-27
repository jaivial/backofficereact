import React, { useCallback } from "react";
import { usePageContext } from "vike-react/usePageContext";
import { navigate } from "vike/client/router";
import { ArrowLeft } from "lucide-react";
import { AnuncioEditor } from "../../functionalComponents/ConfigAnuncios/AnuncioEditor";
import { useAdsController } from "../../functionalComponents/ConfigAnuncios/hooks/useAdsController";
import { InlineAlert } from "../../../../../ui/feedback/InlineAlert";
import type { RestaurantAd } from "../../../../../api/types";
import type { Data } from "./+data";

const LIST_HREF = "/app/config?content=anuncios";

export default function AnuncioEditPage() {
  const pageContext = usePageContext();
  const rawId = String((pageContext as { routeParams?: { adId?: string } }).routeParams?.adId ?? "");
  const adId = Number(rawId);
  const valid = Number.isFinite(adId) && adId > 0;

  const { api, website, notify } = useAdsController();
  const data = (pageContext.data ?? { adId: null, initialAd: null }) as Data;
  const initialAd: RestaurantAd | null = data.initialAd ?? null;

  const onDeleted = useCallback(() => {
    void navigate(LIST_HREF);
  }, []);

  if (!valid) {
    return (
      <section aria-label="Anuncio" className="max-w-3xl mx-auto grid gap-3" data-testid="anuncio-edit-invalid">
        <a href={LIST_HREF} className="bo-anunciosBackLink" data-slot="anuncio-back-link">
          <ArrowLeft size={16} aria-hidden="true" />
          Volver a la lista de anuncios
        </a>
        <InlineAlert kind="error" title="Anuncio no válido" message="El identificador de anuncio no es válido." />
      </section>
    );
  }

  return (
    <section aria-label="Anuncio" className="grid gap-4" data-testid="anuncio-edit-page">
      <a href={LIST_HREF} className="bo-anunciosBackLink" data-slot="anuncio-back-link">
        <ArrowLeft size={16} aria-hidden="true" />
        Volver a la lista de anuncios
      </a>
      <AnuncioEditor
        api={api}
        website={website}
        notify={notify}
        mode="edit"
        adId={adId}
        initialAd={initialAd}
        onDeleted={onDeleted}
      />
    </section>
  );
}
