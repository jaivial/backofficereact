import React, { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "../../../../../api/client";
import type { MenuPublicSEO } from "../../../../../api/types";
import { AutosaveInput } from "../../../../../ui/inputs/AutosaveInput";

const EMPTY: MenuPublicSEO = {
  seo_slug: "", seo_title: "", seo_title_english: "", seo_description: "",
  seo_description_english: "", seo_h1: "", seo_h1_english: "",
  seo_intro: "", seo_intro_english: "", seo_faq: "", seo_faq_english: "",
};

const FIELDS: Array<{ key: keyof MenuPublicSEO; label: string; multiline?: boolean }> = [
  { key: "seo_title", label: "Title SEO" },
  { key: "seo_title_english", label: "Title SEO (English)" },
  { key: "seo_description", label: "Meta description", multiline: true },
  { key: "seo_description_english", label: "Meta description (English)", multiline: true },
  { key: "seo_h1", label: "H1 de la página" },
  { key: "seo_h1_english", label: "H1 de la página (English)" },
  // Coordination id: menu_seo_content_v1
  { key: "seo_intro", label: "Introducción visible (texto SEO bajo el H1)", multiline: true },
  { key: "seo_intro_english", label: "Introducción visible (English)", multiline: true },
  { key: "seo_faq", label: "Preguntas frecuentes (pregunta en la primera línea, respuesta debajo; separa cada pregunta con una línea en blanco)", multiline: true },
  { key: "seo_faq_english", label: "Preguntas frecuentes (English)", multiline: true },
];

function slugify(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 120).replace(/-+$/g, "");
}

