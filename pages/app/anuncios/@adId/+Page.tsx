import React from "react";
import { usePageContext } from "vike-react/usePageContext";
import { AdEditor, adEditorTab } from "../functionalComponents/AdEditor";
import { InlineAlert } from "../../../../ui/feedback/InlineAlert";
import type { Data } from "./+data";

export default function AnuncioEditPage() {
  const pageContext = usePageContext();
  const data = (pageContext.data ?? { adId: null, initialAd: null }) as Data;

  return (
    // Desktop: the editor fills the rest of the viewport (no page scroll).
    <section className="flex min-w-0 flex-col gap-4 lg:min-h-0 lg:flex-1" aria-label="Anuncio" data-testid="anuncio-edit-page">
      {data.adId ? (
        <AdEditor mode="edit" adId={data.adId} initialAd={data.initialAd} initialTab={adEditorTab(pageContext.urlParsed?.search?.tab)} />
      ) : (
        <InlineAlert kind="error" title="Anuncio no válido" message="El identificador de anuncio no es válido." testId="anuncio-edit-invalid" />
      )}
    </section>
  );
}
