import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, Reorder, useDragControls } from "motion/react";
import {
  Check,
  CircleAlert,
  Eye,
  GripVertical,
  ImagePlus,
  Megaphone,
  Monitor,
  Plus,
  Settings2,
  Sparkles,
  Smartphone,
  Trash2,
  Type,
  Upload,
  Wand2,
} from "lucide-react";
import type {
  RestaurantAd,
  RestaurantAdContentElement,
  RestaurantAdContentType,
  RestaurantAdInput,
  RestaurantAdTextAlign,
} from "../../../../../api/types";
import { Select } from "../../../../../ui/inputs/Select";
import { Modal } from "../../../../../ui/overlays/Modal";
import { ModalHeader } from "../../../../../ui/overlays/ModalHeader";
import { Popover } from "../../../../../ui/overlays/Popover";
import { Panel } from "../../../../../ui/shell/Panel";
import { PageToolbar } from "../../../../../ui/shell/PageToolbar";
import {
  addContentItem,
  buildCTAURL,
  createCTA,
  createDraftAd,
  removeContentItem,
  WEBSITE_ROUTE_OPTIONS,
} from "./lib/adEditor";
import { compressAdImage } from "./lib/image";
import { InlineDateRangeCalendar } from "../../../../../ui/inputs/InlineDateRangeCalendar";
import { formatISODate, parseISODate } from "../../../../../ui/lib/format";

export type AdsAPI = {
  listAds: () => Promise<{ success: boolean; ads?: RestaurantAd[]; message?: string }>;
  createAd: (payload: RestaurantAdInput) => Promise<{ success: boolean; ad?: RestaurantAd; message?: string }>;
  updateAd: (id: number, payload: RestaurantAdInput) => Promise<{ success: boolean; ad?: RestaurantAd; message?: string }>;
  deleteAd: (id: number) => Promise<{ success: boolean; message?: string }>;
  uploadAdImage: (id: number, file: File) => Promise<{ success: boolean; url?: string; message?: string }>;
  enhanceAdImage: (id: number, file: File) => Promise<{ success: boolean; url?: string; message?: string }>;
  generateAdImage: (id: number) => Promise<{ success: boolean; url?: string; message?: string }>;
};

export type Notify = (kind: "success" | "error" | "info", title: string, message: string) => void;

export type AdSaveRequest = { type: "ad_save"; reqId: string; adId: number; payload: unknown };
export type AdEventListener = (event: { type: string; reqId?: string; adId?: number; code?: string; message?: string; ad?: unknown; conflict?: boolean; name?: string; starts_at?: string; ends_at?: string }) => void;

type ImageStep = "choose" | "preparing" | "advisor" | "working";

const NOOP_NOTIFY: Notify = () => undefined;

const TYPE_LABEL: Record<RestaurantAdContentType, string> = {
  title: "Título",
  subtitle: "Subtítulo",
  text: "Texto",
  image: "Imagen",
};
const TYPE_HINT: Record<RestaurantAdContentType, string> = {
  title: "Hasta 5",
  subtitle: "Hasta 5",
  text: "Hasta 5",
  image: "Una sola",
};

export function apiMessage(result: unknown, fallback: string): string {
  if (result && typeof result === "object" && "message" in result && typeof (result as { message?: unknown }).message === "string") {
    const msg = (result as { message: string }).message;
    return msg || fallback;
  }
  return fallback;
}

type AnuncioEditorProps = {
  api: AdsAPI;
  website: string;
  notify?: Notify;
  mode: "edit" | "create";
  adId?: number;
  initialAd?: RestaurantAd | null;
  onSaved?: (ad: RestaurantAd) => void;
  onDeleted?: () => void;
  wsFailureAtRef?: React.MutableRefObject<Map<number, number>>;
  wsStatusRef?: React.MutableRefObject<"open" | "connecting" | "closed">;
  sendAdSave?: (message: AdSaveRequest) => void;
  subscribeAdEvents?: (listener: AdEventListener) => () => void;
  autosaveDelayMs?: number;
  sendAdScheduleCheck?: (message: { type: "ad_schedule_check"; reqId: string; adId: number; payload: { starts_at: string; ends_at: string } }) => void;
};

