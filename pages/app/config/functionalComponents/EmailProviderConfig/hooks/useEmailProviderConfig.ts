import { useCallback, useMemo, useState } from "react";
import { createClient } from "../../../../../../api/client";
import type { EmailProviderConfig } from "../../../../../../api/types";

function defaultConfig(): EmailProviderConfig {
  return {
    id: 0,
    provider: "smtp",
    smtpHost: "",
    smtpPort: 587,
    smtpUsername: "",
    smtpPassword: "",
    smtpFromEmail: "",
    smtpEncryption: "tls",
    gmailAppPassword: "",
    gmailFromEmail: "",
    isActive: false,
  };
}

type UseEmailProviderConfigReturn = {
  config: EmailProviderConfig;
  setField: <K extends keyof EmailProviderConfig>(key: K, value: EmailProviderConfig[K]) => void;
  save: () => Promise<boolean>;
  load: () => Promise<void>;
  saving: boolean;
  loaded: boolean;
};

export function useEmailProviderConfig(): UseEmailProviderConfigReturn {
  const api = useMemo(() => createClient({ baseUrl: "" }), []);
  const [config, setConfig] = useState<EmailProviderConfig>(defaultConfig());
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const setField = useCallback(<K extends keyof EmailProviderConfig>(key: K, value: EmailProviderConfig[K]) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  }, []);

  const load = useCallback(async () => {
    try {
      const res = await api.config.getEmailProviderConfig();
      if (res.success) {
        setConfig(res.config);
      }
    } catch {
      // use defaults
    }
    setLoaded(true);
  }, [api.config]);

  const save = useCallback(async (): Promise<boolean> => {
    setSaving(true);
    try {
      const res = await api.config.setEmailProviderConfig(config);
      if (!res.success) return false;
      setConfig(res.config);
      return true;
    } catch {
      return false;
    } finally {
      setSaving(false);
    }
  }, [api.config, config]);

  return { config, setField, save, load, saving, loaded };
}
