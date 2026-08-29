import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "../../../../../../api/client";
import { useToasts } from "../../../../../../ui/feedback/useToasts";
import type { AdsAPI, Notify } from "../AnuncioEditor";

type RestaurantInfoLike = { website?: string };

type AdsAPIWithRestaurant = AdsAPI & {
  getRestaurantInfo: () => Promise<{ restaurantInfo?: RestaurantInfoLike } | { message?: string }>;
};

export type AdWSMessage = {
  type: string;
  reqId?: string;
  adId?: number;
  code?: string;
  message?: string;
  ad?: unknown;
};

export type AdSaveMessage = { type: "ad_save"; reqId: string; adId: number; payload: unknown };
export type AdScheduleCheckMessage = { type: "ad_schedule_check"; reqId: string; adId: number; payload: { starts_at: string; ends_at: string } };

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
  /** Live WS readiness: "open" | "connecting" | "closed". */
  wsStatusRef: React.MutableRefObject<"open" | "connecting" | "closed">;
  /** Sends an ad_save message over the shared WS; queued while reconnecting. */
  sendAdSave: (message: AdSaveMessage) => void;
  sendAdScheduleCheck: (message: AdScheduleCheckMessage) => void;
  /** Subscribes to ad_* WS events; returns an unsubscribe fn. */
  subscribeAdEvents: (listener: (event: AdWSMessage) => void) => () => void;
};

/**
 * Centralises the duplicated "build AdsAPI + wire toasts + load website" that
 * each anuncios page used to repeat, plus the shared restaurant WebSocket
 * (fichaje channel) used for realtime: ad_image_failed toasts and — since
 * saves no longer go through the REST endpoint — ad_save / ad_saved traffic.
 */
export function useAdsController(): AdsController {
  const api = useMemo(() => buildAdsAPI(), []);
  const { pushToast } = useToasts();
  const notify = useCallback<Notify>((kind, title, message) => pushToast({ kind, title, message }), [pushToast]);
  const [website, setWebsite] = useState("");
  const wsFailureAtRef = useRef<Map<number, number>>(new Map());
  const wsStatusRef = useRef<"open" | "connecting" | "closed">("connecting");
  const wsRef = useRef<WebSocket | null>(null);
  const outboxRef = useRef<AdSaveMessage[]>([]);
  const listenersRef = useRef(new Set<(event: AdWSMessage) => void>());

  const dispatch = useCallback((event: AdWSMessage) => {
    for (const listener of listenersRef.current) listener(event);
  }, []);

  const flushOutbox = useCallback(() => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    const pending = outboxRef.current;
    outboxRef.current = [];
    for (const message of pending) ws.send(JSON.stringify(message));
  }, []);

  const sendAdScheduleCheck = useCallback((message: AdScheduleCheckMessage) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(message));
  }, []);

  const sendAdSave = useCallback((message: AdSaveMessage) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
      return;
    }
    // Not connected (reconnecting): queue and flush when the socket opens.
    outboxRef.current.push(message);
  }, []);

  const subscribeAdEvents = useCallback((listener: (event: AdWSMessage) => void) => {
    listenersRef.current.add(listener);
    return () => { listenersRef.current.delete(listener); };
  }, []);

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
      wsRef.current = ws;
      ws.onopen = () => {
        wsStatusRef.current = "open";
        retryDelay = 2000;
        flushOutbox();
      };
      ws.onmessage = (event) => {
        let data: unknown;
        try { data = JSON.parse(typeof event.data === "string" ? event.data : ""); } catch { return; }
        const msg = data as AdWSMessage;
        if (!msg || typeof msg.type !== "string") return;
        if (msg.type === "ad_image_failed") {
          const adId = Number(msg.adId);
          if (Number.isFinite(adId) && adId > 0) {
            wsFailureAtRef.current.set(adId, Date.now());
          }
          if (msg.code === "insufficient_credits") {
            notify("error", "Imagen", AD_IMAGE_INSUFFICIENT_CREDITS_MESSAGE);
          }
        }
        if (msg.type === "ad_saved" || msg.type === "ad_save_failed" || msg.type === "ad_image_failed" || msg.type === "ad_schedule_conflict") {
          dispatch(msg);
        }
      };
      ws.onclose = () => {
        wsRef.current = null;
        wsStatusRef.current = "closed";
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
      wsRef.current = null;
      wsStatusRef.current = "closed";
      ws?.close();
    };
  }, [dispatch, flushOutbox, notify]);

  return { api, website, notify, wsFailureAtRef, wsStatusRef, sendAdSave, sendAdScheduleCheck, subscribeAdEvents };
}