export function AnuncioEditor({ api, website, notify = NOOP_NOTIFY, mode, adId, initialAd, onSaved, onDeleted, wsStatusRef, sendAdSave, subscribeAdEvents, autosaveDelayMs, sendAdScheduleCheck }: AnuncioEditorProps) {
  const [ad, setAd] = useState<RestaurantAd | null>(initialAd ?? null);
  const [loading, setLoading] = useState(mode === "edit" && !initialAd);
  const [busy, setBusy] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewDevice, setPreviewDevice] = useState<"mobile" | "desktop">("desktop");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [scheduleError, setScheduleError] = useState("");
  const scheduleCheckReqRef = useRef<string | null>(null);

  const [imageOpen, setImageOpen] = useState(false);
  const [imageStep, setImageStep] = useState<ImageStep>("choose");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewURL, setImagePreviewURL] = useState("");
  const [imageEnhancing, setImageEnhancing] = useState(false);
  const [addContentOpen, setAddContentOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const addContentBtnRef = useRef<HTMLButtonElement | null>(null);
  const baselineRef = useRef<string | null>(null);
  const pendingSavesRef = useRef(new Map<string, { resolve: (ad: RestaurantAd | null) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> }>());
  const reqCounter = useRef(0);

  useEffect(() => {
    if (mode !== "edit" || initialAd || !adId) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const result = await api.listAds();
        if (cancelled) return;
        if (!result.success) {
          notify("error", "Anuncios", apiMessage(result, "No se pudieron cargar los anuncios"));
          setAd(null);
          return;
        }
        setAd(result.ads?.find((item) => item.id === adId) ?? null);
      } catch (error) {
        if (cancelled) return;
        notify("error", "Anuncios", error instanceof Error ? error.message : "No se pudieron cargar los anuncios");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [adId, api, initialAd, mode, notify]);

  useEffect(() => {
    if (mode === "create" && !ad) setAd(createDraftAd());
  }, [ad, mode]);

  useEffect(() => () => { if (imagePreviewURL) URL.revokeObjectURL(imagePreviewURL); }, [imagePreviewURL]);

  const persistAd = useCallback(async (source: RestaurantAd): Promise<RestaurantAd | null> => {
    try {
      const payload: RestaurantAdInput = { name: source.name, active: source.active, content: source.content, ctas: source.ctas, starts_at: source.starts_at ?? null, ends_at: source.ends_at ?? null };
      const result = source.id > 0
        ? await api.updateAd(source.id, payload)
        : await api.createAd(payload);
      if (!result.success) { notify("error", "Anuncios", apiMessage(result, "No se pudo guardar el anuncio")); return null; }
      if (result.ad) setAd(result.ad);
      if (result.ad && onSaved) onSaved(result.ad);
      return result.ad ?? null;
    } catch (error) {
      notify("error", "Anuncios", error instanceof Error ? error.message : "No se pudo guardar el anuncio");
      return null;
    }
  }, [api, notify, onSaved]);

  const persistViaWS = useCallback((source: RestaurantAd): Promise<RestaurantAd | null> => {
    // The shared WS can be mid-reconnect (backoff grows to 30s) or stale after a
    // tab restore, so queuing an ad_save and waiting 8s surfaces a bogus
    // "sin conexión con el servidor" error while the write never gets a chance.
    // When the socket is not confirmed open, save over REST instead. If no
    // wsStatusRef is provided (e.g. isolated component tests), keep the old
    // WS-only path.
    if (!sendAdSave) return persistAd(source);
    if (wsStatusRef && wsStatusRef.current !== "open") return persistAd(source);
    const reqId = `ad-save-${Date.now()}-${++reqCounter.current}`;
    return new Promise((resolve, reject) => {
      let settled = false;
      const finish = (ad: RestaurantAd | null) => { if (!settled) { settled = true; clearTimeout(timer); resolve(ad); } };
      const fail = (error: Error) => { if (!settled) { settled = true; clearTimeout(timer); reject(error); } };
      const timer = setTimeout(() => {
        // WS did not confirm in time → fall back to REST so the save still lands.
        pendingSavesRef.current.delete(reqId);
        void persistAd(source).then(finish);
      }, 8000);
      pendingSavesRef.current.set(reqId, { resolve: finish, reject: fail, timer });
      sendAdSave({ type: "ad_save", reqId, adId: source.id, payload: { name: source.name, active: source.active, content: source.content, ctas: source.ctas, starts_at: source.starts_at ?? null, ends_at: source.ends_at ?? null } });
    });
  }, [persistAd, sendAdSave, wsStatusRef]);

  useEffect(() => {
    if (!subscribeAdEvents) return;
    return subscribeAdEvents((event) => {
      const pending = event.reqId ? pendingSavesRef.current.get(event.reqId) : undefined;
      if (event.type === "ad_saved" && pending) {
        clearTimeout(pending.timer);
        pendingSavesRef.current.delete(event.reqId!);
        pending.resolve(event.ad as RestaurantAd);
        setSaveState("saved");
      }
      if (event.type === "ad_schedule_conflict" && event.reqId === scheduleCheckReqRef.current) {
        if (event.conflict) {
          setScheduleError(`El anuncio ${event.name} esta programado para las fechas ${event.starts_at} a ${event.ends_at}, no puedes asignar estas fechas seleccionadas.`);
          setAd((current) => current ? { ...current, starts_at: null, ends_at: null } : current);
        }
      }
      if (event.type === "ad_save_failed" && pending) {
        clearTimeout(pending.timer);
        pendingSavesRef.current.delete(event.reqId!);
        pending.reject(new Error(event.message || "No se pudo guardar el anuncio"));
        setSaveState("error");
      }
    });
  }, [subscribeAdEvents]);

  useEffect(() => {
    if (!ad || !sendAdSave) return;
    const json = JSON.stringify({ name: ad.name, active: ad.active, content: ad.content, ctas: ad.ctas, starts_at: ad.starts_at ?? null, ends_at: ad.ends_at ?? null });
    if (baselineRef.current === null) { baselineRef.current = json; return; }
    if (json === baselineRef.current) return;
    const timer = setTimeout(() => {
      setSaveState("saving");
      void persistViaWS(ad).then((saved) => {
        if (saved) {
          setAd(saved);
          baselineRef.current = JSON.stringify({ name: saved.name, active: saved.active, content: saved.content, ctas: saved.ctas, starts_at: saved.starts_at ?? null, ends_at: saved.ends_at ?? null });
        }
      }).catch((error) => notify("error", "Anuncios", error instanceof Error ? error.message : "No se pudo guardar el anuncio"));
    }, autosaveDelayMs ?? 1000);
    return () => clearTimeout(timer);
  }, [ad, autosaveDelayMs, notify, persistViaWS, sendAdSave]);

  const removeAd = useCallback(async () => {
    if (!ad?.id) return;
    setBusy(true);
    try {
      const result = await api.deleteAd(ad.id);
      if (!result.success) { notify("error", "Anuncios", apiMessage(result, "No se pudo eliminar el anuncio")); return; }
      if (onDeleted) onDeleted();
    } catch (error) {
      notify("error", "Anuncios", error instanceof Error ? error.message : "No se pudo eliminar el anuncio");
    } finally {
      setBusy(false);
    }
  }, [ad, api, notify, onDeleted]);

  const updateContentValue = useCallback((id: string, value: string) =>
    setAd((current) => current ? { ...current, content: current.content.map((item) => item.id === id ? { ...item, value } : item) } : current),
  []);
  const blockedRanges = ad?.blocked_ranges?.filter((range) => range.id !== ad.id) ?? [];
  const blockedDates = useMemo(() => {
    const result = new Set<string>();
    for (const range of blockedRanges) {
      const from = parseISODate(range.starts_at); const to = parseISODate(range.ends_at);
      if (!from || !to) continue;
      const cursor = new Date(from);
      while (cursor <= to) { result.add(formatISODate(cursor)); cursor.setUTCDate(cursor.getUTCDate() + 1); }
    }
    return result;
  }, [blockedRanges]);
  const blockedDateLabels = useMemo(() => {
    const result = new Map<string, string>();
    for (const range of blockedRanges) {
      const from = parseISODate(range.starts_at); const to = parseISODate(range.ends_at);
      if (!from || !to) continue;
      const cursor = new Date(from);
      while (cursor <= to) { result.set(formatISODate(cursor), `Reservado por ${range.name}`); cursor.setUTCDate(cursor.getUTCDate() + 1); }
    }
    return result;
  }, [blockedRanges]);

  const updateContentAlign = useCallback((id: string, align: RestaurantAdTextAlign) =>
    setAd((current) => current ? { ...current, content: current.content.map((item) => item.id === id ? { ...item, align } : item) } : current),
  []);

  const addContent = useCallback((type: RestaurantAdContentType) => {
    if (!ad) return;
    try {
      setAd(addContentItem(ad, type));
      setAddContentOpen(false);
    } catch (error) {
      notify("info", "Límite", error instanceof Error ? error.message : "No se puede añadir otro elemento");
    }
  }, [ad, notify]);

  const addCta = useCallback(() => {
    if (!ad) return;
    setAd({ ...ad, ctas: [...ad.ctas, createCTA()] });
    setAddContentOpen(false);
  }, [ad]);

  const setImageURL = useCallback(async (url: string) => {
    if (!ad) return;
    const existing = ad.content.find((item) => item.type === "image");
    const next = existing ? { ...ad, content: ad.content.map((item) => item.id === existing.id ? { ...item, value: url } : item) } : addContentItem(ad, "image");
    const withURL = existing ? next : { ...next, content: next.content.map((item) => item.type === "image" && !item.value ? { ...item, value: url } : item) };
    setAd(withURL);
    await persistAd(withURL);
  }, [ad, persistAd]);

  const closeImage = useCallback(() => { setImageOpen(false); setImageStep("choose"); setImageFile(null); setImagePreviewURL(""); }, []);
  const chooseImage = useCallback(async (file: File) => {
    console.log("[AD-DEBUG] chooseImage called", { name: file?.name, type: file?.type, size: file?.size });
    setImageStep("preparing");
    try {
      const compressed = await compressAdImage(file);
      console.log("[AD-DEBUG] compressAdImage OK", { outName: compressed?.name, outSize: compressed?.size });
      const url = URL.createObjectURL(compressed);
      setImagePreviewURL((old) => { if (old) URL.revokeObjectURL(old); return url; });
      setImageFile(compressed); setImageStep("advisor");
    } catch (error) {
      console.log("[AD-DEBUG] chooseImage FAILED", { name: error instanceof Error ? error.name : typeof error, message: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? (error.stack || "").split("\n").slice(0, 3).join("\n") : "" });
      notify("error", "Imagen", error instanceof Error ? error.message : "No se pudo preparar la imagen");
      setImageStep("choose");
    }
  }, [notify]);

  const handleUploadedImage = useCallback(async (enhance: boolean) => {
    if (!ad?.id || !imageFile) return;
    if (enhance) {
      const fileToEnhance = imageFile;
      setImageEnhancing(true);
      closeImage();
      try {
        const result = await api.enhanceAdImage(ad.id, fileToEnhance);
        if (!result.success) {
          notify("error", "Imagen", apiMessage(result, "No se pudo procesar la imagen"));
          return;
        }
        await setImageURL(result.url ?? "");
      } catch (error) {
        notify("error", "Imagen", error instanceof Error ? error.message : "No se pudo procesar la imagen");
      } finally {
        setImageEnhancing(false);
      }
      return;
    }
    setImageStep("working");
    try {
      const result = await api.uploadAdImage(ad.id, imageFile);
      if (!result.success) { notify("error", "Imagen", apiMessage(result, "No se pudo procesar la imagen")); setImageStep("advisor"); return; }
      await setImageURL(result.url ?? "");
      closeImage();
    } catch (error) {
      notify("error", "Imagen", error instanceof Error ? error.message : "No se pudo procesar la imagen");
      setImageStep("advisor");
    }
  }, [ad?.id, api, closeImage, imageFile, notify, setImageURL]);

  const generateImage = useCallback(async () => {
    if (!ad) return;
    setImageStep("working");
    const saved = await persistAd(ad);
    if (!saved) { setImageStep("choose"); return; }
    try {
      const result = await api.generateAdImage(saved.id);
      if (!result.success) { notify("error", "Imagen", apiMessage(result, "No se pudo generar la imagen")); setImageStep("choose"); return; }
      await setImageURL(result.url ?? "");
      closeImage();
    } catch (error) {
      notify("error", "Imagen", error instanceof Error ? error.message : "No se pudo generar la imagen");
      setImageStep("choose");
    }
  }, [ad, api, closeImage, notify, persistAd, setImageURL]);

  const textCounts = useMemo(() => ad ? ad.content.reduce<Record<string, number>>((out, item) => ({ ...out, [item.type]: (out[item.type] || 0) + 1 }), {}) : {}, [ad]);

  if (loading) {
    return (
      <Panel data-slot="ads-loading" meta="Cargando anuncio...">
        <p className="bo-mutedText">Recuperando el anuncio solicitado.</p>
      </Panel>
    );
  }

  if (!ad) {
    return (
      <Panel data-slot="ads-not-found" className="bo-panel--empty" meta="Anuncio no encontrado" title="No se pudo cargar el anuncio">
        <p className="bo-mutedText" style={{ textAlign: "center", paddingBlock: 16 }}>
          El anuncio solicitado no existe o fue eliminado.
        </p>
      </Panel>
    );
  }

  const addContentItems: Array<{ type: RestaurantAdContentType; icon: React.ReactNode; label: string; meta: string; disabled?: boolean }> = [
    { type: "title", icon: <Type size={16} aria-hidden="true" />, label: "Título", meta: TYPE_HINT.title, disabled: (textCounts.title || 0) >= 5 },
    { type: "subtitle", icon: <Wand2 size={16} aria-hidden="true" />, label: "Subtítulo", meta: TYPE_HINT.subtitle, disabled: (textCounts.subtitle || 0) >= 5 },
    { type: "text", icon: <Sparkles size={16} aria-hidden="true" />, label: "Texto", meta: TYPE_HINT.text, disabled: (textCounts.text || 0) >= 5 },
    { type: "image", icon: <ImagePlus size={16} aria-hidden="true" />, label: "Imagen", meta: TYPE_HINT.image, disabled: (textCounts.image || 0) >= 1 },
  ];

  return (
    <section className="grid gap-4" aria-label="Anuncios" data-testid="config-anuncios">
      <PageToolbar
        data-slot="ads-toolbar"
        left={<span className="bo-anunciosEditorCrumb">{mode === "create" ? "Nuevo anuncio" : "Editando anuncio"}</span>}
        right={
          ad.id > 0 ? (
            <button
              type="button"
              onClick={() => void removeAd()}
              disabled={busy}
              className="bo-anunciosIconBtn"
              data-tone="danger"
              aria-label="Eliminar anuncio"
              data-slot="ad-delete"
            >
              <Trash2 size={16} aria-hidden="true" />
            </button>
          ) : null
        }
      />

      <div className="bo-anunciosEditorBar" data-slot="ads-editor-bar">
        <div className="bo-anunciosEditorBar-left" data-slot="ads-editor-bar-left">
          <span className="bo-anunciosEditorStatus" data-slot="ads-editor-status">{ad.active ? "Activo" : "Inactivo"}</span>
        </div>
        <div className="bo-anunciosEditorBar-right" data-slot="ads-editor-bar-right">
          <div
            className="bo-anunciosPreviewSwitch"
            role="group"
            aria-label="Modo de visualización"
            data-slot="ads-preview-switch"
          >
            <button
              type="button"
              className={`bo-anunciosPreviewSwitchBtn ${previewOpen ? "" : "is-active"}`}
              onClick={() => setPreviewOpen(false)}
              aria-pressed={!previewOpen}
              data-testid="ad-mode-editor"
            >
              <Settings2 size={14} aria-hidden="true" />
              <span className="bo-anunciosPreviewSwitchLabel">Editor</span>
            </button>
            <button
              type="button"
              className={`bo-anunciosPreviewSwitchBtn ${previewOpen ? "is-active" : ""}`}
              onClick={() => setPreviewOpen(true)}
              aria-pressed={previewOpen}
              data-testid="ad-mode-preview"
            >
              <Eye size={14} aria-hidden="true" />
              <span className="bo-anunciosPreviewSwitchLabel">Preview</span>
            </button>
          </div>
          <SaveStatusBadge state={saveState} />
        </div>
      </div>

      <div
        className={`bo-anunciosEditorLayout grid gap-4 ${previewOpen ? "xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.9fr)]" : "grid-cols-1"} ${previewOpen ? "is-preview-active" : "is-editor-active"}`}
        data-slot="ads-editor-layout"
      >
        <Panel
          data-slot="ads-main-panel"
          title={
            <div className="flex min-w-[180px] flex-1 items-center gap-3" data-slot="ads-name-wrap">
              <Megaphone size={18} aria-hidden="true" className="shrink-0" />
              <input
                value={ad.name}
                onChange={(event) => setAd({ ...ad, name: event.target.value })}
                className="bo-input"
                style={{ flex: 1, minWidth: 0 }}
                aria-label="Nombre del anuncio"
                data-testid="ad-name"
              />
            </div>
          }
          meta={`${ad.content.length} elemento${ad.content.length === 1 ? "" : "s"} · ${ad.ctas.length} CTA${ad.ctas.length === 1 ? "" : "s"}`}
          actions={
            <button
              ref={addContentBtnRef}
              type="button"
              onClick={() => setAddContentOpen((v) => !v)}
              className={`bo-anunciosMoreTrigger ${addContentOpen ? "is-open" : ""}`}
              aria-haspopup="menu"
              aria-expanded={addContentOpen}
              aria-label="Añadir contenido o CTA"
              data-testid="ad-add-content-trigger"
            >
              <Plus size={16} aria-hidden="true" />
            </button>
          }
        >
          <Reorder.Group
            axis="y"
            values={ad.content}
            onReorder={(content) => setAd({ ...ad, content })}
            className="grid gap-2"
            data-slot="ad-content-reorder"
          >
            {ad.content.map((item, index) => (
              <DraggableCardRow
                key={item.id}
                item={item}
                ordinal={ad.content.slice(0, index + 1).filter((entry) => entry.type === item.type).length}
                onDelete={() => setAd(removeContentItem(ad, item.id))}
                onAlignChange={(align) => updateContentAlign(item.id, align)}
                dataSlot={`ad-content-${item.id}`}
              >
                {item.type === "image" ? (
                  <button
                    type="button"
                    onClick={() => { setImageOpen(true); setImageStep("choose"); }}
                    disabled={imageEnhancing}
                    aria-busy={imageEnhancing}
                    className="flex w-full items-center gap-3 rounded-bo-sm border border-dashed border-bo-border bg-bo-surface p-3 text-left text-sm text-bo-muted disabled:cursor-not-allowed disabled:opacity-70"
                    data-slot={`ad-content-${item.id}-change`}
                  >
                    {imageEnhancing ? (
                      <span className="flex h-16 w-24 items-center justify-center rounded-bo-sm bg-bo-surface-2" data-slot={`ad-content-${item.id}-enhancing`}>
                        <Sparkles size={20} className="animate-pulse text-bo-accent" aria-hidden="true" />
                      </span>
                    ) : item.value ? (
                      <img src={item.value} alt="Imagen actual" className="h-16 w-24 rounded-bo-sm object-cover" data-slot={`ad-content-${item.id}-thumb`} />
                    ) : (
                      <ImagePlus size={22} aria-hidden="true" />
                    )}
                    <span data-slot={`ad-content-${item.id}-change-text`}>{imageEnhancing ? "Mejorando con IA..." : item.value ? "Cambiar imagen" : "Seleccionar imagen"}</span>
                  </button>
                ) : item.type === "text" ? (
                  <textarea value={item.value} onChange={(event) => updateContentValue(item.id, event.target.value)} rows={3} className="bo-textarea" aria-label={TYPE_LABEL[item.type]} data-slot={`ad-content-${item.id}-textarea`} />
                ) : (
                  <input value={item.value} onChange={(event) => updateContentValue(item.id, event.target.value)} className="bo-input" style={{ width: "100%" }} aria-label={TYPE_LABEL[item.type]} data-slot={`ad-content-${item.id}-input`} />
                )}
              </DraggableCardRow>
            ))}
          </Reorder.Group>

          <div className="bo-anunciosDurationSection" data-slot="ads-duration-section">
            <div className="bo-anunciosCtasTitle">Duración</div>
            <div className="bo-anunciosCtasHint">El anuncio se mostrará durante este periodo. Déjalo vacío para mostrarlo siempre.</div>
            <InlineDateRangeCalendar from={ad.starts_at || ""} to={ad.ends_at || ""} disabledDates={blockedDates} disabledDateLabels={blockedDateLabels} onChange={(range) => {
              if (range.from && range.to && sendAdScheduleCheck) {
                const reqId = `ad-schedule-${Date.now()}-${++reqCounter.current}`;
                scheduleCheckReqRef.current = reqId;
                sendAdScheduleCheck({ type: "ad_schedule_check", reqId, adId: ad.id, payload: { starts_at: range.from, ends_at: range.to } });
              }
              setScheduleError("");
              setAd({ ...ad, starts_at: range.from || null, ends_at: range.to || null });
            }} />
            {scheduleError ? <p className="bo-anunciosScheduleError" role="alert">{scheduleError}</p> : null}
          </div>

          <div className="bo-anunciosCtasSection" data-slot="ads-cta-section">
            <div className="bo-anunciosCtasHead">
              <div>
                <div className="bo-anunciosCtasTitle">Llamadas a la acción</div>
                <div className="bo-anunciosCtasHint">Siempre se muestran al final del anuncio.</div>
              </div>
            </div>
            <Reorder.Group
              axis="y"
              values={ad.ctas}
              onReorder={(ctas) => setAd({ ...ad, ctas })}
              className="bo-anunciosCtasList"
              data-slot="ad-cta-list"
            >
              {ad.ctas.map((cta, index) => (
                <CTARowCard
                  key={cta.id}
                  cta={cta}
                  index={index}
                  website={website}
                  onChange={(patch) => setAd({ ...ad, ctas: ad.ctas.map((item) => item.id === cta.id ? { ...item, ...patch } : item) })}
                  onDelete={() => setAd({ ...ad, ctas: ad.ctas.filter((item) => item.id !== cta.id) })}
                />
              ))}
            </Reorder.Group>
          </div>
        </Panel>

        {previewOpen ? (
          <div className="bo-anunciosPreviewCol" data-slot="ads-preview-column">
            <div className="bo-anunciosDeviceSwitch" role="group" aria-label="Vista del dispositivo" data-slot="ad-preview-device-switch">
              <div className="bo-anunciosPreviewSwitch">
                <button type="button" className={`bo-anunciosPreviewSwitchBtn ${previewDevice === "mobile" ? "is-active" : ""}`} onClick={() => setPreviewDevice("mobile")} aria-pressed={previewDevice === "mobile"} aria-label="Ver versión móvil" data-testid="ad-preview-device-mobile"><Smartphone size={14} aria-hidden="true" /><span className="bo-anunciosPreviewSwitchLabel">Móvil</span></button>
                <button type="button" className={`bo-anunciosPreviewSwitchBtn ${previewDevice === "desktop" ? "is-active" : ""}`} onClick={() => setPreviewDevice("desktop")} aria-pressed={previewDevice === "desktop"} aria-label="Ver versión ordenador" data-testid="ad-preview-device-desktop"><Monitor size={14} aria-hidden="true" /><span className="bo-anunciosPreviewSwitchLabel">Ordenador</span></button>
              </div>
            </div>
            <Preview ad={ad} website={website} device={previewDevice} />
          </div>
        ) : null}
      </div>

      <Popover
        open={addContentOpen}
        anchorRef={addContentBtnRef}
        onClose={() => setAddContentOpen(false)}
        ariaLabel="Añadir contenido al anuncio"
        data-testid="ad-add-content-popover"
        minWidthPx={240}
      >
        <div className="bo-anunciosAddList" role="menu" data-slot="ad-add-content-list">
          {addContentItems.map((item) => (
            <button
              key={item.type}
              type="button"
              role="menuitem"
              onClick={() => addContent(item.type)}
              disabled={item.disabled}
              className="bo-anunciosAddItem"
              data-slot={`ad-add-${item.type}`}
              data-testid={`ad-add-${item.type}-popover`}
            >
              <span className="bo-anunciosAddItemIcon">{item.icon}</span>
              <span>{item.label}</span>
              <span className="bo-anunciosAddItemMeta">{item.meta}</span>
            </button>
          ))}
          <div className="bo-anunciosAddDivider" role="separator" data-slot="ad-add-content-divider" />
          <button
            type="button"
            role="menuitem"
            onClick={addCta}
            className="bo-anunciosAddItem"
            data-slot="ad-cta-add-confirm"
          >
            <span className="bo-anunciosAddItemIcon"><Plus size={16} aria-hidden="true" /></span>
            <span>Añadir nuevo CTA</span>
            <span className="bo-anunciosAddItemMeta">Botón</span>
          </button>
        </div>
      </Popover>

      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(event) => { const file = event.target.files?.[0]; console.log("[AD-DEBUG] raw file from picker", { name: file?.name, type: file?.type, size: file?.size }); event.target.value = ""; if (file) void chooseImage(file); }} data-testid="ad-image-file" />
      <ImageFlowModal open={imageOpen} step={imageStep} previewURL={imagePreviewURL} file={imageFile} onClose={closeImage} onGenerate={() => void generateImage()} onPick={() => fileRef.current?.click()} onRaw={() => void handleUploadedImage(false)} onEnhance={() => void handleUploadedImage(true)} />
    </section>
  );
}

