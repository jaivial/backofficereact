import { useCallback, useMemo, useState } from "react";
import { createClient } from "../../../../../../api/client";
import type { MiniMaxConfig } from "../../../../../../api/types";

export const DEFAULT_MODEL = "MiniMax-M3";

function defaultConfig(): MiniMaxConfig {
  return { hasApiKey: false, model: DEFAULT_MODEL };
}

export type UseMiniMaxConfigReturn = {
  config: MiniMaxConfig;
  // Write-only: the server never sends the API key back, so it lives outside
  // `config` and is only submitted when non-empty.
  apiKey: string;
  setApiKey: (value: string) => void;
  setModel: (model: string) => void;
  load: () => Promise<void>;
  save: () => Promise<{ ok: boolean; message?: string }>;
  loaded: boolean;
  saving: boolean;
};

export function useMiniMaxConfig(): UseMiniMaxConfigReturn {
  const api = useMemo(() => createClient({ baseUrl: "" }), []);
  const [config, setConfig] = useState<MiniMaxConfig>(defaultConfig());
  const [apiKey, setApiKey] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.config.getMiniMaxConfig();
      if (res.success) setConfig(res.config);
    } catch {
      // keep defaults
    }
    setLoaded(true);
  }, [api.config]);

  const save = useCallback(async (): Promise<{ ok: boolean; message?: string }> => {
    setSaving(true);
    try {
      const res = await api.config.setMiniMaxConfig({
        // Only send a key if the user typed one; blank keeps the stored value.
        apiKey: apiKey.trim() || undefined,
        model: config.model,
      });
      if (!res.success) return { ok: false, message: res.message };
      setConfig(res.config);
      setApiKey("");
      return { ok: true };
    } catch {
      return { ok: false };
    } finally {
      setSaving(false);
    }
  }, [api.config, apiKey, config.model]);

  return { config, apiKey, setApiKey, setModel: (model) => setConfig((prev) => ({ ...prev, model })), load, save, loaded, saving };
}