// Generic SEO form shared by the menu editor and the food-type pages
// (/app/comida/cafes). Each caller supplies how to load and save; a page with a
// fixed public path (e.g. /cafes) passes fixedPath and gets no slug field.
// Coordination ids: menu_public_seo_v1, cafes_page_seo_v1
export function PublicSEOForm({
  ready,
  title,
  load,
  save,
  fixedPath,
  heading,
  testPrefix,
  coordinationId,
}: {
  ready: boolean;
  title: string;
  load: () => Promise<{ ok: boolean; seo?: Partial<MenuPublicSEO>; message?: string }>;
  save: (seo: MenuPublicSEO) => Promise<{ ok: boolean; seo_slug?: string; message?: string }>;
  fixedPath?: string;
  heading: string;
  testPrefix: string;
  coordinationId: string;
}) {
  const [draft, setDraft] = useState<MenuPublicSEO>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    let cancelled = false;
    if (!ready) { setDraft(EMPTY); return; }
    setLoading(true); setStatus("");
    void load().then((result) => {
      if (cancelled) return;
      if (!result.ok) { setStatus(result.message || "No se pudo cargar el SEO"); return; }
      const seo = result.seo || {};
      setDraft(Object.fromEntries((Object.keys(EMPTY) as Array<keyof MenuPublicSEO>).map((key) => [key, seo[key] || ""])) as MenuPublicSEO);
    }).catch((error: unknown) => { if (!cancelled) setStatus(error instanceof Error ? error.message : "No se pudo cargar el SEO"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [ready, load]);

  const generate = () => {
    const cleanTitle = title.trim();
    setDraft((current) => ({
      ...current,
      seo_slug: fixedPath ? "" : (current.seo_slug || slugify(cleanTitle)),
      seo_title: current.seo_title || (cleanTitle ? `${cleanTitle} en Catarroja | Alquería Villa Carmen` : ""),
      seo_description: current.seo_description || (cleanTitle ? `${cleanTitle} en Alquería Villa Carmen, Catarroja (Valencia). Consulta la carta y reserva online.` : ""),
      seo_h1: current.seo_h1 || cleanTitle,
    }));
  };

  const onSave = async () => {
    if (!ready) return;
    setSaving(true); setStatus("");
    try {
      const result = await save(draft);
      if (!result.ok) { setStatus(result.message || "No se pudo guardar el SEO"); return; }
      if (result.seo_slug !== undefined) setDraft((current) => ({ ...current, seo_slug: result.seo_slug || "" }));
      setStatus("SEO guardado. La API ya usa esta configuración; el HTML prerenderizado y el sitemap se actualizan en el siguiente despliegue del frontend.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "No se pudo guardar el SEO");
    } finally { setSaving(false); }
  };

  const t = testPrefix;
  return (
    <section className="bo-menuConfigSection bo-menuConfigSection--seo" data-testid={`${t}-panel`} data-coordination-id={coordinationId}>
      <div className="bo-menuConfigSectionHead" data-testid={`${t}-head`}>
        <div data-testid={`${t}-head-copy`}>
          <h2 className="bo-panelTitle" data-testid={`${t}-title`}>{heading}</h2>
          <p className="bo-panelMeta" data-testid={`${t}-help`}>Configura los textos de búsqueda. Los cambios se guardan por separado del contenido.</p>
        </div>
      </div>
      <div className="bo-menuConfigSectionBody bo-form" data-testid={`${t}-body`}>
        {fixedPath ? (
          <p className="bo-panelMeta" data-testid={`${t}-url-preview`}>URL pública: {fixedPath}</p>
        ) : (
          <div className="bo-field bo-field--full" data-testid={`${t}-slug-field`}>
            <label className="bo-label" htmlFor={`${t}-slug`} data-testid={`${t}-slug-label`}>Nombre de ruta (slug)</label>
            <AutosaveInput id={`${t}-slug`} className="bo-input" value={draft.seo_slug} disabled={!ready || loading} onChange={(event) => setDraft({ ...draft, seo_slug: event.target.value })} placeholder="menu-arrocero" data-testid={`${t}-slug-input`} />
            <p className="bo-panelMeta" data-testid={`${t}-url-preview`}>{draft.seo_slug ? `URL pública: /menu/${draft.seo_slug}` : "Sin slug se conserva la URL actual con el ID del menú."}</p>
          </div>
        )}
        <button className="bo-btn bo-btn--ghost bo-btn--sm" type="button" disabled={!ready || !title.trim() || loading} onClick={generate} data-testid={`${t}-generate`}>Generar propuesta desde el título</button>
        {FIELDS.map((field) => (
          <div className="bo-field bo-field--full" key={field.key} data-testid={`${t}-field-${field.key}`}>
            <label className="bo-label" htmlFor={`${t}-${field.key}`} data-testid={`${t}-label-${field.key}`}>{field.label}</label>
            <AutosaveInput id={`${t}-${field.key}`} className={field.multiline ? "bo-input bo-textarea" : "bo-input"} multiline={field.multiline} rows={field.multiline ? (field.key.startsWith("seo_faq") || field.key.startsWith("seo_intro") ? 6 : 3) : undefined} value={draft[field.key] || ""} disabled={!ready || loading} onChange={(event) => setDraft({ ...draft, [field.key]: event.target.value })} data-testid={`${t}-input-${field.key}`} />
          </div>
        ))}
        <div className="bo-menuWizardActions" data-testid={`${t}-actions`}>
          <button className="bo-btn bo-btn--primary" type="button" disabled={!ready || loading || saving} onClick={() => void onSave()} data-testid={`${t}-save`}>{saving ? "Guardando SEO…" : "Guardar SEO"}</button>
        </div>
        <p className="bo-panelMeta" role="status" aria-live="polite" data-testid={`${t}-status`}>{status}</p>
      </div>
    </section>
  );
}

// Coordination id: menu_public_seo_v1 (BO settings -> menus -> public metadata)
export function MenuPublicSEOSettings({ menuId, title }: { menuId: number | null; title: string }) {
  const api = useMemo(() => createClient({ baseUrl: "" }), []);
  const load = useCallback(async () => {
    const result = await api.menus.gruposV2.get(menuId as number);
    if (!result.success) return { ok: false, message: result.message };
    return { ok: true, seo: result.menu as Partial<MenuPublicSEO> };
  }, [api, menuId]);
  const save = useCallback(async (seo: MenuPublicSEO) => {
    const result = await api.menus.gruposV2.patchSEO(menuId as number, seo);
    return result.success ? { ok: true, seo_slug: result.seo_slug } : { ok: false, message: result.message };
  }, [api, menuId]);
  return (
    <PublicSEOForm
      ready={Boolean(menuId)}
      title={title}
      load={load}
      save={save}
      heading="SEO de la página del menú"
      testPrefix="menu-public-seo"
      coordinationId="menu_public_seo_v1"
    />
  );
}