function Preview({ ad, website, device }: { ad: RestaurantAd; website: string; device: "mobile" | "desktop" }) {
  const visibleContent = ad.content.filter((item) => item.type === "image" ? Boolean(item.value) : Boolean(item.value.trim()));
  const primaryColor = ad.ctas.find((cta) => cta.color)?.color?.trim() || "#436754";

  return (
    <div
      className="bo-anunciosPreview bo-adModalPreview"
      data-testid="ad-preview"
      data-slot="ad-preview"
      data-preview-device={device}
      style={{ "--ad-primary": primaryColor } as React.CSSProperties}    >
      <div className="bo-adModalBody" data-slot="ad-preview-body">
        {device === "mobile" ? (
          <>
            {visibleContent.map((item) => item.type === "image" ? (
              <div className="bo-adModalImageCol" key={item.id} data-slot="ad-preview-image-col">
                <img src={item.value} alt="Imagen del anuncio" className="bo-adModalImage" data-slot={`ad-preview-${item.id}`} />
              </div>
            ) : item.type === "subtitle" ? (
              <p key={item.id} className="bo-adModalSupertitle" data-slot={`ad-preview-${item.id}`}>{item.value}</p>
            ) : item.type === "title" ? (
              <h2 key={item.id} className="bo-adModalTitle" data-slot={`ad-preview-${item.id}`}>{item.value}</h2>
            ) : (
              <p key={item.id} className="bo-adModalDesc" data-slot={`ad-preview-${item.id}`}>{item.value}</p>
            ))}
            {!visibleContent.length ? <p className="bo-adModalDesc" data-slot="ad-preview-empty">Añade contenido para ver el anuncio en tiempo real.</p> : null}
            <div className="bo-adModalActions" data-slot="ad-preview-ctas">
              {ad.ctas.map((cta) => <a key={cta.id} href={buildCTAURL(website, cta)} className="bo-adModalCta" style={{ "--ad-primary": cta.color || "#436754" } as React.CSSProperties} rel="noopener noreferrer" data-slot={`ad-preview-cta-${cta.id}`}>{cta.text || "Más información"}</a>)}
            </div>
          </>
        ) : (
          <>
            {visibleContent.map((item) => item.type === "image" ? (
              <div className="bo-adModalImageCol" key={item.id} data-slot="ad-preview-image-col">
                <img src={item.value} alt="Imagen del anuncio" className="bo-adModalImage" data-slot={`ad-preview-${item.id}`} />
              </div>
            ) : item.type === "subtitle" ? (
              <p key={item.id} className="bo-adModalSupertitle" style={{ textAlign: item.align || "left" }} data-slot={`ad-preview-${item.id}`}>{item.value}</p>
            ) : item.type === "title" ? (
              <h2 key={item.id} className="bo-adModalTitle" style={{ textAlign: item.align || "left" }} data-slot={`ad-preview-${item.id}`}>{item.value}</h2>
            ) : (
              <p key={item.id} className="bo-adModalDesc" style={{ textAlign: item.align || "left" }} data-slot={`ad-preview-${item.id}`}>{item.value}</p>
            ))}

            {!visibleContent.length ? (
              <p className="bo-adModalDesc" data-slot="ad-preview-empty">Añade contenido para ver el anuncio en tiempo real.</p>
            ) : null}

            <div className="bo-adModalActions" data-slot="ad-preview-ctas">
              {ad.ctas.map((cta) => (
                <a
                  key={cta.id}
                  href={buildCTAURL(website, cta)}
                  className="bo-adModalCta"
                  style={{ "--ad-primary": cta.color || "#436754" } as React.CSSProperties}
                  rel="noopener noreferrer"
                  data-slot={`ad-preview-cta-${cta.id}`}
                >
                  {cta.text || "Más información"}
                </a>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function AlignmentTabs({ value, onChange }: { value: RestaurantAdTextAlign; onChange: (value: RestaurantAdTextAlign) => void }) {
  return <div className="bo-anunciosAlignmentTabs" role="group" aria-label="Alineación del texto">{(["left", "center", "right"] as RestaurantAdTextAlign[]).map((align) => <button key={align} type="button" className={value === align ? "is-active" : ""} onClick={() => onChange(align)} aria-pressed={value === align}>{align === "left" ? "Izquierda" : align === "center" ? "Centro" : "Derecha"}</button>)}</div>;
}

function SaveStatusBadge({ state }: { state: "idle" | "saving" | "saved" | "error" }) {
  if (state === "idle") {
    return (
      <span
        className="bo-anunciosSaveStatus"
        data-state="idle"
        data-testid="ad-save-status"
        aria-live="polite"
        data-slot="ad-save-status"
      >
        <span className="bo-anunciosSaveLabel">Guardado</span>
      </span>
    );
  }
  if (state === "saving") {
    return (
      <span
        className="bo-anunciosSaveStatus"
        data-state="saving"
        data-testid="ad-save-status"
        aria-live="polite"
        aria-busy="true"
        data-slot="ad-save-status"
      >
        <span className="bo-anunciosSaveSpinner" aria-hidden="true" />
        <span className="bo-anunciosSaveLabel">Guardando...</span>
      </span>
    );
  }
  if (state === "error") {
    return (
      <span
        className="bo-anunciosSaveStatus"
        data-state="error"
        data-testid="ad-save-status"
        aria-live="assertive"
        data-slot="ad-save-status"
      >
        <CircleAlert size={14} aria-hidden="true" />
        <span className="bo-anunciosSaveLabel">Error</span>
      </span>
    );
  }
  return (
    <span className="bo-anunciosSaveStatus" data-state="saved" data-testid="ad-save-status" aria-live="polite" data-slot="ad-save-status">
      <Check size={14} aria-hidden="true" />
      <span className="bo-anunciosSaveLabel">Guardado</span>
    </span>
  );
}

function DraggableCardRow({
  item,
  ordinal,
  children,
  onDelete,
  onAlignChange,
  dataSlot,
}: {
  item: RestaurantAdContentElement;
  ordinal: number;
  children: React.ReactNode;
  onDelete?: () => void;
  onAlignChange?: (align: RestaurantAdTextAlign) => void;
  dataSlot: string;
}) {
  const label = `${TYPE_LABEL[item.type]} ${ordinal}`;
  const dragControls = useDragControls();
  const startDrag = useCallback(
    (event: React.PointerEvent<Element>) => dragControls.start(event),
    [dragControls],
  );
  // Only text-like elements carry alignment; the image row shows the handle
  // and trash with an empty middle column.
  const showAlign = onAlignChange && item.type !== "image";
  return (
    <Reorder.Item
      value={item}
      as="div"
      layout="position"
      data-slot={dataSlot}
      dragListener={false}
      dragControls={dragControls}
      dragMomentum={false}
      dragElastic={0.04}
      whileDrag={{ zIndex: 2 }}
      className="bo-anunciosRowCard"
    >
      <div className="bo-anunciosRowField" data-slot={`${dataSlot}-field`}>
        <span className="bo-anunciosRowTypeLabel" data-slot={`${dataSlot}-type-label`}>{TYPE_LABEL[item.type]}</span>
        {children}
      </div>
      <div className="bo-anunciosRowBand" data-slot={`${dataSlot}-band`}>
        <button
          type="button"
          className="bo-anunciosDragHandle"
          aria-label={`Mover ${label}`}
          data-slot={`${dataSlot}-grip`}
          onPointerDown={(event) => { event.preventDefault(); startDrag(event); }}
        >
          <GripVertical size={17} aria-hidden="true" className="bo-anunciosDragHandleIcon" />
        </button>
        {showAlign ? (
          <AlignmentTabs value={item.align || "left"} onChange={onAlignChange} />
        ) : (
          <span aria-hidden="true" data-slot={`${dataSlot}-band-spacer`} />
        )}
        {onDelete ? (
          <button
            type="button"
            onClick={onDelete}
            className="bo-anunciosIconBtn"
            data-tone="danger"
            aria-label={`Eliminar ${label}`}
            data-slot={`${dataSlot}-delete`}
          >
            <Trash2 size={15} aria-hidden="true" />
          </button>
        ) : null}
      </div>
    </Reorder.Item>
  );
}

function CTARowCard({
  cta,
  index,
  website,
  onChange,
  onDelete,
}: {
  cta: RestaurantAd["ctas"][number];
  index: number;
  website: string;
  onChange: (patch: Partial<RestaurantAd["ctas"][number]>) => void;
  onDelete: () => void;
}) {
  const label = `CTA ${index + 1}`;
  const dragControls = useDragControls();
  const startDrag = useCallback(
    (event: React.PointerEvent<Element>) => dragControls.start(event),
    [dragControls],
  );
  return (
    <Reorder.Item
      value={cta}
      as="div"
      layout="position"
      data-slot={`ad-cta-${cta.id}`}
      dragListener={false}
      dragControls={dragControls}
      dragMomentum={false}
      dragElastic={0.04}
      whileDrag={{ zIndex: 2 }}
      className="bo-anunciosRowCard"
    >
      <button
        type="button"
        className="bo-anunciosDragHandle"
        aria-label={`Mover ${label}`}
        data-slot={`ad-cta-${cta.id}-grip`}
        onPointerDown={(event) => { event.preventDefault(); startDrag(event); }}
      >
        <GripVertical size={17} aria-hidden="true" className="bo-anunciosDragHandleIcon" />
      </button>
      <div className="bo-anunciosRowField bo-anunciosRowField-2col" data-slot={`ad-cta-${cta.id}-fields`}>
        <label className="grid gap-1 text-xs text-bo-muted">
          <span>Texto botón {index + 1}</span>
          <input value={cta.text} onChange={(event) => onChange({ text: event.target.value })} className="bo-input" data-slot={`ad-cta-${cta.id}-text`} />
        </label>
        <label className="grid gap-1 text-xs text-bo-muted">
          <span>Color</span>
          <input type="color" value={cta.color || "#436754"} onChange={(event) => onChange({ color: event.target.value })} className="h-10 w-full rounded-bo-sm border border-bo-border bg-bo-surface p-1" data-slot={`ad-cta-${cta.id}-color`} />
        </label>
        <label className="grid gap-1 text-xs text-bo-muted">
          <span>Navegación</span>
          <Select value={cta.navigation_mode} onChange={(value) => onChange({ navigation_mode: value === "custom" ? "custom" : "route" })} options={[{ value: "route", label: "Ruta de la web" }, { value: "custom", label: "URL personalizada" }]} ariaLabel={`Navegación CTA ${index + 1}`} />
        </label>
        {cta.navigation_mode === "route" ? (
          <label className="grid gap-1 text-xs text-bo-muted">
            <span>Ruta</span>
            <Select value={cta.route || "/reservas"} onChange={(route) => onChange({ route })} options={[...WEBSITE_ROUTE_OPTIONS]} ariaLabel={`Ruta CTA ${index + 1}`} />
          </label>
        ) : (
          <label className="grid gap-1 text-xs text-bo-muted">
            <span>URL personalizada</span>
            <input type="url" value={cta.custom_url} onChange={(event) => onChange({ custom_url: event.target.value })} className="bo-input" placeholder="https://..." data-slot={`ad-cta-${cta.id}-custom-url`} />
          </label>
        )}
        <p className="bo-mutedText md:col-span-2" data-slot={`ad-cta-${cta.id}-resolved`}>Destino: {buildCTAURL(website, cta) || "Sin configurar"}</p>
      </div>
      <div className="bo-anunciosRowAction" data-slot={`ad-cta-${cta.id}-action`}>
        <button
          type="button"
          onClick={onDelete}
          className="bo-anunciosIconBtn"
          data-tone="danger"
          aria-label={`Eliminar CTA ${index + 1}`}
          data-slot={`ad-cta-${cta.id}-delete`}
        >
          <Trash2 size={15} aria-hidden="true" />
        </button>
      </div>
    </Reorder.Item>
  );
}

function ImageFlowModal({ open, step, previewURL, file, onClose, onGenerate, onPick, onRaw, onEnhance }: { open: boolean; step: ImageStep; previewURL: string; file: File | null; onClose: () => void; onGenerate: () => void; onPick: () => void; onRaw: () => void; onEnhance: () => void }) {
  const locked = step === "preparing" || step === "working";
  return (
    <Modal open={open} title={step === "advisor" ? "Asesor IA de imagen" : "Imagen del anuncio"} onClose={locked ? () => undefined : onClose} widthPx={620} hideClose>
      <ModalHeader title={step === "advisor" ? "Asesor IA de imagen" : "Imagen del anuncio"} onClose={locked ? () => undefined : onClose} />
      <div className="p-5" data-slot="ad-image-modal-body">
        <AnimatePresence mode="wait">
          <motion.div key={step} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }} data-slot={`ad-image-step-${step}`}>
            {step === "choose" ? (
              <div className="grid gap-3 sm:grid-cols-2" data-slot="ad-image-choices">
                <button type="button" onClick={onGenerate} className="bo-card bo-card--clickable" style={{ display: "grid", placeItems: "center", gap: 8, minHeight: 144, textAlign: "center" }} data-slot="ad-image-generate">
                  <Sparkles size={24} aria-hidden="true" />
                  <span className="bo-cardIconTitle" data-slot="ad-image-generate-title">Generar desde el texto</span>
                  <span className="bo-mutedText" data-slot="ad-image-generate-hint">Usa el contenido escrito con WaveSpeed z-image/turbo.</span>
                </button>
                <button type="button" onClick={onPick} className="bo-card bo-card--clickable" style={{ display: "grid", placeItems: "center", gap: 8, minHeight: 144, textAlign: "center" }} data-slot="ad-image-upload">
                  <Upload size={24} aria-hidden="true" />
                  <span className="bo-cardIconTitle" data-slot="ad-image-upload-title">Subir una imagen</span>
                  <span className="bo-mutedText" data-slot="ad-image-upload-hint">Se convierte a WebP y se comprime a máximo 100 KB.</span>
                </button>
              </div>
            ) : step === "advisor" ? (
              <div className="grid gap-4" data-slot="ad-image-advisor">
                <div className="grid gap-1" data-slot="ad-image-advisor-copy">
                  <p className="text-sm text-bo-text" data-slot="ad-image-advisor-lead">La imagen ya está preparada en WebP. Puedes usarla tal cual o mejorarla con IA antes de subirla a BunnyCDN.</p>
                  <p className="text-xs text-bo-muted" data-slot="ad-image-advisor-size">Tamaño optimizado: {Math.max(1, Math.round((file?.size || 0) / 1024))} KB.</p>
                </div>
                {previewURL ? <img src={previewURL} alt="Previsualización de imagen optimizada" className="max-h-72 w-full rounded-bo-lg object-contain" data-slot="ad-image-advisor-preview" /> : null}
                <div className="flex flex-wrap justify-end gap-2" data-slot="ad-image-advisor-actions">
                  <button type="button" onClick={onRaw} className="rounded-bo-sm border border-bo-border bg-bo-surface px-4 py-2 text-sm text-bo-text" data-testid="ad-image-use-raw">Continuar sin mejorar</button>
                  <button type="button" onClick={onEnhance} className="flex items-center gap-2 rounded-bo-sm bg-bo-accent px-4 py-2 text-sm font-semibold text-bo-bg" data-testid="ad-image-enhance"><Sparkles size={15} aria-hidden="true" />Mejorar con IA</button>
                </div>
              </div>
            ) : (
              <div className="grid min-h-48 place-items-center gap-3 text-center" data-slot="ad-image-busy">
                <Sparkles size={28} className="animate-pulse text-bo-accent" aria-hidden="true" />
                <p className="text-sm text-bo-muted" data-slot="ad-image-busy-text">{step === "preparing" ? "Convirtiendo y comprimiendo a WebP..." : "Procesando imagen..."}</p>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </Modal>
  );
}
