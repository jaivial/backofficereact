import React, { useCallback, useMemo, useState } from "react";
import { usePageContext } from "vike-react/usePageContext";
import { Check, Globe, Loader2, Palette, Search, Sparkles, ExternalLink } from "lucide-react";

import { createClient } from "../../../api/client";
import { useToasts } from "../../../ui/feedback/useToasts";
import { useErrorToast } from "../../../ui/feedback/useErrorToast";
import { Button } from "../../../ui/actions/Button";
import type { Data } from "./+data";

type WebsiteConfig = NonNullable<Data["config"]>;

type TabKey = "templates" | "ai" | "domain";

const WEBSITE_THEMES = [
  { id: "villa-carmen", name: "Villa Carmen", description: "Clasico y elegante" },
  { id: "lumen-gold", name: "Lumen Gold", description: "Lujoso y moderno" },
  { id: "terra-olive", name: "Terra Olive", description: "Rustico y calido" },
  { id: "nocturne-copper", name: "Nocturne Copper", description: "Oscuro y sofisticado" },
  { id: "sea-breeze", name: "Sea Breeze", description: "Fresco y marino" },
];

export default function WebsiteBuilderPage() {
  const pageContext = usePageContext();
  const { addToast } = useToasts();
  const { handleError } = useErrorToast();
  const client = useMemo(() => createClient(), []);

  const data = (pageContext.data ?? { config: null, error: null }) as { config: WebsiteConfig | null; error: string | null };
  useErrorToast(data.error ?? null);

  const [config, setConfig] = useState<WebsiteConfig | null>(data.config);
  const [activeTab, setActiveTab] = useState<TabKey>("templates");
  const [prompt, setPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [domainQuery, setDomainQuery] = useState("");
  const [domainResult, setDomainResult] = useState<{ domain: string; available: boolean; marked_price: number; currency: string } | null>(null);
  const [searchingDomain, setSearchingDomain] = useState(false);
  const [registeringDomain, setRegisteringDomain] = useState(false);

  const loading = !data.config && !data.error;

  const handleSave = useCallback(
    async (updates: Partial<WebsiteConfig>) => {
      try {
        setSaving(true);
        const res = await client.request<{ success: boolean }>("/admin/website", {
          method: "PUT",
          body: JSON.stringify(updates),
        });
        if (res.success) {
          addToast({ title: "Guardado", description: "Configuracion actualizada correctamente" });
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
                }
          );
        }
      } catch (err) {
        handleError(err);
      } finally {
        setSaving(false);
      }
    },
    [client, addToast, handleError]
  );

  const handleAIGenerate = useCallback(async () => {
    if (!prompt.trim()) return;
    try {
      setGenerating(true);
      const res = await client.request<{ success: boolean; custom_html: string }>("/admin/website/ai-generate", {
        method: "POST",
        body: JSON.stringify({ prompt }),
      });
      if (res.success) {
        await handleSave({ custom_html: res.custom_html, template_id: null });
        setPrompt("");
      }
    } catch (err) {
      handleError(err);
    } finally {
      setGenerating(false);
    }
  }, [client, prompt, handleSave, handleError]);

  const handleSearchDomain = useCallback(async () => {
    if (!domainQuery.trim()) return;
    try {
      setSearchingDomain(true);
      setDomainResult(null);
      const res = await client.request<{ success: boolean; data: any }>(`/admin/domains/search?query=${encodeURIComponent(domainQuery.trim())}`, {
        method: "GET",
      });
      if (res.success && res.data) {
        setDomainResult(res.data);
      }
    } catch (err) {
      handleError(err);
    } finally {
      setSearchingDomain(false);
    }
  }, [client, domainQuery, handleError]);

  const handleRegisterDomain = useCallback(async () => {
    if (!domainResult || !domainResult.available) return;
    if (!confirm(`¿Estas seguro de registrar ${domainResult.domain} por ${domainResult.marked_price} ${domainResult.currency} / ano? Se generara un cargo recurrente anual.`)) return;

    try {
      setRegisteringDomain(true);
      const res = await client.request<{ success: boolean; message: string }>("/admin/domains/register", {
        method: "POST",
        body: JSON.stringify({ domain: domainResult.domain, price: domainResult.marked_price }),
      });
      if (res.success) {
        addToast({ title: "Registrado", description: res.message });
        setConfig((prev) => (prev ? { ...prev, domain: domainResult.domain } : null));
        setDomainResult(null);
        setDomainQuery("");
      }
    } catch (err) {
      handleError(err);
    } finally {
      setRegisteringDomain(false);
    }
  }, [client, domainResult, addToast, handleError]);

  const handleTogglePublished = useCallback(() => {
    if (!config) return;
    handleSave({ is_published: !config.is_published });
  }, [config, handleSave]);

  const tabs = useMemo<{ key: TabKey; label: string; icon: React.ReactNode }[]>(
    () => [
      { key: "templates", label: "Plantillas", icon: <Palette size={16} /> },
      { key: "ai", label: "Constructor IA", icon: <Sparkles size={16} /> },
      { key: "domain", label: "Dominio", icon: <Globe size={16} /> },
    ],
    []
  );

  const previewUrl = useMemo(() => {
    if (!config?.template_id) return null;
    return `/preview-web?theme=${config.template_id}`;
  }, [config?.template_id]);

  if (loading) {
    return (
      <div className="p-6" data-ui="website-loading">
        <div className="rounded-lg bg-card shadow-soft">
          <div className="p-4">
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="animate-spin h-4 w-4" size={24} />
              <span className="ml-2">Cargando configuracion...</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6" data-ui="website-builder">
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 text-foreground">
            <Globe size={24} />
            <h1 className="text-xl font-semibold">Website Builder</h1>
          </div>
          <p className="text-muted-foreground mt-1">Crea y publica la web de tu restaurante</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant={config?.is_published ? "success" : "secondary"} type="button" onClick={handleTogglePublished} disabled={saving}>
            {config?.is_published ? "Publicado" : "Borrador"}
          </Button>
          {previewUrl && (
            <a className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-white/[0.09] bg-card-2 text-foreground text-sm font-bold transition-all hover:border-primary hover:bg-card-2/80 disabled:opacity-55 disabled:cursor-not-allowed" href={previewUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink size={16} />
              <span>Vista previa</span>
            </a>
          )}
        </div>
      </div>

      <div className="flex gap-1 p-1 bg-card-3 rounded-lg mb-6" role="tablist">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.key}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab.key 
                ? "bg-card text-foreground shadow-sm" 
                : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {activeTab === "templates" && (
        <section className="mb-6" aria-label="Plantillas premium">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {WEBSITE_THEMES.map((theme) => {
              const isSelected = config?.template_id === theme.id;
              return (
                <button
                  key={theme.id}
                  type="button"
                  className={`relative text-left p-3 rounded-lg border transition-all ${
                    isSelected 
                      ? "border-accent bg-accent/10" 
                      : "border hover:border-2"
                  }`}
                  onClick={() => handleSave({ template_id: theme.id, custom_html: null })}
                  disabled={saving}
                >
                  <div className="h-24 rounded bg-card-2 mb-3 overflow-hidden">
                    <div className="w-full h-full" data-theme-id={theme.id} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-foreground truncate">{theme.name}</div>
                    <div className="text-sm text-muted-foreground truncate">{theme.description}</div>
                  </div>
                  {isSelected && (
                    <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-accent flex items-center justify-center">
                      <Check size={14} className="text-background" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </section>
      )}

      {activeTab === "ai" && (
        <section className="mb-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-lg bg-card shadow-soft p-4">
            <div className="flex items-end justify-between pb-2">
              <div className="text-sm font-bold text-foreground">Generar con IA</div>
              <div className="text-xs text-muted-foreground">Describe tu sitio ideal</div>
            </div>
            <div className="flex flex-col gap-4">
              <p className="text-muted-foreground text-sm">Describe como quieres que se vea tu sitio web. Nuestra IA creara el codigo HTML/CSS por ti, integrando tus menus y horarios automaticamente.</p>
              <label className="grid gap-2">
                <textarea
                  className="w-full min-h-[120px] rounded-md border border bg-card-2 text-foreground p-3 outline-none focus:border-accent resize-none"
                  placeholder="Ej: Quiero una web moderna con fondo oscuro y detalles en dorado. Usa una tipografia elegante y muestra mi menu de arroces en la pagina principal..."
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  rows={6}
                />
              </label>
              <div className="flex justify-end">
                <Button variant="primary" type="button" onClick={handleAIGenerate} disabled={!prompt.trim() || generating}>
                  {generating ? (
                    <>
                      <Loader2 size={16} className="animate-spin h-4 w-4" />
                      <span>Generando...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles size={16} />
                      <span>Generar Web</span>
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>

          <div className="rounded-lg bg-card shadow-soft p-4">
            <div className="flex items-end justify-between pb-2">
              <div className="text-sm font-bold text-foreground">Vista previa</div>
              <div className="text-xs text-muted-foreground">HTML personalizado</div>
            </div>
            <div className="min-h-[200px] p-4 bg-card-2 rounded-md overflow-auto">
              {config?.custom_html ? (
                <div dangerouslySetInnerHTML={{ __html: config.custom_html }} />
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground text-center gap-3">
                  <p className="text-muted-foreground">No hay HTML generado aun</p>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {activeTab === "domain" && (
        <section className="mb-6" aria-label="Dominio personalizado">
          <div className="rounded-lg bg-card shadow-soft p-4 max-w-2xl">
            <div className="flex items-end justify-between pb-2">
              <div className="text-sm font-bold text-foreground">Dominio personalizado</div>
              <div className="text-xs text-muted-foreground">Registra un dominio para tu sitio</div>
            </div>
            <div className="flex flex-col gap-4 p-4 pt-0">
              {config?.domain ? (
                <div className="flex flex-col gap-2">
                  <p className="text-sm text-muted-foreground">Dominio activo</p>
                  <div className="font-semibold text-foreground text-lg">{config.domain}</div>
                </div>
              ) : (
                <p className="text-muted-foreground">Busca y registra un dominio para tu sitio web. El pago se añadira a tu facturacion anual.</p>
              )}

              <div className="flex gap-2">
                <input
                  type="text"
                  className="h-10 rounded-md border border bg-white/5 text-foreground px-3 outline-none flex-1 transition-colors focus:border-accent"
                  placeholder="Ej: mirestaurante.com"
                  value={domainQuery}
                  onChange={(e) => setDomainQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearchDomain()}
                />
                <Button variant="primary" type="button" onClick={handleSearchDomain} disabled={searchingDomain || !domainQuery.trim()}>
                  {searchingDomain ? (
                    <>
                      <Loader2 size={16} className="animate-spin h-4 w-4" />
                      <span>Buscando...</span>
                    </>
                  ) : (
                    <>
                      <Search size={16} />
                      <span>Buscar</span>
                    </>
                  )}
                </Button>
              </div>

              {domainResult && (
                <div className="flex flex-col gap-3 p-4 bg-card-2 rounded-md">
                  <div className="flex items-center justify-between">
                    <div className="font-semibold text-foreground">{domainResult.domain}</div>
                    {domainResult.available ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/16 text-green-500 border border-green-500/30">Disponible</span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-500/16 text-red-500 border border-red-500/30">No disponible</span>
                    )}
                  </div>
                  {domainResult.available && (
                    <div className="flex items-center justify-between">
                      <div className="text-muted-foreground">
                        {domainResult.marked_price.toFixed(2)} {domainResult.currency}
                        <span className="text-muted-foreground"> / ano</span>
                      </div>
                      <Button variant="primary" type="button" onClick={handleRegisterDomain} disabled={registeringDomain}>
                        {registeringDomain ? (
                          <>
                            <Loader2 size={16} className="animate-spin h-4 w-4" />
                            <span>Registrando...</span>
                          </>
                        ) : (
                          <span>Registrar ahora</span>
                        )}
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
