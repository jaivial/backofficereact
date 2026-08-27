import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "../../../../../../api/client";
import { useToasts } from "../../../../../../ui/feedback/useToasts";
import type { AdsAPI, Notify } from "../AnuncioEditor";

type RestaurantInfoLike = { website?: string };

type AdsAPIWithRestaurant = AdsAPI & {
  getRestaurantInfo: () => Promise<{ restaurantInfo?: RestaurantInfoLike } | { message?: string }>;
};

export const AD_IMAGE_INSUFFICIENT_CREDITS_MESSAGE =
  "Crédito insuficiente: contacta con el administrador para añadir fondos a WaveSpeed.";

function adImageWSURL(): string {
  const proto = window.location.protocol === "https:" ? "wss" : "ws";
  return `${proto}://${window.location.host}/api/admin/fichaje/ws`;
}

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
  /** Newest ad_image_failed event seen over WS for any ad (adId -> timestamp ms). */
  wsFailureAtRef: React.MutableRefObject<Map<number, number>>;
};

/**
 * Centralises the duplicated "build AdsAPI + wire toasts + load website" that
 * each anuncios page used to repeat. Returns a stable API client, the
 * restaurant website (for CTA preview URLs) and a toast-bound notify fn.
 *
 * Also keeps one shared WebSocket (the restaurant-scoped fichaje channel)
 * open while an anuncios page is mounted and listens for `ad_image_failed`
 * events so AI-image failures surface with an actionable toast even when an
 * intermediary (Cloudflare) replaces the HTTP error body of the original
 * POST.
 */
export function useAdsController(): AdsController {
  const api = useMemo(() => buildAdsAPI(), []);
  const { pushToast } = useToasts();
  const notify = useCallback<Notify>((kind, title, message) => pushToast({ kind, title, message }), [pushToast]);
  const [website, setWebsite] = useState("");
  const wsFailureAtRef = useRef<Map<number, number>>(new Map());

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

  useEffect(() => {
    if (typeof window === "undefined" || typeof WebSocket === "undefined") return;
    let ws: WebSocket | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let closed = false;
    let retryDelay = 2000;

    const connect = () => {
      if (closed) return;
      ws = new WebSocket(adImageWSURL());
      ws.onmessage = (event) => {
        let data: unknown;
        try { data = JSON.parse(typeof event.data === "string" ? event.data : ""); } catch { return; }
        const msg = data as { type?: string; adId?: number; code?: string; message?: string };
        if (msg?.type !== "ad_image_failed") return;
        const adId = Number(msg.adId);
        if (Number.isFinite(adId) && adId > 0) {
          wsFailureAtRef.current.set(adId, Date.now());
        }
        if (msg.code === "insufficient_credits") {
          notify("error", "Imagen", AD_IMAGE_INSUFFICIENT_CREDITS_MESSAGE);
        }
      };
      ws.onclose = () => {
        if (closed) return;
        retryTimer = setTimeout(() => {
          retryDelay = Math.min(retryDelay * 2, 30000);
          connect();
        }, retryDelay);
      };
    };

    connect();
    return () => {
      closed = true;
      if (retryTimer) clearTimeout(retryTimer);
      ws?.close();
    };
  }, [notify]);

  return { api, website, notify, wsFailureAtRef };
}
