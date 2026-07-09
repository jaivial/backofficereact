import React, { useEffect, useMemo } from "react";
import { Sparkles, KeyRound, Save } from "lucide-react";

import { SearchableSelect } from "../../../../../ui/inputs/SearchableSelect";
import { Switch } from "../../../../../ui/shadcn/Switch";
import { useToasts } from "../../../../../ui/feedback/useToasts";
import { useAIImageConfig } from "./hooks/useAIImageConfig";

export function ConfigAIImage() {
  const { pushToast } = useToasts();
  const {
    config, providers, models, apiKeyInput, setApiKeyInput, setField, load, save, loaded, saving,
  } = useAIImageConfig();

  useEffect(() => { void load(); }, [load]);

  const providerOptions = useMemo(
    () => providers.map((p) => ({ value: p.slug, label: p.label })),
    [providers],
  );
  const t2iOptions = useMemo(
    () => models.filter((m) => m.providerSlug === config.providerSlug && m.mode === "t2i").map((m) => ({ value: m.slug, label: m.label })),
    [models, config.providerSlug],
  );
  const i2iOptions = useMemo(
    () => models.filter((m) => m.providerSlug === config.providerSlug && m.mode === "i2i").map((m) => ({ value: m.slug, label: m.label })),
    [models, config.providerSlug],
  );

  const hasProvider = !!config.providerSlug;
  // Show the model selectors once a key exists (stored) or a new one is being typed.
  const keyReady = config.hasApiKey || apiKeyInput.trim().length > 0;

  const onSave = async () => {
    const ok = await save();
    pushToast(ok
      ? { kind: "success", title: "Configuracion IA guardada" }
      : { kind: "error", title: "Error", message: "No se pudo guardar la configuracion" });
  };

  if (!loaded) {
    return <div className="bo-panel p-6 text-sm text-[var(--bo-muted)]" data-slot="config-ai-loading">Cargando configuracion...</div>;
  }

  return (
    <div className="bo-panel" data-ui="config-ai-image" data-testid="config-ai-image">
      <div className="bo-panelHead flex-col items-stretch gap-1">
        <div className="bo-panelTitle flex items-center gap-2">
          <Sparkles size={18} className="text-[var(--bo-accent)]" aria-hidden="true" />
          Generacion de imagenes con IA
        </div>
        <div className="bo-panelMeta">Configura el proveedor y los modelos usados para generar imagenes de la carta.</div>
      </div>

      <div className="bo-panelBody flex flex-col gap-5">
        {/* Provider */}
        <label className="bo-field" data-slot="config-ai-provider-field">
          <span className="bo-label">Proveedor</span>
          <SearchableSelect
            value={config.providerSlug}
            onChange={(v) => setField("providerSlug", v)}
            options={providerOptions}
            ariaLabel="Proveedor de IA"
            placeholder="Selecciona un proveedor"
            searchPlaceholder="Buscar proveedor..."
            emptyText="Sin proveedores"
            data-testid="config-ai-provider-select"
          />
        </label>

        {/* API key — appears once a provider is selected */}
        {hasProvider ? (
          <label className="bo-field" data-slot="config-ai-apikey-field">
            <span className="bo-label flex items-center gap-2">
              <KeyRound size={14} className="text-[var(--bo-muted)]" aria-hidden="true" />
              API key
            </span>
            <input
              type="password"
              autoComplete="off"
              className="bo-input"
              value={apiKeyInput}
              onChange={(e) => setApiKeyInput(e.target.value)}
              placeholder={config.hasApiKey ? `Guardada (${config.apiKeyMask}) — pega una nueva para cambiarla` : "Pega tu API key"}
              disabled={saving}
              data-role="config-ai-apikey-input"
            />
          </label>
        ) : null}

        {/* Model selectors — appear once a key is set/typed */}
        {hasProvider && keyReady ? (
          <>
            <label className="bo-field" data-slot="config-ai-t2i-field">
              <span className="bo-label">Modelo Texto a Imagen</span>
              <SearchableSelect
                value={config.t2iModelSlug || ""}
                onChange={(v) => setField("t2iModelSlug", v)}
                options={t2iOptions}
                ariaLabel="Modelo texto a imagen"
                placeholder="Selecciona un modelo"
                searchPlaceholder="Buscar modelo..."
                data-testid="config-ai-t2i-select"
              />
            </label>

            <label className="bo-field" data-slot="config-ai-i2i-field">
              <span className="bo-label">Modelo Imagen a Imagen</span>
              <SearchableSelect
                value={config.i2iModelSlug || ""}
                onChange={(v) => setField("i2iModelSlug", v)}
                options={i2iOptions}
                ariaLabel="Modelo imagen a imagen"
                placeholder="Selecciona un modelo"
                searchPlaceholder="Buscar modelo..."
                data-testid="config-ai-i2i-select"
              />
            </label>

            <div className="bo-foodDetailQuickStatus" data-slot="config-ai-active-field">
              <span className="bo-label">Activar generacion con IA</span>
              <Switch
                checked={config.isActive}
                onCheckedChange={(v) => setField("isActive", v)}
                disabled={saving}
                aria-label="Activar generacion con IA"
              />
            </div>
          </>
        ) : null}
      </div>

      <div className="bo-foodDetailEditorActions" data-slot="config-ai-actions">
        <button
          type="button"
          className="bo-btn bo-btn--primary gap-2"
          onClick={() => void onSave()}
          disabled={saving}
          data-role="config-ai-save-btn"
        >
          <Save size={14} />
          {saving ? "Guardando..." : "Guardar"}
        </button>
      </div>
    </div>
  );
}
