import React, { useEffect, useMemo, useState } from "react";
import { createClient } from "../../../../../api/client";
import type { MenuPublicSEO } from "../../../../../api/types";
import { AutosaveInput } from "../../../../../ui/inputs/AutosaveInput";

const EMPTY: MenuPublicSEO = {
  seo_slug: "", seo_title: "", seo_title_english: "", seo_description: "",
  seo_description_english: "", seo_h1: "", seo_h1_english: "",
};

const FIELDS: Array<{ key: keyof MenuPublicSEO; label: string; multiline?: boolean }> = [
  { key: "seo_title", label: "Title SEO" },
  { key: "seo_title_english", label: "Title SEO (English)" },
  { key: "seo_description", label: "Meta description", multiline: true },
  { key: "seo_description_english", label: "Meta description (English)", multiline: true },
  { key: "seo_h1", label: "H1 de la página" },
  { key: "seo_h1_english", label: "H1 de la página (English)" },
];

function slugify(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 120).replace(/-+$/g, "");
}

// Coordination id: menu_public_seo_v1 (BO settings -> menus -> public metadata)
export function MenuPublicSEOSettings({ menuId, title }: { menuId: number | null; title: string }) {
  const api = useMemo(() => createClient({ baseUrl: "" }), []);
  const [draft, setDraft] = useState<MenuPublicSEO>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    let cancelled = false;
    if (!menuId) { setDraft(EMPTY); return; }
    setLoading(true); setStatus("");
    void api.menus.gruposV2.get(menuId).then((result) => {
      if (cancelled) return;
      if (!result.success) { setStatus(result.message || "No se pudo cargar el SEO"); return; }
      setDraft({
        seo_slug: result.menu.seo_slug || "", seo_title: result.menu.seo_title || "",
        seo_title_english: result.menu.seo_title_english || "", seo_description: result.menu.seo_description || "",
        seo_description_english: result.menu.seo_description_english || "", seo_h1: result.menu.seo_h1 || "",
        seo_h1_english: result.menu.seo_h1_english || "",
      });
    }).catch((error: unknown) => { if (!cancelled) setStatus(error instanceof Error ? error.message : "No se pudo cargar el SEO"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [api, menuId]);

  const generate = () => {
    const cleanTitle = title.trim();
    setDraft((current) => ({
      ...current,
      seo_slug: current.seo_slug || slugify(cleanTitle),
      seo_title: current.seo_title || (cleanTitle ? `${cleanTitle} | Restaurante Villa Carmen` : ""),
      seo_description: current.seo_description || (cleanTitle ? `Descubre ${cleanTitle} en Restaurante Villa Carmen. Consulta los platos, la información y reserva tu experiencia.` : ""),
      seo_h1: current.seo_h1 || cleanTitle,
    }));
  };

  const save = async () => {
    if (!menuId) return;
    setSaving(true); setStatus("");
    try {
      const result = await api.menus.gruposV2.patchSEO(menuId, draft);
      if (!result.success) { setStatus(result.message || "No se pudo guardar el SEO"); return; }
      setDraft((current) => ({ ...current, seo_slug: result.seo_slug }));
      setStatus("SEO guardado. La API ya usa esta configuración; el HTML prerenderizado y el sitemap se actualizan en el siguiente despliegue del frontend.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "No se pudo guardar el SEO");
    } finally { setSaving(false); }
  };

  return (
    <section className="bo-panel" data-testid="menu-public-seo-panel" data-coordination-id="menu_public_seo_v1">
      <div className="bo-panelHead" data-testid="menu-public-seo-head">
        <div data-testid="menu-public-seo-head-copy">
          <h2 className="bo-panelTitle" data-testid="menu-public-seo-title">SEO de la página del menú</h2>
          <p className="bo-panelMeta" data-testid="menu-public-seo-help">Configura la URL y los textos de búsqueda. Los cambios se guardan por separado del contenido del menú.</p>
        </div>
      </div>
      <div className="bo-panelBody bo-form" data-testid="menu-public-seo-body">
        <div className="bo-field bo-field--full" data-testid="menu-public-seo-slug-field">
          <label className="bo-label" htmlFor="menu-public-seo-slug" data-testid="menu-public-seo-slug-label">Nombre de ruta (slug)</label>
          <AutosaveInput id="menu-public-seo-slug" className="bo-input" value={draft.seo_slug} disabled={!menuId || loading} onChange={(event) => setDraft({ ...draft, seo_slug: event.target.value })} placeholder="menu-arrocero" data-testid="menu-public-seo-slug-input" />
          <p className="bo-panelMeta" data-testid="menu-public-seo-url-preview">{draft.seo_slug ? `URL pública: /menu/${draft.seo_slug}` : "Sin slug se conserva la URL actual con el ID del menú."}</p>
        </div>
        <button className="bo-btn bo-btn--ghost bo-btn--sm" type="button" disabled={!menuId || !title.trim() || loading} onClick={generate} data-testid="menu-public-seo-generate">Generar propuesta desde el título</button>
        {FIELDS.map((field) => (
          <div className="bo-field bo-field--full" key={field.key} data-testid={`menu-public-seo-field-${field.key}`}>
            <label className="bo-label" htmlFor={`menu-public-seo-${field.key}`} data-testid={`menu-public-seo-label-${field.key}`}>{field.label}</label>
            <AutosaveInput id={`menu-public-seo-${field.key}`} className={field.multiline ? "bo-input bo-textarea" : "bo-input"} multiline={field.multiline} rows={field.multiline ? 3 : undefined} value={draft[field.key]} disabled={!menuId || loading} onChange={(event) => setDraft({ ...draft, [field.key]: event.target.value })} data-testid={`menu-public-seo-input-${field.key}`} />
          </div>
        ))}
        <div className="bo-menuWizardActions" data-testid="menu-public-seo-actions">
          <button className="bo-btn bo-btn--primary" type="button" disabled={!menuId || loading || saving} onClick={() => void save()} data-testid="menu-public-seo-save">{saving ? "Guardando SEO…" : "Guardar SEO"}</button>
        </div>
        <p className="bo-panelMeta" role="status" aria-live="polite" data-testid="menu-public-seo-status">{status}</p>
      </div>
    </section>
  );
}
