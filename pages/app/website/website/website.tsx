import React, { useMemo, useState } from "react";
import { Check, ExternalLink, Globe, Loader2, Palette, Search, Sparkles } from "lucide-react";

import { WEBSITE_THEMES } from "./constants";
import { useWebsiteLoader } from "./hooks";
import type { TabKey } from "./types";

export default function WebsitePage() {
  const {
    config,
    loading,
    saving,
    generating,
    searchingDomain,
    registeringDomain,
    saveConfig,
    generateWithAI,
    searchDomain,
    registerDomain,
    togglePublished,
    updateConfig,
  } = useWebsiteLoader();

  const [activeTab, setActiveTab] = useState<TabKey>("templates");
  const [prompt, setPrompt] = useState("");
  const [domainQuery, setDomainQuery] = useState("");
  const [domainResult, setDomainResult] = useState<{ domain: string; available: boolean; marked_price: number; currency: string } | null>(null);

  const handleAIGenerateWrapper = () => {
    void generateWithAI(prompt).then(() => setPrompt(""));
  };

  const handleSearchDomainWrapper = () => {
    setDomainResult(null);
    void searchDomain(domainQuery).then((result) => {
      if (result) setDomainResult(result as typeof domainResult);
    });
  };

  const handleRegisterDomainWrapper = () => {
    if (!domainResult) return;
    void registerDomain(domainResult.domain, domainResult.marked_price).then((message) => {
      if (message) {
        setDomainResult(null);
        setDomainQuery("");
      }
    });
  };

  const tabs = useMemo<{ key: TabKey; label: string; icon: React.ReactNode }[]>(
    () => [
      { key: "templates", label: "Plantillas", icon: <Palette size={16} aria-hidden="true" data-ui="tab-icon-templates" /> },
      { key: "ai", label: "Constructor IA", icon: <Sparkles size={16} aria-hidden="true" data-ui="tab-icon-ai" /> },
      { key: "domain", label: "Dominio", icon: <Globe size={16} aria-hidden="true" data-ui="tab-icon-domain" /> },
    ],
    [],
  );

  const previewUrl = useMemo(() => {
    if (!config?.template_id) return null;
    return `/preview-web?theme=${config.template_id}`;
  }, [config?.template_id]);

  if (loading) {
    return (
      <div className="bo-websitePage" data-ui="website-loading">
        <div className="bo-panel" data-ui="loading-panel">
          <div className="bo-panelBody" data-ui="loading-body">
            <div className="bo-loadingState" data-ui="loading-state">
              <Loader2 className="bo-spinnerIcon" size={24} aria-hidden="true" data-ui="loading-spinner" />
              <span className="bo-mutedText" data-ui="loading-text">Cargando configuracion...</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bo-websitePage" data-ui="website-builder">
      <div className="bo-websiteHeader" data-ui="website-header">
        <div className="bo-websiteHeaderMain" data-ui="website-header-main">
          <div className="bo-websiteTitle" data-ui="website-title">
            <Globe size={24} aria-hidden="true" data-ui="website-title-icon" />
            <h1 data-ui="website-title-text">Website Builder</h1>
          </div>
          <p className="bo-websiteSubtitle" data-ui="website-subtitle">Crea y publica la web de tu restaurante</p>
        </div>
        <div className="bo-websiteHeaderActions" data-ui="website-header-actions">
          <button
            className={`bo-btn bo-btn--${config?.is_published ? "success" : "secondary"}`}
            type="button"
            onClick={togglePublished}
            disabled={saving}
            data-ui="website-publish-btn"
          >
            {config?.is_published ? "Publicado" : "Borrador"}
          </button>
          {previewUrl && (
            <a
              className="bo-btn bo-btn--secondary"
              href={previewUrl}
              target="_blank"
              rel="noopener noreferrer"
              data-ui="website-preview-link"
            >
              <ExternalLink size={16} aria-hidden="true" data-ui="preview-icon" />
              <span data-ui="preview-label">Vista previa</span>
            </a>
          )}
        </div>
      </div>

      <div className="bo-websiteTabs" role="tablist" data-ui="website-tabs">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.key}
            className={`bo-websiteTab${activeTab === tab.key ? " is-active" : ""}`}
            onClick={() => setActiveTab(tab.key)}
            data-ui={`website-tab-${tab.key}`}
          >
            {tab.icon}
            <span data-ui={`tab-label-${tab.key}`}>{tab.label}</span>
          </button>
        ))}
      </div>

      {activeTab === "templates" && (
        <section className="bo-websiteSection" aria-label="Plantillas premium" data-ui="website-section-templates">
          <div className="bo-websiteTemplateGrid" data-ui="website-template-grid">
            {WEBSITE_THEMES.map((theme) => {
              const isSelected = config?.template_id === theme.id;
              return (
                <button
                  key={theme.id}
                  type="button"
                  className={`bo-websiteTemplateCard${isSelected ? " is-selected" : ""}`}
                  onClick={() => saveConfig({ template_id: theme.id, custom_html: null })}
                  disabled={saving}
                  data-ui={`website-template-card-${theme.id}`}
                >
                  <div className="bo-websiteTemplatePreview" data-ui="template-preview">
                    <div className="bo-websiteTemplatePreviewInner" data-theme-id={theme.id} data-ui="template-preview-inner" />
                  </div>
                  <div className="bo-websiteTemplateInfo" data-ui="template-info">
                    <div className="bo-websiteTemplateName" data-ui="template-name">{theme.name}</div>
                    <div className="bo-websiteTemplateDesc" data-ui="template-desc">{theme.description}</div>
                  </div>
                  {isSelected && (
                    <div className="bo-websiteTemplateBadge" data-ui="template-badge" aria-label="Seleccionado">
                      <Check size={14} aria-hidden="true" data-ui="template-check-icon" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </section>
      )}

      {activeTab === "ai" && (
        <section className="bo-websiteSection" aria-label="Constructor con IA" data-ui="website-section-ai">
          <div className="bo-websiteAIGrid" data-ui="website-ai-grid">
            <div className="bo-panel" data-ui="ai-prompt-panel">
              <div className="bo-panelHead" data-ui="ai-prompt-header">
                <div className="bo-panelTitle" data-ui="ai-prompt-title">Generar con IA</div>
                <div className="bo-panelMeta" data-ui="ai-prompt-meta">Describe tu sitio ideal</div>
              </div>
              <div className="bo-panelBody" data-ui="ai-prompt-body">
                <div className="bo-stack" data-ui="ai-prompt-stack">
                  <p className="bo-mutedText" data-ui="ai-prompt-description">
                    Describe como quieres que se vea tu sitio web. Nuestra IA creara el codigo HTML/CSS por ti, integrando tus menus y horarios automaticamente.
                  </p>
                  <label className="bo-field" data-ui="ai-prompt-field">
                    <textarea
                      className="bo-textarea bo-textarea--lg"
                      placeholder="Ej: Quiero una web moderna con fondo oscuro y detalles en dorado. Usa una tipografia elegante y muestra mi menu de arroces en la pagina principal..."
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      rows={6}
                      data-ui="ai-prompt-textarea"
                    />
                  </label>
                  <div className="bo-row bo-row--right" data-ui="ai-prompt-actions">
                    <button
                      className="bo-btn bo-btn--primary"
                      type="button"
                      onClick={() => void handleAIGenerateWrapper()}
                      disabled={!prompt.trim() || generating}
                      data-ui="ai-generate-btn"
                    >
                      {generating ? (
                        <>
                          <Loader2 size={16} className="bo-spinnerIcon" aria-hidden="true" data-ui="ai-generating-spinner" />
                          <span data-ui="ai-generating-label">Generando...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles size={16} aria-hidden="true" data-ui="ai-sparkle-icon" />
                          <span data-ui="ai-generate-label">Generar Web</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="bo-panel" data-ui="ai-preview-panel">
              <div className="bo-panelHead" data-ui="ai-preview-header">
                <div className="bo-panelTitle" data-ui="ai-preview-title">Vista previa</div>
                <div className="bo-panelMeta" data-ui="ai-preview-meta">HTML personalizado</div>
              </div>
              <div className="bo-panelBody" data-ui="ai-preview-body">
                <div className="bo-websitePreviewFrame" data-ui="ai-preview-frame">
                  {config?.custom_html ? (
                    <div dangerouslySetInnerHTML={{ __html: config.custom_html }} data-ui="ai-preview-html" />
                  ) : (
                    <div className="bo-emptyState" data-ui="ai-preview-empty">
                      <p className="bo-mutedText" data-ui="ai-preview-empty-text">No hay HTML generado aun</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {activeTab === "domain" && (
        <section className="bo-websiteSection" aria-label="Dominio personalizado" data-ui="website-section-domain">
          <div className="bo-panel bo-panel--lg" data-ui="domain-panel">
            <div className="bo-panelHead" data-ui="domain-header">
              <div className="bo-panelTitle" data-ui="domain-title">Dominio personalizado</div>
              <div className="bo-panelMeta" data-ui="domain-meta">Registra un dominio para tu sitio</div>
            </div>
            <div className="bo-panelBody" data-ui="domain-body">
              <div className="bo-stack" data-ui="domain-stack">
                {config?.domain ? (
                  <div className="bo-websiteDomainActive" data-ui="domain-active">
                    <p className="bo-websiteDomainLabel" data-ui="domain-active-label">Dominio activo</p>
                    <div className="bo-websiteDomainName" data-ui="domain-active-name">{config.domain}</div>
                  </div>
                ) : (
                  <p className="bo-mutedText" data-ui="domain-placeholder">
                    Busca y registra un dominio para tu sitio web. El pago se añadira a tu facturacion anual.
                  </p>
                )}

                <div className="bo-websiteDomainSearch" data-ui="domain-search">
                  <input
                    type="text"
                    className="bo-input"
                    placeholder="Ej: mirestaurante.com"
                    value={domainQuery}
                    onChange={(e) => setDomainQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSearchDomainWrapper()}
                    data-ui="domain-search-input"
                  />
                  <button
                    className="bo-btn bo-btn--primary"
                    type="button"
                    onClick={() => void handleSearchDomainWrapper()}
                    disabled={searchingDomain || !domainQuery.trim()}
                    data-ui="domain-search-btn"
                  >
                    {searchingDomain ? (
                      <>
                        <Loader2 size={16} className="bo-spinnerIcon" aria-hidden="true" data-ui="domain-searching-spinner" />
                        <span data-ui="domain-searching-label">Buscando...</span>
                      </>
                    ) : (
                      <>
                        <Search size={16} aria-hidden="true" data-ui="domain-search-icon" />
                        <span data-ui="domain-search-label">Buscar</span>
                      </>
                    )}
                  </button>
                </div>

                {domainResult && (
                  <div className="bo-websiteDomainResult" data-ui="domain-result">
                    <div className="bo-websiteDomainResultMain" data-ui="domain-result-main">
                      <div className="bo-websiteDomainResultName" data-ui="domain-result-name">{domainResult.domain}</div>
                      {domainResult.available ? (
                        <span className="bo-badge bo-badge--success" data-ui="domain-result-available">Disponible</span>
                      ) : (
                        <span className="bo-badge bo-badge--danger" data-ui="domain-result-unavailable">No disponible</span>
                      )}
                    </div>
                    {domainResult.available && (
                      <div className="bo-websiteDomainResultActions" data-ui="domain-result-actions">
                        <div className="bo-websiteDomainPrice" data-ui="domain-result-price">
                          {domainResult.marked_price.toFixed(2)} {domainResult.currency}
                          <span className="bo-mutedText" data-ui="domain-result-price-period"> / ano</span>
                        </div>
                        <button
                          className="bo-btn bo-btn--primary"
                          type="button"
                          onClick={() => void handleRegisterDomainWrapper()}
                          disabled={registeringDomain}
                          data-ui="domain-register-btn"
                        >
                          {registeringDomain ? (
                            <>
                              <Loader2 size={16} className="bo-spinnerIcon" aria-hidden="true" data-ui="domain-registering-spinner" />
                              <span data-ui="domain-registering-label">Registrando...</span>
                            </>
                          ) : (
                            <span data-ui="domain-register-label">Registrar ahora</span>
                          )}
                        </button>
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
