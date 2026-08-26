import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "../../../../../../api/client";
import { useToasts } from "../../../../../../ui/feedback/useToasts";
import type { AdsAPI, Notify } from "../AnuncioEditor";

type RestaurantInfoLike = { website?: string };

type AdsAPIWithRestaurant = AdsAPI & {
  getRestaurantInfo: () => Promise<{ restaurantInfo?: RestaurantInfoLike } | { message?: string }>;
};

function buildAdsAPI(): AdsAPIWithRestaurant {
  const config = createClient({ baseUrl: "" }).config;
  return {
    listAds: config.listAds.bind(config),
    createAd: config.createAd.bind(config),
    updateAd: config.updateAd.bind(config),
    deleteAd: config.deleteAd.bind(config),
    uploadAdImage: config.uploadAdImage.bind(config),
    enhanceAdImage: config.enhanceAdImage.bind(config),
    generateAdImage: config.generateAdImage.bind(config),
    getRestaurantInfo: config.getRestaurantInfo.bind(config),
  };
}

export type AdsController = {
  api: AdsAPIWithRestaurant;
  website: string;
  notify: Notify;
};

/**
 * Centralises the duplicated "build AdsAPI + wire toasts + load website" that
 * each anuncios page used to repeat. Returns a stable API client, the
 * restaurant website (for CTA preview URLs) and a toast-bound notify fn.
 */
export function useAdsController(): AdsController {
  const api = useMemo(() => buildAdsAPI(), []);
  const { pushToast } = useToasts();
  const notify = useCallback<Notify>((kind, title, message) => pushToast({ kind, title, message }), [pushToast]);
  const [website, setWebsite] = useState("");

  useEffect(() => {
    let cancelled = false;
    api.getRestaurantInfo()
      .then((res) => {
        if (cancelled) return;
        const ri = (res as { restaurantInfo?: RestaurantInfoLike }).restaurantInfo;
        if (ri?.website) setWebsite(ri.website);
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [api]);

  return { api, website, notify };
}
