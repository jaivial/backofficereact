
// Site Builder — embeds instatic's on-demand visual editor for the active
// restaurant. The backend proxies editor-dev.menustudioai.com to the restaurant's
// instatic instance (spun up on demand, session injected server-side).
import React from "react";
import { useAtomValue } from "jotai";
import { usePageContext } from "vike-react/usePageContext";

import { sessionAtom } from "../../../state/atoms";

// ponytail: fixed editor host; override needs matching backend INSTATIC_EDITOR_HOST + nginx.
const EDITOR_HOST = "editor-dev.menustudioai.com";

export function editorUrl(restaurantId: number): string {
  return `https://${EDITOR_HOST}/admin/site?rid=${encodeURIComponent(String(restaurantId))}`;
}

function SiteBuilderEditorPage() {
  const pageContext = usePageContext();
  const session = useAtomValue(sessionAtom);
  // The atom tracks a restaurant switch immediately; pageContext is the SSR fallback.
  const restaurantId = session?.activeRestaurantId ?? pageContext.bo?.session?.activeRestaurantId;

  if (!restaurantId) {
    return <main data-ui="site-builder-unavailable">No hay restaurante activo.</main>;
  }

  const src = editorUrl(restaurantId);

  return (
    <iframe
      src={src}
      title="Editor de Sitio Web"
      data-ui="site-builder-instatic-frame"
      style={{ width: "100%", height: "100%", border: "none", display: "block" }}
      allow="clipboard-read; clipboard-write"
    />
  );
}

export { SiteBuilderEditorPage as SiteBuilderPage };
export default SiteBuilderEditorPage;
