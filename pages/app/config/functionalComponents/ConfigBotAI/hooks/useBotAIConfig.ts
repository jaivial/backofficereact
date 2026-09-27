import { useCallback, useMemo, useState } from "react";
import { createClient } from "../../../../../../api/client";
import type { BotAIConfig, BotKnowledgeChunk } from "../../../../../../api/types";

// Coordination id: wa_bot_ai_providers_v1 - API keys are write-only: the server
// only returns hasApiKey + a mask, typed keys live in `apiKeys` until saved.
export type UseBotAIConfigReturn = {
  config: BotAIConfig | null;
  apiKeys: Record<string, string>;
  setApiKey: (provider: string, value: string) => void;
  setModel: (slot: "primaryModel" | "fallbackModel", value: string) => void;
  setKnowledge: (next: BotKnowledgeChunk[]) => void;
  load: () => Promise<void>;
  save: () => Promise<{ ok: boolean; message?: string }>;
  loading: boolean;
  saving: boolean;
};

export function useBotAIConfig(restaurantId: number): UseBotAIConfigReturn {
  const api = useMemo(() => createClient({ baseUrl: "" }), []);
  const [config, setConfig] = useState<BotAIConfig | null>(null);
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!restaurantId) return;
    setLoading(true);
    try {
      const res = await api.config.getBotAIConfig(restaurantId);
      if (res.success) setConfig(res);
    } finally {
      setLoading(false);
    }
  }, [api.config, restaurantId]);

  const save = useCallback(async (): Promise<{ ok: boolean; message?: string }> => {
    if (!config) return { ok: false };
    setSaving(true);
    try {
      const res = await api.config.setBotAIConfig(restaurantId, {
        primaryModel: config.primaryModel,
        fallbackModel: config.fallbackModel,
        knowledge: config.knowledge,
        apiKeys: Object.fromEntries(Object.entries(apiKeys).filter(([, v]) => v.trim() !== "")),
      });
      if (!res.success) return { ok: false, message: res.message };
      setConfig(res);
      setApiKeys({});
      return { ok: true };
    } catch {
      return { ok: false };
    } finally {
      setSaving(false);
    }
  }, [api.config, apiKeys, config, restaurantId]);

  return {
    config,
    apiKeys,
    setApiKey: (provider, value) => setApiKeys((prev) => ({ ...prev, [provider]: value })),
    setModel: (slot, value) => setConfig((prev) => (prev ? { ...prev, [slot]: value } : prev)),
    setKnowledge: (next) => setConfig((prev) => (prev ? { ...prev, knowledge: next } : prev)),
    load,
    save,
    loading,
    saving,
  };
}
