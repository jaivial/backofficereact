import React from "react";
import { usePageContext } from "vike-react/usePageContext";

import { InlineAlert } from "../../../../../ui/feedback/InlineAlert";
import { LegalPageEditor } from "../../functionalComponents/ConfigLegalPages/LegalPageEditor";
import type { Data } from "./+data";

export default function Page() {
  const pageContext = usePageContext();
  const data = pageContext.data as Data | undefined;

  // While vike is still resolving +data during a client-side transition,
  // `pageContext.data` is momentarily undefined. Render nothing (rather than the
  // "no válida" error) so the invalid-slug branch only shows once data has
  // actually loaded and the slug is confirmed null.
  if (!data) {
    return null;
  }

  if (!data.slug) {
    return (
      <section aria-label="Página legal" className="max-w-3xl mx-auto" data-testid="legal-page-editor-invalid">
        <InlineAlert kind="error" title="Página no válida" message={data.error ?? "Página legal no encontrada."} />
      </section>
    );
  }

  return (
    <section aria-label="Página legal" className="max-w-3xl mx-auto max-sm:mx-0 max-sm:px-0" data-testid="config-legal-page-section">
      <LegalPageEditor slug={data.slug} />
    </section>
  );
}
