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
      <div className="bo-websitePage" data-ui="website-loading">
        <div className="rounded-bo-lg bg-bo-surface shadow-bo-soft">
          <div className="p-4">
            <div className="flex items-center justify-center py-8 text-bo-muted">
              <Loader2 className="animate-spin h-4 w-4" size={24} />
              <span className="text-mutedText">Cargando configuracion...</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bo-websitePage" data-ui="website-builder">
      <div className="bo-websiteHeader">
        <div className="bo-websiteHeaderMain">
          <div className="bo-websiteTitle">
            <Globe size={24} />
            <h1>Website Builder</h1>
          </div>
          <p className="bo-websiteSubtitle">Crea y publica la web de tu restaurante</p>
        </div>
        <div className="bo-websiteHeaderActions">
          <Button variant={config?.is_published ? "success" : "secondary"} type="button" onClick={handleTogglePublished} disabled={saving}>
            {config?.is_published ? "Publicado" : "Borrador"}
          </Button>
          {previewUrl && (
            <a className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-white/[0.09] bg-bo-surface-2 text-bo-text text-sm font-bold transition-all hover:border-bo-primary hover:bg-bo-surface-2/80 disabled:opacity-55 disabled:cursor-not-allowed" href={previewUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink size={16} />
              <span>Vista previa</span>
            </a>
          )}
        </div>
      </div>

      <div className="bo-websiteTabs" role="tablist">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.key}
            className={`bo-websiteTab${activeTab === tab.key ? " is-active" : ""}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {activeTab === "templates" && (
        <section className="bo-websiteSection" aria-label="Plantillas premium">
          <div className="bo-websiteTemplateGrid">
            {WEBSITE_THEMES.map((theme) => {
              const isSelected = config?.template_id === theme.id;
              return (
                <button
                  key={theme.id}
                  type="button"
                  className={`bo-websiteTemplateCard${isSelected ? " is-selected" : ""}`}
                  onClick={() => handleSave({ template_id: theme.id, custom_html: null })}
                  disabled={saving}
                >
                  <div className="bo-websiteTemplatePreview">
                    <div className="bo-websiteTemplatePreviewInner" data-theme-id={theme.id} />
                  </div>
                  <div className="bo-websiteTemplateInfo">
                    <div className="bo-websiteTemplateName">{theme.name}</div>
                    <div className="bo-websiteTemplateDesc">{theme.description}</div>
                  </div>
                  {isSelected && (
                    <div className="bo-websiteTemplateBadge">
                      <Check size={14} />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </section>
      )}

      {activeTab === "ai" && (
        <section className="bo-websiteSection" aria-label="Constructor con IA">
          <div className="bo-websiteAIGrid">
            <div className="rounded-bo-lg bg-bo-surface shadow-bo-soft">
              <div className="flex items-end justify-between pb-2 px-4 pt-4">
                <div className="text-bo-sm font-bold text-bo-text">Generar con IA</div>
                <div className="text-bo-xs text-bo-faint">Describe tu sitio ideal</div>
              </div>
              <div className="p-4">
                <div className="flex flex-col gap-bo-4 p-4">
                  <p className="text-mutedText">Describe como quieres que se vea tu sitio web. Nuestra IA creara el codigo HTML/CSS por ti, integrando tus menus y horarios automaticamente.</p>
                  <label className="grid gap-bo-2">
                    <textarea
                      className="bo-textarea bo-textarea--lg"
                      placeholder="Ej: Quiero una web moderna con fondo oscuro y detalles en dorado. Usa una tipografia elegante y muestra mi menu de arroces en la pagina principal..."
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      rows={6}
                    />
                  </label>
                  <div className="flex gap-bo-4 bo-row--right">
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
            </div>

            <div className="rounded-bo-lg bg-bo-surface shadow-bo-soft">
              <div className="flex items-end justify-between pb-2 px-4 pt-4">
                <div className="text-bo-sm font-bold text-bo-text">Vista previa</div>
                <div className="text-bo-xs text-bo-faint">HTML personalizado</div>
              </div>
              <div className="p-4">
                <div className="bo-websitePreviewFrame">
                  {config?.custom_html ? (
                    <div dangerouslySetInnerHTML={{ __html: config.custom_html }} />
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 px-4 text-bo-muted text-center gap-3">
                      <p className="text-mutedText">No hay HTML generado aun</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {activeTab === "domain" && (
        <section className="bo-websiteSection" aria-label="Dominio personalizado">
          <div className="rounded-bo-lg bg-bo-surface shadow-bo-soft bo-panel--lg">
            <div className="flex items-end justify-between pb-2 px-4 pt-4">
              <div className="text-bo-sm font-bold text-bo-text">Dominio personalizado</div>
              <div className="text-bo-xs text-bo-faint">Registra un dominio para tu sitio</div>
            </div>
            <div className="p-4">
              <div className="flex flex-col gap-bo-4 p-4">
                {config?.domain ? (
                  <div className="bo-websiteDomainActive">
                    <p className="bo-websiteDomainLabel">Dominio activo</p>
                    <div className="bo-websiteDomainName">{config.domain}</div>
                  </div>
                ) : (
                  <p className="text-mutedText">Busca y registra un dominio para tu sitio web. El pago se añadira a tu facturacion anual.</p>
                )}

                <div className="bo-websiteDomainSearch">
                  <input
                    type="text"
                    className="h-10 rounded-bo-md border border-bo-border bg-white/5 text-bo-text px-3 outline-none min-w-0 transition-colors"
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
                  <div className="bo-websiteDomainResult">
                    <div className="bo-websiteDomainResultMain">
                      <div className="bo-websiteDomainResultName">{domainResult.domain}</div>
                      {domainResult.available ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-bo-xs font-medium bo-badge--success">Disponible</span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-bo-xs font-medium bo-badge--danger">No disponible</span>
                      )}
                    </div>
                    {domainResult.available && (
                      <div className="bo-websiteDomainResultActions">
                        <div className="bo-websiteDomainPrice">
                          {domainResult.marked_price.toFixed(2)} {domainResult.currency}
                          <span className="text-mutedText"> / ano</span>
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
          </div>
        </section>
      )}
    </div>
  );
}
