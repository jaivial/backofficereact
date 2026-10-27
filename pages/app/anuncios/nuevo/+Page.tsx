import React from "react";
import { usePageContext } from "vike-react/usePageContext";
import { AdEditor, adEditorTab } from "../functionalComponents/AdEditor";

export default function AnuncioNewPage() {
  const pageContext = usePageContext();
  return (
    <section className="flex min-w-0 flex-col gap-4 lg:min-h-0 lg:flex-1" aria-label="Nuevo anuncio" data-testid="anuncio-new-page">
      <AdEditor mode="create" initialTab={adEditorTab(pageContext.urlParsed?.search?.tab)} />
    </section>
  );
}
