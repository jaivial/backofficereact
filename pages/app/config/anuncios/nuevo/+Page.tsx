import React, { useCallback } from "react";
import { navigate } from "vike/client/router";
import { ArrowLeft } from "lucide-react";
import { AnuncioEditor } from "../../functionalComponents/ConfigAnuncios/AnuncioEditor";
import { useAdsController } from "../../functionalComponents/ConfigAnuncios/hooks/useAdsController";

const LIST_HREF = "/app/config?content=anuncios";

export default function AnuncioNewPage() {
  const { api, website, notify } = useAdsController();

  const onSaved = useCallback((ad: { id: number }) => {
    if (ad.id > 0) void navigate(`/app/config/anuncios/${ad.id}`);
  }, []);

  return (
    <section aria-label="Nuevo anuncio" className="grid gap-4" data-testid="anuncio-new-page">
      <a href={LIST_HREF} className="bo-anunciosBackLink" data-slot="anuncio-back-link">
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
