import React, { useCallback, useEffect, useMemo, useState } from "react";
import { usePageContext } from "vike-react/usePageContext";
import { ArrowLeft } from "lucide-react";
import { createClient } from "../../../../../api/client";
import { useToasts } from "../../../../../ui/feedback/useToasts";
import { AnuncioEditor, type AdsAPI, type Notify } from "../../functionalComponents/ConfigAnuncios/AnuncioEditor";

function buildAPI(): AdsAPI {
  const client = createClient({ baseUrl: "" });
  const config = client.config;
  return {
    listAds: config.listAds.bind(config),
    createAd: config.createAd.bind(config),
    updateAd: config.updateAd.bind(config),
    deleteAd: config.deleteAd.bind(config),
    uploadAdImage: config.uploadAdImage.bind(config),
    enhanceAdImage: config.enhanceAdImage.bind(config),
    generateAdImage: config.generateAdImage.bind(config),
  };
}

export default function AnuncioNewPage() {
  const pageContext = usePageContext();
  const api = useMemo(() => buildAPI(), []);
  const { pushToast } = useToasts();
  const notify = useCallback<Notify>((kind, title, message) => pushToast({ kind, title, message }), [pushToast]);

  const [website, setWebsite] = useState("");
  useEffect(() => {
    let cancelled = false;
    createClient({ baseUrl: "" }).config.getRestaurantInfo()
      .then((res) => {
        if (cancelled) return;
        if ("restaurantInfo" in res && res.restaurantInfo?.website) setWebsite(res.restaurantInfo.website);
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  const onSaved = useCallback((ad: { id: number }) => {
    if (typeof window !== "undefined" && ad.id > 0) {
      window.location.href = `/app/config/anuncios/${ad.id}`;
    }
  }, []);

  return (
    <section aria-label="Nuevo anuncio" className="grid gap-4" data-testid="anuncio-new-page">
      <a href="/app/config?content=anuncios" className="bo-anunciosBackLink" data-slot="anuncio-back-link">
        <ArrowLeft size={16} aria-hidden="true" />
        Volver a la lista de anuncios
      </a>
      <AnuncioEditor
        api={api}
        website={website}
        notify={notify}
        mode="create"
        onSaved={onSaved}
      />
    </section>
  );
}
