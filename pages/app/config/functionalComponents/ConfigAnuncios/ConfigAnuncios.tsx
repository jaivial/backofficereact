import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, Reorder } from "motion/react";
import { Eye, GripVertical, ImagePlus, Megaphone, Plus, Save, Sparkles, Trash2, Upload } from "lucide-react";
import { createClient } from "../../../../../api/client";
import type { RestaurantAd, RestaurantAdContentElement, RestaurantAdContentType, RestaurantAdInput } from "../../../../../api/types";
import { Select } from "../../../../../ui/inputs/Select";
import { Modal } from "../../../../../ui/overlays/Modal";
import { ModalHeader } from "../../../../../ui/overlays/ModalHeader";
import { Switch } from "../../../../../ui/shadcn/Switch";
import { useToasts } from "../../../../../ui/feedback/useToasts";
import { addContentItem, buildCTAURL, createCTA, createDraftAd, removeContentItem, WEBSITE_ROUTE_OPTIONS } from "./lib/adEditor";
import { compressAdImage } from "./lib/image";

type AdsAPI = Pick<ReturnType<typeof createClient>, "config">;
type Notify = (kind: "success" | "error" | "info", title: string, message: string) => void;
type ImageStep = "choose" | "preparing" | "advisor" | "working";
const NOOP_NOTIFY: Notify = () => undefined;

const TYPE_LABEL: Record<RestaurantAdContentType, string> = { title: "Título", subtitle: "Subtítulo", text: "Texto", image: "Imagen" };

function apiMessage(result: unknown, fallback: string): string {
  if (result && typeof result === "object" && "message" in result && typeof (result as { message?: unknown }).message === "string") {
    return String((result as { message: string }).message) || fallback;
  }
  return fallback;
}

