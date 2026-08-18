import { useCallback, useMemo, useState } from "react";
import { createClient } from "../../../../../../api/client";
import type { BunnyStorageConfig } from "../../../../../../api/types";

function defaultConfig(): BunnyStorageConfig {
  return {
    storageZone: "",
    hasStorageKey: false,
    storageKeyMask: "",
    pullBaseUrl: "",
    isActive: false,
    usingEnvFallback: true,
  };
}

export type UseBunnyStorageConfigReturn = {
  config: BunnyStorageConfig;
  // The access key is write-only: the server never sends it back, so it lives
  // outside `config` and is only submitted when non-empty.
  storageKey: string;
  setStorageKey: (value: string) => void;
  setField: <K extends keyof BunnyStorageConfig>(key: K, value: BunnyStorageConfig[K]) => void;
  load: () => Promise<void>;
  save: () => Promise<{ ok: boolean; message?: string }>;
  loaded: boolean;
  saving: boolean;
};

export function useBunnyStorageConfig(): UseBunnyStorageConfigReturn {
  const api = useMemo(() => createClient({ baseUrl: "" }), []);
  const [config, setConfig] = useState<BunnyStorageConfig>(defaultConfig());
  const [storageKey, setStorageKey] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  const setField = useCallback(<K extends keyof BunnyStorageConfig>(key: K, value: BunnyStorageConfig[K]) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  }, []);

  const load = useCallback(async () => {
    try {
      const res = await api.config.getBunnyStorageConfig();
      if (res.success) setConfig(res.config);
    } catch {
      // keep defaults
    }
    setLoaded(true);
  }, [api.config]);

  const save = useCallback(async (): Promise<{ ok: boolean; message?: string }> => {
    setSaving(true);
    try {
      const res = await api.config.setBunnyStorageConfig({
        storageZone: config.storageZone || "",
        pullBaseUrl: config.pullBaseUrl || "",
        // Only send a key if the user typed one; blank keeps the stored value.
        storageKey: storageKey.trim() || undefined,
        isActive: config.isActive,
      });
      if (!res.success) return { ok: false, message: res.message };
      setConfig(res.config);
      setStorageKey("");
      return { ok: true };
    } catch {
      return { ok: false };
    } finally {
      setSaving(false);
    }
  }, [api.config, config, storageKey]);

  return { config, storageKey, setStorageKey, setField, load, save, loaded, saving };
}
