import { useCallback } from "react";
import { createClient } from "../../../../../api/client";
import { useToasts } from "../../../../../ui/feedback/useToasts";
import { useErrorToast } from "../../../../../ui/feedback/useErrorToast";
import type { WebsiteConfig } from "../types";

export function useWebsiteActions(config: WebsiteConfig | null, onConfigChange: (updates: Partial<WebsiteConfig>) => void) {
  const client = createClient();
  const { addToast } = useToasts();
  const { handleError } = useErrorToast();

  const handleSave = useCallback(
    async (updates: Partial<WebsiteConfig>) => {
      try {
        const res = await client.request<{ success: boolean }>("/admin/website", {
          method: "PUT",
          body: JSON.stringify(updates),
        });
        if (res.success) {
          addToast({ title: "Guardado", description: "Configuracion actualizada correctamente" });
          onConfigChange(updates);
        }
      } catch (err) {
        handleError(err);
      }
    },
    [client, addToast, handleError, onConfigChange],
  );

  const handleAIGenerate = useCallback(
    async (prompt: string) => {
      if (!prompt.trim()) return;
      try {
        const res = await client.request<{ success: boolean; custom_html: string }>("/admin/website/ai-generate", {
          method: "POST",
          body: JSON.stringify({ prompt }),
        });
        if (res.success) {
          await handleSave({ custom_html: res.custom_html, template_id: null });
        }
      } catch (err) {
        handleError(err);
      }
    },
    [client, handleSave, handleError],
  );

  const handleSearchDomain = useCallback(
    async (query: string) => {
      if (!query.trim()) return null;
      try {
        const res = await client.request<{ success: boolean; data: unknown }>(
          `/admin/domains/search?query=${encodeURIComponent(query.trim())}`,
          { method: "GET" },
        );
        if (res.success && res.data) {
          return res.data;
        }
      } catch (err) {
        handleError(err);
      }
      return null;
    },
    [client, handleError],
  );

  const handleRegisterDomain = useCallback(
    async (
      domainResult: { domain: string; available: boolean; marked_price: number; currency: string },
      setDomainResult: (result: null) => void,
      setDomainQuery: (query: string) => void,
    ) => {
      if (!domainResult.available) return;
      if (!confirm(`¿Estas seguro de registrar ${domainResult.domain} por ${domainResult.marked_price} ${domainResult.currency} / ano? Se generara un cargo recurrente anual.`)) return;
      try {
        const res = await client.request<{ success: boolean; message: string }>("/admin/domains/register", {
          method: "POST",
          body: JSON.stringify({ domain: domainResult.domain, price: domainResult.marked_price }),
        });
        if (res.success) {
          addToast({ title: "Registrado", description: res.message });
          onConfigChange({ domain: domainResult.domain });
          setDomainResult(null);
          setDomainQuery("");
        }
      } catch (err) {
        handleError(err);
      }
    },
    [client, addToast, handleError, onConfigChange],
  );

  const handleTogglePublished = useCallback(() => {
    if (!config) return;
    handleSave({ is_published: !config.is_published });
  }, [config, handleSave]);

  return { handleSave, handleAIGenerate, handleSearchDomain, handleRegisterDomain, handleTogglePublished };
}