function Preview({ ad, website }: { ad: RestaurantAd; website: string }) {
  const visibleContent = ad.content.filter((item) => item.type === "image" ? Boolean(item.value) : Boolean(item.value.trim()));
  return (
    <div className="sticky top-4 overflow-hidden rounded-bo-lg border border-bo-border bg-bo-surface shadow-xl" data-testid="ad-preview">
      <div className="flex min-h-[420px] flex-col p-7" data-slot="ad-preview-body">
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
          {!visibleContent.length ? <p className="text-sm text-bo-muted" data-slot="ad-preview-empty">Añade contenido para ver el anuncio en tiempo real.</p> : null}
        </div>
        <div className="mt-auto flex flex-wrap gap-2 pt-5" data-slot="ad-preview-ctas">
          {ad.ctas.map((cta) => (
            <a key={cta.id} href={buildCTAURL(website, cta)} className="rounded-bo-full px-5 py-3 text-sm font-semibold text-white no-underline" style={{ backgroundColor: cta.color }} data-slot={`ad-preview-cta-${cta.id}`}>{cta.text || "Más información"}</a>
          ))}
        </div>
      </div>
    </div>
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
  const fileRef = useRef<HTMLInputElement | null>(null);

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

  const updateContentValue = useCallback((id: string, value: string) => setAd((current) => current ? { ...current, content: current.content.map((item) => item.id === id ? { ...item, value } : item) } : current), []);
  const addContent = useCallback((type: RestaurantAdContentType) => {
    if (!ad) return;
    try { setAd(addContentItem(ad, type)); } catch (error) { notify("info", "Límite", error instanceof Error ? error.message : "No se puede añadir otro elemento"); }
  }, [ad, notify]);

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

  if (loading) return <div className="rounded-bo-lg border border-bo-border bg-bo-surface p-6 text-sm text-bo-muted" data-slot="ads-loading">Cargando anuncios...</div>;

  return (
    <section className="grid gap-5" aria-label="Anuncios" data-testid="config-anuncios">
      <div className="flex flex-wrap items-center justify-between gap-3" data-slot="ads-toolbar">
        <div className="flex flex-wrap gap-2" data-slot="ads-selector-list">
          {ads.map((item) => <button key={item.id} type="button" onClick={() => setAd(item)} className={`rounded-bo-sm border px-3 py-2 text-sm ${ad?.id === item.id ? "border-bo-accent text-bo-accent" : "border-bo-border text-bo-muted"}`} data-slot={`ad-select-${item.id}`}>{item.name}</button>)}
        </div>
        <button type="button" onClick={() => void createAd()} disabled={busy} className="flex items-center gap-2 rounded-bo-sm bg-bo-accent px-4 py-2 text-sm font-semibold text-bo-bg disabled:opacity-50" aria-label="Crear anuncio" data-testid="ad-create"><Plus size={16} aria-hidden="true" />Crear anuncio</button>
      </div>

      {!ad ? <div className="rounded-bo-lg border border-dashed border-bo-border p-10 text-center text-sm text-bo-muted" data-slot="ads-empty">Crea tu primer anuncio para empezar.</div> : (
        <div className={`grid gap-5 ${previewOpen ? "xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.9fr)]" : "grid-cols-1"}`} data-slot="ads-editor-layout">
          <div className="grid gap-4" data-slot="ads-editor">
            <div className="rounded-bo-lg border border-bo-border bg-bo-surface p-5" data-slot="ads-main-panel">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3" data-slot="ads-main-head">
                <div className="flex min-w-[220px] flex-1 items-center gap-3" data-slot="ads-name-wrap"><Megaphone size={18} aria-hidden="true" /><input value={ad.name} onChange={(event) => setAd({ ...ad, name: event.target.value })} className="w-full rounded-bo-sm border border-bo-border bg-bo-surface-2 px-3 py-2 text-bo-text" aria-label="Nombre del anuncio" data-testid="ad-name" /></div>
                <label className="flex items-center gap-2 text-sm text-bo-muted" data-slot="ads-active-label"><Switch checked={ad.active} onCheckedChange={(active) => setAd({ ...ad, active })} data-testid="ad-active" /><span data-slot="ads-active-text">{ad.active ? "Activo" : "Inactivo"}</span></label>
              </div>

              <div className="mb-3 flex flex-wrap gap-2" data-slot="ads-add-controls">
                {(["title", "subtitle", "text"] as RestaurantAdContentType[]).map((type) => <button key={type} type="button" onClick={() => addContent(type)} disabled={(textCounts[type] || 0) >= 5} className="rounded-bo-sm border border-bo-border px-3 py-2 text-sm text-bo-text disabled:opacity-40" aria-label={`Añadir ${TYPE_LABEL[type].toLowerCase()}`} data-slot={`ad-add-${type}`}><Plus size={14} aria-hidden="true" /> {`Añadir ${TYPE_LABEL[type].toLowerCase()}`}</button>)}
                <button type="button" onClick={() => { setImageOpen(true); setImageStep("choose"); }} disabled={(textCounts.image || 0) >= 1} className="rounded-bo-sm border border-bo-border px-3 py-2 text-sm text-bo-text disabled:opacity-40" aria-label="Añadir imagen" data-slot="ad-add-image"><ImagePlus size={14} aria-hidden="true" /> Añadir imagen</button>
              </div>

              <Reorder.Group axis="y" values={ad.content} onReorder={(content) => setAd({ ...ad, content })} className="grid gap-2" data-slot="ad-content-reorder">
                {ad.content.map((item, index) => {
                  const ordinal = ad.content.slice(0, index + 1).filter((entry) => entry.type === item.type).length;
                  return <ContentRow key={item.id} item={item} ordinal={ordinal} onChange={updateContentValue} onDelete={() => setAd(removeContentItem(ad, item.id))} onImage={() => { setImageOpen(true); setImageStep("choose"); }} />;
                })}
              </Reorder.Group>
            </div>

            <div className="rounded-bo-lg border border-bo-border bg-bo-surface p-5" data-slot="ads-cta-panel">
              <div className="mb-4 flex items-center justify-between gap-3" data-slot="ads-cta-head"><div data-slot="ads-cta-title-wrap"><h3 className="font-semibold text-bo-text" data-slot="ads-cta-title">Llamadas a la acción</h3><p className="text-xs text-bo-muted" data-slot="ads-cta-hint">Siempre se muestran al final del anuncio.</p></div><button type="button" onClick={() => setAd({ ...ad, ctas: [...ad.ctas, createCTA()] })} className="rounded-bo-sm border border-bo-border px-3 py-2 text-sm text-bo-text" aria-label="Añadir CTA" data-slot="ad-add-cta"><Plus size={14} aria-hidden="true" /> Añadir CTA</button></div>
              <div className="grid gap-3" data-slot="ads-cta-list">{ad.ctas.map((cta, index) => <CTARow key={cta.id} index={index} cta={cta} website={website} onChange={(patch) => setAd({ ...ad, ctas: ad.ctas.map((item) => item.id === cta.id ? { ...item, ...patch } : item) })} onDelete={() => setAd({ ...ad, ctas: ad.ctas.filter((item) => item.id !== cta.id) })} />)}</div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3" data-slot="ads-actions"><button type="button" onClick={() => void removeAd()} disabled={busy} className="flex items-center gap-2 rounded-bo-sm border border-bo-border px-4 py-2 text-sm text-bo-text disabled:opacity-50" data-slot="ad-delete"><Trash2 size={15} aria-hidden="true" />Eliminar anuncio</button><div className="flex items-center gap-3" data-slot="ads-actions-right"><label className="flex items-center gap-2 text-sm text-bo-muted" data-slot="ads-preview-toggle"><Eye size={15} aria-hidden="true" /><span data-slot="ads-preview-label">Preview web</span><Switch checked={previewOpen} onCheckedChange={setPreviewOpen} data-testid="ad-preview-switch" /></label><button type="button" onClick={() => void save()} disabled={busy} className="flex items-center gap-2 rounded-bo-sm bg-bo-accent px-5 py-2 text-sm font-semibold text-bo-bg disabled:opacity-50" data-slot="ad-save"><Save size={15} aria-hidden="true" />{busy ? "Guardando..." : "Guardar"}</button></div></div>
          </div>
          {previewOpen ? <Preview ad={ad} website={website} /> : null}
        </div>
      )}

      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void chooseImage(file); }} data-testid="ad-image-file" />
      <ImageFlowModal open={imageOpen} step={imageStep} previewURL={imagePreviewURL} file={imageFile} onClose={closeImage} onGenerate={() => void generateImage()} onPick={() => fileRef.current?.click()} onRaw={() => void handleUploadedImage(false)} onEnhance={() => void handleUploadedImage(true)} />
    </section>
  );
}

