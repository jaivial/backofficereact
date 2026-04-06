import { useCallback, useEffect, useState } from "react";
import { createClient } from "../../../../../api/client";
import { useErrorToast } from "../../../../../ui/feedback/useErrorToast";
import type { WebsiteConfig } from "../types";

export function useWebsiteLoader() {
  const client = createClient();
  const { handleError } = useErrorToast();

  const [config, setConfig] = useState<WebsiteConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [searchingDomain, setSearchingDomain] = useState(false);
  const [registeringDomain, setRegisteringDomain] = useState(false);

  const loadConfig = useCallback(async () => {
    try {
      setLoading(true);
      const res = await client.request<{ success: boolean; data: WebsiteConfig | null }>("/admin/website", {
        method: "GET",
      });
      if (res.success && res.data) {
        setConfig(res.data);
      }
    } catch (err) {
      handleError(err);
    } finally {
      setLoading(false);
    }
  }, [client, handleError]);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const updateConfig = useCallback((updates: Partial<WebsiteConfig>) => {
    setConfig((prev) =>
      prev
        ? { ...prev, ...updates }
        : {
            id: 0,
            restaurant_id: 0,
            template_id: null,
            custom_html: null,
            domain: null,
            is_published: false,
            ...updates,
          },
    );
  }, []);

  const saveConfig = useCallback(
    async (updates: Partial<WebsiteConfig>) => {
      try {
        setSaving(true);
        const res = await client.request<{ success: boolean }>("/admin/website", {
          method: "PUT",
          body: JSON.stringify(updates),
        });
        if (res.success) {
          updateConfig(updates);
        }
      } catch (err) {
        handleError(err);
      } finally {
        setSaving(false);
      }
    },
    [client, handleError, updateConfig],
  );

  const generateWithAI = useCallback(
    async (prompt: string) => {
      if (!prompt.trim()) return;
      try {
        setGenerating(true);
        const res = await client.request<{ success: boolean; custom_html: string }>("/admin/website/ai-generate", {
          method: "POST",
          body: JSON.stringify({ prompt }),
        });
        if (res.success) {
          await saveConfig({ custom_html: res.custom_html, template_id: null });
        }
      } catch (err) {
        handleError(err);
      } finally {
        setGenerating(false);
      }
    },
    [client, handleError, saveConfig],
  );

  const searchDomain = useCallback(
    async (query: string): Promise<unknown> => {
      if (!query.trim()) return null;
      try {
        const res = await client.request<{ success: boolean; data: unknown }>(
          `/admin/domains/search?query=${encodeURIComponent(query.trim())}`,
          { method: "GET" },
        );
        return res.success ? res.data : null;
      } catch (err) {
        handleError(err);
        return null;
      }
    },
    [client, handleError],
  );

  const registerDomain = useCallback(
    async (domain: string, price: number): Promise<string | null> => {
      try {
        setRegisteringDomain(true);
        const res = await client.request<{ success: boolean; message: string }>("/admin/domains/register", {
          method: "POST",
          body: JSON.stringify({ domain, price }),
        });
        if (res.success) {
          updateConfig({ domain });
          return res.message;
        }
        return null;
      } catch (err) {
        handleError(err);
        return null;
      } finally {
        setRegisteringDomain(false);
      }
    },
    [client, handleError, updateConfig],
  );

  const togglePublished = useCallback(() => {
    if (!config) return;
    saveConfig({ is_published: !config.is_published });
  }, [config, saveConfig]);

  return {
    config,
    loading,
    saving,
    generating,
    searchingDomain,
    registeringDomain,
    updateConfig,
    reload: loadConfig,
    saveConfig,
    generateWithAI,
    searchDomain,
    registerDomain,
    togglePublished,
  };
}
