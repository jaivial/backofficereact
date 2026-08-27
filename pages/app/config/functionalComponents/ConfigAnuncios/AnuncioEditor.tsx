import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, Reorder, useDragControls } from "motion/react";
import {
  AlertTriangle,
  Eye,
  GripVertical,
  ImagePlus,
  Megaphone,
  Plus,
  Save,
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
  RestaurantAdInput,
  RestaurantAdImageGenerationStatus,
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
  /** Shared WS-failure timestamps (adId -> epoch ms) from useAdsController. */
  wsFailureAtRef?: React.MutableRefObject<Map<number, number>>;
};

export function AnuncioEditor({ api, website, notify = NOOP_NOTIFY, mode, adId, initialAd, onSaved, onDeleted, wsFailureAtRef }: AnuncioEditorProps) {
  const [ad, setAd] = useState<RestaurantAd | null>(initialAd ?? null);
  const [loading, setLoading] = useState(mode === "edit" && !initialAd);
  const [busy, setBusy] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(true);
  const [imageOpen, setImageOpen] = useState(false);
  const [imageStep, setImageStep] = useState<ImageStep>("choose");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewURL, setImagePreviewURL] = useState("");
  const [addContentOpen, setAddContentOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const addContentBtnRef = useRef<HTMLButtonElement | null>(null);

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
      const payload: RestaurantAdInput = { name: source.name, active: source.active, content: source.content, ctas: source.ctas };
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

  const save = useCallback(async () => {
    if (!ad) return;
    setBusy(true);
    try {
      const saved = await persistAd(ad);
      if (saved) notify("success", "Anuncios", "Anuncio guardado");
    } finally {
      setBusy(false);
    }
  }, [ad, notify, persistAd]);

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

  const setImageGenerationStatus = useCallback((status: RestaurantAdImageGenerationStatus) => {
    setAd((current) => current ? { ...current, image_generation_status: status, image_generation_started_at: status === "pending" ? new Date().toISOString() : current.image_generation_started_at } : current);
  }, []);

  const closeImage = useCallback(() => { setImageOpen(false); setImageStep("choose"); setImageFile(null); setImagePreviewURL(""); }, []);
  const chooseImage = useCallback(async (file: File) => {
    setImageStep("preparing");
    try {
      const compressed = await compressAdImage(file);
      const url = URL.createObjectURL(compressed);
      setImagePreviewURL((old) => { if (old) URL.revokeObjectURL(old); return url; });
      setImageFile(compressed); setImageStep("advisor");
    } catch (error) {
      notify("error", "Imagen", error instanceof Error ? error.message : "No se pudo preparar la imagen");
      setImageStep("choose");
    }
  }, [notify]);

  /**
   * Surfaces an AI-image failure toast. When the HTTP error body was replaced
   * in transit (message collapses to "HTTP <status>") and the WebSocket
   * already delivered the actionable `ad_image_failed` event for this ad
   * (e.g. insufficient credits), skip the duplicate useless toast.
   */
  const notifyImageFailure = useCallback((adId: number, error: unknown) => {
    const message = error instanceof Error ? error.message : "No se pudo procesar la imagen";
    const mangled = /^HTTP \d+$/.test(message);
    const seenAt = wsFailureAtRef?.current.get(adId) ?? 0;
    const wsAlreadySurfaced = Date.now() - seenAt < 15000;
    if (mangled && wsAlreadySurfaced) return;
    notify("error", "Imagen", message);
  }, [notify, wsFailureAtRef]);

  const handleUploadedImage = useCallback(async (enhance: boolean) => {
    if (!ad?.id || !imageFile) return;
    if (enhance) {
      // AI enhance is slow — close the modal immediately and let the row
      // render a skeleton. The server persists the in-flight status so
      // a page reload mid-flight keeps the skeleton visible.
      const adIdForFailure = ad.id;
      closeImage();
      setImageGenerationStatus("pending");
      try {
        const result = await api.enhanceAdImage(ad.id, imageFile);
        if (!result.success || !result.url) {
          setImageGenerationStatus("failed");
          notify("error", "Imagen", apiMessage(result, "No se pudo procesar la imagen"));
          return;
        }
        await setImageURL(result.url);
        setImageGenerationStatus("ready");
      } catch (error) {
        setImageGenerationStatus("failed");
        notifyImageFailure(adIdForFailure, error);
      }
      return;
    }
    setImageStep("working");
    try {
      const result = await api.uploadAdImage(ad.id, imageFile);
      if (!result.success) { notify("error", "Imagen", apiMessage(result, "No se pudo procesar la imagen")); setImageStep("advisor"); return; }
      await setImageURL(result.url ?? "");
      setImageGenerationStatus("ready");
      closeImage();
    } catch (error) {
      notify("error", "Imagen", error instanceof Error ? error.message : "No se pudo procesar la imagen");
      setImageStep("advisor");
    }
  }, [ad?.id, api, closeImage, imageFile, notify, notifyImageFailure, setImageGenerationStatus, setImageURL]);

  const generateImage = useCallback(async () => {
    if (!ad) return;
    setImageStep("working");
    const saved = await persistAd(ad);
    if (!saved) { setImageStep("choose"); return; }
    closeImage();
    setImageGenerationStatus("pending");
    try {
      const result = await api.generateAdImage(saved.id);
      if (!result.success || !result.url) {
        setImageGenerationStatus("failed");
        notify("error", "Imagen", apiMessage(result, "No se pudo generar la imagen"));
        return;
      }
      await setImageURL(result.url);
      setImageGenerationStatus("ready");
    } catch (error) {
      setImageGenerationStatus("failed");
      notifyImageFailure(saved.id, error);
    }
  }, [ad, api, closeImage, notifyImageFailure, persistAd, setImageGenerationStatus, setImageURL]);

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
          <button
            type="button"
            onClick={() => void save()}
            disabled={busy}
            className="bo-anunciosIconBtn"
            data-tone="primary"
            aria-label="Guardar anuncio"
            data-slot="ad-save"
            data-testid="ad-save"
          >
            <Save size={16} aria-hidden="true" />
          </button>
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
                dataSlot={`ad-content-${item.id}`}
              >
                {item.type === "image" ? (
                  ad.image_generation_status === "pending" ? (
                    <div role="status" aria-live="polite" className="flex w-full items-center gap-3 rounded-bo-sm border border-dashed border-bo-border bg-bo-surface p-3 text-left text-sm text-bo-muted" data-slot={`ad-content-${item.id}-change`}>
                      <div className="bo-skeleton h-16 w-24 rounded-bo-sm" aria-hidden="true" data-slot={`ad-content-${item.id}-skeleton`} />
                      <span className="bo-skeletonLine bo-skeletonLine--md" style={{ width: "60%" }} aria-hidden="true" />
                      <Sparkles size={14} aria-hidden="true" className="animate-pulse text-bo-accent" />
                      <span data-slot={`ad-content-${item.id}-change-text`}>Mejorando con IA...</span>
                    </div>
                  ) : (
                    <button type="button" onClick={() => { setImageOpen(true); setImageStep("choose"); }} className="flex w-full items-center gap-3 rounded-bo-sm border border-dashed border-bo-border bg-bo-surface p-3 text-left text-sm text-bo-muted" data-slot={`ad-content-${item.id}-change`} data-failed={ad.image_generation_status === "failed" ? "true" : undefined}>
                      {item.value ? <img src={item.value} alt="Imagen actual" className="h-16 w-24 rounded-bo-sm object-cover" data-slot={`ad-content-${item.id}-thumb`} /> : <ImagePlus size={22} aria-hidden="true" />}
                      <span className="min-w-0 flex-1" data-slot={`ad-content-${item.id}-change-copy`}>
                        <span className="block" data-slot={`ad-content-${item.id}-change-text`}>{item.value ? "Cambiar imagen" : "Seleccionar imagen"}</span>
                        {ad.image_generation_status === "failed" ? (
                          <span className="mt-0.5 flex items-center gap-1 text-xs text-bo-text-warning" data-slot={`ad-content-${item.id}-failed-chip`}>
                            <AlertTriangle size={12} aria-hidden="true" />
                            La mejora con IA falló. Reintenta o continúa sin mejorar.
                          </span>
                        ) : null}
                      </span>
                    </button>
                  )
                ) : item.type === "text" ? (
                  <textarea value={item.value} onChange={(event) => updateContentValue(item.id, event.target.value)} rows={3} className="bo-textarea" aria-label={TYPE_LABEL[item.type]} data-slot={`ad-content-${item.id}-textarea`} />
                ) : (
                  <input value={item.value} onChange={(event) => updateContentValue(item.id, event.target.value)} className="bo-input" style={{ width: "100%" }} aria-label={TYPE_LABEL[item.type]} data-slot={`ad-content-${item.id}-input`} />
                )}
              </DraggableCardRow>
            ))}
          </Reorder.Group>

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

        {previewOpen ? <Preview ad={ad} website={website} /> : null}
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

      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void chooseImage(file); }} data-testid="ad-image-file" />
      <ImageFlowModal open={imageOpen} step={imageStep} previewURL={imagePreviewURL} file={imageFile} onClose={closeImage} onGenerate={() => void generateImage()} onPick={() => fileRef.current?.click()} onRaw={() => void handleUploadedImage(false)} onEnhance={() => void handleUploadedImage(true)} />
    </section>
  );
}