function ContentRow({ item, ordinal, onChange, onDelete, onImage }: { item: RestaurantAdContentElement; ordinal: number; onChange: (id: string, value: string) => void; onDelete: () => void; onImage: () => void }) {
  const label = `${TYPE_LABEL[item.type]} ${ordinal}`;
  return (
    <Reorder.Item value={item} className="flex items-start gap-2 rounded-bo-md border border-bo-border bg-bo-surface-2 p-2" data-slot={`ad-content-${item.id}`}>
      <button type="button" className="mt-2 cursor-grab text-bo-muted" aria-label={`Mover ${label}`} data-slot="ad-content-grip"><GripVertical size={17} aria-hidden="true" /></button>
      <div className="min-w-0 flex-1" data-slot="ad-content-field">{item.type === "image" ? <button type="button" onClick={onImage} className="flex w-full items-center gap-3 rounded-bo-sm border border-dashed border-bo-border p-3 text-left text-sm text-bo-muted" data-slot="ad-image-change">{item.value ? <img src={item.value} alt="Imagen actual" className="h-16 w-24 rounded-bo-sm object-cover" data-slot="ad-image-thumb" /> : <ImagePlus size={22} aria-hidden="true" />}<span data-slot="ad-image-change-text">{item.value ? "Cambiar imagen" : "Seleccionar imagen"}</span></button> : item.type === "text" ? <textarea value={item.value} onChange={(event) => onChange(item.id, event.target.value)} rows={3} className="w-full resize-y rounded-bo-sm border border-bo-border bg-bo-surface px-3 py-2 text-sm text-bo-text" aria-label={label} data-slot="ad-content-textarea" /> : <input value={item.value} onChange={(event) => onChange(item.id, event.target.value)} className="w-full rounded-bo-sm border border-bo-border bg-bo-surface px-3 py-2 text-sm text-bo-text" aria-label={label} data-slot="ad-content-input" />}</div>
      <button type="button" onClick={onDelete} className="mt-1 rounded-bo-sm p-2 text-bo-text-danger" aria-label={`Eliminar ${label}`} data-slot="ad-content-delete"><Trash2 size={15} aria-hidden="true" /></button>
    </Reorder.Item>
  );
}

