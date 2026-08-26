import React from "react";
import { useAdsController } from "./hooks/useAdsController";
import { AnunciosList } from "./AnunciosList";

export { AnuncioEditor } from "./AnuncioEditor";
export type { AdsAPI, Notify } from "./AnuncioEditor";

/**
 * Tab entry point used by `/app/config?content=anuncios`. The wrapper keeps
 * the legacy `website` prop so the tab caller does not need to change; the
 * list itself fetches its own website via `useAdsController`.
 */
export function ConfigAnuncios({ website: _website }: { website: string }) {
  void _website;
  const { api, notify } = useAdsController();
  return <AnunciosList api={api} notify={notify} />;
}
