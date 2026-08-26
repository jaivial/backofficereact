import React, { useCallback, useMemo } from "react";
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

export default function AnuncioEditPage() {
  const pageContext = usePageContext();
  const rawId = String((pageContext as { routeParams?: { adId?: string } }).routeParams?.adId ?? "");
  const adId = Number(rawId);
  const valid = Number.isFinite(adId) && adId > 0;

  const api = useMemo(() => buildAPI(), []);
  const { pushToast } = useToasts();
  const notify = useCallback<Notify>((kind, title, message) => pushToast({ kind, title, message }), [pushToast]);

  const website = (pageContext as { bo?: { restaurantInfo?: { website?: string } } }).bo?.restaurantInfo?.website ?? "";

  const onDeleted = useCallback(() => {
    if (typeof window !== "undefined") window.location.href = "/app/config?content=anuncios";
  }, []);

  if (!valid) {
    return (
      <section aria-label="Anuncio" className="max-w-3xl mx-auto" data-testid="anuncio-edit-invalid">
        <a href="/app/config?content=anuncios" className="bo-anunciosBackLink" data-slot="anuncio-back-link">
          <ArrowLeft size={16} aria-hidden="true" />
          Volver a la lista de anuncios
        </a>
        <p className="bo-mutedText" style={{ marginTop: 12 }}>Identificador de anuncio no válido.</p>
      </section>
    );
  }

  return (
    <section aria-label="Anuncio" className="grid gap-4" data-testid="anuncio-edit-page">
      <a href="/app/config?content=anuncios" className="bo-anunciosBackLink" data-slot="anuncio-back-link">
        <ArrowLeft size={16} aria-hidden="true" />
        Volver a la lista de anuncios
      </a>
      <AnuncioEditor
        api={api}
        website={website}
        notify={notify}
        mode="edit"
        adId={adId}
        onDeleted={onDeleted}
      />
    </section>
  );
}
