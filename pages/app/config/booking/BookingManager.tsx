import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useToasts } from "../../../../ui/feedback/useToasts";
import { useErrorToast } from "../../../../ui/feedback/useErrorToast";
import { InlineAlert } from "../../../../ui/feedback/InlineAlert";
import { InstallGuide } from "./InstallGuide";
import { WidgetPreview } from "./WidgetPreview";
import { ColorPicker } from "./ColorPicker";
import type { WidgetSettings } from "../../../../api/types";
import { createClient } from "../../../../api/client";

const DEFAULT_SETTINGS: WidgetSettings = {
  primary_color: "#7c3aed",
  success_color: "#16a34a",
  border_color: "#e5e7eb",
  surface_color: "#ffffff",
  text_color: "#1f2937",
  muted_color: "#6b7280",
  font_stack: "system-ui, -apple-system, sans-serif",
};

const DEBOUNCE_MS = 600;

function readAPIMessage(result: unknown, fallback: string): string {
  if (!result || typeof result !== "object") return fallback;
  if (!("message" in result)) return fallback;
  const message = (result as { message?: unknown }).message;
  if (typeof message !== "string") return fallback;
  return message.trim() || fallback;
}

export function BookingManager() {
  const api = useMemo(() => createClient({ baseUrl: "" }), []);
  const { pushToast } = useToasts();

  const [settings, setSettings] = useState<WidgetSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load current settings.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    api.widget.getSettings().then((res) => {
      if (cancelled) return;
      if (!("success" in res) || !res.success) {
        setError(readAPIMessage(res, "No se pudieron cargar los ajustes del widget"));
        return;
      }
      setSettings(res.settings ?? DEFAULT_SETTINGS);
    }).catch((e: Error) => {
      if (cancelled) return;
      setError(e.message || "Error cargando ajustes");
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [api]);

  const saveSettings = useCallback(async (patch: Partial<WidgetSettings>) => {
    setError(null);
    try {
      const res = await api.widget.updateSettings(patch);
      if (!("success" in res) || !res.success) {
        setError(readAPIMessage(res, "No se pudieron guardar los ajustes"));
        return;
      }
      pushToast({ kind: "success", title: "Guardado", message: "Ajustes del widget actualizados" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error guardando ajustes");
    }
  }, [api, pushToast]);

  const handleColorChange = useCallback((field: keyof WidgetSettings, value: string) => {
    const updated = { ...settings, [field]: value };
    setSettings(updated);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void saveSettings({ [field]: value });
    }, DEBOUNCE_MS);
  }, [settings, saveSettings]);

  useErrorToast(error);

  if (loading) {
    return <InlineAlert kind="info" title="Cargando" message="Cargando ajustes del widget..." />;
  }

  return (
    <div className="bo-stack" data-ui="booking-manager">
      <div className="bo-panel">
        <div className="bo-panelHead">
          <div className="bo-panelTitle">Booking Manager</div>
          <div className="bo-panelMeta">Widget de reservas embebible para webs de clientes</div>
        </div>
        <div className="bo-panelBody">
          <InstallGuide restaurantId="1" />
        </div>
      </div>

      <div className="bo-panel">
        <div className="bo-panelHead">
          <div className="bo-panelTitle">Vista previa</div>
          <div className="bo-panelMeta">Así se verá el widget en la web del cliente</div>
        </div>
        <div className="bo-panelBody">
          <WidgetPreview settings={settings} />
        </div>
      </div>

      <div className="bo-panel">
        <div className="bo-panelHead">
          <div className="bo-panelTitle">Personalización de colores</div>
          <div className="bo-panelMeta">Guardado automático al cambiar</div>
        </div>
        <div className="bo-panelBody">
          <div className="bo-widget-colors-grid" data-ui="colors-grid">
            <ColorPicker
              label="Color primario"
              value={settings.primary_color}
              onChange={(v) => handleColorChange("primary_color", v)}
            />
            <ColorPicker
              label="Color de éxito"
              value={settings.success_color}
              onChange={(v) => handleColorChange("success_color", v)}
            />
            <ColorPicker
              label="Color de borde"
              value={settings.border_color}
              onChange={(v) => handleColorChange("border_color", v)}
            />
            <ColorPicker
              label="Color de fondo"
              value={settings.surface_color}
              onChange={(v) => handleColorChange("surface_color", v)}
            />
            <ColorPicker
              label="Color de texto"
              value={settings.text_color}
              onChange={(v) => handleColorChange("text_color", v)}
            />
            <ColorPicker
              label="Color secundario"
              value={settings.muted_color}
              onChange={(v) => handleColorChange("muted_color", v)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
