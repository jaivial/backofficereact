import React, { useEffect, useMemo, useState } from "react";
import { BookOpen, Check, KeyRound, Plus, Route, Save, Trash2 } from "lucide-react";

import type { BORestaurant, BotKnowledgeChunk } from "../../../../../api/types";
import { SearchableSelect } from "../../../../../ui/inputs/SearchableSelect";
import { useToasts } from "../../../../../ui/feedback/useToasts";
import { useBotAIConfig } from "./hooks/useBotAIConfig";

// Coordination id: wa_bot_ai_providers_v1 / wa_bot_rag_fts_v1
// WhatsApp bot model routing (primary + automatic fallback), encrypted
// provider API keys (OpenCode Go, MiniMax, Jev) and the RAG knowledge chunks.

const KEY_PROVIDERS: { id: string; label: string; hint: string }[] = [
  { id: "opencode-go", label: "OpenCode Go", hint: "oc_sk_…" },
  { id: "minimax", label: "MiniMax (Coding Plan)", hint: "Clave de MiniMax" },
  { id: "jev", label: "Jev · TypeSafe AI", hint: "apikey_…" },
];

export function ConfigBotAI({ restaurants, activeRestaurantId }: { restaurants: BORestaurant[]; activeRestaurantId: number }) {
  const [restaurantId, setRestaurantId] = useState<number>(activeRestaurantId || restaurants[0]?.id || 0);
  const { config, apiKeys, setApiKey, setModel, setKnowledge, load, save, loading, saving } = useBotAIConfig(restaurantId);
  const { pushToast } = useToasts();

  useEffect(() => { void load(); }, [load]);

  const modelOptions = useMemo(
    () => (config?.providers ?? []).flatMap((p) => p.models.map((m) => ({ value: `${p.id}/${m}`, label: `${p.label} · ${m}` }))),
    [config?.providers],
  );
  const restaurantOptions = useMemo(() => restaurants.map((r) => ({ value: String(r.id), label: r.name })), [restaurants]);

  const onSave = async () => {
    const res = await save();
    pushToast(res.ok
      ? { kind: "success", title: "IA del bot de WhatsApp guardada" }
      : { kind: "error", title: "Error", message: res.message || "No se pudo guardar" });
  };

  const updateChunk = (index: number, patch: Partial<BotKnowledgeChunk>) => {
    if (!config) return;
    setKnowledge(config.knowledge.map((c, i) => (i === index ? { ...c, ...patch } : c)));
  };

  if (!config) {
    return <div className="bo-panel p-6 text-sm text-[var(--bo-muted)]" data-testid="config-bot-ai-loading">{loading ? "Cargando IA del bot..." : "Sin datos"}</div>;
  }

  return (
    <div className="bo-panel" data-ui="config-bot-ai" data-testid="config-bot-ai">
      <div className="bo-panelHead flex-col items-stretch gap-1" data-testid="config-bot-ai-head">
        <div className="bo-panelTitle flex items-center gap-2" data-testid="config-bot-ai-title">
          <Route size={18} strokeWidth={2} className="text-[var(--bo-accent)]" aria-hidden="true" />
          IA del bot de WhatsApp
        </div>
        <div className="bo-panelMeta" data-testid="config-bot-ai-meta">
          Modelo principal y de respaldo: si el principal falla, se queda sin tokens o alcanza su límite, el bot responde
          automáticamente con el de respaldo. Las claves se guardan cifradas (AES-256-GCM) y no se vuelven a mostrar.
        </div>
      </div>

      <div className="bo-panelBody flex flex-col gap-5" data-testid="config-bot-ai-body">
        {restaurants.length > 1 ? (
          <div className="bo-field" data-testid="config-bot-ai-restaurant-field">
            <span className="bo-label" data-testid="config-bot-ai-restaurant-label">Restaurante</span>
            <SearchableSelect value={String(restaurantId)} onChange={(v) => setRestaurantId(Number(v) || 0)} options={restaurantOptions}
              ariaLabel="Restaurante" searchPlaceholder="Buscar restaurante..." data-testid="config-bot-ai-restaurant-select" disabled={saving} />
          </div>
        ) : null}

        <div className="bo-botAIModels" data-testid="config-bot-ai-models">
          <div className="bo-field" data-testid="config-bot-ai-primary-field">
            <span className="bo-label" data-testid="config-bot-ai-primary-label">Modelo principal</span>
            <SearchableSelect value={config.primaryModel} onChange={(v) => v && setModel("primaryModel", v)} options={modelOptions}
              ariaLabel="Modelo principal del bot" searchPlaceholder="Buscar modelo..." data-testid="config-bot-ai-primary-select" disabled={saving} />
          </div>
          <div className="bo-field" data-testid="config-bot-ai-fallback-field">
            <span className="bo-label" data-testid="config-bot-ai-fallback-label">Modelo de respaldo</span>
            <SearchableSelect value={config.fallbackModel} onChange={(v) => v && setModel("fallbackModel", v)} options={modelOptions}
              ariaLabel="Modelo de respaldo del bot" searchPlaceholder="Buscar modelo..." data-testid="config-bot-ai-fallback-select" disabled={saving} />
          </div>
        </div>

        <div className="flex flex-col gap-3" data-testid="config-bot-ai-keys">
          <span className="bo-label flex items-center gap-1.5" data-testid="config-bot-ai-keys-label">
            <KeyRound size={14} strokeWidth={1.5} aria-hidden="true" /> Claves de API por proveedor
          </span>
          {KEY_PROVIDERS.map((p) => {
            const status = config.keys.find((k) => k.provider === p.id);
            const isSet = Boolean(status?.hasApiKey);
            return (
              <div key={p.id} className="bo-field" data-testid={`config-bot-ai-key-field-${p.id}`}>
                <span className="bo-botAIKeyLabel" data-testid={`config-bot-ai-key-label-${p.id}`}>
                  <label htmlFor={`bot-ai-key-${p.id}`} data-testid={`config-bot-ai-key-label-text-${p.id}`}>{p.label}</label>
                  <span className={`bo-botAIKeyStatus${isSet ? " is-set" : ""}`} data-testid={`config-bot-ai-key-status-${p.id}`} aria-live="polite">
                    {isSet ? <Check size={14} strokeWidth={2} aria-hidden="true" /> : null}
                    {isSet ? `Configurada ${status?.mask ?? ""}` : "Sin configurar"}
                  </span>
                </span>
                <input type="password" autoComplete="off" id={`bot-ai-key-${p.id}`}
                  className={`bo-input${isSet ? " bo-botAIKeyInput--set" : ""}`}
                  value={apiKeys[p.id] ?? ""} onChange={(e) => setApiKey(p.id, e.target.value)}
                  placeholder={isSet ? "Clave guardada — escribe una nueva para cambiarla" : p.hint}
                  disabled={saving} data-testid={`config-bot-ai-key-input-${p.id}`} />
              </div>
            );
          })}
        </div>

        <div className="flex flex-col gap-3" data-testid="config-bot-ai-knowledge">
          <div className="flex items-center justify-between gap-2" data-testid="config-bot-ai-knowledge-head">
            <span className="bo-label flex items-center gap-1.5" data-testid="config-bot-ai-knowledge-label">
              <BookOpen size={14} strokeWidth={1.5} aria-hidden="true" /> Base de conocimiento (RAG · SQLite FTS5)
            </span>
            <button type="button" className="bo-btn bo-btn--ghost gap-1.5 bo-pressable" disabled={saving}
              onClick={() => setKnowledge([...config.knowledge, { id: "", title: "", body: "", tags: [] }])}
              data-testid="config-bot-ai-knowledge-add-btn">
              <Plus size={14} strokeWidth={2} aria-hidden="true" /> Añadir regla
            </button>
          </div>
          <p className="bo-panelMeta" data-testid="config-bot-ai-knowledge-help">
            Cada regla se indexa y solo se envía al modelo cuando es relevante para el mensaje o su ruta del pipeline
            (etiquetas: rice, menu_policy, create_booking, modify_booking, cancel_booking, booking_status, availability,
            allergens, special_needs, extras, human, complaint, acknowledgement, greeting, info, always).
          </p>
          {config.knowledge.map((chunk, index) => (
            <div key={`${chunk.id}-${index}`} className="bo-botAIChunk" data-testid={`config-bot-ai-chunk-${index}`}>
              <div className="bo-botAIChunkRow" data-testid={`config-bot-ai-chunk-row-${index}`}>
                <input className="bo-input" value={chunk.title} placeholder="Título" aria-label="Título de la regla" disabled={saving}
                  onChange={(e) => updateChunk(index, { title: e.target.value })} data-testid={`config-bot-ai-chunk-title-${index}`} />
                <input className="bo-input" value={chunk.tags.join(", ")} placeholder="Etiquetas" aria-label="Etiquetas de la regla" disabled={saving}
                  onChange={(e) => updateChunk(index, { tags: e.target.value.split(",").map((t) => t.trim()).filter(Boolean) })}
                  data-testid={`config-bot-ai-chunk-tags-${index}`} />
                <button type="button" className="bo-btn bo-btn--ghost bo-pressable" aria-label="Eliminar regla" disabled={saving}
                  onClick={() => setKnowledge(config.knowledge.filter((_, i) => i !== index))} data-testid={`config-bot-ai-chunk-remove-${index}`}>
                  <Trash2 size={14} strokeWidth={1.5} aria-hidden="true" />
                </button>
              </div>
              <textarea className="bo-input bo-botAIChunkBody" rows={3} value={chunk.body} aria-label="Contenido de la regla" disabled={saving}
                onChange={(e) => updateChunk(index, { body: e.target.value })} data-testid={`config-bot-ai-chunk-body-${index}`} />
            </div>
          ))}
        </div>
      </div>

      <div className="bo-foodDetailEditorActions" data-testid="config-bot-ai-actions">
        <button type="button" className="bo-btn bo-btn--primary gap-2 bo-pressable" onClick={() => void onSave()} disabled={saving} data-testid="config-bot-ai-save-btn">
          <Save size={14} strokeWidth={2} aria-hidden="true" />
          {saving ? "Guardando..." : "Guardar"}
        </button>
      </div>
    </div>
  );
}
