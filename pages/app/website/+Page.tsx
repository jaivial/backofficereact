import React, { useCallback, useEffect, useMemo, useState } from "react";

import { createClient } from "../../../api/client";
import { useErrorToast } from "../../../ui/feedback/useErrorToast";
import { useToasts } from "../../../ui/feedback/useToasts";

type TabId = "templates" | "ai" | "domain";

type WebsiteConfig = {
  id: number;
  restaurant_id: number;
  template_id: string | null;
  custom_html: string | null;
  domain: string | null;
  is_published: boolean;
  domain_status?: string | null;
  active_domain?: string | null;
};

type WebsiteTemplate = {
  id: string;
  name: string;
  description?: string | null;
  preview_image_url?: string | null;
};

type DomainSearchResult = {
  domain: string;
  available: boolean;
};

type DomainQuote = {
  domain: string;
  available?: boolean;
  marked_price: number;
  currency: string;
};

type WebsiteConfigPatch = Partial<Pick<WebsiteConfig, "template_id" | "custom_html" | "is_published">>;

type ApiFailure = {
  success: false;
  message?: string;
};

type ApiSuccess<T extends object> = {
  success: true;
  message?: string;
} & T;

type ApiResult<T extends object> = ApiSuccess<T> | ApiFailure;

type PremiumWebsiteApi = {
  getConfig: () => Promise<ApiResult<{ config: WebsiteConfig | null }>>;
  listTemplates: () => Promise<ApiResult<{ templates: WebsiteTemplate[] }>>;
  updateConfig: (patch: WebsiteConfigPatch) => Promise<ApiResult<{ config: WebsiteConfig | null }>>;
  generate: (input: { prompt: string }) => Promise<ApiResult<{ html: string }>>;
};

type PremiumDomainsApi = {
  search: (input: { query: string }) => Promise<ApiResult<{ domain: DomainSearchResult }>>;
  quote: (input: { domain: string }) => Promise<ApiResult<{ quote: DomainQuote }>>;
  register: (input: { domain: string }) => Promise<ApiResult<{ domain: string; status?: string }>>;
};

type PremiumApiClient = ReturnType<typeof createClient> & {
  premium: {
    website: PremiumWebsiteApi;
    domains: PremiumDomainsApi;
  };
};

const AI_PROMPT_MIN_LENGTH = 10;

function buildEmptyConfig(patch?: WebsiteConfigPatch): WebsiteConfig {
  return {
    id: 0,
    restaurant_id: 0,
    template_id: null,
    custom_html: null,
    domain: null,
    is_published: false,
    ...patch,
  };
}

function readApiMessage(result: { message?: string }, fallback: string): string {
  const text = String(result.message ?? "").trim();
  return text || fallback;
}

function toErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) {
    const text = error.message.trim();
    return text || fallback;
  }
  return fallback;
}

function formatDomainStatus(status: string | null | undefined, hasActiveDomain: boolean): string {
  const normalized = String(status ?? "").trim().toLowerCase();
  if (normalized === "active") return "Activo";
  if (normalized === "pending") return "Pendiente de validacion";
  if (normalized === "failed") return "Error de registro";
  if (hasActiveDomain) return "Activo";
  return "Sin dominio";
}