function CTARow({ cta, index, website, onChange, onDelete }: { cta: RestaurantAd["ctas"][number]; index: number; website: string; onChange: (patch: Partial<RestaurantAd["ctas"][number]>) => void; onDelete: () => void }) {
  return (
    <div className="grid gap-3 rounded-bo-md border border-bo-border bg-bo-surface-2 p-3 md:grid-cols-[1fr_auto]" data-slot={`ad-cta-${cta.id}`}>
      <div className="grid gap-3 md:grid-cols-2" data-slot="ad-cta-fields"><label className="grid gap-1 text-xs text-bo-muted" data-slot="ad-cta-text-label"><span data-slot="ad-cta-text-caption">Texto botón {index + 1}</span><input value={cta.text} onChange={(event) => onChange({ text: event.target.value })} className="rounded-bo-sm border border-bo-border bg-bo-surface px-3 py-2 text-sm text-bo-text" data-slot="ad-cta-text" /></label><label className="grid gap-1 text-xs text-bo-muted" data-slot="ad-cta-color-label"><span data-slot="ad-cta-color-caption">Color</span><input type="color" value={cta.color || "#436754"} onChange={(event) => onChange({ color: event.target.value })} className="h-10 w-full rounded-bo-sm border border-bo-border bg-bo-surface p-1" data-slot="ad-cta-color" /></label><label className="grid gap-1 text-xs text-bo-muted" data-slot="ad-cta-mode-label"><span data-slot="ad-cta-mode-caption">Navegación</span><Select value={cta.navigation_mode} onChange={(value) => onChange({ navigation_mode: value === "custom" ? "custom" : "route" })} options={[{ value: "route", label: "Ruta de la web" }, { value: "custom", label: "URL personalizada" }]} ariaLabel={`Navegación CTA ${index + 1}`} /></label>{cta.navigation_mode === "route" ? <label className="grid gap-1 text-xs text-bo-muted" data-slot="ad-cta-route-label"><span data-slot="ad-cta-route-caption">Ruta</span><Select value={cta.route || "/reservas"} onChange={(route) => onChange({ route })} options={[...WEBSITE_ROUTE_OPTIONS]} ariaLabel={`Ruta CTA ${index + 1}`} /></label> : <label className="grid gap-1 text-xs text-bo-muted" data-slot="ad-cta-custom-label"><span data-slot="ad-cta-custom-caption">URL personalizada</span><input type="url" value={cta.custom_url} onChange={(event) => onChange({ custom_url: event.target.value })} className="rounded-bo-sm border border-bo-border bg-bo-surface px-3 py-2 text-sm text-bo-text" placeholder="https://..." data-slot="ad-cta-custom-url" /></label>}<p className="text-xs text-bo-muted md:col-span-2" data-slot="ad-cta-resolved">Destino: {buildCTAURL(website, cta) || "Sin configurar"}</p></div>
      <button type="button" onClick={onDelete} className="self-start rounded-bo-sm p-2 text-bo-text-danger" aria-label={`Eliminar CTA ${index + 1}`} data-slot="ad-cta-delete"><Trash2 size={15} aria-hidden="true" /></button>
    </div>
  );
}

