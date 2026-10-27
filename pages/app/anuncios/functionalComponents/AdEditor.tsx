import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { navigate } from "vike/client/router";
import { CalendarRange, Eye, Layers3, LayoutPanelTop, PenLine, Plus, Settings, Square, Trash2, TriangleAlert, X } from "lucide-react";
import type { RestaurantAd, RestaurantAdDesignContainer, RestaurantAdDesignKind, RestaurantAdInput } from "../../../../api/types";
import { createClient } from "../../../../api/client";
import { InlineAlert } from "../../../../ui/feedback/InlineAlert";
import { useToasts } from "../../../../ui/feedback/useToasts";
import { Tabs, type TabItem } from "../../../../ui/nav/Tabs";
import { ConfirmDialog } from "../../../../ui/overlays/ConfirmDialog";
import { Switch } from "../../../../ui/shadcn/Switch";
import { cn } from "../../../../ui/shadcn/utils";
import { Panel } from "../../../../ui/shell/Panel";
import { DeviceSwitch } from "../../../../ui/htmlBuilder/PreviewFrame";
import { Segmented } from "../../../../ui/htmlBuilder/BuilderInspector";
import type { BuilderDevice } from "../../../../ui/htmlBuilder/BuilderCanvas";
import type { BlockContext } from "../../../../ui/htmlBuilder/blocks";
import { CampaignField, CampaignSection } from "../../campanas/functionalComponents/campaignUi";
import { AdEditorHeader, type AdSaveState } from "./AdEditorHeader";
import { AdBuilder } from "./editor/AdBuilder";
import { AD_DEVICE_WIDTHS, AdLivePreview, websiteBase } from "./editor/AdStage";
import {
  AD_DEFAULT_OVERLAY, addStep, defaultDraft, designFromDraft, draftFromDesign, orphanSteps, removeStep, stepIdsOf, switchKind, syncSteps,
  type AdDraft, type AdPage,
} from "./editor/adDesign";
import { draftFromLegacy, isLegacyAd } from "./editor/adLegacy";

/*
 * Ad editor (ads_html_editor_v1): the web ad built with the shared HTML
 * builder over the real website. Diseño edits one page at a time (a single
 * ad has one; a multiple ad has its cards page and one detail page per card),
 * Previsualización plays the whole ad as a visitor sees it, Ajustes holds the
 * name, schedule, kind and the window around the design.
 */

const LIST_HREF = "/app/anuncios";

export type AdEditorTab = "diseno" | "previsualizacion" | "ajustes";

const AD_EDITOR_TABS: { id: AdEditorTab; label: string; Icon: typeof PenLine }[] = [
  { id: "diseno", label: "Diseño", Icon: PenLine },
  { id: "previsualizacion", label: "Previsualización", Icon: Eye },
  { id: "ajustes", label: "Ajustes", Icon: Settings },
];

/** Tab named by the `?tab=` query; anything else opens the design. */
export function adEditorTab(raw: unknown): AdEditorTab {
  return AD_EDITOR_TABS.find((t) => t.id === raw)?.id ?? "diseno";
}

const TABPANEL_SCROLL = "min-w-0 lg:min-h-0 lg:flex-1 lg:overflow-y-auto";

type Meta = { name: string; active: boolean; starts_at: string | null; ends_at: string | null };
type Brand = { loaded: boolean; brandName: string; logoUrl: string; website: string; accent: string };

function apiMessage(result: unknown, fallback: string): string {
  const message = (result as { message?: unknown } | null)?.message;
  return typeof message === "string" && message.trim() ? message : fallback;
}

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

const shortDate = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });

function scheduleLabel(meta: Meta): string {
  if (meta.starts_at && meta.ends_at) return `Del ${shortDate(meta.starts_at)} al ${shortDate(meta.ends_at)}`;
  return "Sin fechas: siempre que esté activo";
}

/** rgba()/hex overlay <-> colour + opacity controls. */
function parseOverlay(value: string): { hex: string; alpha: number } {
  const rgba = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)$/i.exec(value.trim());
  if (rgba) {
    const hex = `#${[rgba[1], rgba[2], rgba[3]].map((n) => Math.min(255, Number(n)).toString(16).padStart(2, "0")).join("")}`;
    return { hex, alpha: rgba[4] === undefined ? 1 : Math.min(1, Math.max(0, Number(rgba[4]))) };
  }
  if (/^#[0-9a-f]{6}$/i.test(value.trim())) return { hex: value.trim(), alpha: 1 };
  return { hex: "#0f1714", alpha: 0.62 };
}