export default function WebsiteBuilderPage() {
  const api = useMemo(() => createClient({ baseUrl: "" }) as PremiumApiClient, []);
  const { pushToast } = useToasts();

  const [error, setError] = useState<string | null>(null);
  useErrorToast(error);

  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<WebsiteConfig | null>(null);
  const [templates, setTemplates] = useState<WebsiteTemplate[]>([]);
  const [activeTab, setActiveTab] = useState<TabId>("templates");

  const [savingPublish, setSavingPublish] = useState(false);
  const [savingTemplateId, setSavingTemplateId] = useState<string | null>(null);

  const [prompt, setPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [previewHtml, setPreviewHtml] = useState("");

  const [domainQuery, setDomainQuery] = useState("");
  const [domainSearch, setDomainSearch] = useState<DomainSearchResult | null>(null);
  const [domainQuote, setDomainQuote] = useState<DomainQuote | null>(null);
  const [searchingDomain, setSearchingDomain] = useState(false);
  const [registeringDomain, setRegisteringDomain] = useState(false);

  const loadInitialData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [configRes, templatesRes] = await Promise.all([
        api.premium.website.getConfig(),
        api.premium.website.listTemplates(),
      ]);
      if (!configRes.success) {
        throw new Error(readApiMessage(configRes, "No se pudo cargar la configuracion de la web"));
      }
      if (!templatesRes.success) {
        throw new Error(readApiMessage(templatesRes, "No se pudieron cargar las plantillas premium"));
      }

      setConfig(configRes.config);
      setTemplates(templatesRes.templates);
      setPreviewHtml(configRes.config?.custom_html ?? "");
    } catch (caughtError: unknown) {
      setError(toErrorMessage(caughtError, "Error cargando website premium"));
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    void loadInitialData();
  }, [loadInitialData]);

  const onTogglePublished = useCallback(async () => {
    if (!config) return;
    const nextPublished = !config.is_published;
    setSavingPublish(true);
    setError(null);
    try {
      const res = await api.premium.website.updateConfig({ is_published: nextPublished });
      if (!res.success) {
        throw new Error(readApiMessage(res, "No se pudo actualizar el estado de publicacion"));
      }
      setConfig((prev) => {
        if (res.config) return res.config;
        if (!prev) return buildEmptyConfig({ is_published: nextPublished });
        return { ...prev, is_published: nextPublished };
      });
      pushToast({
        kind: "success",
        title: nextPublished ? "Website publicada" : "Website en borrador",
      });
    } catch (caughtError: unknown) {
      setError(toErrorMessage(caughtError, "No se pudo actualizar el estado de publicacion"));
    } finally {
      setSavingPublish(false);
    }
  }, [api, config, pushToast]);

  const onSelectTemplate = useCallback(
    async (templateId: string) => {
      setSavingTemplateId(templateId);
      setError(null);
      try {
        const res = await api.premium.website.updateConfig({ template_id: templateId, custom_html: null });
        if (!res.success) {
          throw new Error(readApiMessage(res, "No se pudo guardar la plantilla"));
        }
        setConfig((prev) => {
          if (res.config) return res.config;
          if (!prev) return buildEmptyConfig({ template_id: templateId, custom_html: null });
          return { ...prev, template_id: templateId, custom_html: null };
        });
        setPreviewHtml("");
        pushToast({
          kind: "success",
          title: "Plantilla guardada",
          message: "La plantilla premium esta activa",
        });
      } catch (caughtError: unknown) {
        setError(toErrorMessage(caughtError, "No se pudo guardar la plantilla"));
      } finally {
        setSavingTemplateId(null);
      }
    },
    [api, pushToast],
  );

  const onGenerateWebsite = useCallback(async () => {
    const cleanPrompt = prompt.trim();
    if (cleanPrompt.length < AI_PROMPT_MIN_LENGTH) {
      pushToast({
        kind: "error",
        title: "Prompt invalido",
        message: `Escribe al menos ${AI_PROMPT_MIN_LENGTH} caracteres`,
      });
      return;
    }

    setGenerating(true);
    setError(null);

    try {
      const generated = await api.premium.website.generate({ prompt: cleanPrompt });
      if (!generated.success) {
        throw new Error(readApiMessage(generated, "No se pudo generar el HTML con IA"));
      }
      const html = generated.html.trim();
      if (!html) {
        throw new Error("La IA no devolvio HTML valido");
      }

      const saveRes = await api.premium.website.updateConfig({ custom_html: html, template_id: null });
      if (!saveRes.success) {
        throw new Error(readApiMessage(saveRes, "No se pudo guardar el resultado generado"));
      }

      setPreviewHtml(html);
      setPrompt("");
      setConfig((prev) => {
        if (saveRes.config) return saveRes.config;
        if (!prev) return buildEmptyConfig({ custom_html: html, template_id: null });
        return { ...prev, custom_html: html, template_id: null };
      });
      pushToast({
        kind: "success",
        title: "Website generada",
        message: "El HTML generado se guardo correctamente",
      });
    } catch (caughtError: unknown) {
      setError(toErrorMessage(caughtError, "No se pudo completar la generacion con IA"));
    } finally {
      setGenerating(false);
    }
  }, [api, prompt, pushToast]);

  const onSearchDomain = useCallback(async () => {
    const query = domainQuery.trim();
    if (!query) {
      pushToast({
        kind: "error",
        title: "Dominio requerido",
        message: "Introduce un dominio para buscar",
      });
      return;
    }

    setSearchingDomain(true);
    setError(null);
    setDomainSearch(null);
    setDomainQuote(null);
    try {
      const searchRes = await api.premium.domains.search({ query });
      if (!searchRes.success) {
        throw new Error(readApiMessage(searchRes, "No se pudo buscar el dominio"));
      }
      setDomainSearch(searchRes.domain);

      if (!searchRes.domain.available) {
        pushToast({
          kind: "info",
          title: "Dominio no disponible",
          message: "Prueba con otra opcion",
        });
        return;
      }

      const quoteRes = await api.premium.domains.quote({ domain: searchRes.domain.domain });
      if (!quoteRes.success) {
        throw new Error(readApiMessage(quoteRes, "No se pudo obtener la cotizacion"));
      }
      setDomainQuote(quoteRes.quote);
    } catch (caughtError: unknown) {
      setError(toErrorMessage(caughtError, "Error buscando dominio"));
    } finally {
      setSearchingDomain(false);
    }
  }, [api, domainQuery, pushToast]);

  const onRegisterDomain = useCallback(async () => {
    if (!domainQuote || domainQuote.available === false) return;

    const yearlyPrice = `${domainQuote.marked_price.toFixed(2)} ${domainQuote.currency}`;
    const message = `Confirmar registro de ${domainQuote.domain} por ${yearlyPrice} al ano`;
    if (typeof window !== "undefined" && !window.confirm(message)) {
      return;
    }

    setRegisteringDomain(true);
    setError(null);
    try {
      const registerRes = await api.premium.domains.register({ domain: domainQuote.domain });
      if (!registerRes.success) {
        throw new Error(readApiMessage(registerRes, "No se pudo registrar el dominio"));
      }

      setConfig((prev) => {
        const base = prev ?? buildEmptyConfig();
        return {
          ...base,
          domain: registerRes.domain,
          active_domain: registerRes.domain,
          domain_status: registerRes.status ?? "pending",
        };
      });
      setDomainQuery("");
      setDomainSearch(null);
      setDomainQuote(null);
      pushToast({
        kind: "success",
        title: "Dominio registrado",
      });
    } catch (caughtError: unknown) {
      setError(toErrorMessage(caughtError, "No se pudo completar el registro del dominio"));
    } finally {
      setRegisteringDomain(false);
    }
  }, [api, domainQuote, pushToast]);

  const activeDomain = config?.active_domain ?? config?.domain ?? null;
  const domainStatusLabel = formatDomainStatus(config?.domain_status, Boolean(activeDomain));

  if (loading) {
    return (
      <div className="bo-stack">
        <div className="bo-panel">
          <div className="bo-panelBody">
            <div className="bo-mutedText">Cargando website premium...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <section className="bo-stack" aria-label="Website premium">
      <div className="bo-panel">
        <div className="bo-panelHead">
          <div className="bo-panelTitle">Website premium</div>
          <div className="bo-panelMeta">Plantillas, IA y dominio personalizado</div>
        </div>
        <div className="bo-panelBody">
          <div className="bo-toolbar">
            <div className="bo-toolbarLeft">
              <div className="bo-mutedText">
                Estado: {config?.is_published ? "Publicado" : "Borrador"}
              </div>
            </div>
            <div className="bo-toolbarRight">
              <button
                type="button"
                className={`bo-btn ${config?.is_published ? "bo-btn--secondary" : "bo-btn--primary"}`}
                onClick={() => void onTogglePublished()}
                disabled={savingPublish || !config}
              >
                {savingPublish ? "Guardando..." : config?.is_published ? "Pasar a borrador" : "Publicar"}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="bo-panel">
        <div className="bo-panelBody">
          <div className="bo-toolbar">
            <div className="bo-toolbarLeft" style={{ gap: "8px", display: "flex", flexWrap: "wrap" }}>
              <button
                type="button"
                className={`bo-btn ${activeTab === "templates" ? "bo-btn--primary" : "bo-btn--ghost"}`}
                onClick={() => setActiveTab("templates")}
              >
                Plantillas
              </button>
              <button
                type="button"
                className={`bo-btn ${activeTab === "ai" ? "bo-btn--primary" : "bo-btn--ghost"}`}
                onClick={() => setActiveTab("ai")}
              >
                AI
              </button>
              <button
                type="button"
                className={`bo-btn ${activeTab === "domain" ? "bo-btn--primary" : "bo-btn--ghost"}`}
                onClick={() => setActiveTab("domain")}
              >
                Domain
              </button>
            </div>
            <div className="bo-toolbarRight">
              <button type="button" className="bo-btn bo-btn--ghost" onClick={() => void loadInitialData()}>
                Recargar
              </button>
            </div>
          </div>
        </div>
      </div>

      {activeTab === "templates" && (
        <div className="bo-panel">
          <div className="bo-panelHead">
            <div className="bo-panelTitle">Plantillas premium</div>
            <div className="bo-panelMeta">Selecciona y guarda una plantilla</div>
          </div>
          <div className="bo-panelBody">
            {templates.length === 0 ? (
              <div className="bo-mutedText">No hay plantillas disponibles.</div>
            ) : (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                  gap: "14px",
                }}
              >
                {templates.map((template) => {
                  const isSelected = config?.template_id === template.id;
                  const isSaving = savingTemplateId === template.id;
                  return (
                    <div
                      key={template.id}
                      className="bo-panel"
                      style={{
                        border: isSelected ? "1px solid var(--bo-color-primary)" : "1px solid var(--bo-border)",
                      }}
                    >
                      <div className="bo-panelBody" style={{ display: "grid", gap: "10px" }}>
                        {template.preview_image_url ? (
                          <img
                            src={template.preview_image_url}
                            alt={template.name}
                            style={{
                              width: "100%",
                              height: "140px",
                              objectFit: "cover",
                              borderRadius: "8px",
                              background: "var(--bo-bg-muted)",
                            }}
                          />
                        ) : (
                          <div
                            className="bo-input"
                            style={{
                              minHeight: "140px",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            Sin preview
                          </div>
                        )}
                        <div className="bo-panelTitle">{template.name}</div>
                        {template.description ? (
                          <div className="bo-mutedText">{template.description}</div>
                        ) : null}
                        <button
                          type="button"
                          className={`bo-btn ${isSelected ? "bo-btn--secondary" : "bo-btn--primary"}`}
                          onClick={() => void onSelectTemplate(template.id)}
                          disabled={isSaving}
                        >
                          {isSaving ? "Guardando..." : isSelected ? "Seleccionada" : "Seleccionar"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "ai" && (
        <div
          className="bo-content-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gap: "16px",
          }}
        >
          <div className="bo-panel">
            <div className="bo-panelHead">
              <div className="bo-panelTitle">Generar con IA</div>
              <div className="bo-panelMeta">Describe tu web (minimo 10 caracteres)</div>
            </div>
            <div className="bo-panelBody" style={{ display: "grid", gap: "12px" }}>
              <label className="bo-field">
                <span className="bo-label">Prompt</span>
                <textarea
                  className="bo-textarea"
                  placeholder="Ej: Landing moderna para restaurante con seccion de menu, horario y reservas."
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                  rows={8}
                />
              </label>
              <div className="bo-toolbar">
                <div className="bo-toolbarLeft">
                  <div className="bo-mutedText">
                    {prompt.trim().length}/{AI_PROMPT_MIN_LENGTH} minimo
                  </div>
                </div>
                <div className="bo-toolbarRight">
                  <button
                    type="button"
                    className="bo-btn bo-btn--primary"
                    onClick={() => void onGenerateWebsite()}
                    disabled={generating}
                  >
                    {generating ? "Generando..." : "Generar website"}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="bo-panel">
            <div className="bo-panelHead">
              <div className="bo-panelTitle">Vista previa</div>
              <div className="bo-panelMeta">HTML generado y guardado</div>
            </div>
            <div className="bo-panelBody">
              {previewHtml ? (
                <iframe
                  title="Vista previa website generada"
                  srcDoc={previewHtml}
                  style={{
                    width: "100%",
                    minHeight: "460px",
                    border: "1px solid var(--bo-border)",
                    borderRadius: "10px",
                    background: "#ffffff",
                  }}
                />
              ) : (
                <div
                  className="bo-input"
                  style={{
                    minHeight: "220px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  Aun no hay HTML generado.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === "domain" && (
        <div className="bo-panel">
          <div className="bo-panelHead">
            <div className="bo-panelTitle">Dominio personalizado</div>
            <div className="bo-panelMeta">Busqueda, cotizacion y registro</div>
          </div>
          <div className="bo-panelBody" style={{ display: "grid", gap: "14px" }}>
            <div className="bo-field">
              <span className="bo-label">Dominio activo</span>
              <div className="bo-input">{activeDomain || "Sin dominio activo"}</div>
            </div>
            <div className="bo-field">
              <span className="bo-label">Estado del dominio</span>
              <div className="bo-input">{domainStatusLabel}</div>
            </div>

            <div className="bo-toolbar">
              <div className="bo-toolbarLeft" style={{ display: "flex", gap: "8px", width: "100%" }}>
                <input
                  type="text"
                  className="bo-input"
                  placeholder="tudominio.com"
                  value={domainQuery}
                  onChange={(event) => setDomainQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void onSearchDomain();
                    }
                  }}
                />
                <button
                  type="button"
                  className="bo-btn bo-btn--secondary"
                  onClick={() => void onSearchDomain()}
                  disabled={searchingDomain}
                >
                  {searchingDomain ? "Buscando..." : "Buscar"}
                </button>
              </div>
            </div>

            {domainSearch ? (
              <div className="bo-field">
                <span className="bo-label">Resultado de busqueda</span>
                <div className="bo-input">
                  {domainSearch.domain} - {domainSearch.available ? "Disponible" : "No disponible"}
                </div>
              </div>
            ) : null}

            {domainQuote && domainQuote.available !== false ? (
              <div className="bo-panel">
                <div className="bo-panelBody">
                  <div className="bo-toolbar">
                    <div className="bo-toolbarLeft">
                      <div className="bo-panelTitle">{domainQuote.domain}</div>
                      <div className="bo-mutedText">
                        {domainQuote.marked_price.toFixed(2)} {domainQuote.currency} / ano
                      </div>
                    </div>
                    <div className="bo-toolbarRight">
                      <button
                        type="button"
                        className="bo-btn bo-btn--primary"
                        onClick={() => void onRegisterDomain()}
                        disabled={registeringDomain}
                      >
                        {registeringDomain ? "Registrando..." : "Registrar dominio"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </section>
  );
}
