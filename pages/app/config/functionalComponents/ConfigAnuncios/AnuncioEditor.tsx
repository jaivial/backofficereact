import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, Reorder, useDragControls } from "motion/react";
import {
  Check,
  ChevronRight,
  CircleAlert,
  Eye,
  GripVertical,
  Layers,
  ImagePlus,
  Megaphone,
  MousePointerClick,
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
  RestaurantAdElementStyle,
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
  asText,
  addContentItem,
  addStep,
  adLayout,
  buttonAction,
  buildCTAURL,
  buildWhatsAppURL,
  createCTA,
  createClientID,
  createDraftAd,
  duplicateBlock,
  moveBlock,
  removeBlock,
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
import { AdBlockBar, AdBlockHover, AdMoveableBox, AdStudioShell } from "./AdEditorChrome";
import {
  ELEMENT_MAX_HEIGHT_PX,
  ELEMENT_MAX_WIDTH_PCT,
  ELEMENT_MIN_HEIGHT_PX,
  ELEMENT_MIN_WIDTH_PCT,
  normalizeElementStyle,
  resetElementSize,
  resetElementStyle,
  resizeElement,
  STYLE_FONT_SIZE_MAX,
  STYLE_FONT_SIZE_MIN,
  STYLE_FONT_WEIGHTS,
  STYLE_LETTER_SPACING_MAX,
  STYLE_LETTER_SPACING_MIN,
  STYLE_LINE_HEIGHT_MAX,
  STYLE_LINE_HEIGHT_MIN,
  STYLE_OFFSET_MAX,
  STYLE_OFFSET_MIN,
  STYLE_OPACITY_MAX,
  STYLE_OPACITY_MIN,
  STYLE_RADIUS_MAX,
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
type ImageTarget = { kind: "ad" } | { kind: "step-content" | "step-card" | "step-detail"; stepId: string };

const NOOP_NOTIFY: Notify = () => undefined;

function asLayerPreview(value: unknown): string {
  const text = asText(value).replace(/\s+/g, " ").trim();
  return text.length > 22 ? `${text.slice(0, 22)}...` : text;
}

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

/** Fills the (single) image element with the uploaded URL, adding one if missing. */
function withImageContent(ad: RestaurantAd, url: string): RestaurantAd {
  const existing = ad.content.find((item) => item.type === "image");
  if (existing) return { ...ad, content: ad.content.map((item) => (item.id === existing.id ? { ...item, value: url } : item)) };
  const next = addContentItem(ad, "image");
  return { ...next, content: next.content.map((item) => (item.type === "image" && !item.value ? { ...item, value: url } : item)) };
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
  /** Where the shared upload flow writes (coord id ads_image_target_v2):
   * the announcement image, a step content image, the card background or the
   * detail background of a step. */
  const [imageTarget, setImageTarget] = useState<ImageTarget>({ kind: "ad" });
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
    // The fingerprint covers every persisted field, layout included, so a
    // wizard-only edit (step backgrounds, step content) autosaves too.
    const json = JSON.stringify({ name: ad.name, active: ad.active, content: ad.content, ctas: ad.ctas, layout: adLayout(ad), starts_at: ad.starts_at ?? null, ends_at: ad.ends_at ?? null });
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
    // The shared upload flow feeds the target that requested it: the
    // announcement image, a step body image, or one of the two step backgrounds.
    let next: RestaurantAd;
    if (imageTarget.kind === "ad") {
      next = withImageContent(ad, url);
    } else {
      const step = adLayout(ad).steps.find((entry) => entry.id === imageTarget.stepId);
      if (!step) return;
      if (imageTarget.kind === "step-card") next = updateStep(ad, step.id, { background_image: url, background_mode: "image" });
      else if (imageTarget.kind === "step-detail") next = updateStep(ad, step.id, { detail_background_image: url, detail_background_mode: "image" });
      else next = updateStep(ad, step.id, { content: withImageContent({ ...ad, content: step.content }, url).content });
    }
    setAd(next);
    await persistAd(next);
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
  const canvasRef = useRef<HTMLDivElement | null>(null);
  // In the multiple layout the cards column edits the card buttons of the
  // active step, while the opened announcement edits the step content plus
  // the wizard-wide buttons (ad.ctas) it renders.
  const target = useMemo(
    () => (layout.mode === "multiple" && activeStep ? { kind: "step" as const, step: activeStep, view: wizardStep === 0 ? ("card" as const) : ("detail" as const) } : { kind: "ad" as const, step: null, view: "detail" as const }),
    [activeStep, layout.mode, wizardStep],
  );
  const targetContent = target.kind === "step" ? target.step.content : ad?.content ?? [];
  const targetButtons = target.kind === "step" && target.view === "card" ? target.step.buttons : ad?.ctas ?? [];
  const selectedElement = useMemo(
    () => (selectedId ? targetContent.find((item) => item.id === selectedId) ?? null : null),
    [selectedId, targetContent],
  );

  const selectedButton = useMemo(
    () => (selectedId ? targetButtons.find((item) => item.id === selectedId) ?? null : null),
    [selectedId, targetButtons],
  );

  const patchTargetContent = useCallback((content: RestaurantAdContentElement[]) => {
    if (!ad) return;
    if (target.kind === "step") setAd(updateStep(ad, target.step.id, { content }));
    else setAd({ ...ad, content });
  }, [ad, target]);

  const patchTargetButtons = useCallback((buttons: RestaurantAdCTA[]) => {
    if (!ad) return;
    if (target.kind === "step" && target.view === "card") setAd(updateStep(ad, target.step.id, { buttons }));
    else setAd({ ...ad, ctas: buttons });
  }, [ad, target]);

  /** Writes both lists at once so a mixed-order move is one state update. */
  const patchTargetFlow = useCallback((next: { content: RestaurantAdContentElement[]; buttons: RestaurantAdCTA[] }) => {
    if (!ad) return;
    if (target.kind === "step") setAd({ ...updateStep(ad, target.step.id, { content: next.content }), ctas: next.buttons });
    else setAd({ ...ad, content: next.content, ctas: next.buttons });
  }, [ad, target]);

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


  // Coordination id: ads_block_studio_v1 - one set of block operations for
  // the selection, whatever list (content or buttons) the block lives in.
  const selectedList = selectedButton ? "buttons" : selectedElement ? "content" : null;
  // Coordination id: ads_button_slot_v1 - the drag index is a position in the
  // mixed canvas order (content, slotted buttons, then the actions row), the
  // same order the DOM shows, so any block can land anywhere.
  const moveSelectedTo = useCallback((toIndex: number) => {
    if (!selectedId) return;
    patchTargetFlow(moveBlock(targetContent, targetButtons, selectedId, toIndex));
  }, [patchTargetFlow, selectedId, targetButtons, targetContent]);

  // Delete and duplicate go through the mixed flow so slotted buttons keep
  // pointing at the same neighbours when content shifts.
  const deleteSelected = useCallback(() => {
    if (!selectedId) return;
    patchTargetFlow(removeBlock(targetContent, targetButtons, selectedId));
    setSelectedId(null);
  }, [patchTargetFlow, selectedId, targetButtons, targetContent]);

  const duplicateSelected = useCallback(() => {
    if (!selectedId) return;
    try {
      patchTargetFlow(duplicateBlock(targetContent, targetButtons, selectedId));
    } catch (error) {
      notify("info", "Limite", error instanceof Error ? error.message : "No se puede duplicar el bloque");
    }
  }, [notify, patchTargetFlow, selectedId, targetButtons, targetContent]);

  const resizeSelected = useCallback((patch: { width: number; height?: number }) => {
    if (!selectedId) return;
    if (selectedList === "buttons") patchTargetButtons(targetButtons.map((item) => (item.id === selectedId ? { ...item, width: patch.width } : item)));
    else patchTargetContent(targetContent.map((item) => (item.id === selectedId ? { ...item, size: resizeElement(item, patch) } : item)));
  }, [patchTargetButtons, patchTargetContent, selectedId, selectedList, targetButtons, targetContent]);

  const selectedWidth = selectedButton?.width ?? selectedElement?.size?.width;

  // Keyboard: Delete / Backspace removes the selected block when the caret is
  // not inside its text; Escape clears the selection.
  useEffect(() => {
    if (!selectedId || previewOpen) return;
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = Boolean(target?.isContentEditable || target?.closest("input, textarea, select"));
      if (event.key === "Escape") {
        setSelectedId(null);
        return;
      }
      if (typing) return;
      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        deleteSelected();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [deleteSelected, previewOpen, selectedId]);

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

  const layerIcon = (item: RestaurantAdContentElement) => (addContentItems.find((entry) => entry.type === item.type) ?? { icon: <Sparkles size={14} aria-hidden="true" /> }).icon;

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

      <div className="bo-adStudioBar" data-testid="ad-studio-bar">
        <Megaphone size={16} aria-hidden="true" className="bo-adStudioBarIcon" />
        <input
          value={ad.name}
          onChange={(event) => setAd({ ...ad, name: event.target.value })}
          className="bo-adStudioName"
          aria-label="Nombre del anuncio"
          data-testid="ad-name"
        />
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
        {ad.id > 0 ? (
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
        ) : null}
      </div>

      <AdStudioShell
        canvasLabel={`${isMultiple ? (wizardStep === 0 ? "Pile de tarjetas" : `Anuncio ${wizardStep} de ${layout.steps.length}`) : "Anuncio"} ${previewOpen ? "(preview)" : "(editable)"}`}
        layers={
          <>
            {isMultiple ? (
              <StepListPanel
                steps={layout.steps}
                activeStepId={activeStep?.id ?? ""}
                onSelect={(stepId) => { setActiveStepId(stepId); setWizardStep(0); setSelectedId(null); }}
                onAdd={() => { try { setAd(addStep(ad)); } catch (error) { notify("info", "Limite", error instanceof Error ? error.message : "No se puede anadir otro anuncio"); } }}
                onRemove={(stepId) => setAd(removeStep(ad, stepId))}
                onReorder={(ordered) => setAd(reorderSteps(ad, ordered.map((step) => step.id)))}
              >
                {(step) => (
                  <StepLayers
                    step={step}
                    selectedId={selectedId}
                    onSelect={(id, view) => { setActiveStepId(step.id); setWizardStep(view === "card" ? 0 : layout.steps.findIndex((entry) => entry.id === step.id) + 1); setSelectedId(id); }}
                    onChange={(patch) => setAd(updateStep(ad, step.id, patch))}
                    icon={layerIcon}
                  />
                )}
              </StepListPanel>
            ) : (
              <>
                {/* Layers (coord id ads_block_studio_v1): content and buttons are
                    two equal lists of blocks, same row, same drag, same selection. */}
                <LayerList
                  title="Contenido"
                  values={targetContent}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                  onReorder={patchTargetContent}
                  icon={layerIcon}
                  label={(item) => TYPE_LABEL[item.type]}
                  preview={(item) => asLayerPreview(item.value)}
                  empty="Sin elementos: anade uno desde la paleta."
                  testId="ad-layers-list"
                />
                <LayerList
                  title="Botones"
                  values={targetButtons}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                  onReorder={patchTargetButtons}
                  icon={() => <MousePointerClick size={14} aria-hidden="true" />}
                  label={() => "Boton"}
                  preview={(cta) => asLayerPreview(cta.text)}
                  empty="Sin botones."
                  testId="ad-layers-buttons"
                />
              </>
            )}

        <div className="bo-adInsertPalette" data-testid="ad-insert-palette">
          <div className="bo-adStudioSectionTitle">Anadir</div>
          <div className="bo-anunciosAddList bo-anunciosAddList--inline">
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
              <span>Boton</span>
            </button>
          </div>
        </div>
          </>
        }
        canvas={
          <>
            {/* Live template: the same markup as the public ad, editable in place. */}
            <div
              className="bo-anunciosCanvasCol"
              data-slot="ads-canvas-column"
              ref={canvasRef}
              onPointerDown={(event) => {
                // Clicking the card outside any block clears the selection.
                if (!(event.target as Element).closest("[data-node-id], .bo-adBlockBar, .moveable-control-box, .bo-adNodeImagePick")) setSelectedId(null);
              }}
            >
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
                  onCardButtonsChange={(stepId, buttons) => setAd(updateStep(ad, stepId, { buttons }))}
                  onStepChange={(stepId, patch) => setAd(updateStep(ad, stepId, patch))}
                  onButtonsChange={(buttons) => setAd({ ...ad, ctas: buttons })}
                  onImagePick={() => {
                    setImageTarget(activeStep ? { kind: "step-content", stepId: activeStep.id } : { kind: "ad" });
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
                    setImageTarget({ kind: "ad" });
                    setImageOpen(true);
                    setImageStep("choose");
                  }}
                  emptyHint="Anade contenido para ver el anuncio en tiempo real."
                />
              )}
              {!previewOpen ? <AdBlockHover containerRef={canvasRef} selectedId={selectedId} /> : null}
              {!previewOpen && selectedId && selectedList ? (
                <>
                  <AdMoveableBox
                    containerRef={canvasRef}
                    nodeId={selectedId}
                    hasHeight={selectedElement?.type === "image"}
                    onResize={resizeSelected}
                  />
                  <AdBlockBar
                    containerRef={canvasRef}
                    nodeId={selectedId}
                    onDelete={deleteSelected}
                    onDuplicate={duplicateSelected}
                    onMoveTo={moveSelectedTo}
                  >
                    <span className="bo-adBlockBarValue" data-testid="ad-block-bar-size">
                      {selectedWidth ? `${Math.round(selectedWidth)}%` : "Auto"}
                    </span>
                  </AdBlockBar>
                </>
              ) : null}
            </div>
          </>
        }
        properties={
          selectedButton ? (
            <ButtonInspector
              cta={selectedButton}
              website={website}
              phone={restaurantPhone}
              onChange={(patch) => patchTargetButtons(targetButtons.map((item) => (item.id === selectedButton.id ? { ...item, ...patch } : item)))}
              onDelete={deleteSelected}
              onClose={() => setSelectedId(null)}
            />
          ) : selectedElement ? (
            <ElementInspector
              item={selectedElement}
              onChange={(patch) => patchTargetContent(targetContent.map((item) => (item.id === selectedElement.id ? { ...item, ...patch } : item)))}
              onStyle={(patch) => patchTargetContent(targetContent.map((item) => (item.id === selectedElement.id ? { ...item, style: normalizeElementStyle(item, patch) } : item)))}
              onImagePick={() => {
                setImageTarget(target.kind === "step" ? { kind: "step-content", stepId: target.step.id } : { kind: "ad" });
                setImageOpen(true);
                setImageStep("choose");
              }}
              onResetSize={() => patchTargetContent(resetElementSize(targetContent, selectedElement.id))}
              onResetStyle={() => patchTargetContent(resetElementStyle(targetContent, selectedElement.id))}
              onDelete={deleteSelected}
              onClose={() => setSelectedId(null)}
            />
          ) : (
            <>
              {isMultiple && activeStep ? <StepInspector step={activeStep} onChange={(patch) => setAd(updateStep(ad, activeStep.id, patch))} onBackgroundImage={(which) => { setImageTarget({ kind: which, stepId: activeStep.id }); setImageOpen(true); setImageStep("choose"); }} imageBusy={imageEnhancing} onSelectButton={(buttonId) => setSelectedId(buttonId)} /> : null}
              <div className="bo-anunciosDurationSection" data-slot="ads-duration-section">
                <div className="bo-anunciosCtasTitle">Duracion</div>
                <div className="bo-anunciosCtasHint">El anuncio solo se muestra dentro de este periodo.</div>
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
              <button type="button" onClick={addCta} className="bo-adFieldReset" data-testid="ad-add-button">
                Anadir boton
              </button>
            </>
          )
        }
      />

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

/** One generic layers list: the same row for every block kind. */
function LayerList<T extends { id: string }>({
  title,
  values,
  selectedId,
  onSelect,
  onReorder,
  icon,
  label,
  preview,
  empty,
  testId,
}: {
  title: string;
  values: T[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onReorder: (values: T[]) => void;
  icon: (item: T) => React.ReactNode;
  label: (item: T) => string;
  preview: (item: T) => string;
  empty: string;
  testId: string;
}) {
  return (
    <div className="bo-adLayerGroup" data-testid={`${testId}-group`}>
      <div className="bo-adStudioSectionTitle">{title}</div>
      <Reorder.Group axis="y" values={values} onReorder={onReorder} className="bo-adLayers" data-testid={testId}>
        {values.map((item) => (
          <Reorder.Item key={item.id} value={item} as="div" className="bo-adLayer" data-layer-id={item.id}>
            <button
              type="button"
              className={`bo-adLayerRow ${selectedId === item.id ? "is-selected" : ""}`}
              onClick={() => onSelect(selectedId === item.id ? null : item.id)}
              data-testid={`ad-layer-${item.id}`}
            >
              <span className="bo-adLayerGrip" aria-hidden="true"><GripVertical size={12} /></span>
              <span className="bo-adLayerIcon">{icon(item)}</span>
              <span className="bo-adLayerLabel">{label(item)}</span>
              <span className="bo-adLayerValue">{preview(item)}</span>
            </button>
          </Reorder.Item>
        ))}
        {!values.length ? <p className="bo-adLayersEmpty">{empty}</p> : null}
      </Reorder.Group>
    </div>
  );
}

/**
 * Layers of one wizard step (coord id ads_step_layers_v1): the card buttons,
 * then the opened announcement's content and buttons, selectable from the
 * sidebar so the canvas jumps to the right view.
 */
function StepLayers({
  step,
  selectedId,
  onSelect,
  onChange,
  icon,
}: {
  step: RestaurantAdStep;
  selectedId: string | null;
  onSelect: (id: string | null, view: "card" | "detail") => void;
  onChange: (patch: Partial<RestaurantAdStep>) => void;
  icon: (item: RestaurantAdContentElement) => React.ReactNode;
}) {
  return (
    <>
      <LayerList
        title="Tarjeta: botones"
        values={step.buttons}
        selectedId={selectedId}
        onSelect={(id) => onSelect(id, "card")}
        onReorder={(buttons) => onChange({ buttons })}
        icon={() => <MousePointerClick size={14} aria-hidden="true" />}
        label={() => "Boton"}
        preview={(cta) => asLayerPreview(cta.text)}
        empty="La tarjeta avanza con Ver más."
        testId={`ad-step-${step.id}-card-buttons`}
      />
      <LayerList
        title="Anuncio: contenido"
        values={step.content}
        selectedId={selectedId}
        onSelect={(id) => onSelect(id, "detail")}
        onReorder={(content) => onChange({ content })}
        icon={icon}
        label={(item) => TYPE_LABEL[item.type]}
        preview={(item) => asLayerPreview(item.value)}
        empty="Sin contenido: abre el anuncio y anade bloques."
        testId={`ad-step-${step.id}-content`}
      />
    </>
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

function AlignmentTabs({ value, onChange }: { value: RestaurantAdTextAlign; onChange: (value: RestaurantAdTextAlign) => void }) {
  return (
    <span className="bo-anunciosAlignmentTabs" role="group" aria-label="Alineacion del texto">
      {(["left", "center", "right"] as RestaurantAdTextAlign[]).map((option) => (
        <button key={option} type="button" className={value === option ? "is-active" : ""} onClick={() => onChange(option)} aria-pressed={value === option} data-testid={`ad-align-${option}`}>
          {option === "left" ? "Izq" : option === "center" ? "Cen" : "Der"}
        </button>
      ))}
    </span>
  );
}

function StepListPanel({
  steps,
  activeStepId,
  onSelect,
  onAdd,
  onRemove,
  onReorder,
  children,
}: {
  steps: RestaurantAdStep[];
  activeStepId: string;
  onSelect: (stepId: string) => void;
  onAdd: () => void;
  onRemove: (stepId: string) => void;
  onReorder: (ordered: RestaurantAdStep[]) => void;
  /** Layers of one step, rendered under its row while expanded (coord id ads_step_layers_v1). */
  children?: (step: RestaurantAdStep) => React.ReactNode;
}) {
  // The active step starts expanded; any row can be toggled independently.
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const isOpen = (step: RestaurantAdStep) => expanded[step.id] ?? step.id === activeStepId;
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
            <div className="bo-anunciosStepRowHead" data-slot={`ad-step-${step.id}-head`}>
              {children ? (
                <button
                  type="button"
                  className={`bo-adStepToggle ${isOpen(step) ? "is-open" : ""}`}
                  onClick={() => setExpanded((current) => ({ ...current, [step.id]: !isOpen(step) }))}
                  aria-expanded={isOpen(step)}
                  aria-label={`${isOpen(step) ? "Contraer" : "Desplegar"} capas de ${step.title || `anuncio ${index + 1}`}`}
                  data-testid={`ad-step-${step.id}-toggle`}
                >
                  <ChevronRight size={14} aria-hidden="true" />
                </button>
              ) : null}
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
            </div>
            {children && isOpen(step) ? (
              <div className="bo-adStepLayers" data-testid={`ad-step-${step.id}-layers`}>
                {children(step)}
              </div>
            ) : null}
          </Reorder.Item>
        ))}
      </Reorder.Group>
      {!steps.length ? <p className="bo-anunciosCtasHint" data-testid="ad-step-empty">Añade el primer anuncio del wizard.</p> : null}
    </div>
  );
}

/** One background triple (mode, colour, image) reused by card and detail. */
function BackgroundFields({
  title,
  hint,
  mode,
  color,
  image,
  onChange,
  onPickImage,
  imageBusy,
  testId,
}: {
  title: string;
  hint?: string;
  mode: RestaurantAdStep["background_mode"];
  color?: string;
  image?: string;
  onChange: (bg: { mode: RestaurantAdStep["background_mode"]; color?: string; image?: string }) => void;
  onPickImage: () => void;
  imageBusy: boolean;
  testId: string;
}) {
  return (
    <div className="bo-adGroup" data-testid={`${testId}-group`}>
      <div className="bo-adGroupTitle">{title}</div>
      {hint ? <p className="bo-adFieldHint">{hint}</p> : null}
      <Select
        value={mode}
        onChange={(value) => onChange({ mode: value as RestaurantAdStep["background_mode"], color, image })}
        options={[...STEP_BACKGROUND_OPTIONS]}
        ariaLabel={title}
        size="sm"
        data-testid={`${testId}-mode`}
      />
      {mode === "color" ? (
        <label className="grid gap-1 text-xs text-bo-muted" data-testid={`${testId}-color-wrap`}>
          <span>Color de fondo</span>
          <input type="color" value={color || AD_DEFAULT_COLOR} onChange={(event) => onChange({ mode, color: event.target.value, image })} className="h-10 w-full max-w-[75px] rounded-bo-sm border border-bo-border bg-bo-surface p-1" data-testid={`${testId}-color`} />
        </label>
      ) : null}
      {mode === "image" ? (
        <div className="bo-anunciosStepImage" data-testid={`${testId}-image`}>
          {image ? <img src={image} alt={title} className="h-16 w-24 rounded-bo-sm object-cover" data-testid={`${testId}-thumb`} /> : null}
          <button type="button" onClick={onPickImage} disabled={imageBusy} className="bo-adFieldReset" data-testid={`${testId}-pick`}>
            {image ? "Cambiar imagen" : "Seleccionar imagen"}
          </button>
        </div>
      ) : null}
    </div>
  );
}

/** Card settings of the active wizard step. */
function StepInspector({
  step,
  onChange,
  onBackgroundImage,
  imageBusy,
  onSelectButton,
}: {
  step: RestaurantAdStep;
  onChange: (patch: Partial<RestaurantAdStep>) => void;
  /** Which of the two step backgrounds asked for an upload. */
  onBackgroundImage: (which: "step-card" | "step-detail") => void;
  imageBusy: boolean;
  /** Selects a card button so its properties open in this sidebar. */
  onSelectButton: (buttonId: string) => void;
}) {
  return (
    <div className="bo-anunciosStepInspector" data-slot="ads-step-inspector" data-testid="ads-step-inspector">
      <div className="bo-anunciosCtasHead" data-testid="ads-step-inspector-head">
        <div data-testid="ads-step-inspector-head-copy">
          <div className="bo-anunciosCtasTitle" data-testid="ads-step-inspector-title">Tarjeta del anuncio</div>
          <div className="bo-anunciosCtasHint" data-testid="ads-step-inspector-hint">Texto y fondos: la tarjeta del wizard y el anuncio que abre tienen fondo propio.</div>
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
        <BackgroundFields
          title="Fondo de la tarjeta"
          mode={step.background_mode}
          color={step.background_color}
          image={step.background_image}
          onChange={(bg) => onChange({ background_mode: bg.mode, background_color: bg.color, background_image: bg.image })}
          onPickImage={() => onBackgroundImage("step-card")}
          imageBusy={imageBusy}
          testId="ad-step-background"
        />
        {/* Coordination id: ads_step_detail_background_v1 - the opened
            announcement gets its own background, independent from the card. */}
        <BackgroundFields
          title="Fondo del anuncio abierto"
          hint="Independiente de la tarjeta. Sin fondo mantiene la hoja clara."
          mode={step.detail_background_mode ?? "transparent"}
          color={step.detail_background_color}
          image={step.detail_background_image}
          onChange={(bg) => onChange({ detail_background_mode: bg.mode, detail_background_color: bg.color, detail_background_image: bg.image })}
          onPickImage={() => onBackgroundImage("step-detail")}
          imageBusy={imageBusy}
          testId="ad-step-detail-background"
        />
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
            <button
              key={cta.id}
              type="button"
              className="bo-adLayerRow"
              onClick={() => onSelectButton(cta.id)}
              data-testid={`ad-step-${step.id}-button-${cta.id}`}
            >
              <span className="bo-adLayerLabel">Boton {index + 1}</span>
              <span className="bo-adLayerValue">{cta.text}</span>
            </button>
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

/* Coordination id: ads_inspector_v2 - the properties sidebar is a design-tool
 * inspector: grouped sections, sliders for continuous values, swatches for
 * colour, and one component per selected kind. Ordering never lives here. */

function Field({ label, hint, children, testId }: { label: string; hint?: string; children: React.ReactNode; testId?: string }) {
  return (
    <label className="bo-adField" data-testid={testId}>
      <span className="bo-adFieldLabel">{label}</span>
      {children}
      {hint ? <span className="bo-adFieldHint">{hint}</span> : null}
    </label>
  );
}

function Slider({
  label, value, min, max, step = 1, suffix = "", placeholder, onChange, testId,
}: {
  label: string;
  value: number | undefined;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  placeholder?: string;
  onChange: (value: number | undefined) => void;
  testId?: string;
}) {
  return (
    <div className="bo-adField" data-testid={testId}>
      <span className="bo-adFieldLabel">
        {label}
        <span className="bo-adFieldValue">{value === undefined ? placeholder ?? "Auto" : `${value}${suffix}`}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value === "" ? undefined : Number(event.target.value))}
        className="bo-adSlider"
        aria-label={label}
        data-testid={`${testId}-range`}
      />
    </div>
  );
}

function NumberField({
  label, value, min, max, placeholder, onChange, testId,
}: {
  label: string;
  value: number | undefined;
  min: number;
  max: number;
  placeholder?: string;
  onChange: (value: number | undefined) => void;
  testId?: string;
}) {
  return (
    <Field label={label} testId={testId}>
      <input
        type="number"
        min={min}
        max={max}
        value={value ?? ""}
        placeholder={placeholder ?? "Auto"}
        onChange={(event) => onChange(event.target.value === "" ? undefined : Number(event.target.value))}
        className="bo-input bo-adNumber"
        aria-label={label}
      />
    </Field>
  );
}

function ColorField({ label, value, onChange, testId }: { label: string; value: string | undefined; onChange: (value: string | undefined) => void; testId?: string }) {
  return (
    <div className="bo-adField" data-testid={testId}>
      <span className="bo-adFieldLabel">{label}</span>
      <span className="bo-adColorRow">
        <input
          type="color"
          value={value || "#24342b"}
          onChange={(event) => onChange(event.target.value)}
          className="bo-adColor"
          data-testid={`${testId}-picker`}
        />
        <button
          type="button"
          className="bo-adColorClear"
          onClick={() => onChange(undefined)}
          disabled={!value}
          data-testid={`${testId}-clear`}
        >
          Auto
        </button>
      </span>
    </div>
  );
}

/** Text and image properties: typography, appearance, box and position. */
function ElementInspector({
  item,
  onChange,
  onStyle,
  onImagePick,
  onResetSize,
  onResetStyle,
  onDelete,
  onClose,
}: {
  item: RestaurantAdContentElement;
  onChange: (patch: Partial<RestaurantAdContentElement>) => void;
  onStyle: (patch: Partial<RestaurantAdElementStyle>) => void;
  onImagePick: () => void;
  onResetSize: () => void;
  onResetStyle: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const isText = item.type !== "image";
  const style = item.style ?? {};
  return (
    <div className="bo-adInspector" data-testid="ad-inspector-selection">
      <div className="bo-adStudioSectionTitle">{TYPE_LABEL[item.type]}</div>

      {isText ? (
        <Field label="Texto" testId={`ad-node-${item.id}-text`}>
          <textarea
            value={item.value}
            onChange={(event) => onChange({ value: event.target.value })}
            rows={3}
            className="bo-textarea"
          />
        </Field>
      ) : null}

      {isText ? (
        <div className="bo-adGroup" data-testid={`ad-node-${item.id}-typography`}>
          <div className="bo-adGroupTitle">Tipografia</div>
          <Slider
            label="Tamano"
            value={style.font_size}
            min={STYLE_FONT_SIZE_MIN}
            max={STYLE_FONT_SIZE_MAX}
            suffix="px"
            onChange={(font_size) => onStyle({ font_size })}
            testId={`ad-node-${item.id}-font-size`}
          />
          <Field label="Peso" testId={`ad-node-${item.id}-weight`}>
            <Select
              value={String(style.font_weight ?? "")}
              onChange={(value) => onStyle({ font_weight: value ? Number(value) : undefined })}
              options={[{ value: "", label: "Auto" }, ...STYLE_FONT_WEIGHTS.map((weight) => ({ value: String(weight), label: String(weight) }))]}
              size="sm"
              ariaLabel="Peso de la fuente"
            />
          </Field>
          <Slider
            label="Espaciado"
            value={style.letter_spacing}
            min={STYLE_LETTER_SPACING_MIN}
            max={STYLE_LETTER_SPACING_MAX}
            step={0.5}
            suffix="px"
            onChange={(letter_spacing) => onStyle({ letter_spacing })}
            testId={`ad-node-${item.id}-letter-spacing`}
          />
          <Slider
            label="Interlineado"
            value={style.line_height}
            min={STYLE_LINE_HEIGHT_MIN}
            max={STYLE_LINE_HEIGHT_MAX}
            step={0.05}
            onChange={(line_height) => onStyle({ line_height })}
            testId={`ad-node-${item.id}-line-height`}
          />
          <ColorField label="Color" value={style.color} onChange={(color) => onStyle({ color })} testId={`ad-node-${item.id}-color`} />
          <div className="bo-adField">
            <span className="bo-adFieldLabel">Alineacion</span>
            <AlignmentTabs value={item.align || "left"} onChange={(align) => onChange({ align })} />
          </div>
        </div>
      ) : null}

      <div className="bo-adGroup" data-testid={`ad-node-${item.id}-box`}>
        <div className="bo-adGroupTitle">Tamano y posicion</div>
        <NumberField label="Ancho (%)" value={item.size?.width} min={ELEMENT_MIN_WIDTH_PCT} max={ELEMENT_MAX_WIDTH_PCT} onChange={(width) => onChange({ size: width ? { ...(item.size ?? {}), width } : undefined })} testId={`ad-node-${item.id}-width`} />
        {item.type === "image" ? (
          <NumberField label="Alto (px)" value={item.size?.height} min={ELEMENT_MIN_HEIGHT_PX} max={ELEMENT_MAX_HEIGHT_PX} onChange={(height) => onChange({ size: { ...(item.size ?? {}), width: item.size?.width ?? 95, height } })} testId={`ad-node-${item.id}-height`} />
        ) : null}
        {item.type === "image" ? (
          <Slider label="Esquinas" value={style.radius} min={0} max={STYLE_RADIUS_MAX} suffix="px" onChange={(radius) => onStyle({ radius })} testId={`ad-node-${item.id}-radius`} />
        ) : null}
        <Slider
          label="Desplazamiento X"
          value={style.offset_x}
          min={STYLE_OFFSET_MIN}
          max={STYLE_OFFSET_MAX}
          suffix="px"
          placeholder="0"
          onChange={(offset_x) => onStyle({ offset_x })}
          testId={`ad-node-${item.id}-offset-x`}
        />
        <Slider
          label="Opacidad"
          value={style.opacity}
          min={STYLE_OPACITY_MIN}
          max={STYLE_OPACITY_MAX}
          step={0.05}
          onChange={(opacity) => onStyle({ opacity })}
          testId={`ad-node-${item.id}-opacity`}
        />
        <p className="bo-adFieldHint">Arrastra con Shift dentro del lienzo para mover en horizontal.</p>
      </div>

      {item.type === "image" ? (
        <button type="button" className="bo-adFieldReset" onClick={onImagePick} data-testid={`ad-node-${item.id}-image-change`}>
          Cambiar imagen
        </button>
      ) : null}

      <div className="bo-adInspectorActions">
        <button type="button" className="bo-adFieldReset" onClick={onResetSize} data-testid={`ad-node-${item.id}-size-reset`}>
          Tamano auto
        </button>
        <button type="button" className="bo-adFieldReset" onClick={onResetStyle} data-testid={`ad-node-${item.id}-style-reset`}>
          Estilo auto
        </button>
        <button
          type="button"
          className="bo-anunciosIconBtn"
          data-tone="danger"
          aria-label={`Eliminar ${TYPE_LABEL[item.type]}`}
          data-testid={`ad-inspector-${item.id}-delete`}
          onClick={onDelete}
        >
          <Trash2 size={15} aria-hidden="true" />
        </button>
      </div>
      <button type="button" className="bo-adFieldReset" onClick={onClose} data-testid="ad-inspector-close">
        Cerrar
      </button>
    </div>
  );
}

/** Button properties, shown only while a button is selected. */
export function ButtonInspector({
  cta,
  website,
  phone,
  onChange,
  onDelete,
  onClose,
}: {
  cta: RestaurantAd["ctas"][number];
  website: string;
  phone: string;
  onChange: (patch: Partial<RestaurantAd["ctas"][number]>) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const action = buttonAction(cta);
  const whatsapp = parseWhatsAppURL(cta.custom_url);
  const destination = buildCTAURL(website, cta);
  const whatsappStyle = action === "whatsapp";

  return (
    <div className="bo-adInspector bo-adInspectorButton" data-testid="ad-inspector-selection">
      <div className="bo-adInspectorHead">
        <span className="bo-adStudioSectionTitle">Boton</span>
        <button type="button" className="bo-anunciosIconBtn" data-tone="danger" aria-label="Eliminar boton" data-testid={`ad-cta-${cta.id}-delete`} onClick={onDelete}>
          <Trash2 size={15} aria-hidden="true" />
        </button>
      </div>

      {/* Live pill: the button as it renders, so colour and text are judged in place. */}
      <span className="bo-adModalCta bo-adInspectorPreview" style={{ ["--ad-primary" as string]: cta.color || AD_DEFAULT_COLOR }} data-testid={`ad-cta-${cta.id}-preview`}>
        {cta.text || "Mas informacion"}
      </span>

      <div className="bo-adGroup" data-testid={`ad-cta-${cta.id}-content`}>
        <div className="bo-adGroupTitle">Contenido</div>
        <Field label="Texto" testId={`ad-cta-${cta.id}-text`}>
          <input value={cta.text} onChange={(event) => onChange({ text: event.target.value })} className="bo-input" placeholder="Texto del boton" />
        </Field>
        <ColorField label="Color" value={cta.color} onChange={(color) => onChange({ color: color || AD_DEFAULT_COLOR })} testId={`ad-cta-${cta.id}-color`} />
        <NumberField label="Ancho (%)" value={cta.width} min={ELEMENT_MIN_WIDTH_PCT} max={ELEMENT_MAX_WIDTH_PCT} onChange={(width) => onChange({ width })} testId={`ad-cta-${cta.id}-width`} />
      </div>

      <div className="bo-adGroup" data-testid={`ad-cta-${cta.id}-action`}>
        <div className="bo-adGroupTitle">Accion</div>
        <div className="bo-adSeg" role="group" aria-label="Accion del boton" data-testid={`ad-cta-${cta.id}-action-select`}>
          {([
            { value: "route", label: "Web", title: "Pagina de la web" },
            { value: "url", label: "URL", title: "URL propia" },
            { value: "whatsapp", label: "WhatsApp", title: "Abrir una conversacion" },
          ] as Array<{ value: ButtonAction; label: string; title: string }>).map((option) => (
            <button
              key={option.value}
              type="button"
              className={action === option.value ? "is-active" : ""}
              title={option.title}
              aria-pressed={action === option.value}
              onClick={() => onChange(setButtonAction(cta, option.value, phone))}
              data-testid={`ad-cta-${cta.id}-action-${option.value}`}
            >
              {option.label}
            </button>
          ))}
        </div>

        {action === "route" ? (
          <Field label="Pagina" testId={`ad-cta-${cta.id}-route`}>
            <Select value={cta.route || "/reservas"} onChange={(route) => onChange({ route })} options={[...WEBSITE_ROUTE_OPTIONS]} size="sm" ariaLabel="Pagina del boton" listMaxHeightPx={260} />
          </Field>
        ) : null}

        {action === "url" ? (
          <Field label="URL" hint="Anade https:// si falta" testId={`ad-cta-${cta.id}-url`}>
            <input
              type="url"
              value={cta.custom_url ?? ""}
              onChange={(event) => onChange({ custom_url: event.target.value, navigation_mode: "custom" })}
              onBlur={(event) => onChange({ custom_url: normalizeButtonURL(event.target.value, website) })}
              className="bo-input"
              placeholder="ejemplo.com/promo"
              spellCheck={false}
            />
          </Field>
        ) : null}

        {whatsappStyle ? (
          <div className="bo-adGroup bo-adWhatsapp" data-testid={`ad-cta-${cta.id}-whatsapp`}>
            <div className="bo-adGroupTitle">WhatsApp</div>
            <Field label="Telefono del restaurante" testId={`ad-cta-${cta.id}-phone-restaurant`}>
              <input value={phone || "Sin telefono"} readOnly className="bo-input bo-inputReadonly" />
            </Field>
            <Field label="Telefono personalizado" testId={`ad-cta-${cta.id}-phone-custom`}>
              <input
                value={whatsapp?.phone ?? ""}
                onChange={(event) => onChange(patchWhatsAppButton(cta, { phone: event.target.value }))}
                placeholder={phone || "34600000000"}
                inputMode="tel"
                className="bo-input"
              />
            </Field>
            <Field label="Mensaje inicial" testId={`ad-cta-${cta.id}-phone-message`}>
              <textarea
                value={whatsapp?.message ?? WHATSAPP_DEFAULT_MESSAGE}
                onChange={(event) => onChange(patchWhatsAppButton(cta, { message: event.target.value }))}
                rows={2}
                className="bo-textarea"
              />
            </Field>
          </div>
        ) : null}

        <div className="bo-adDestination" data-testid={`ad-cta-${cta.id}-resolved`}>
          <span className="bo-adDestinationLabel">Destino</span>
          <span className="bo-adDestinationValue" title={destination || "Sin configurar"}>
            {destination || "Sin configurar"}
          </span>
          {destination ? (
            <a href={destination} target="_blank" rel="noopener noreferrer" className="bo-adDestinationOpen" aria-label="Abrir destino" data-testid={`ad-cta-${cta.id}-open`}>
              Abrir
            </a>
          ) : null}
        </div>
      </div>

      <div className="bo-adInspectorActions">
        <button type="button" className="bo-adFieldReset" onClick={onClose} data-testid="ad-inspector-close">
          Cerrar
        </button>
      </div>
    </div>
  );
}
