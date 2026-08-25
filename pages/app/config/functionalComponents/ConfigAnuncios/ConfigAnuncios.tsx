import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, Reorder, useDragControls } from "motion/react";
import { Eye, GripVertical, ImagePlus, Megaphone, MoreHorizontal, Plus, Save, Settings2, Sparkles, Trash2, Type, Upload, Wand2 } from "lucide-react";
import { createClient } from "../../../../../api/client";
import type { RestaurantAd, RestaurantAdContentElement, RestaurantAdContentType, RestaurantAdInput } from "../../../../../api/types";
import { Select } from "../../../../../ui/inputs/Select";
import { Modal } from "../../../../../ui/overlays/Modal";
import { ModalHeader } from "../../../../../ui/overlays/ModalHeader";
import { Popover } from "../../../../../ui/overlays/Popover";
import { Switch } from "../../../../../ui/shadcn/Switch";
import { Card } from "../../../../../ui/shell/Card";
import { Panel } from "../../../../../ui/shell/Panel";
import { PageToolbar } from "../../../../../ui/shell/PageToolbar";
import { useToasts } from "../../../../../ui/feedback/useToasts";
import { addContentItem, buildCTAURL, createCTA, createDraftAd, removeContentItem, WEBSITE_ROUTE_OPTIONS } from "./lib/adEditor";
import { compressAdImage } from "./lib/image";

type AdsAPI = Pick<ReturnType<typeof createClient>, "config">;
type Notify = (kind: "success" | "error" | "info", title: string, message: string) => void;
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

function apiMessage(result: unknown, fallback: string): string {
  if (result && typeof result === "object" && "message" in result && typeof (result as { message?: unknown }).message === "string") {
    return String((result as { message: string }).message) || fallback;
  }
  return fallback;
}

function Preview({ ad, website }: { ad: RestaurantAd; website: string }) {
  const visibleContent = ad.content.filter((item) => item.type === "image" ? Boolean(item.value) : Boolean(item.value.trim()));
  return (
    <Panel
      data-testid="ad-preview"
      className="bo-anunciosPreview"
      title="Preview en vivo"
      meta={"Renderizado en orden de visualización"}
    >
      <div className="flex min-h-[420px] flex-col" data-slot="ad-preview-body">
        <div className="flex flex-1 flex-col gap-3" data-slot="ad-preview-content">
          {visibleContent.map((item) => item.type === "image" ? (
            <img key={item.id} src={item.value} alt="Imagen del anuncio" className="my-2 max-h-72 w-full rounded-bo-lg object-cover" data-slot={`ad-preview-${item.id}`} />
          ) : item.type === "title" ? (
            <h3 key={item.id} className="text-3xl font-semibold leading-tight text-bo-accent" data-slot={`ad-preview-${item.id}`}>{item.value}</h3>
          ) : item.type === "subtitle" ? (
            <p key={item.id} className="text-xs font-semibold uppercase tracking-[0.18em] text-bo-accent-2" data-slot={`ad-preview-${item.id}`}>{item.value}</p>
          ) : (
            <p key={item.id} className="whitespace-pre-wrap text-sm leading-relaxed text-bo-text" data-slot={`ad-preview-${item.id}`}>{item.value}</p>
          ))}
          {!visibleContent.length ? <p className="bo-mutedText" data-slot="ad-preview-empty">Añade contenido para ver el anuncio en tiempo real.</p> : null}
        </div>
        <div className="mt-auto flex flex-wrap gap-2 pt-5" data-slot="ad-preview-ctas">
          {ad.ctas.map((cta) => (
            <a key={cta.id} href={buildCTAURL(website, cta)} className="rounded-bo-full px-5 py-3 text-sm font-semibold text-white no-underline" style={{ backgroundColor: cta.color }} data-slot={`ad-preview-cta-${cta.id}`}>{cta.text || "Más información"}</a>
          ))}
        </div>
      </div>
    </Panel>
  );
}

function DraggableCardRow({
  item,
  startDrag,
  children,
  onDelete,
  dataSlot,
}: {
  item: RestaurantAdContentElement & { ordinal?: number };
  startDrag: (event: React.PointerEvent<Element>) => void;
  children: React.ReactNode;
  onDelete?: () => void;
  dataSlot: string;
}) {
  const label = `${TYPE_LABEL[item.type]} ${item.ordinal}`;
  return (
    <Reorder.Item
      value={item}
      data-slot={dataSlot}
      dragListener={false}
      dragMomentum={false}
      dragElastic={0.04}
      whileDrag={{ zIndex: 2 }}
      className="bo-anunciosRowCard"
    >
      <button
        type="button"
        className="bo-anunciosDragHandle"
        aria-label={`Mover ${label}`}
        data-slot={`${dataSlot}-grip`}
        onPointerDown={startDrag}
      >
        <GripVertical size={17} aria-hidden="true" className="bo-anunciosDragHandleIcon" />
      </button>
      <div className="min-w-0 flex-1" data-slot={`${dataSlot}-field`}>
        {children}
      </div>
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
    </Reorder.Item>
  );
}