function composeOverlay(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${Math.round(alpha * 100) / 100})`;
}

const metaOf = (ad: RestaurantAd | null): Meta => ({
  name: ad?.name ?? "Nuevo anuncio",
  active: ad?.active ?? false,
  starts_at: ad?.starts_at ?? null,
  ends_at: ad?.ends_at ?? null,
});

type Props = {
  mode: "create" | "edit";
  adId?: number;
  initialAd?: RestaurantAd | null;
  initialTab?: AdEditorTab;
};

export function AdEditor({ mode, adId, initialAd = null, initialTab = "diseno" }: Props) {
  const api = useMemo(() => createClient({ baseUrl: "" }).config, []);
  const { pushToast } = useToasts();
  const [ad, setAd] = useState<RestaurantAd | null>(initialAd);
  const [loadError, setLoadError] = useState("");
  const [meta, setMeta] = useState<Meta>(metaOf(initialAd));
  const [draft, setDraft] = useState<AdDraft | null>(null);
  const [converted, setConverted] = useState(false);
  const [page, setPage] = useState<AdPage>({ kind: "main" });
  const [tab, setTab] = useState<AdEditorTab>(initialTab);
  const [device, setDevice] = useState<BuilderDevice>("desktop");
  const [brand, setBrand] = useState<Brand>({ loaded: false, brandName: "", logoUrl: "", website: "", accent: "#1e4636" });
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState<{ kind: "delete" } | { kind: "step"; id: string } | { kind: "single" } | null>(null);
  const savedRef = useRef<string>("");
  const navigated = useRef(false);
  const tabRef = useRef(tab);
  tabRef.current = tab;
  const coordId = ad ? `ad-${ad.id}` : "ad-new";
  const basePath = ad ? `${LIST_HREF}/${ad.id}` : `${LIST_HREF}/nuevo`;

  // Phones start on the phone screen (a desktop stage would be a thumbnail).
  useEffect(() => {
    if (!window.matchMedia("(min-width: 1024px)").matches) setDevice("mobile");
  }, []);

  // Brand + website for the blocks, the AI and the backdrop (best effort).
  useEffect(() => {
    let alive = true;
    api
      .adEditorContext()
      .then((res) => {
        if (!alive) return;
        setBrand(
          res.success
            ? { loaded: true, brandName: res.brand_name ?? "", logoUrl: res.logo_url ?? "", website: res.website ?? "", accent: res.accent || "#1e4636" }
            : (prev) => ({ ...prev, loaded: true }),
        );
      })
      .catch(() => alive && setBrand((prev) => ({ ...prev, loaded: true })));
    return () => {
      alive = false;
    };
  }, [api]);

  // Edit page opened without the SSR copy (client navigation): load it.
  useEffect(() => {
    if (mode !== "edit" || ad || !adId) return;
    let alive = true;
    api
      .listAds()
      .then((res) => {
        if (!alive) return;
        const found = res.success ? (res.ads ?? []).find((item) => item.id === adId) ?? null : null;
        if (!found) {
          setLoadError(res.success ? "Este anuncio no existe o ya se ha eliminado." : apiMessage(res, "No se pudo cargar el anuncio"));
          return;
        }
        setAd(found);
        setMeta(metaOf(found));
      })
      .catch((err) => alive && setLoadError(errorMessage(err, "No se pudo cargar el anuncio")));
    return () => {
      alive = false;
    };
  }, [ad, adId, api, mode]);

  const blockContext = useMemo<BlockContext>(
    () => ({ brandName: brand.brandName, logoUrl: brand.logoUrl, websiteUrl: websiteBase(brand.website), accent: brand.accent }),
    [brand.accent, brand.brandName, brand.logoUrl, brand.website],
  );

  // First draft once the brand is known: the stored design, the conversion of
  // an ad made with the previous editor, or the starting template.
  useEffect(() => {
    if (!brand.loaded || draft || (mode === "edit" && !ad)) return;
    let next: AdDraft;
    if (ad?.design) next = draftFromDesign(ad.design);
    else if (ad && isLegacyAd(ad)) {
      next = draftFromLegacy(ad, blockContext, websiteBase(brand.website));
      setConverted(true);
    } else next = defaultDraft("single", blockContext);
    setDraft(next);
    savedRef.current = ad?.design ? JSON.stringify({ meta: metaOf(ad), design: designFromDraft(next) }) : "";
  }, [ad, blockContext, brand.loaded, brand.website, draft, mode]);

  const selectTab = useCallback((next: AdEditorTab) => {
    setTab(next);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", next);
    window.history.replaceState(window.history.state, "", url);
  }, []);

  const tabs = useMemo<TabItem[]>(
    () =>
      AD_EDITOR_TABS.map(({ id, label, Icon }) => ({
        id,
        label,
        href: `${basePath}?tab=${id}`,
        icon: <Icon className="bo-ico" aria-hidden="true" data-testid={`ad-editor-tabs-${id}-svg`} />,
      })),
    [basePath],
  );

  const stepIds = useMemo(() => (draft?.kind === "multiple" ? stepIdsOf(draft.main) : []), [draft?.kind, draft?.main]);
  // A page that no longer exists (its card was removed) falls back to the cards.
  useEffect(() => {
    if (page.kind === "step" && !stepIds.includes(page.id)) setPage({ kind: "main" });
  }, [page, stepIds]);

  const design = useMemo(() => (draft ? designFromDraft(draft) : null), [draft]);
  const snapshot = useMemo(() => (design ? JSON.stringify({ meta, design }) : ""), [design, meta]);
  const dirty = Boolean(snapshot) && snapshot !== savedRef.current;
  const saveState: AdSaveState = saving ? "saving" : !ad ? "new" : dirty ? "dirty" : "saved";

  const setMain = useCallback((html: string) => setDraft((d) => (d ? syncSteps({ ...d, main: html }, blockContext) : d)), [blockContext]);
  const setStepHtml = useCallback(
    (id: string, html: string) => setDraft((d) => (d && d.steps[id] ? { ...d, steps: { ...d.steps, [id]: { ...d.steps[id], html } } } : d)),
    [],
  );
  const setContainer = useCallback((patch: Partial<RestaurantAdDesignContainer>) => setDraft((d) => (d ? { ...d, container: { ...d.container, ...patch } } : d)), []);
  const applyKind = useCallback(
    (kind: RestaurantAdDesignKind) => {
      setDraft((d) => (d ? switchKind(d, kind, blockContext) : d));
      setPage({ kind: "main" });
    },
    [blockContext],
  );
  // Multiple -> single keeps only the first proposal: ask before dropping more.
  const setKind = useCallback(
    (kind: RestaurantAdDesignKind) => {
      if (draft?.kind === "multiple" && kind === "single" && stepIdsOf(draft.main).length > 1) setConfirm({ kind: "single" });
      else applyKind(kind);
    },
    [applyKind, draft],
  );

  const persist = useCallback(async (): Promise<RestaurantAd | null> => {
    if (!design) return null;
    setBusy(true);
    setSaving(true);
    try {
      // The previous editor's fields travel untouched: the HTML design takes
      // over the website, the old data stays as it was.
      const payload: RestaurantAdInput = {
        name: meta.name.trim() || "Nuevo anuncio",
        active: meta.active,
        starts_at: meta.starts_at,
        ends_at: meta.ends_at,
        content: ad?.content ?? [],
        ctas: ad?.ctas ?? [],
        layout: ad?.layout ?? { mode: "unico", steps: [] },
        ...(ad?.canvas ? { canvas: ad.canvas } : {}),
        design,
      };
      const result = ad ? await api.updateAd(ad.id, payload) : await api.createAd(payload);
      if (!result.success || !result.ad) throw new Error(apiMessage(result, "No se pudo guardar el anuncio"));
      savedRef.current = JSON.stringify({ meta, design });
      setAd(result.ad);
      setConverted(false);
      // Steps whose card was removed are gone for good once saved.
      setDraft((d) => (d && d.kind === "multiple" ? { ...d, steps: Object.fromEntries(Object.entries(d.steps).filter(([id]) => !orphanSteps(d).includes(id))) } : d));
      pushToast({ kind: "success", title: "Anuncios", message: "Anuncio guardado" });
      return result.ad;
    } catch (err) {
      pushToast({ kind: "error", title: "Anuncios", message: errorMessage(err, "No se pudo guardar el anuncio") });
      return null;
    } finally {
      setBusy(false);
      setSaving(false);
    }
  }, [ad, api, design, meta, pushToast]);

  const save = useCallback(async () => {
    const saved = await persist();
    if (saved && !navigated.current && (mode === "create" || !ad)) {
      navigated.current = true;
      void navigate(`${LIST_HREF}/${saved.id}?tab=${tabRef.current}`);
    }
    return saved;
  }, [ad, mode, persist]);

  const saveRef = useRef(save);
  saveRef.current = save;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void saveRef.current();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const uploadImage = useCallback(
    async (file: File) => {
      try {
        // A new ad needs an id for its image folder: save it in place first.
        const target = ad ?? (await persist());
        if (!target) throw new Error("No se pudo guardar el anuncio antes de subir la imagen");
        const result = await api.uploadAdDesignImage(target.id, file);
        if (!result.success || !result.url) throw new Error(apiMessage(result, "No se pudo subir la imagen"));
        return result.url;
      } catch (err) {
        const message = errorMessage(err, "No se pudo subir la imagen");
        pushToast({ kind: "error", title: "Imagen", message });
        throw new Error(message, { cause: err });
      }
    },
    [ad, api, persist, pushToast],
  );

  const remove = useCallback(async () => {
    if (!ad) return;
    setBusy(true);
    try {
      const result = await api.deleteAd(ad.id);
      if (!result.success) throw new Error(apiMessage(result, "No se pudo eliminar el anuncio"));
      void navigate(LIST_HREF);
    } catch (err) {
      pushToast({ kind: "error", title: "Anuncios", message: errorMessage(err, "No se pudo eliminar el anuncio") });
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  }, [ad, api, pushToast]);

  const stepTitle = useCallback((id: string) => draft?.steps[id]?.title ?? "", [draft?.steps]);
  const openStep = useCallback((id: string) => setPage({ kind: "step", id }), []);
  const site = websiteBase(brand.website);
  // The website only shows active ads (the saved version).
  const liveUrl = ad?.active && site ? `${site}/?vc_ad=${ad.id}&vc_preview=1` : "";

  if (loadError) {
    return <InlineAlert kind="error" title="Anuncio" message={loadError} testId="ad-editor-load-error" />;
  }

  const orphans = draft ? orphanSteps(draft) : [];
  // Other active ads with dates (the list carries every one, this ad included).
  const otherRanges = (ad?.blocked_ranges ?? []).filter((r) => r.id !== ad?.id);
  const currentStep = page.kind === "step" && draft?.steps[page.id] ? page.id : "";
  const builderPage = draft?.kind === "multiple" ? (currentStep ? "step" : "cards") : "single";

  return (
    <section className="flex min-w-0 flex-col gap-3 pb-24 sm:pb-0 lg:min-h-0 lg:flex-1 lg:pb-0" aria-label="Editor de anuncio" data-testid="ad-editor" data-coord-id="ads_html_editor_v1">
      <h2 className="sr-only" data-testid="ad-editor-heading">Editor de anuncio</h2>
      <AdEditorHeader
        name={meta.name}
        active={meta.active}
        schedule={scheduleLabel(meta)}
        kind={draft?.kind ?? "single"}
        saveState={saveState}
        canDelete={Boolean(ad)}
        busy={busy || !draft}
        liveUrl={liveUrl}
        backHref={LIST_HREF}
        onBack={() => void navigate(LIST_HREF)}
        onNameChange={(name) => setMeta((m) => ({ ...m, name }))}
        onSave={() => void save()}
        onDelete={() => setConfirm({ kind: "delete" })}
      />

      <Tabs
        tabs={tabs}
        activeId={tab}
        ariaLabel="Secciones del anuncio"
        className="bo-tabs--reservas my-0 mx-auto flex w-fit shrink-0 flex-row rounded-xl"
        onNavigate={(_href, id) => selectTab(id as AdEditorTab)}
        testId="ad-editor-tabs"
      />

      {converted && (
        <InlineAlert
          kind="info"
          title="Convertido desde el editor anterior"
          message="Este anuncio se ha pasado al nuevo editor. Revísalo en Diseño y Previsualización y guárdalo: hasta entonces la web sigue mostrando la versión anterior."
          testId="ad-editor-converted"
        />
      )}

      {!draft ? (
        <div className="grid min-h-[420px] place-items-center rounded-bo-lg border border-bo-border bg-bo-surface-3 text-sm text-bo-muted" data-testid="ad-editor-loading">
          Preparando el editor…
        </div>
      ) : (
        <>
          {tab === "diseno" && (
            <div className="flex min-w-0 flex-col gap-2 lg:min-h-0 lg:flex-1" role="tabpanel" aria-label="Diseño" data-testid="ad-tabpanel-design">
              <div className="eb-scope flex flex-wrap items-center gap-2" data-testid="ad-pages">
                <Segmented<RestaurantAdDesignKind>
                  label="Tipo de anuncio"
                  value={draft.kind}
                  onChange={setKind}
                  options={[
                    { value: "single", label: "Individual", title: "Un único anuncio" },
                    { value: "multiple", label: "Múltiple", title: "Tarjetas que abren cada una su página de detalle" },
                  ]}
                  testId="ad-kind"
                />
                {draft.kind === "multiple" && (
                  <nav className="flex min-w-0 flex-1 basis-full items-center gap-1.5 overflow-x-auto pb-1 sm:basis-0 sm:flex-wrap sm:overflow-visible sm:pb-0" aria-label="Páginas del anuncio" data-testid="ad-pages-nav">
                    <PageChip active={!currentStep} onClick={() => setPage({ kind: "main" })} testId="ad-page-main" icon={<LayoutPanelTop size={13} aria-hidden="true" data-testid="ad-page-main-icon" />}>
                      Tarjetas
                    </PageChip>
                    {stepIds.map((id, i) => (
                      <PageChip
                        key={id}
                        active={currentStep === id}
                        onClick={() => setPage({ kind: "step", id })}
                        onRemove={() => setConfirm({ kind: "step", id })}
                        testId={`ad-page-step-${i + 1}`}
                      >
                        {i + 1} · {draft.steps[id]?.title || "Paso"}
                      </PageChip>
                    ))}
                    <button
                      type="button"
                      onClick={() => {
                        const res = addStep(draft, blockContext);
                        setDraft(res.draft);
                        setPage({ kind: "step", id: res.id });
                      }}
                      disabled={stepIds.length >= 20}
                      className="inline-flex h-8 shrink-0 items-center gap-1 rounded-bo-full border border-dashed border-bo-border-2 px-3 text-xs font-medium text-bo-muted transition hover:text-bo-text disabled:opacity-40"
                      data-testid="ad-page-add"
                    >
                      <Plus size={13} aria-hidden="true" data-testid="ad-page-add-icon" /> Añadir propuesta
                    </button>
                  </nav>
                )}
                {draft.kind === "multiple" && orphans.length > 0 && (
                  <span className="inline-flex items-center gap-1 text-[11px] text-[var(--bo-on-surface-warning)]" data-testid="ad-pages-orphans">
                    <TriangleAlert size={12} aria-hidden="true" data-testid="ad-pages-orphans-icon" />
                    {orphans.length === 1 ? "1 página sin tarjeta se descartará al guardar" : `${orphans.length} páginas sin tarjeta se descartarán al guardar`}
                  </span>
                )}
              </div>
              <div className="min-w-0 lg:min-h-0 lg:flex-1" data-testid="ad-builder-host" data-page={currentStep || "main"}>
                <AdBuilder
                  key={currentStep || "main"}
                  value={currentStep ? draft.steps[currentStep].html : draft.main}
                  onChange={currentStep ? (html) => setStepHtml(currentStep, html) : setMain}
                  context={blockContext}
                  coordId={coordId}
                  website={brand.website}
                  container={draft.container}
                  page={builderPage}
                  device={device}
                  onDeviceChange={setDevice}
                  stepTitle={stepTitle}
                  onOpenStep={openStep}
                  onUploadImage={uploadImage}
                />
              </div>
            </div>
          )}

          {tab === "previsualizacion" && (
            <div className={`eb-scope ${TABPANEL_SCROLL}`} role="tabpanel" aria-label="Previsualización" data-testid="ad-tabpanel-preview">
              <Panel
                title="Previsualización"
                meta="El anuncio sobre la web, tal y como lo ve el cliente (con los cambios sin guardar)"
                className="mx-auto h-auto w-full max-w-6xl"
                bodyClassName="grid content-start gap-4"
                data-testid="ad-preview-panel"
              >
                <div className="flex flex-wrap items-center justify-center gap-2" data-testid="ad-preview-device-toggle">
                  <DeviceSwitch value={device} onChange={setDevice} testId="ad-preview-device" widths={AD_DEVICE_WIDTHS} />
                </div>
                <AdLivePreview key={device} draft={draft} device={device} website={brand.website} coordId={coordId} initialStep={currentStep} />
              </Panel>
            </div>
          )}

          {tab === "ajustes" && (
            <div className={`ad-settingsPanel grid content-start gap-4 ${TABPANEL_SCROLL}`} role="tabpanel" aria-label="Ajustes" data-testid="ad-tabpanel-settings">
              <CampaignSection icon={<CalendarRange size={15} aria-hidden="true" data-testid="ad-settings-publish-svg" />} title="Publicación" helper="Cuándo aparece el anuncio en la web" data-testid="ad-settings-publish">
                <div className="grid content-start gap-4 sm:grid-cols-2" data-testid="ad-settings-publish-fields">
                  <CampaignField label="Nombre interno" helper="Solo para el equipo, no se ve en la web" data-testid="ad-settings-name">
                    <input className="bo-input h-10 w-full" value={meta.name} onChange={(e) => setMeta((m) => ({ ...m, name: e.currentTarget.value }))} data-testid="ad-settings-name-input" />
                  </CampaignField>
                  <CampaignField as="div" label="Estado" helper="Solo se muestra un anuncio activo a la vez por visita" data-testid="ad-settings-active">
                    <span className="flex h-10 items-center gap-2 text-sm" data-testid="ad-settings-active-row">
                      <Switch checked={meta.active} onCheckedChange={(active) => setMeta((m) => ({ ...m, active }))} aria-label="Anuncio activo" data-testid="ad-settings-active-switch" />
                      {meta.active ? "Activo" : "Inactivo"}
                    </span>
                  </CampaignField>
                  <CampaignField as="div" label="Programación" helper="Sin fechas se muestra mientras esté activo" className="sm:col-span-2" data-testid="ad-settings-schedule">
                    <div className="flex flex-wrap items-center gap-2" data-testid="ad-settings-schedule-row">
                      <Segmented<"always" | "range">
                        label="Programación"
                        value={meta.starts_at && meta.ends_at ? "range" : "always"}
                        onChange={(v) => {
                          const today = new Date().toISOString().slice(0, 10);
                          setMeta((m) => (v === "always" ? { ...m, starts_at: null, ends_at: null } : { ...m, starts_at: m.starts_at ?? today, ends_at: m.ends_at ?? today }));
                        }}
                        options={[
                          { value: "always", label: "Siempre", title: "Se muestra mientras esté activo" },
                          { value: "range", label: "Entre fechas", title: "Solo entre dos fechas" },
                        ]}
                        testId="ad-settings-schedule-mode"
                      />
                      {meta.starts_at && meta.ends_at && (
                        <>
                          <input type="date" className="bo-input h-10" value={meta.starts_at} max={meta.ends_at} aria-label="Desde" onChange={(e) => setMeta((m) => ({ ...m, starts_at: e.currentTarget.value || m.starts_at }))} data-testid="ad-settings-starts" />
                          <span className="text-sm text-bo-muted" data-testid="ad-settings-schedule-sep">a</span>
                          <input type="date" className="bo-input h-10" value={meta.ends_at} min={meta.starts_at} aria-label="Hasta" onChange={(e) => setMeta((m) => ({ ...m, ends_at: e.currentTarget.value || m.ends_at }))} data-testid="ad-settings-ends" />
                        </>
                      )}
                    </div>
                    {otherRanges.length > 0 && (
                      <ul className="m-0 grid list-none gap-1 p-0 text-[11px] text-bo-faint" data-testid="ad-settings-blocked">
                        {otherRanges.map((r) => (
                          <li key={r.id} data-testid={`ad-settings-blocked-${r.id}`}>
                            «{r.name}» ocupa del {shortDate(r.starts_at)} al {shortDate(r.ends_at)}
                          </li>
                        ))}
                      </ul>
                    )}
                  </CampaignField>
                </div>
              </CampaignSection>

              <CampaignSection icon={<Layers3 size={15} aria-hidden="true" data-testid="ad-settings-kind-svg" />} title="Tipo de anuncio" helper="Un anuncio, o varias propuestas en tarjetas" data-testid="ad-settings-kind">
                <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Tipo de anuncio" data-testid="ad-settings-kind-options">
                  {([
                    ["single", "Individual", "Un único anuncio con su imagen, texto y botones.", <Square key="s" size={16} aria-hidden="true" data-testid="ad-settings-kind-single-icon" />],
                    ["multiple", "Múltiple", "Primero todas las propuestas en tarjetas; cada tarjeta abre su página de detalle, con botón para volver.", <Layers3 key="m" size={16} aria-hidden="true" data-testid="ad-settings-kind-multiple-icon" />],
                  ] as const).map(([value, label, help, icon]) => (
                    <button
                      key={value}
                      type="button"
                      role="radio"
                      aria-checked={draft.kind === value}
                      onClick={() => setKind(value)}
                      className={cn(
                        "grid cursor-pointer gap-1 rounded-bo-md border bg-bo-surface-3 p-3 text-left transition",
                        draft.kind === value ? "border-[#7c5cff]/70 ring-1 ring-[#7c5cff]/40" : "border-bo-border hover:border-bo-border-2",
                      )}
                      data-testid={`ad-settings-kind-${value}`}
                    >
                      <span className="flex items-center gap-2 text-sm font-semibold text-bo-text" data-testid={`ad-settings-kind-${value}-label`}>
                        {icon}
                        {label}
                      </span>
                      <span className="text-xs leading-snug text-bo-muted" data-testid={`ad-settings-kind-${value}-help`}>{help}</span>
                    </button>
                  ))}
                </div>
              </CampaignSection>

              <WindowSettings container={draft.container} onChange={setContainer} />

              {ad && (
                <CampaignSection icon={<Trash2 size={15} aria-hidden="true" data-testid="ad-settings-danger-svg" />} title="Eliminar" helper="Borra el anuncio de la web y del backoffice" data-testid="ad-settings-danger">
                  <button type="button" className="bo-btn bo-btn--danger bo-btn--sm w-fit" onClick={() => setConfirm({ kind: "delete" })} disabled={busy} data-testid="ad-settings-delete">
                    Eliminar anuncio
                  </button>
                </CampaignSection>
              )}
            </div>
          )}
        </>
      )}

      <ConfirmDialog
        open={confirm?.kind === "delete"}
        title="Eliminar anuncio"
        message={`«${meta.name}» desaparecerá de la web. No se puede deshacer.`}
        confirmText="Eliminar"
        danger
        busy={busy}
        onClose={() => setConfirm(null)}
        onConfirm={remove}
        testId="ad-delete-confirm"
      />
      <ConfirmDialog
        open={confirm?.kind === "step"}
        title="Quitar propuesta"
        message={confirm?.kind === "step" ? `Se quitan la tarjeta y la página de «${draft?.steps[confirm.id]?.title || "esta propuesta"}».` : ""}
        confirmText="Quitar"
        danger
        onClose={() => setConfirm(null)}
        onConfirm={() => {
          if (confirm?.kind === "step") {
            setDraft((d) => (d ? removeStep(d, confirm.id) : d));
            setPage({ kind: "main" });
          }
          setConfirm(null);
        }}
        testId="ad-step-remove-confirm"
      />
      <ConfirmDialog
        open={confirm?.kind === "single"}
        title="Pasar a individual"
        message={`El anuncio se queda con la página de «${draft && draft.kind === "multiple" ? draft.steps[stepIdsOf(draft.main)[0]]?.title || "la primera propuesta" : ""}»; las demás propuestas se descartan (hasta que guardes puedes recargar para recuperarlas).`}
        confirmText="Pasar a individual"
        onClose={() => setConfirm(null)}
        onConfirm={() => {
          applyKind("single");
          setConfirm(null);
        }}
        testId="ad-kind-single-confirm"
      />
    </section>
  );
}

function PageChip({ active, onClick, onRemove, testId, icon, children }: { active: boolean; onClick: () => void; onRemove?: () => void; testId: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex h-8 max-w-[16rem] shrink-0 items-center rounded-bo-full border text-xs font-medium transition",
        active ? "border-[#7c5cff]/70 bg-[#7c5cff]/15 text-[#d9d0ff]" : "border-bo-border bg-bo-surface-3 text-bo-muted hover:text-bo-text",
      )}
      data-testid={testId}
      data-active={active}
    >
      <button type="button" onClick={onClick} aria-current={active ? "page" : undefined} className="inline-flex h-full min-w-0 items-center gap-1 truncate pl-3 pr-2" data-testid={`${testId}-open`}>
        {icon}
        <span className="truncate" data-testid={`${testId}-label`}>{children}</span>
      </button>
      {onRemove && (
        <button type="button" onClick={onRemove} aria-label="Quitar propuesta" title="Quitar propuesta" className="mr-1 grid size-6 place-items-center rounded-full text-bo-faint hover:bg-bo-surface-2 hover:text-bo-text" data-testid={`${testId}-remove`}>
          <X size={12} aria-hidden="true" data-testid={`${testId}-remove-icon`} />
        </button>
      )}
    </span>
  );
}

function WindowSettings({ container, onChange }: { container: RestaurantAdDesignContainer; onChange: (patch: Partial<RestaurantAdDesignContainer>) => void }) {
  const overlay = parseOverlay(container.overlay || AD_DEFAULT_OVERLAY);
  const width = container.max_width ?? 560;
  const radius = container.radius ?? 24;
  return (
    <CampaignSection icon={<LayoutPanelTop size={15} aria-hidden="true" data-testid="ad-settings-window-svg" />} title="Ventana" helper="El marco del anuncio sobre la web" data-testid="ad-settings-window">
      <div className="grid gap-4 sm:grid-cols-2" data-testid="ad-settings-window-fields">
        <CampaignField label={`Ancho máximo · ${width}px`} helper="En el móvil ocupa la pantalla con un margen" data-testid="ad-settings-width">
          <input type="range" min={280} max={1200} step={10} value={width} onChange={(e) => onChange({ max_width: Number(e.currentTarget.value) })} className="w-full" data-testid="ad-settings-width-input" />
        </CampaignField>
        <CampaignField label={`Esquinas · ${radius}px`} data-testid="ad-settings-radius">
          <input type="range" min={0} max={48} step={1} value={radius} onChange={(e) => onChange({ radius: Number(e.currentTarget.value) })} className="w-full" data-testid="ad-settings-radius-input" />
        </CampaignField>
        <CampaignField label="Fondo de la ventana" helper="Se ve en las esquinas y bajo el diseño" data-testid="ad-settings-background">
          <input type="color" value={/^#[0-9a-f]{6}$/i.test(container.background ?? "") ? container.background : "#ffffff"} onChange={(e) => onChange({ background: e.currentTarget.value })} className="h-10 w-16 cursor-pointer rounded-md border border-bo-border bg-transparent" data-testid="ad-settings-background-input" />
        </CampaignField>
        <CampaignField as="div" label={`Oscurecer la web · ${Math.round(overlay.alpha * 100)} %`} data-testid="ad-settings-overlay">
          <div className="flex items-center gap-3" data-testid="ad-settings-overlay-row">
            <input type="color" value={overlay.hex} aria-label="Color del fondo oscurecido" onChange={(e) => onChange({ overlay: composeOverlay(e.currentTarget.value, overlay.alpha) })} className="h-10 w-16 shrink-0 cursor-pointer rounded-md border border-bo-border bg-transparent" data-testid="ad-settings-overlay-color" />
            <input type="range" min={0} max={95} step={1} value={Math.round(overlay.alpha * 100)} aria-label="Opacidad del fondo oscurecido" onChange={(e) => onChange({ overlay: composeOverlay(overlay.hex, Number(e.currentTarget.value) / 100) })} className="w-full" data-testid="ad-settings-overlay-alpha" />
          </div>
        </CampaignField>
      </div>
    </CampaignSection>
  );
}
