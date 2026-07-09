import { useCallback, useMemo, useState } from "react";
import { createClient } from "../../../../../../api/client";
import type { AIImageConfig, AIImageModel, AIImageProvider } from "../../../../../../api/types";

function defaultConfig(): AIImageConfig {
  return {
    providerSlug: "wavespeed",
    hasApiKey: false,
    apiKeyMask: "",
    t2iModelSlug: "",
    i2iModelSlug: "",
    isActive: false,
  };
}

export type UseAIImageConfigReturn = {
  config: AIImageConfig;
  providers: AIImageProvider[];
  models: AIImageModel[];
  apiKeyInput: string;
  setApiKeyInput: (v: string) => void;
  setField: <K extends keyof AIImageConfig>(key: K, value: AIImageConfig[K]) => void;
  load: () => Promise<void>;
  save: () => Promise<boolean>;
  loaded: boolean;
  saving: boolean;
};

export function useAIImageConfig(): UseAIImageConfigReturn {
  const api = useMemo(() => createClient({ baseUrl: "" }), []);
  const [config, setConfig] = useState<AIImageConfig>(defaultConfig());
  const [providers, setProviders] = useState<AIImageProvider[]>([]);
  const [models, setModels] = useState<AIImageModel[]>([]);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  const setField = useCallback(<K extends keyof AIImageConfig>(key: K, value: AIImageConfig[K]) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  }, []);

  const load = useCallback(async () => {
    try {
      const [catalogRes, cfgRes] = await Promise.all([
        api.config.getAIImageProviders(),
        api.config.getAIImageConfig(),
      ]);
      if (catalogRes.success) {
        setProviders(catalogRes.providers || []);
        setModels(catalogRes.models || []);
      }
      if (cfgRes.success) {
        setConfig(cfgRes.config);
      }
    } catch {
      // keep defaults
    }
    setLoaded(true);
  }, [api.config]);

  const save = useCallback(async (): Promise<boolean> => {
    setSaving(true);
    try {
      const res = await api.config.setAIImageConfig({
        providerSlug: config.providerSlug,
        // Only send the key if the user typed a new one; blank keeps existing.
        apiKey: apiKeyInput.trim() ? apiKeyInput.trim() : undefined,
        t2iModelSlug: config.t2iModelSlug || "",
        i2iModelSlug: config.i2iModelSlug || "",
        isActive: config.isActive,
      });
      if (!res.success) return false;
      setConfig(res.config);
      setApiKeyInput("");
      return true;
    } catch {
      return false;
    } finally {
      setSaving(false);
    }
  }, [api.config, config, apiKeyInput]);

  return { config, providers, models, apiKeyInput, setApiKeyInput, setField, load, save, loaded, saving };
}