function CTARowCard({
  cta,
  index,
  startDrag,
  website,
  onChange,
  onDelete,
}: {
  cta: RestaurantAd["ctas"][number];
  index: number;
  startDrag: (event: React.PointerEvent<Element>) => void;
  website: string;
  onChange: (patch: Partial<RestaurantAd["ctas"][number]>) => void;
  onDelete: () => void;
}) {
  const label = `CTA ${index + 1}`;
  return (
    <Reorder.Item
      value={cta}
      data-slot={`ad-cta-${cta.id}`}
      dragListener={false}
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
        onPointerDown={startDrag}
      >
        <GripVertical size={17} aria-hidden="true" className="bo-anunciosDragHandleIcon" />
      </button>
      <div className="grid gap-3 md:grid-cols-2" data-slot={`ad-cta-${cta.id}-fields`}>
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
    </Reorder.Item>
  );
}


export function ConfigAnunciosContent({ api, website, notify = NOOP_NOTIFY }: { api: AdsAPI; website: string; notify?: Notify }) {
  const [ads, setAds] = useState<RestaurantAd[]>([]);
  const [ad, setAd] = useState<RestaurantAd | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(true);
  const [imageOpen, setImageOpen] = useState(false);
  const [imageStep, setImageStep] = useState<ImageStep>("choose");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewURL, setImagePreviewURL] = useState("");
  const [addContentOpen, setAddContentOpen] = useState(false);
  const [addCtaOpen, setAddCtaOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const addContentBtnRef = useRef<HTMLButtonElement | null>(null);
  const addCtaBtnRef = useRef<HTMLButtonElement | null>(null);

  // motion/react drag controls — each row's handle triggers drag via
  // dragControls.start(event). dragListener={false} on Reorder.Item
  // ensures the drag surface is the handle, not the inputs.
  const contentDragControls = useDragControls();
  const ctaDragControls = useDragControls();
  const startContentDrag = useCallback(
    (event: React.PointerEvent<Element>) => contentDragControls.start(event),
    [contentDragControls],
  );
  const startCtaDrag = useCallback(
    (event: React.PointerEvent<Element>) => ctaDragControls.start(event),
    [ctaDragControls],
  );

  const replaceAd = useCallback((next: RestaurantAd) => {
    setAd(next);
    setAds((current) => current.map((item) => item.id === next.id ? next : item));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api.config.listAds();
      if (!result.success) { notify("error", "Anuncios", apiMessage(result, "No se pudieron cargar los anuncios")); return; }
      setAds(result.ads);
      setAd((current) => result.ads.find((item) => item.id === current?.id) ?? result.ads[0] ?? null);
    } catch (error) {
      notify("error", "Anuncios", error instanceof Error ? error.message : "No se pudieron cargar los anuncios");
    } finally {
      setLoading(false);
    }
  }, [api.config, notify]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => () => { if (imagePreviewURL) URL.revokeObjectURL(imagePreviewURL); }, [imagePreviewURL]);

  const persistAd = useCallback(async (source: RestaurantAd): Promise<RestaurantAd | null> => {
    try {
      const payload: RestaurantAdInput = { name: source.name, active: source.active, content: source.content, ctas: source.ctas };
      const result = source.id > 0 ? await api.config.updateAd(source.id, payload) : await api.config.createAd(payload);
      if (!result.success) { notify("error", "Anuncios", apiMessage(result, "No se pudo guardar el anuncio")); return null; }
      replaceAd(result.ad);
      return result.ad;
    } catch (error) {
      notify("error", "Anuncios", error instanceof Error ? error.message : "No se pudo guardar el anuncio");
      return null;
    }
  }, [api.config, notify, replaceAd]);

  const createAd = useCallback(async () => {
    setBusy(true);
    try {
      const result = await api.config.createAd(createDraftAd());
      if (!result.success) { notify("error", "Anuncios", apiMessage(result, "No se pudo crear el anuncio")); return; }
      setAds((current) => [result.ad, ...current]);
      setAd(result.ad);
    } catch (error) {
      notify("error", "Anuncios", error instanceof Error ? error.message : "No se pudo crear el anuncio");
    } finally {
      setBusy(false);
    }
  }, [api.config, notify]);

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
      const result = await api.config.deleteAd(ad.id);
      if (!result.success) { notify("error", "Anuncios", apiMessage(result, "No se pudo eliminar el anuncio")); return; }
      const next = ads.filter((item) => item.id !== ad.id);
      setAds(next); setAd(next[0] ?? null);
    } catch (error) {
      notify("error", "Anuncios", error instanceof Error ? error.message : "No se pudo eliminar el anuncio");
    } finally {
      setBusy(false);
    }
  }, [ad, ads, api.config, notify]);

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
    setAddCtaOpen(false);
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

  const handleUploadedImage = useCallback(async (enhance: boolean) => {
    if (!ad?.id || !imageFile) return;
    setImageStep("working");
    try {
      const result = enhance ? await api.config.enhanceAdImage(ad.id, imageFile) : await api.config.uploadAdImage(ad.id, imageFile);
      if (!result.success) { notify("error", "Imagen", apiMessage(result, "No se pudo procesar la imagen")); setImageStep("advisor"); return; }
      await setImageURL(result.url);
      closeImage();
    } catch (error) {
      notify("error", "Imagen", error instanceof Error ? error.message : "No se pudo procesar la imagen");
      setImageStep("advisor");
    }
  }, [ad?.id, api.config, closeImage, imageFile, notify, setImageURL]);

  const generateImage = useCallback(async () => {
    if (!ad) return;
    setImageStep("working");
    const saved = await persistAd(ad);
    if (!saved) { setImageStep("choose"); return; }
    try {
      const result = await api.config.generateAdImage(saved.id);
      if (!result.success) { notify("error", "Imagen", apiMessage(result, "No se pudo generar la imagen")); setImageStep("choose"); return; }
      await setImageURL(result.url);
      closeImage();
    } catch (error) {
      notify("error", "Imagen", error instanceof Error ? error.message : "No se pudo generar la imagen");
      setImageStep("choose");
    }
  }, [ad, api.config, closeImage, notify, persistAd, setImageURL]);

  const textCounts = useMemo(() => ad ? ad.content.reduce<Record<string, number>>((out, item) => ({ ...out, [item.type]: (out[item.type] || 0) + 1 }), {}) : {}, [ad]);

  // Decorate content rows with their per-type ordinal (1..5) so the
  // accessibility label is meaningful when the user drags a row.
  const decoratedContent = useMemo(() => ad
    ? ad.content.map((item, index) => ({
        ...item,
        ordinal: ad.content.slice(0, index + 1).filter((entry) => entry.type === item.type).length,
      }))
    : [], [ad]);

  if (loading) {
    return (
      <Panel data-slot="ads-loading" meta="Cargando anuncios...">
        <p className="bo-mutedText">Recuperando la lista de anuncios del restaurante.</p>
      </Panel>
    );
  }

  if (!ad) {
    return (
      <Panel data-slot="ads-empty" className="bo-panel--empty" meta="Sin anuncios todavía" title="Empieza creando tu primer anuncio">
        <p className="bo-mutedText" style={{ textAlign: "center", paddingBlock: 16 }}>
          Crea tu primer anuncio para empezar.
        </p>
        <div style={{ display: "flex", justifyContent: "center", marginTop: 12 }}>
          <button type="button" onClick={() => void createAd()} disabled={busy} className="bo-anunciosIconBtn" data-tone="primary" aria-label="Crear anuncio" data-testid="ad-create">
            <Plus size={16} aria-hidden="true" />
          </button>
        </div>
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
        left={
          <div className="bo-chips" role="tablist" data-slot="ads-selector-list" aria-label="Anuncios">
            {ads.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={ad?.id === item.id}
                onClick={() => setAd(item)}
                className={`bo-chip ${ad?.id === item.id ? "is-on" : ""}`}
                data-slot={`ad-select-${item.id}`}
              >
                {item.name}
              </button>
            ))}
          </div>
        }
        right={
          <button
            type="button"
            onClick={() => void createAd()}
            disabled={busy}
            className="bo-anunciosIconBtn"
            data-tone="primary"
            aria-label="Crear anuncio"
            data-testid="ad-create"
          >
            <Plus size={16} aria-hidden="true" />
          </button>
        }
      />

      {/* Top action bar: save / delete / preview switch */}
      <div className="bo-anunciosEditorBar" data-slot="ads-editor-bar">
        <div className="bo-anunciosEditorBar-left" data-slot="ads-editor-bar-left">
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
          >
            <Save size={16} aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className={`grid gap-4 ${previewOpen ? "xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.9fr)]" : "grid-cols-1"}`} data-slot="ads-editor-layout">
        <Panel
          data-slot="ads-main-panel"
          title={
            <div className="flex min-w-[220px] flex-1 items-center gap-3" data-slot="ads-name-wrap">
              <Megaphone size={18} aria-hidden="true" />
              <input
                value={ad.name}
                onChange={(event) => setAd({ ...ad, name: event.target.value })}
                className="bo-input"
                style={{ flex: 1 }}
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
              aria-label="Añadir contenido"
              data-testid="ad-add-content-trigger"
            >
              <MoreHorizontal size={16} aria-hidden="true" />
            </button>
          }
        >
          <Reorder.Group
            axis="y"
            values={decoratedContent as unknown as RestaurantAdContentElement[]}
            onReorder={(content) => setAd({ ...ad, content: content as RestaurantAdContentElement[] })}
            className="grid gap-2"
            data-slot="ad-content-reorder"
          >
            {decoratedContent.map((item) => (
              <DraggableCardRow
                key={item.id}
                item={item as RestaurantAdContentElement & { ordinal: number }}
                startDrag={startContentDrag}
                onDelete={() => setAd(removeContentItem(ad, item.id))}
                dataSlot={`ad-content-${item.id}`}
              >
                {item.type === "image" ? (
                  <button type="button" onClick={() => { setImageOpen(true); setImageStep("choose"); }} className="flex w-full items-center gap-3 rounded-bo-sm border border-dashed border-bo-border p-3 text-left text-sm text-bo-muted" data-slot={`ad-content-${item.id}-change`}>
                    {item.value ? <img src={item.value} alt="Imagen actual" className="h-16 w-24 rounded-bo-sm object-cover" data-slot={`ad-content-${item.id}-thumb`} /> : <ImagePlus size={22} aria-hidden="true" />}
                    <span data-slot={`ad-content-${item.id}-change-text`}>{item.value ? "Cambiar imagen" : "Seleccionar imagen"}</span>
                  </button>
                ) : item.type === "text" ? (
                  <textarea value={item.value} onChange={(event) => updateContentValue(item.id, event.target.value)} rows={3} className="bo-textarea" aria-label={TYPE_LABEL[item.type]} data-slot={`ad-content-${item.id}-textarea`} />
                ) : (
                  <input value={item.value} onChange={(event) => updateContentValue(item.id, event.target.value)} className="bo-input" aria-label={TYPE_LABEL[item.type]} data-slot={`ad-content-${item.id}-input`} />
                )}
              </DraggableCardRow>
            ))}
          </Reorder.Group>

          {/* Merged CTAs section */}
          <div className="bo-anunciosCtasSection" data-slot="ads-cta-section">
            <div className="bo-anunciosCtasHead">
              <div>
                <div className="bo-anunciosCtasTitle">Llamadas a la acción</div>
                <div className="bo-anunciosCtasHint">Siempre se muestran al final del anuncio.</div>
              </div>
              <button
                ref={addCtaBtnRef}
                type="button"
                onClick={() => setAddCtaOpen((v) => !v)}
                className={`bo-anunciosIconBtn ${addCtaOpen ? "is-open" : ""}`}
                aria-haspopup="menu"
                aria-expanded={addCtaOpen}
                aria-label="Añadir CTA"
                data-testid="ad-add-cta-trigger"
              >
                <Plus size={16} aria-hidden="true" />
              </button>
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
                  startDrag={startCtaDrag}
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
        </div>
      </Popover>

      <Popover
        open={addCtaOpen}
        anchorRef={addCtaBtnRef}
        onClose={() => setAddCtaOpen(false)}
        ariaLabel="Opciones de CTA"
        data-testid="ad-add-cta-popover"
        minWidthPx={220}
      >
        <div className="bo-anunciosAddList" role="menu" data-slot="ad-add-cta-list">
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
                  <button type="button" onClick={onRaw} className="rounded-bo-sm border border-bo-border px-4 py-2 text-sm text-bo-text" data-testid="ad-image-use-raw">Continuar sin mejorar</button>
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

export function ConfigAnuncios({ website }: { website: string }) {
  const api = useMemo(() => createClient({ baseUrl: "" }), []);
  const { pushToast } = useToasts();
  const notify = useCallback<Notify>((kind, title, message) => pushToast({ kind, title, message }), [pushToast]);
  return <ConfigAnunciosContent api={api} website={website} notify={notify} />;
}