function ImageFlowModal({ open, step, previewURL, file, onClose, onGenerate, onPick, onRaw, onEnhance }: { open: boolean; step: ImageStep; previewURL: string; file: File | null; onClose: () => void; onGenerate: () => void; onPick: () => void; onRaw: () => void; onEnhance: () => void }) {
  const locked = step === "preparing" || step === "working";
  return (
    <Modal open={open} title={step === "advisor" ? "Asesor IA de imagen" : "Imagen del anuncio"} onClose={locked ? () => undefined : onClose} widthPx={620} hideClose>
      <ModalHeader title={step === "advisor" ? "Asesor IA de imagen" : "Imagen del anuncio"} onClose={locked ? () => undefined : onClose} />
      <div className="p-5" data-slot="ad-image-modal-body"><AnimatePresence mode="wait"><motion.div key={step} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }} data-slot={`ad-image-step-${step}`}>{step === "choose" ? <div className="grid gap-3 sm:grid-cols-2" data-slot="ad-image-choices"><button type="button" onClick={onGenerate} className="grid min-h-36 place-items-center gap-2 rounded-bo-lg border border-bo-border bg-bo-surface-2 p-5 text-center text-bo-text" data-slot="ad-image-generate"><Sparkles size={24} aria-hidden="true" /><span className="font-semibold" data-slot="ad-image-generate-title">Generar desde el texto</span><span className="text-xs text-bo-muted" data-slot="ad-image-generate-hint">Usa el contenido escrito con WaveSpeed z-image/turbo.</span></button><button type="button" onClick={onPick} className="grid min-h-36 place-items-center gap-2 rounded-bo-lg border border-bo-border bg-bo-surface-2 p-5 text-center text-bo-text" data-slot="ad-image-upload"><Upload size={24} aria-hidden="true" /><span className="font-semibold" data-slot="ad-image-upload-title">Subir una imagen</span><span className="text-xs text-bo-muted" data-slot="ad-image-upload-hint">Se convierte a WebP y se comprime a máximo 100 KB.</span></button></div> : step === "advisor" ? <div className="grid gap-4" data-slot="ad-image-advisor"><div className="grid gap-1" data-slot="ad-image-advisor-copy"><p className="text-sm text-bo-text" data-slot="ad-image-advisor-lead">La imagen ya está preparada en WebP. Puedes usarla tal cual o mejorarla con IA antes de subirla a BunnyCDN.</p><p className="text-xs text-bo-muted" data-slot="ad-image-advisor-size">Tamaño optimizado: {Math.max(1, Math.round((file?.size || 0) / 1024))} KB.</p></div>{previewURL ? <img src={previewURL} alt="Previsualización de imagen optimizada" className="max-h-72 w-full rounded-bo-lg object-contain" data-slot="ad-image-advisor-preview" /> : null}<div className="flex flex-wrap justify-end gap-2" data-slot="ad-image-advisor-actions"><button type="button" onClick={onRaw} className="rounded-bo-sm border border-bo-border px-4 py-2 text-sm text-bo-text" data-testid="ad-image-use-raw">Continuar sin mejorar</button><button type="button" onClick={onEnhance} className="flex items-center gap-2 rounded-bo-sm bg-bo-accent px-4 py-2 text-sm font-semibold text-bo-bg" data-testid="ad-image-enhance"><Sparkles size={15} aria-hidden="true" />Mejorar con IA</button></div></div> : <div className="grid min-h-48 place-items-center gap-3 text-center" data-slot="ad-image-busy"><Sparkles size={28} className="animate-pulse text-bo-accent" aria-hidden="true" /><p className="text-sm text-bo-muted" data-slot="ad-image-busy-text">{step === "preparing" ? "Convirtiendo y comprimiendo a WebP..." : "Procesando imagen..."}</p></div>}</motion.div></AnimatePresence></div>
    </Modal>
  );
}

export function ConfigAnuncios({ website }: { website: string }) {
  const api = useMemo(() => createClient({ baseUrl: "" }), []);
  const { pushToast } = useToasts();
  const notify = useCallback<Notify>((kind, title, message) => pushToast({ kind, title, message }), [pushToast]);
  return <ConfigAnunciosContent api={api} website={website} notify={notify} />;
}
