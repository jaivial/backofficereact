import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bot, Eye, MapPin, Phone, RefreshCw, RotateCcw, Save, UtensilsCrossed } from "lucide-react";

import { createClient } from "../../../../../api/client";
import type { BORestaurant, BotRestaurantData, BotTenantConfig } from "../../../../../api/types";
import { SearchableSelect } from "../../../../../ui/inputs/SearchableSelect";
import { Switch } from "../../../../../ui/shadcn/Switch";
import { useToasts } from "../../../../../ui/feedback/useToasts";

const BOT_MODELS = [
  { value: "", label: "Por defecto del sistema" },
  { value: "MiniMax-M3", label: "MiniMax-M3" },
  { value: "MiniMax-M2", label: "MiniMax-M2" },
  { value: "MiniMax-Text-01", label: "MiniMax-Text-01" },
];

function emptyConfig(): BotTenantConfig {
  return {
    model: "",
    language_default: "es",
    tone: "cercano y profesional",
    greeting_style: "",
    disable_attachments: false,
    custom_instructions: "",
    contact_phone: "",
    rules: "",
  };
}

export function ConfigWhatsAppBot({ restaurants, activeRestaurantId }: { restaurants: BORestaurant[]; activeRestaurantId: number }) {
  const api = useMemo(() => createClient({ baseUrl: "" }), []);
  const { pushToast } = useToasts();

  const [restaurantId, setRestaurantId] = useState<number>(activeRestaurantId || restaurants[0]?.id || 0);
  const [config, setConfig] = useState<BotTenantConfig>(emptyConfig());
  const [promptPreview, setPromptPreview] = useState("");
  const [defaultModel, setDefaultModel] = useState("");
  const [defaultRules, setDefaultRules] = useState("");
  const [restaurantData, setRestaurantData] = useState<BotRestaurantData | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(true);
  const [dirty, setDirty] = useState(false);

  const restaurantOptions = useMemo(
    () => restaurants.map((r) => ({ value: String(r.id), label: `${r.name} (#${r.id})` })),
    [restaurants],
  );

  const load = useCallback(async (rid: number) => {
    if (!rid) return;
    setLoading(true);
    try {
      const res = await api.config.getBotSettings(rid);
      if (res.success) {
        const cfg = { ...emptyConfig(), ...res.config };
        // Rules textarea shows the effective rules: custom or defaults.
        if (!cfg.rules.trim()) cfg.rules = res.defaultRules || "";
        setConfig(cfg);
        setPromptPreview(res.promptPreview || "");
        setDefaultModel(res.defaultModel || "");
        setDefaultRules(res.defaultRules || "");
        setRestaurantData(res.restaurant || null);
        setDirty(false);
      } else {
        pushToast({ kind: "error", title: "Error", message: res.message || "No se pudo cargar la configuración del bot" });
      }
    } catch {
      pushToast({ kind: "error", title: "Error", message: "No se pudo cargar la configuración del bot" });
    } finally {
      setLoading(false);
    }
  }, [api.config, pushToast]);

  useEffect(() => { void load(restaurantId); }, [load, restaurantId]);

  const setField = useCallback(<K extends keyof BotTenantConfig>(key: K, value: BotTenantConfig[K]) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  }, []);

  // Live preview: debounce edits and re-render the prompt server-side
  // without saving. Skips the initial load (dirty=false).
  const previewSeq = useRef(0);
  useEffect(() => {
    if (!dirty || !restaurantId) return;
    const seq = ++previewSeq.current;
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const res = await api.config.previewBotSettings(restaurantId, config);
          if (res.success && seq === previewSeq.current) {
            setPromptPreview(res.promptPreview || "");
          }
        } catch {
          /* preview is best-effort */
        }
      })();
    }, 600);
    return () => clearTimeout(timer);
  }, [api.config, config, dirty, restaurantId]);

  const onSave = useCallback(async () => {
    if (!restaurantId) return;
    setSaving(true);
    try {
      const res = await api.config.saveBotSettings(restaurantId, config);
      if (res.success) {
        const cfg = { ...emptyConfig(), ...res.config };
        if (!cfg.rules.trim()) cfg.rules = res.defaultRules || defaultRules;
        setConfig(cfg);
        setPromptPreview(res.promptPreview || "");
        setRestaurantData(res.restaurant || null);
        setDirty(false);
        pushToast({ kind: "success", title: "Bot de WhatsApp", message: "Configuración guardada" });
      } else {
        pushToast({ kind: "error", title: "Error", message: res.message || "No se pudo guardar" });
      }
    } catch {
      pushToast({ kind: "error", title: "Error", message: "No se pudo guardar" });
    } finally {
      setSaving(false);
    }
  }, [api.config, config, defaultRules, pushToast, restaurantId]);

  const modelOptions = useMemo(() => {
    const base = BOT_MODELS.map((m) => (m.value === "" && defaultModel
      ? { value: "", label: `Por defecto del sistema (${defaultModel})` }
      : m));
    if (config.model && !base.some((m) => m.value === config.model)) {
      base.push({ value: config.model, label: config.model });
    }
    return base;
  }, [config.model, defaultModel]);

  return (
    <div className="bo-panel" data-ui="config-whatsapp-bot" data-testid="config-whatsapp-bot">
      <div className="bo-panelHead flex-col items-stretch gap-1">
        <div className="bo-panelTitle flex items-center gap-2">
          <Bot size={18} className="text-[var(--bo-accent)]" aria-hidden="true" />
          Bot de reservas por WhatsApp
        </div>
        <div className="bo-panelMeta">Configura el modelo LLM y la personalidad del bot para cada restaurante, y previsualiza su system prompt.</div>
      </div>

      <div className="bo-panelBody flex flex-col gap-5">
        {/* Restaurant selector */}
        <label className="bo-field" data-slot="config-bot-restaurant-field">
          <span className="bo-label">Restaurante</span>
          <SearchableSelect
            value={String(restaurantId || "")}
            onChange={(v) => setRestaurantId(Number(v) || 0)}
            options={restaurantOptions}
            ariaLabel="Restaurante"
            placeholder="Selecciona un restaurante"
            searchPlaceholder="Buscar restaurante..."
            emptyText="Sin restaurantes"
            data-testid="config-bot-restaurant-select"
          />
        </label>

        {loading ? (
          <div className="text-sm text-[var(--bo-muted)]" data-slot="config-bot-loading">Cargando configuración del bot...</div>
        ) : (
          <>
            {/* Live multi-tenant data feeding the prompt */}
            {restaurantData ? (
              <div
                className="rounded-lg border border-[var(--bo-border)] bg-[var(--bo-surface-2,var(--bo-surface))] p-4 text-xs flex flex-col gap-1.5"
                data-slot="config-bot-restaurant-data"
                data-testid="config-bot-restaurant-data"
              >
                <div className="font-semibold text-sm text-[var(--bo-text)]">{restaurantData.brandName || "Sin nombre"}</div>
                <div className="flex items-center gap-1.5 text-[var(--bo-muted)]">
                  <Phone size={12} aria-hidden="true" />
                  {restaurantData.phone || "Sin teléfono en Contacto"}
                </div>
                <div className="flex items-center gap-1.5 text-[var(--bo-muted)]">
                  <MapPin size={12} aria-hidden="true" />
                  {restaurantData.address || "Sin dirección en Contacto"}
                </div>
                <div className="flex items-center gap-1.5 text-[var(--bo-muted)]">
                  <UtensilsCrossed size={12} aria-hidden="true" />
                  {restaurantData.riceTypes?.length
                    ? `${restaurantData.riceTypes.length} arroces: ${restaurantData.riceTypes.join(", ")}`
                    : "Sin arroces configurados"}
                </div>
                {restaurantData.hours ? (
                  <div className="text-[var(--bo-muted)]">Horarios: {restaurantData.hours}</div>
                ) : null}
                {restaurantData.dailyLimit > 0 ? (
                  <div className="text-[var(--bo-muted)]">Límite diario: {restaurantData.dailyLimit} comensales</div>
                ) : null}
              </div>
            ) : null}

            {/* Model */}
            <label className="bo-field" data-slot="config-bot-model-field">
              <span className="bo-label">Modelo LLM</span>
              <SearchableSelect
                value={config.model}
                onChange={(v) => setField("model", v)}
                options={modelOptions}
                ariaLabel="Modelo LLM del bot"
                placeholder="Por defecto del sistema"
                searchPlaceholder="Buscar modelo..."
                data-testid="config-bot-model-select"
              />
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Language */}
              <label className="bo-field" data-slot="config-bot-language-field">
                <span className="bo-label">Idioma por defecto</span>
                <SearchableSelect
                  value={config.language_default}
                  onChange={(v) => setField("language_default", v)}
                  options={[{ value: "es", label: "Español" }, { value: "en", label: "English" }]}
                  ariaLabel="Idioma por defecto del bot"
                  data-testid="config-bot-language-select"
                />
              </label>

              {/* Tone */}
              <label className="bo-field" data-slot="config-bot-tone-field">
                <span className="bo-label">Tono</span>
                <input
                  className="bo-input"
                  value={config.tone}
                  onChange={(e) => setField("tone", e.target.value)}
                  placeholder="cercano y profesional"
                  disabled={saving}
                  data-role="config-bot-tone-input"
                />
              </label>
            </div>

            {/* Custom instructions */}
            <label className="bo-field" data-slot="config-bot-instructions-field">
              <span className="bo-label">Instrucciones personalizadas</span>
              <textarea
                className="bo-input min-h-24"
                value={config.custom_instructions}
                onChange={(e) => setField("custom_instructions", e.target.value)}
                placeholder="Reglas extra para este restaurante (opcional)"
                disabled={saving}
                rows={4}
                data-role="config-bot-instructions-input"
              />
            </label>

            {/* Contact phone — prefilled from restaurant_info.telefono */}
            <label className="bo-field" data-slot="config-bot-phone-field">
              <span className="bo-label">Teléfono de contacto del bot (prellenado desde Contacto)</span>
              <input
                className="bo-input"
                value={config.contact_phone}
                onChange={(e) => setField("contact_phone", e.target.value)}
                placeholder={restaurantData?.phone || "Ej. 961 234 567"}
                disabled={saving}
                data-role="config-bot-phone-input"
              />
            </label>

            {/* Editable critical rules */}
            <label className="bo-field" data-slot="config-bot-rules-field">
              <div className="flex items-center justify-between gap-2">
                <span className="bo-label">Reglas críticas del bot (editables por restaurante)</span>
                <button
                  type="button"
                  className="bo-btn bo-btn--ghost gap-1 text-xs"
                  onClick={() => setField("rules", defaultRules)}
                  disabled={saving || !defaultRules || config.rules === defaultRules}
                  data-role="config-bot-rules-reset-btn"
                >
                  <RotateCcw size={12} />
                  Restaurar por defecto
                </button>
              </div>
              <textarea
                className="bo-input min-h-48 font-mono text-xs leading-relaxed"
                value={config.rules}
                onChange={(e) => setField("rules", e.target.value)}
                disabled={saving}
                rows={11}
                data-role="config-bot-rules-input"
              />
              {config.rules.trim() && config.rules.trim() !== defaultRules.trim() ? (
                <span className="text-xs text-[var(--bo-warning,orange)]">Reglas personalizadas: este restaurante no recibirá mejoras futuras de las reglas por defecto.</span>
              ) : (
                <span className="text-xs text-[var(--bo-muted)]">Usando las reglas por defecto del sistema.</span>
              )}
            </label>

            {/* Attachments toggle */}
            <div className="bo-foodDetailQuickStatus" data-slot="config-bot-attachments-field">
              <span className="bo-label">Desactivar envío de adjuntos (imágenes, documentos, ubicación, contacto)</span>
              <Switch
                checked={config.disable_attachments}
                onCheckedChange={(v) => setField("disable_attachments", v)}
                disabled={saving}
                aria-label="Desactivar adjuntos del bot"
              />
            </div>

            {/* System prompt — full render with the dynamic multi-tenant data */}
            <div className="bo-field" data-slot="config-bot-preview-field">
              <div className="flex items-center justify-between gap-2">
                <span className="bo-label flex items-center gap-2">
                  <Eye size={14} className="text-[var(--bo-muted)]" aria-hidden="true" />
                  System prompt construido (datos dinámicos + reglas + personalización)
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="bo-btn bo-btn--ghost gap-1 text-xs"
                    onClick={() => void load(restaurantId)}
                    disabled={loading}
                    data-role="config-bot-preview-refresh-btn"
                  >
                    <RefreshCw size={12} />
                    Refrescar
                  </button>
                  <button
                    type="button"
                    className="bo-btn bo-btn--ghost gap-1 text-xs"
                    onClick={() => setShowPreview((v) => !v)}
                    data-role="config-bot-preview-toggle-btn"
                  >
                    {showPreview ? "Ocultar" : "Mostrar"}
                  </button>
                </div>
              </div>
              {showPreview ? (
                <>
                  <pre
                    className="mt-2 max-h-[32rem] overflow-auto whitespace-pre-wrap rounded-lg border border-[var(--bo-border)] bg-[var(--bo-surface-2,var(--bo-surface))] p-4 text-xs leading-relaxed text-[var(--bo-text)]"
                    data-testid="config-bot-prompt-preview"
                  >
                    {promptPreview || "Sin preview disponible."}
                  </pre>
                  <span className="text-xs text-[var(--bo-muted)]">
                    Este es el prompt exacto que recibe el LLM: se reconstruye en cada mensaje con los datos en vivo del restaurante (nombre, contacto, arroces, horarios, límite diario, fecha de hoy) más las reglas y personalización de arriba. Se actualiza en vivo mientras editas; recuerda guardar para aplicarlo.
                  </span>
                </>
              ) : null}
            </div>
          </>
        )}
      </div>

      <div className="bo-foodDetailEditorActions" data-slot="config-bot-actions">
        <button
          type="button"
          className="bo-btn bo-btn--primary gap-2"
          onClick={() => void onSave()}
          disabled={saving || loading || !restaurantId}
          data-role="config-bot-save-btn"
        >
          <Save size={14} />
          {saving ? "Guardando..." : "Guardar"}
        </button>
      </div>
    </div>
  );
}
