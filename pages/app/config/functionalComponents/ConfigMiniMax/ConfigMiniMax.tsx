import React, { useEffect } from "react";
import { Bot, Save } from "lucide-react";

import { SearchableSelect } from "../../../../../ui/inputs/SearchableSelect";
import { useToasts } from "../../../../../ui/feedback/useToasts";
import { useMiniMaxConfig } from "./hooks/useMiniMaxConfig";

const MINIMAX_MODELS = [
  { value: "MiniMax-M3", label: "MiniMax-M3" },
  { value: "MiniMax-M2", label: "MiniMax-M2" },
  { value: "MiniMax-Text-01", label: "MiniMax-Text-01" },
];

export function ConfigMiniMax() {
  const { config, apiKey, setApiKey, setModel, load, save, loaded, saving } = useMiniMaxConfig();
  const { pushToast } = useToasts();

  useEffect(() => { void load(); }, [load]);

  const onSave = async () => {
    const res = await save();
    pushToast(res.ok
      ? { kind: "success", title: "Configuracion de MiniMax guardada" }
      : { kind: "error", title: "Error", message: res.message || "No se pudo guardar la configuracion" });
  };

  if (!loaded) {
    return <div className="bo-panel p-6 text-sm text-[var(--bo-muted)]" data-slot="config-minimax-loading">Cargando configuracion...</div>;
  }

  return (
    <div className="bo-panel" data-ui="config-minimax" data-testid="config-minimax">
      <div className="bo-panelHead flex-col items-stretch gap-1">
        <div className="bo-panelTitle flex items-center gap-2">
          <Bot size={18} className="text-[var(--bo-accent)]" aria-hidden="true" />
          MiniMax (IA)
        </div>
        <div className="bo-panelMeta">
          Clave de API y modelo de MiniMax de este restaurante. Se usan para ForKy (asistente IA), las
          traducciones de la carta y las funciones de IA de stock. La clave se guarda cifrada (AES-256-GCM)
          en la base de datos y no se vuelve a mostrar.
        </div>
      </div>

      <div className="bo-panelBody flex flex-col gap-5">
        <div className="bo-field" data-slot="config-minimax-key-field">
          <span className="bo-label flex items-center gap-1.5">
            <label htmlFor="minimax-key">API Key</label>
          </span>
          <input
            type="password"
            autoComplete="off"
            className="bo-input"
            id="minimax-key"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={config.hasApiKey ? "Clave guardada — escribe una nueva para cambiarla" : "Pega la API key de MiniMax"}
            disabled={saving}
            data-testid="config-minimax-key-input"
          />
        </div>

        <div className="bo-field" data-slot="config-minimax-model-field">
          <span className="bo-label">
            <label id="minimax-model-label">Modelo</label>
          </span>
          <SearchableSelect
            value={config.model || MINIMAX_MODELS[0].value}
            onChange={(v) => setModel(v || MINIMAX_MODELS[0].value)}
            options={MINIMAX_MODELS}
            ariaLabel="Modelo de MiniMax"
            searchPlaceholder="Buscar modelo..."
            data-testid="config-minimax-model-select"
            disabled={saving}
          />
        </div>

        <div className="bo-foodDetailQuickStatus" data-slot="config-minimax-status-field">
          <span className="bo-label">
            {config.hasApiKey ? "Clave guardada en este restaurante" : "Sin clave propia: se usara la global del servidor (si existe)"}
          </span>
        </div>
      </div>

      <div className="bo-foodDetailEditorActions" data-slot="config-minimax-actions">
        <button
          type="button"
          className="bo-btn bo-btn--primary gap-2"
          onClick={() => void onSave()}
          disabled={saving}
          data-testid="config-minimax-save-btn"
        >
          <Save size={14} />
          {saving ? "Guardando..." : "Guardar"}
        </button>
      </div>
    </div>
  );
}