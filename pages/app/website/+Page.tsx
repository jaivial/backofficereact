import React, { useCallback, useEffect, useMemo, useState } from "react";
import { usePageContext } from "vike-react/usePageContext";
import { Check, Globe, Loader2, Palette, Search, Sparkles, ExternalLink } from "lucide-react";

import { createClient } from "../../../api/client";
import { useToasts } from "../../../ui/feedback/useToasts";
import { useErrorToast } from "../../../ui/feedback/useErrorToast";
import { Panel } from "../../../ui/shell/Panel";

interface WebsiteConfig {
  id: number;
  restaurant_id: number;
  template_id: string | null;
  custom_html: string | null;
  domain: string | null;
  is_published: boolean;
}

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

  const [config, setConfig] = useState<WebsiteConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>("templates");
  const [prompt, setPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [domainQuery, setDomainQuery] = useState("");
  const [domainResult, setDomainResult] = useState<{ domain: string; available: boolean; marked_price: number; currency: string } | null>(null);
  const [searchingDomain, setSearchingDomain] = useState(false);
  const [registeringDomain, setRegisteringDomain] = useState(false);

  useEffect(() => {
    loadConfig();
  }, [client]);

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
        <Panel data-slot="website-panel">
          <div className="bo-loadingState" data-slot="website-loadingState">
            <Loader2 className="bo-spinnerIcon" size={24} />
            <span className="bo-mutedText" data-slot="website-mutedText">Cargando configuracion...</span>
          </div>
        </Panel>
      </div>
    );
  }

  return (
    <div className="bo-websitePage" data-ui="website-builder">
      <div className="bo-websiteHeader" data-slot="website-websiteHeader">
        <div className="bo-websiteHeaderMain" data-slot="website-websiteHeaderMain">
          <div className="bo-websiteTitle" data-testid="website-page-title">
            <Globe size={24} />
            <h1 data-slot="website-der">Website Builder</h1>
          </div>
          <p className="bo-websiteSubtitle" data-testid="website-page-subtitle">Crea y publica la web de tu restaurante</p>
        </div>
        <div className="bo-websiteHeaderActions" data-slot="website-websiteHeaderActions">
          <button className={`bo-btn bo-btn--${config?.is_published ? "success" : "secondary"}`} type="button" onClick={handleTogglePublished} disabled={saving} data-testid="website-page-publish-toggle">
            {config?.is_published ? "Publicado" : "Borrador"}
          </button>
          {previewUrl && (
            <a className="bo-btn bo-btn--secondary" href={previewUrl} target="_blank" rel="noopener noreferrer" data-testid="website-page-preview-link">
              <ExternalLink size={16} />
              <span data-slot="website-via">Vista previa</span>
            </a>
          )}
        </div>
      </div>

      <div className="bo-websiteTabs" role="tablist" data-testid="website-page-tabs">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.key}
            className={`bo-websiteTab${activeTab === tab.key ? " is-active" : ""}`}
            onClick={() => setActiveTab(tab.key)}
            data-testid={`website-page-tab-${tab.key}`}
          >
            {tab.icon}
            <span data-slot="website-bel">{tab.label}</span>
          </button>
        ))}
      </div>

      {activeTab === "templates" && (
        <section className="bo-websiteSection" aria-label="Plantillas premium" data-testid="website-page-templates-section">
          <div className="bo-websiteTemplateGrid" data-slot="website-websiteTemplateGrid">
            {WEBSITE_THEMES.map((theme) => {
              const isSelected = config?.template_id === theme.id;
              return (
                <button
                  key={theme.id}
                  type="button"
                  className={`bo-websiteTemplateCard${isSelected ? " is-selected" : ""}`}
                  onClick={() => handleSave({ template_id: theme.id, custom_html: null })}
                  disabled={saving}
                  data-testid={`website-page-theme-${theme.id}`}
                >
                  <div className="bo-websiteTemplatePreview" data-slot="website-websiteTemplatePreview">
                    <div className="bo-websiteTemplatePreviewInner" data-theme-id={theme.id} data-slot="website-websiteTemplatePreviewInner" />
                  </div>
                  <div className="bo-websiteTemplateInfo" data-slot="website-websiteTemplateInfo">
                    <div className="bo-websiteTemplateName" data-slot="website-websiteTemplateName">{theme.name}</div>
                    <div className="bo-websiteTemplateDesc" data-slot="website-websiteTemplateDesc">{theme.description}</div>
                  </div>
                  {isSelected && (
                    <div className="bo-websiteTemplateBadge" data-slot="website-websiteTemplateBadge">
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
        <section className="bo-websiteSection" aria-label="Constructor con IA" data-testid="website-page-ai-section">
          <div className="bo-websiteAIGrid" data-slot="website-websiteAIGrid">
            <Panel data-slot="website-panel" title="Generar con IA" meta="Describe tu sitio ideal">
              <div className="bo-stack" data-slot="website-stack">
                <p className="bo-mutedText" data-slot="website-mutedText">Describe como quieres que se vea tu sitio web. Nuestra IA creara el codigo HTML/CSS por ti, integrando tus menus y horarios automaticamente.</p>
                <label className="bo-field" data-slot="website-field">
                  <textarea
                    className="bo-textarea bo-textarea--lg"
                    placeholder="Ej: Quiero una web moderna con fondo oscuro y detalles en dorado. Usa una tipografia elegante y muestra mi menu de arroces en la pagina principal..."
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    rows={6}
                    data-testid="website-page-ai-prompt-input"
                  />
                </label>
                <div className="bo-row bo-row--right" data-slot="website-row--right">
                  <button className="bo-btn bo-btn--primary" type="button" onClick={handleAIGenerate} disabled={!prompt.trim() || generating} data-testid="website-page-ai-generate-button">
                    {generating ? (
                      <>
                        <Loader2 size={16} className="bo-spinnerIcon" />
                        <span data-slot="website-ndo">Generando...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles size={16} />
                        <span data-slot="website-web">Generar Web</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </Panel>

            <Panel data-slot="website-panel" title="Vista previa" meta="HTML personalizado">
              <div className="bo-websitePreviewFrame" data-slot="website-websitePreviewFrame">
                {config?.custom_html ? (
                  <div dangerouslySetInnerHTML={{ __html: config.custom_html }} data-slot="website-div" />
                ) : (
                  <div className="bo-emptyState" data-slot="website-emptyState">
                    <p className="bo-mutedText" data-slot="website-mutedText">No hay HTML generado aun</p>
                  </div>
                )}
              </div>
            </Panel>
          </div>
        </section>
      )}

      {activeTab === "domain" && (
        <section className="bo-websiteSection" aria-label="Dominio personalizado" data-testid="website-page-domain-section">
          <Panel className="bo-panel--lg" data-slot="website-panel--lg" title="Dominio personalizado" meta="Registra un dominio para tu sitio">
            <div className="bo-stack" data-slot="website-stack">
              {config?.domain ? (
                <div className="bo-websiteDomainActive" data-slot="website-websiteDomainActive">
                  <p className="bo-websiteDomainLabel" data-slot="website-websiteDomainLabel">Dominio activo</p>
                  <div className="bo-websiteDomainName" data-slot="website-websiteDomainName">{config.domain}</div>
                </div>
              ) : (
                <p className="bo-mutedText" data-slot="website-mutedText">Busca y registra un dominio para tu sitio web. El pago se añadira a tu facturacion anual.</p>
              )}

              <div className="bo-websiteDomainSearch" data-slot="website-websiteDomainSearch">
                <input
                  type="text"
                  className="bo-input"
                  placeholder="Ej: mirestaurante.com"
                  value={domainQuery}
                  onChange={(e) => setDomainQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearchDomain()}
                  data-testid="website-page-domain-search-input"
                />
                <button className="bo-btn bo-btn--primary" type="button" onClick={handleSearchDomain} disabled={searchingDomain || !domainQuery.trim()} data-testid="website-page-domain-search-button">
                  {searchingDomain ? (
                    <>
                      <Loader2 size={16} className="bo-spinnerIcon" />
                      <span data-slot="website-ndo">Buscando...</span>
                    </>
                  ) : (
                    <>
                      <Search size={16} />
                      <span data-slot="website-car">Buscar</span>
                    </>
                  )}
                </button>
              </div>

              {domainResult && (
                <div className="bo-websiteDomainResult" data-slot="website-websiteDomainResult">
                  <div className="bo-websiteDomainResultMain" data-slot="website-websiteDomainResultMain">
                    <div className="bo-websiteDomainResultName" data-slot="website-websiteDomainResultName">{domainResult.domain}</div>
                    {domainResult.available ? (
                      <span className="bo-badge bo-badge--success" data-slot="website-badge--success">Disponible</span>
                    ) : (
                      <span className="bo-badge bo-badge--danger" data-slot="website-badge--danger">No disponible</span>
                    )}
                  </div>
                  {domainResult.available && (
                    <div className="bo-websiteDomainResultActions" data-slot="website-websiteDomainResultActions">
                      <div className="bo-websiteDomainPrice" data-slot="website-websiteDomainPrice">
                        {domainResult.marked_price.toFixed(2)} {domainResult.currency}
                        <span className="bo-mutedText" data-slot="website-mutedText"> / ano</span>
                      </div>
                      <button className="bo-btn bo-btn--primary" type="button" onClick={handleRegisterDomain} disabled={registeringDomain} data-testid="website-page-domain-register-button">
                        {registeringDomain ? (
                          <>
                            <Loader2 size={16} className="bo-spinnerIcon" />
                            <span data-slot="website-ndo">Registrando...</span>
                          </>
                        ) : (
                          <span data-slot="website-ora">Registrar ahora</span>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </Panel>
        </section>
      )}
    </div>
  );
}