function Preview({ ad, website }: { ad: RestaurantAd; website: string }) {
  const visibleContent = ad.content.filter((item) => item.type === "image" ? Boolean(item.value) : Boolean(item.value.trim()));
  const image = visibleContent.find((item) => item.type === "image");
  const primaryColor = ad.ctas.find((cta) => cta.color)?.color?.trim() || "#436754";

  return (
    <div
      className="bo-anunciosPreview bo-adModalPreview"
      data-testid="ad-preview"
      data-slot="ad-preview"
      style={{ "--ad-primary": primaryColor } as React.CSSProperties}
    >
      <div className="bo-adModalBody" data-slot="ad-preview-body">
        {image ? (
          <div className="bo-adModalImageCol" data-slot="ad-preview-image-col">
            <img src={image.value} alt="Imagen del anuncio" className="bo-adModalImage" data-slot={`ad-preview-${image.id}`} />
          </div>
        ) : null}

        <div className="bo-adModalTextCol" data-slot="ad-preview-content">
          {visibleContent.filter((item) => item.type !== "image").map((item) => {
            if (item.type === "subtitle") {
              return <p key={item.id} className="bo-adModalSupertitle" data-slot={`ad-preview-${item.id}`}>{item.value}</p>;
            }
            if (item.type === "title") {
              return <h2 key={item.id} className="bo-adModalTitle" data-slot={`ad-preview-${item.id}`}>{item.value}</h2>;
            }
            return <p key={item.id} className="bo-adModalDesc" data-slot={`ad-preview-${item.id}`}>{item.value}</p>;
          })}

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
        </div>
      </div>
    </div>
  );
}

function DraggableCardRow({
  item,
  ordinal,
  children,
  onDelete,
  dataSlot,
}: {
  item: RestaurantAdContentElement;
  ordinal: number;
  children: React.ReactNode;
  onDelete?: () => void;
  dataSlot: string;
}) {
  const label = `${TYPE_LABEL[item.type]} ${ordinal}`;
  const dragControls = useDragControls();
  const startDrag = useCallback(
    (event: React.PointerEvent<Element>) => dragControls.start(event),
    [dragControls],
  );
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
      <span className="bo-anunciosRowTypeLabel" data-slot={`${dataSlot}-type-label`}>{TYPE_LABEL[item.type]}</span>
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
        <div className="bo-anunciosRowField" data-slot={`${dataSlot}-field`}>
          {children}
        </div>
        {onDelete ? (
          <div className="bo-anunciosRowAction" data-slot={`${dataSlot}-action`}>
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
          </div>
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
