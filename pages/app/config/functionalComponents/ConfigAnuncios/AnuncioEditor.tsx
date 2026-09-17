import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, Reorder, useDragControls } from "motion/react";
import {
  Check,
  CircleAlert,
  Eye,
  GripVertical,
  Layers,
  ImagePlus,
  Megaphone,
  Plus,
  Settings2,
  Sparkles,
  Trash2,
  Type,
  Upload,
  Wand2,
} from "lucide-react";
import type {
  RestaurantAd,
  RestaurantAdContentElement,
  RestaurantAdContentType,
  RestaurantAdCTA,
  RestaurantAdInput,
  RestaurantAdStep,
  RestaurantAdTextAlign,
} from "../../../../../api/types";
import { mergeIdList, mergeEditedText } from "../../../../../lib/autosaveGuard";
import { Select } from "../../../../../ui/inputs/Select";
import { Switch } from "../../../../../ui/shadcn/Switch";
import { Modal } from "../../../../../ui/overlays/Modal";
import { ModalHeader } from "../../../../../ui/overlays/ModalHeader";
import { Popover } from "../../../../../ui/overlays/Popover";
import { Panel } from "../../../../../ui/shell/Panel";
import { PageToolbar } from "../../../../../ui/shell/PageToolbar";
import {
  AD_DEFAULT_COLOR,
  addContentItem,
  addStep,
  adLayout,
  buttonAction,
  buildCTAURL,
  buildWhatsAppURL,
  createCTA,
  createClientID,
  createDraftAd,
  normalizeButtonURL,
  parseWhatsAppURL,
  patchWhatsAppButton,
  removeContentItem,
  removeStep,
  reorderSteps,
  setButtonAction,
  setLayoutMode,
  STEP_BACKGROUND_OPTIONS,
  WEBSITE_ROUTE_OPTIONS,
  updateStep,
  WHATSAPP_DEFAULT_MESSAGE,
  type ButtonAction,
} from "./lib/adEditor";
import { AdSurface, AdWizard } from "./AdTemplate";
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
  /** Restaurant contact phone (coord id ads_whatsapp_v1) used as the default
   * WhatsApp button number; the operator can override it per button. */
  phone?: string;
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

// Coordination id: autosave_three_way_merge_v1 - keep operator edits made after
// the snapshot; adopt the server value for everything untouched. Empty values are
// valid edits and are never replaced by a stale server value.
function mergeAdEcho(base: RestaurantAd, local: RestaurantAd, server: RestaurantAd): RestaurantAd {
  return {
    ...server,
    name: mergeEditedText(base.name, local.name, server.name),
    active: Object.is(base.active, local.active) ? server.active : local.active,
    starts_at: Object.is(base.starts_at ?? null, local.starts_at ?? null) ? (server.starts_at ?? null) : (local.starts_at ?? null),
    ends_at: Object.is(base.ends_at ?? null, local.ends_at ?? null) ? (server.ends_at ?? null) : (local.ends_at ?? null),
    content: mergeIdList(base.content, local.content, server.content),
    ctas: mergeIdList(base.ctas, local.ctas, server.ctas),
    // Reference equality is enough: every layout edit produces a new object.
    layout: Object.is(base.layout, local.layout) ? server.layout : local.layout,
  };
}

