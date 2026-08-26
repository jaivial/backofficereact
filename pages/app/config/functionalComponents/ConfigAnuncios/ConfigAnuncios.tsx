import React, { useCallback, useMemo } from "react";
import { createClient } from "../../../../../api/client";
import { useToasts } from "../../../../../ui/feedback/useToasts";
import { AnunciosList } from "./AnunciosList";
import { AnuncioEditor, type AdsAPI, type Notify } from "./AnuncioEditor";

export { AnuncioEditor } from "./AnuncioEditor";
export type { AdsAPI, Notify } from "./AnuncioEditor";

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

/**
 * @deprecated Use `AnuncioEditor` directly. Kept as a thin wrapper to preserve
 * existing imports from the existing ConfigAnuncios.structure.test.tsx suite,
 * which exercises the editor UI with a single pre-loaded ad.
 */
export function ConfigAnunciosContent({ api, website, notify, initialAd, adId }: { api: AdsAPI; website: string; notify?: Notify; initialAd?: Parameters<typeof AnuncioEditor>[0]["initialAd"]; adId?: number }) {
  return (
    <AnuncioEditor
      api={api}
      website={website}
      notify={notify}
      mode={adId ? "edit" : "create"}
      adId={adId}
      initialAd={initialAd}
    />
  );
}

export function ConfigAnuncios({ website }: { website: string }) {
  const api = useMemo(() => buildAPI(), []);
  const { pushToast } = useToasts();
  const notify = useCallback<Notify>((kind, title, message) => pushToast({ kind, title, message }), [pushToast]);
  return <AnunciosList api={api} notify={notify} />;
}