export function AnuncioEditor({ api, website, phone: restaurantPhone = "", notify = NOOP_NOTIFY, mode, adId, initialAd, onSaved, onDeleted, wsStatusRef, sendAdSave, subscribeAdEvents, autosaveDelayMs, sendAdScheduleCheck }: AnuncioEditorProps) {
  const [ad, setAd] = useState<RestaurantAd | null>(initialAd ?? null);
  const [loading, setLoading] = useState(mode === "edit" && !initialAd);
  const [busy, setBusy] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [scheduleError, setScheduleError] = useState("");
  const scheduleCheckReqRef = useRef<string | null>(null);

  const [wizardStep, setWizardStep] = useState(0);
  /** "" targets the announcement body, a step id targets that step background. */
  const [imageTarget, setImageTarget] = useState("");
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

  // Single place that owns the save badge: it flips to "saving" and always
  // settles on "saved"/"error", whether the write went over the WebSocket or
  // fell back to REST. The WS subscription only needs to resolve the pending
  // promise; the badge is handled here so no path can leave it stuck.
  const persistAd = useCallback(async (source: RestaurantAd): Promise<RestaurantAd | null> => {
    setSaveState("saving");
    try {
      const payload: RestaurantAdInput = { name: source.name, active: source.active, content: source.content, ctas: source.ctas, layout: adLayout(source), starts_at: source.starts_at ?? null, ends_at: source.ends_at ?? null };
      const result = source.id > 0
        ? await api.updateAd(source.id, payload)
        : await api.createAd(payload);
      if (!result.success) {
        notify("error", "Anuncios", apiMessage(result, "No se pudo guardar el anuncio"));
        setSaveState("error");
        return null;
      }
      if (result.ad) setAd((current) => current ? mergeAdEcho(source, current, result.ad as RestaurantAd) : (result.ad as RestaurantAd));
      if (result.ad && onSaved) onSaved(result.ad);
      setSaveState("saved");
      return result.ad ?? null;
    } catch (error) {
      notify("error", "Anuncios", error instanceof Error ? error.message : "No se pudo guardar el anuncio");
      setSaveState("error");
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
      sendAdSave({ type: "ad_save", reqId, adId: source.id, payload: { name: source.name, active: source.active, content: source.content, ctas: source.ctas, layout: adLayout(source), starts_at: source.starts_at ?? null, ends_at: source.ends_at ?? null } });
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
      const snapshot = ad;
      void persistViaWS(snapshot).then((saved) => {
        if (saved) {
          // Merge every typable field against the snapshot so a keystroke made
          // during the request survives the echo, and clearing a field sticks.
          setAd((current) => current ? mergeAdEcho(snapshot, current, saved) : saved);
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

  const setImageURL = useCallback(async (url: string) => {
    if (!ad || !url) return;
    // The shared upload flow feeds either the announcement image or, in the
    // multiple layout, the background of the step that requested it.
    if (imageTarget) {
      const layout = adLayout(ad);
      const step = layout.steps.find((entry) => entry.id === imageTarget);
      if (!step) return;
      const next = updateStep(ad, step.id, { background_image: url, background_mode: "image" });
      setAd(next);
      await persistAd(next);
      return;
    }
    const existing = ad.content.find((item) => item.type === "image");
    const next = existing ? { ...ad, content: ad.content.map((item) => item.id === existing.id ? { ...item, value: url } : item) } : addContentItem(ad, "image");
    const withURL = existing ? next : { ...next, content: next.content.map((item) => item.type === "image" && !item.value ? { ...item, value: url } : item) };
    setAd(withURL);
    await persistAd(withURL);
  }, [ad, imageTarget, persistAd]);

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

  // Coordination id: ads_layout_v1 - every edit below is routed to the current
  // target (the single announcement or the active wizard step) so the canvas and
  // the inspector always write the same shape.
  const layout = useMemo(() => adLayout(ad), [ad]);
  const isMultiple = layout.mode === "multiple";
  const [activeStepId, setActiveStepId] = useState<string>("");
  const activeStep = useMemo(
    () => layout.steps.find((step) => step.id === activeStepId) ?? layout.steps[0] ?? null,
    [activeStepId, layout.steps],
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const target = useMemo(
    () => (layout.mode === "multiple" && activeStep ? { kind: "step" as const, step: activeStep } : { kind: "ad" as const, step: null }),
    [activeStep, layout.mode],
  );
  const targetContent = target.kind === "step" ? target.step.content : ad?.content ?? [];
  const targetButtons = target.kind === "step" ? target.step.buttons : ad?.ctas ?? [];

  // Card context (the wizard cards column) collects card buttons; a step detail
  // or a unico announcement collects its own body content and buttons.
  const editingCard = isMultiple && wizardStep === 0;
  const editingBody = !isMultiple || wizardStep > 0;

  const insertContent = useCallback((type: RestaurantAdContentType) => {
    if (!ad) return;
    if (editingBody && isMultiple && activeStep) {
      const step = activeStep;
      setAd(updateStep(ad, step.id, { content: [...step.content, { id: createClientID(type), type, value: "" }] }));
      return;
    }
    try {
      setAd(addContentItem(ad, type));
    } catch (error) {
      notify("info", "Limite", error instanceof Error ? error.message : "No se puede anadir otro elemento");
    }
  }, [activeStep, ad, editingBody, isMultiple, notify]);

  const insertButton = useCallback(() => {
    if (!ad) return;
    if (editingCard && activeStep) {
      setAd(updateStep(ad, activeStep.id, { buttons: [...activeStep.buttons, createCTA()] }));
      return;
    }
    setAd({ ...ad, ctas: [...ad.ctas, createCTA()] });
  }, [activeStep, ad, editingCard]);


  const addContent = useCallback((type: RestaurantAdContentType) => {
    insertContent(type);
    setAddContentOpen(false);
  }, [insertContent]);

  const addCta = useCallback(() => {
    insertButton();
    setAddContentOpen(false);
  }, [insertButton]);

  const textCounts = useMemo(() => (targetContent ? targetContent.reduce<Record<string, number>>((out, item) => ({ ...out, [item.type]: (out[item.type] || 0) + 1 }), {}) : {}), [targetContent]);

  if (loading) {
    return (
      <Panel data-slot="ads-loading" meta="Cargando anuncio...">
        <p data-slot="anuncioEditor-mutedText" className="bo-mutedText">Recuperando el anuncio solicitado.</p>
      </Panel>
    );
  }

  if (!ad) {
    return (
      <Panel data-slot="ads-not-found" className="bo-panel--empty" meta="Anuncio no encontrado" title="No se pudo cargar el anuncio">
        <p data-slot="anuncioEditor-mutedText" className="bo-mutedText" style={{ textAlign: "center", paddingBlock: 16 }}>
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
          <span className="bo-anunciosActiveToggle" data-slot="ads-active-toggle">
            <Switch
              checked={ad.active}
              onCheckedChange={(next) => setAd((current) => (current ? { ...current, active: next } : current))}
              aria-label={ad.active ? "Desactivar anuncio" : "Activar anuncio"}
              data-testid="ad-active-switch"
              data-slot="ad-active-switch"
            />
            <span className="bo-anunciosEditorStatus" data-slot="ads-editor-status">{ad.active ? "Activo" : "Inactivo"}</span>
          </span>
        </div>
        <div className="bo-anunciosEditorBar-right" data-slot="ads-editor-bar-right">
          {/* Coordination id: ads_layout_switch_v1 - unico keeps the classic
              announcement, multiple turns the same ad into a step wizard. */}
          <div className="bo-anunciosPreviewSwitch" role="group" aria-label="Tipo de anuncio" data-slot="ads-layout-switch">
            <button
              type="button"
              className={`bo-anunciosPreviewSwitchBtn ${isMultiple ? "" : "is-active"}`}
              onClick={() => setAd(setLayoutMode(ad, "unico"))}
              aria-pressed={!isMultiple}
              data-testid="ad-layout-unico"
              data-slot="ad-layout-unico"
            >
              <Megaphone size={14} aria-hidden="true" />
              <span className="bo-anunciosPreviewSwitchLabel">Único</span>
            </button>
            <button
              type="button"
              className={`bo-anunciosPreviewSwitchBtn ${isMultiple ? "is-active" : ""}`}
              onClick={() => {
                setAd(setLayoutMode(ad, "multiple"));
                setSelectedId(null);
              }}
              aria-pressed={isMultiple}
              data-testid="ad-layout-multiple"
              data-slot="ad-layout-multiple"
            >
              <Layers size={14} aria-hidden="true" />
              <span className="bo-anunciosPreviewSwitchLabel">Múltiple</span>
            </button>
          </div>
          <div className="bo-anunciosPreviewSwitch" role="group" aria-label="Modo de visualización" data-slot="ads-preview-switch">
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

      <div className={`bo-anunciosEditorLayout ${previewOpen ? "is-preview-active" : "is-editor-active"}`} data-slot="ads-editor-layout">
        {/* Live template: the same markup as the public ad, editable in place. */}
        <div className="bo-anunciosCanvasCol" data-slot="ads-canvas-column">
          {isMultiple ? (
            <AdWizard
              ad={ad}
              website={website}
              steps={layout.steps}
              editable={!previewOpen}
              stepIndex={wizardStep}
              onStepIndex={setWizardStep}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onStepsChange={(steps) => setAd(reorderSteps(ad, steps.map((step) => step.id)))}
              onStepChange={(stepId, patch) => setAd(updateStep(ad, stepId, patch))}
              onButtonsChange={(buttons) => setAd({ ...ad, ctas: buttons })}
              onImagePick={() => {
                setImageTarget(activeStep?.id ?? "");
                setImageOpen(true);
                setImageStep("choose");
              }}
            />
          ) : (
            <AdSurface
              content={ad.content}
              buttons={ad.ctas}
              website={website}
              editable={!previewOpen}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onContentChange={(content) => setAd({ ...ad, content })}
              onButtonsChange={(buttons) => setAd({ ...ad, ctas: buttons })}
              onImagePick={() => {
                setImageTarget("");
                setImageOpen(true);
                setImageStep("choose");
              }}
              emptyHint="Añade contenido para ver el anuncio en tiempo real."
            />
          )}
        </div>

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
          meta={isMultiple ? `${layout.steps.length} anuncio${layout.steps.length === 1 ? "" : "s"} en el wizard` : `${ad.content.length} elemento${ad.content.length === 1 ? "" : "s"} · ${ad.ctas.length} botón${ad.ctas.length === 1 ? "" : "es"}`}
          actions={
            <button
              ref={addContentBtnRef}
              type="button"
              onClick={() => setAddContentOpen((v) => !v)}
              className={`bo-anunciosMoreTrigger ${addContentOpen ? "is-open" : ""}`}
              aria-haspopup="menu"
              aria-expanded={addContentOpen}
              aria-label="Añadir contenido o botón"
              data-testid="ad-add-content-trigger"
            >
              <Plus size={16} aria-hidden="true" />
            </button>
          }
        >
          {isMultiple ? (
            <StepListPanel
              steps={layout.steps}
              activeStepId={activeStep?.id ?? ""}
              onSelect={(stepId) => { setActiveStepId(stepId); setWizardStep(0); setSelectedId(null); }}
              onAdd={() => { try { setAd(addStep(ad)); } catch (error) { notify("info", "Límite", error instanceof Error ? error.message : "No se puede añadir otro anuncio"); } }}
              onRemove={(stepId) => setAd(removeStep(ad, stepId))}
              onReorder={(ordered) => setAd(reorderSteps(ad, ordered.map((step) => step.id)))}
            />
          ) : null}

          {isMultiple && activeStep ? (
            <StepInspector
              step={activeStep}
              phone={restaurantPhone}
              onChange={(patch) => setAd(updateStep(ad, activeStep.id, patch))}
              onBackgroundImage={() => { setImageTarget(activeStep.id); setImageOpen(true); setImageStep("choose"); }}
              imageBusy={imageEnhancing}
            />
          ) : null}

          {editingBody ? (
            <div className="bo-anunciosCanvasHintRow" data-slot="ads-canvas-hint" data-testid="ads-canvas-hint">
              <p className="bo-anunciosCtasHint">Haz clic en cualquier elemento del lienzo para editarlo y arrástralo desde el asa para reordenarlo.</p>
              <div className="bo-anunciosAddList bo-anunciosAddList--inline" role="group" aria-label="Añadir al anuncio" data-slot="ads-insert-bar">
                {(editingCard ? [] : addContentItems).map((item) => (
                  <button
                    key={item.type}
                    type="button"
                    onClick={() => addContent(item.type)}
                    disabled={item.disabled}
                    className="bo-anunciosAddItem bo-anunciosAddItem--inline"
                    data-slot={`ad-insert-${item.type}`}
                    data-testid={`ad-insert-${item.type}`}
                  >
                    <span className="bo-anunciosAddItemIcon">{item.icon}</span>
                    <span>{item.label}</span>
                  </button>
                ))}
                <button type="button" onClick={addCta} className="bo-anunciosAddItem bo-anunciosAddItem--inline" data-slot="ad-insert-button" data-testid="ad-insert-button">
                  <span className="bo-anunciosAddItemIcon"><Plus size={16} aria-hidden="true" /></span>
                  <span>Botón</span>
                </button>
              </div>
            </div>
          ) : null}

          <div className="bo-anunciosDurationSection" data-slot="ads-duration-section">
            <div className="bo-anunciosCtasTitle">Duración</div>
            <div className="bo-anunciosCtasHint">El anuncio solo se muestra dentro de este periodo. Si borras las fechas, no se mostrará aunque esté activo.</div>
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

          {true ? (
            <div className="bo-anunciosCtasSection" data-slot="ads-cta-section">
              <div className="bo-anunciosCtasHead">
                <div>
                  <div className="bo-anunciosCtasTitle" data-testid="ads-buttons-title">Botones</div>
                  <div className="bo-anunciosCtasHint" data-testid="ads-buttons-hint">
                    {isMultiple
                      ? "Se muestran al final de cada anuncio del wizard. Elige página de la web, URL propia o WhatsApp."
                      : "Se muestran al final del anuncio. Elige página de la web, URL propia o WhatsApp."}
                  </div>
                </div>
                <button type="button" onClick={addCta} className="bo-anunciosIconBtn" data-tone="primary" aria-label="Añadir botón" data-testid="ad-add-button">
                  <Plus size={15} aria-hidden="true" />
                </button>
              </div>
              <Reorder.Group
                axis="y"
                values={ad.ctas}
                onReorder={(buttons) => setAd({ ...ad, ctas: buttons })}
                className="bo-anunciosCtasList"
                data-slot="ad-cta-list"
              >
                {ad.ctas.map((cta, index) => (
                  <ButtonRowCard
                    key={cta.id}
                    cta={cta}
                    index={index}
                    website={website}
                    phone={restaurantPhone}
                    selected={selectedId === cta.id}
                    onSelect={() => setSelectedId(selectedId === cta.id ? null : cta.id)}
                    onChange={(patch) => setAd({ ...ad, ctas: ad.ctas.map((item) => (item.id === cta.id ? { ...item, ...patch } : item)) })}
                    onDelete={() => setAd({ ...ad, ctas: ad.ctas.filter((item) => item.id !== cta.id) })}
                  />
                ))}
              </Reorder.Group>
            </div>
          ) : null}
        </Panel>
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
              <span data-slot="anuncioEditor-anunciosAddItemIcon" className="bo-anunciosAddItemIcon">{item.icon}</span>
              <span data-slot="anuncioEditor-span">{item.label}</span>
              <span data-slot="anuncioEditor-anunciosAddItemMeta" className="bo-anunciosAddItemMeta">{item.meta}</span>
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
            <span data-slot="anuncioEditor-anunciosAddItemIcon" className="bo-anunciosAddItemIcon"><Plus size={16} aria-hidden="true" /></span>
            <span data-slot="anuncioEditor-span">Añadir botón</span>
            <span data-slot="anuncioEditor-anunciosAddItemMeta" className="bo-anunciosAddItemMeta">Botón</span>
          </button>
        </div>
      </Popover>

      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(event) => { const file = event.target.files?.[0]; console.log("[AD-DEBUG] raw file from picker", { name: file?.name, type: file?.type, size: file?.size }); event.target.value = ""; if (file) void chooseImage(file); }} data-testid="ad-image-file" />
      <ImageFlowModal open={imageOpen} step={imageStep} previewURL={imagePreviewURL} file={imageFile} onClose={closeImage} onGenerate={() => void generateImage()} onPick={() => fileRef.current?.click()} onRaw={() => void handleUploadedImage(false)} onEnhance={() => void handleUploadedImage(true)} />
    </section>
  );
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
        <span data-slot="anuncioEditor-anunciosSaveLabel" className="bo-anunciosSaveLabel">Guardado</span>
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
        <span data-slot="anuncioEditor-anunciosSaveSpinner" className="bo-anunciosSaveSpinner" aria-hidden="true" />
        <span data-slot="anuncioEditor-anunciosSaveLabel" className="bo-anunciosSaveLabel">Guardando...</span>
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
        <span data-slot="anuncioEditor-anunciosSaveLabel" className="bo-anunciosSaveLabel">Error</span>
      </span>
    );
  }
  return (
    <span className="bo-anunciosSaveStatus" data-state="saved" data-testid="ad-save-status" aria-live="polite" data-slot="ad-save-status">
      <Check size={14} aria-hidden="true" />
      <span data-slot="anuncioEditor-anunciosSaveLabel" className="bo-anunciosSaveLabel">Guardado</span>
    </span>
  );
}

function ButtonRowCard({
  cta,
  index,
  website,
  phone,
  selected,
  onSelect,
  onChange,
  onDelete,
}: {
  cta: RestaurantAd["ctas"][number];
  index: number;
  website: string;
  phone: string;
  selected: boolean;
  onSelect: () => void;
  onChange: (patch: Partial<RestaurantAd["ctas"][number]>) => void;
  onDelete: () => void;
}) {
  const label = `Botón ${index + 1}`;
  const action = buttonAction(cta);
  const whatsapp = parseWhatsAppURL(cta.custom_url);
  const dragControls = useDragControls();
  const startDrag = useCallback((event: React.PointerEvent<Element>) => dragControls.start(event), [dragControls]);
  const setAction = (next: ButtonAction) => onChange(setButtonAction(cta, next, phone));
  return (
    <Reorder.Item
      value={cta}
      as="div"
      layout="position"
      dragListener={false}
      dragControls={dragControls}
      dragMomentum={false}
      dragElastic={0.04}
      whileDrag={{ zIndex: 2 }}
      className={`bo-anunciosRowCard ${selected ? "is-selected" : ""}`}
      data-slot={`ad-cta-${cta.id}`}
      data-testid={`ad-cta-${cta.id}`}
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
        <label className="grid gap-1 text-xs text-bo-muted" data-slot={`ad-cta-${cta.id}-text-wrap`}>
          <span>Texto del botón {index + 1}</span>
          <input value={cta.text ?? ""} onChange={(event) => onChange({ text: event.target.value })} className="bo-input" data-testid={`ad-cta-${cta.id}-text`} />
        </label>
        <label className="grid gap-1 text-xs text-bo-muted" data-slot={`ad-cta-${cta.id}-color-wrap`}>
          <span>Color</span>
          <input type="color" value={cta.color || AD_DEFAULT_COLOR} onChange={(event) => onChange({ color: event.target.value })} className="h-10 w-full max-w-[75px] rounded-bo-sm border border-bo-border bg-bo-surface p-1" data-testid={`ad-cta-${cta.id}-color`} />
        </label>
        <label className="grid gap-1 text-xs text-bo-muted" data-slot={`ad-cta-${cta.id}-action-wrap`}>
          <span>Acción</span>
          <Select
            value={action}
            onChange={(value) => setAction(value as ButtonAction)}
            options={[
              { value: "route", label: "Página de la web" },
              { value: "url", label: "URL personalizada" },
              { value: "whatsapp", label: "WhatsApp" },
            ]}
            ariaLabel={`Acción del botón ${index + 1}`}
            data-testid={`ad-cta-${cta.id}-action`}
          />
        </label>
        {action === "route" ? (
          <label className="grid gap-1 text-xs text-bo-muted" data-slot={`ad-cta-${cta.id}-route-wrap`}>
            <span>Página</span>
            <Select value={cta.route || "/reservas"} onChange={(route) => onChange({ route })} options={[...WEBSITE_ROUTE_OPTIONS]} ariaLabel={`Ruta del botón ${index + 1}`} data-testid={`ad-cta-${cta.id}-route`} />
          </label>
        ) : null}
        {action === "url" ? (
          <label className="grid gap-1 text-xs text-bo-muted" data-slot={`ad-cta-${cta.id}-url-wrap`}>
            <span>URL personalizada</span>
            <input
              type="url"
              value={cta.custom_url ?? ""}
              onChange={(event) => onChange({ custom_url: event.target.value, navigation_mode: "custom" })}
              onBlur={(event) => onChange({ custom_url: normalizeButtonURL(event.target.value, website) })}
              className="bo-input"
              placeholder="ejemplo.com/promo"
              data-testid={`ad-cta-${cta.id}-custom-url`}
            />
          </label>
        ) : null}
        {action === "whatsapp" ? (
          <div className="bo-anunciosWhatsappFields" data-slot={`ad-cta-${cta.id}-whatsapp`} data-testid={`ad-cta-${cta.id}-whatsapp`}>
            <label className="grid gap-1 text-xs text-bo-muted">
              <span>Teléfono del restaurante</span>
              <input value={phone ?? ""} readOnly className="bo-input" data-testid={`ad-cta-${cta.id}-phone-restaurant`} />
            </label>
            <label className="grid gap-1 text-xs text-bo-muted">
              <span>Teléfono personalizado</span>
              <input
                value={whatsapp?.phone ?? ""}
                onChange={(event) => onChange(patchWhatsAppButton(cta, { phone: event.target.value }))}
                placeholder={phone || "34600000000"}
                className="bo-input"
                inputMode="tel"
                data-testid={`ad-cta-${cta.id}-phone-custom`}
              />
            </label>
            <label className="grid gap-1 text-xs text-bo-muted">
              <span>Mensaje inicial</span>
              <input
                value={whatsapp?.message ?? WHATSAPP_DEFAULT_MESSAGE}
                onChange={(event) => onChange(patchWhatsAppButton(cta, { message: event.target.value }))}
                className="bo-input"
                data-testid={`ad-cta-${cta.id}-phone-message`}
              />
            </label>
          </div>
        ) : null}
        <p className="bo-mutedText md:col-span-2" data-slot={`ad-cta-${cta.id}-resolved`} data-testid={`ad-cta-${cta.id}-resolved`}>
          Destino: {buildCTAURL(website, cta) || "Sin configurar"}
        </p>
      </div>
      <div className="bo-anunciosRowAction" data-slot={`ad-cta-${cta.id}-action`}>
        <button type="button" onClick={onSelect} className="bo-anunciosIconBtn" aria-label={`Seleccionar ${label}`} data-testid={`ad-cta-${cta.id}-select`}>
          <Settings2 size={15} aria-hidden="true" />
        </button>
        <button type="button" onClick={onDelete} className="bo-anunciosIconBtn" data-tone="danger" aria-label={`Eliminar ${label}`} data-testid={`ad-cta-${cta.id}-delete`}>
          <Trash2 size={15} aria-hidden="true" />
        </button>
      </div>
    </Reorder.Item>
  );
}

/** Wizard steps of a multiple anuncio: reorder, select, add, remove. */
function StepListPanel({
  steps,
  activeStepId,
  onSelect,
  onAdd,
  onRemove,
  onReorder,
}: {
  steps: RestaurantAdStep[];
  activeStepId: string;
  onSelect: (stepId: string) => void;
  onAdd: () => void;
  onRemove: (stepId: string) => void;
  onReorder: (ordered: RestaurantAdStep[]) => void;
}) {
  return (
    <div className="bo-anunciosStepsSection" data-slot="ads-steps-section" data-testid="ads-steps-section">
      <div className="bo-anunciosCtasHead">
        <div>
          <div className="bo-anunciosCtasTitle">Anuncios del wizard</div>
          <div className="bo-anunciosCtasHint">Cada tarjeta es un paso. Arrástralas para cambiar el orden.</div>
        </div>
        <button type="button" onClick={onAdd} className="bo-anunciosIconBtn" data-tone="primary" aria-label="Añadir anuncio al wizard" data-testid="ad-step-add">
          <Plus size={15} aria-hidden="true" />
        </button>
      </div>
      <Reorder.Group axis="y" values={steps} onReorder={onReorder} className="bo-anunciosStepsList" data-testid="ad-step-list">
        {steps.map((step, index) => (
          <Reorder.Item
            key={step.id}
            value={step}
            as="div"
            layout="position"
            className={`bo-anunciosStepRow ${step.id === activeStepId ? "is-active" : ""}`}
            data-slot={`ad-step-${step.id}`}
            data-testid={`ad-step-${step.id}`}
          >
            <span className="bo-anunciosStepIndex" data-slot={`ad-step-${step.id}-index`}>{index + 1}</span>
            <button type="button" className="bo-anunciosStepName" onClick={() => onSelect(step.id)} data-testid={`ad-step-${step.id}-select`}>
              {step.title || `Anuncio ${index + 1}`}
            </button>
            <span className="bo-anunciosStepMeta" data-slot={`ad-step-${step.id}-meta`}>
              {step.background_mode === "image" ? "Imagen" : step.background_mode === "color" ? "Color" : "Transparente"}
            </span>
            <button type="button" onClick={() => onRemove(step.id)} className="bo-anunciosIconBtn" data-tone="danger" aria-label={`Eliminar ${step.title || `anuncio ${index + 1}`}`} data-testid={`ad-step-${step.id}-delete`}>
              <Trash2 size={14} aria-hidden="true" />
            </button>
          </Reorder.Item>
        ))}
      </Reorder.Group>
      {!steps.length ? <p className="bo-anunciosCtasHint" data-testid="ad-step-empty">Añade el primer anuncio del wizard.</p> : null}
    </div>
  );
}

/** Card settings of the active wizard step. */
function StepInspector({
  step,
  phone,
  onChange,
  onBackgroundImage,
  imageBusy,
}: {
  step: RestaurantAdStep;
  phone: string;
  onChange: (patch: Partial<RestaurantAdStep>) => void;
  onBackgroundImage: () => void;
  imageBusy: boolean;
}) {
  return (
    <div className="bo-anunciosStepInspector" data-slot="ads-step-inspector" data-testid="ads-step-inspector">
      <div className="bo-anunciosCtasHead" data-testid="ads-step-inspector-head">
        <div data-testid="ads-step-inspector-head-copy">
          <div className="bo-anunciosCtasTitle" data-testid="ads-step-inspector-title">Tarjeta del anuncio</div>
          <div className="bo-anunciosCtasHint" data-testid="ads-step-inspector-hint">Texto y fondo de la tarjeta que abre este anuncio en el wizard.</div>
        </div>
      </div>
      <div className="bo-anunciosStepGrid" data-testid="ads-step-inspector-fields">
        <label className="grid gap-1 text-xs text-bo-muted" data-testid="ad-step-title-wrap">
          <span data-testid="ad-step-title-label">Título</span>
          <input value={step.title} onChange={(event) => onChange({ title: event.target.value })} className="bo-input" data-testid="ad-step-title" />
        </label>
        <label className="grid gap-1 text-xs text-bo-muted" data-testid="ad-step-description-wrap">
          <span data-testid="ad-step-description-label">Descripción</span>
          <textarea value={step.description} onChange={(event) => onChange({ description: event.target.value })} rows={3} className="bo-textarea" data-testid="ad-step-description" />
        </label>
        <label className="grid gap-1 text-xs text-bo-muted" data-testid="ad-step-background-wrap">
          <span data-testid="ad-step-background-label">Fondo</span>
          <Select
            value={step.background_mode}
            onChange={(value) => onChange({ background_mode: value as RestaurantAdStep["background_mode"] })}
            options={[...STEP_BACKGROUND_OPTIONS]}
            ariaLabel="Fondo de la tarjeta"
            data-testid="ad-step-background-mode"
          />
        </label>
        {step.background_mode === "color" ? (
          <label className="grid gap-1 text-xs text-bo-muted" data-testid="ad-step-background-color-wrap">
            <span data-testid="ad-step-background-color-label">Color de fondo</span>
            <input type="color" value={step.background_color || AD_DEFAULT_COLOR} onChange={(event) => onChange({ background_color: event.target.value })} className="h-10 w-full max-w-[75px] rounded-bo-sm border border-bo-border bg-bo-surface p-1" data-testid="ad-step-background-color" />
          </label>
        ) : null}
        {step.background_mode === "image" ? (
          <div className="bo-anunciosStepImage" data-testid="ad-step-background-image">
            {step.background_image ? <img src={step.background_image} alt="Fondo de la tarjeta" className="h-16 w-24 rounded-bo-sm object-cover" data-testid="ad-step-background-thumb" /> : null}
            <button type="button" onClick={onBackgroundImage} disabled={imageBusy} className="rounded-bo-sm border border-dashed border-bo-border bg-bo-surface px-3 py-2 text-xs text-bo-muted" data-testid="ad-step-background-pick">
              {step.background_image ? "Cambiar imagen" : "Seleccionar imagen"}
            </button>
          </div>
        ) : null}
        <label className="bo-anunciosStepSeeMore" data-testid="ad-step-see-more-wrap">
          <Switch
            checked={step.see_more !== false}
            onCheckedChange={(see_more) => onChange({ see_more })}
            aria-label="Mostrar botón ver más"
            data-testid="ad-step-see-more"
          />
          <span className="text-xs text-bo-muted">Botón “Ver más” que avanza al anuncio</span>
        </label>
        <div className="bo-anunciosStepButtons" data-testid="ad-step-buttons">
          <div className="bo-anunciosCtasHead" data-testid="ad-step-buttons-head">
            <div className="bo-anunciosCtasTitle" data-testid="ad-step-buttons-title">Botones de la tarjeta</div>
            <button
              type="button"
              className="bo-anunciosIconBtn"
              data-tone="primary"
              aria-label="Añadir botón a la tarjeta"
              data-testid="ad-step-button-add"
              onClick={() => onChange({ buttons: [...step.buttons, createCTA()] })}
            >
              <Plus size={15} aria-hidden="true" />
            </button>
          </div>
          {step.buttons.map((cta, index) => (
            <ButtonRowCard
              key={cta.id}
              cta={cta}
              index={index}
              website=""
              phone={phone}
              selected={false}
              onSelect={() => undefined}
              onChange={(patch) => onChange({ buttons: step.buttons.map((item) => (item.id === cta.id ? { ...item, ...patch } : item)) })}
              onDelete={() => onChange({ buttons: step.buttons.filter((item) => item.id !== cta.id) })}
            />
          ))}
          {!step.buttons.length ? <p className="bo-anunciosCtasHint">Sin botones propios: la tarjeta avanza con “Ver más” o al hacer clic.</p> : null}
        </div>
      </div>
    </div>
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
