import React, { useEffect, useState } from "react";
import { usePageContext } from "vike-react/usePageContext";

import { createClient } from "../../../api/client";
import { useToasts } from "../../../ui/feedback/useToasts";
import { useErrorToast } from "../../../ui/feedback/useErrorToast";
import { Button } from "../../../ui/actions/Button";

interface WebsiteConfig {
  id: number;
  restaurant_id: number;
  template_id: string | null;
  custom_html: string | null;
  domain: string | null;
  is_published: boolean;
}

const TEMPLATES = [
  { id: "tmpl_1", name: "Modern Minimal", img: "https://placehold.co/300x200?text=Modern+Minimal" },
  { id: "tmpl_2", name: "Classic Elegance", img: "https://placehold.co/300x200?text=Classic+Elegance" },
  { id: "tmpl_3", name: "Dark Theme", img: "https://placehold.co/300x200?text=Dark+Theme" },
  { id: "tmpl_4", name: "Bistro Style", img: "https://placehold.co/300x200?text=Bistro+Style" },
  { id: "tmpl_5", name: "Cafe Vibe", img: "https://placehold.co/300x200?text=Cafe+Vibe" },
  { id: "tmpl_6", name: "Fine Dining", img: "https://placehold.co/300x200?text=Fine+Dining" },
  { id: "tmpl_7", name: "Rustic", img: "https://placehold.co/300x200?text=Rustic" },
  { id: "tmpl_8", name: "Seafood", img: "https://placehold.co/300x200?text=Seafood" },
  { id: "tmpl_9", name: "Steakhouse", img: "https://placehold.co/300x200?text=Steakhouse" },
  { id: "tmpl_10", name: "Vegan Fresh", img: "https://placehold.co/300x200?text=Vegan+Fresh" },
];

export default function WebsiteBuilderPage() {
  const { urlParsed } = usePageContext();
  const { addToast } = useToasts();
  const { handleError } = useErrorToast();
  const client = createClient();

  const [config, setConfig] = useState<WebsiteConfig | null>(null);
  const [loading, setLoading] = useState(true);
  
  const [activeTab, setActiveTab] = useState<"templates" | "ai" | "domain">("templates");
  const [prompt, setPrompt] = useState("");
  const [generating, setGenerating] = useState(false);

  const [domainQuery, setDomainQuery] = useState("");
  const [domainResult, setDomainResult] = useState<{domain: string, available: boolean, marked_price: number, currency: string} | null>(null);
  const [searchingDomain, setSearchingDomain] = useState(false);
  const [registeringDomain, setRegisteringDomain] = useState(false);

  useEffect(() => {
    loadConfig();
  }, []);

  async function loadConfig() {
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
  }

  async function handleSave(updates: Partial<WebsiteConfig>) {
    try {
      const res = await client.request<{ success: boolean }>("/admin/website", {
        method: "PUT",
        body: JSON.stringify(updates),
      });
      if (res.success) {
        addToast({ title: "Guardado", description: "Configuración actualizada correctamente" });
        setConfig(prev => prev ? { ...prev, ...updates } : { 
          id: 0, 
          restaurant_id: 0, 
          template_id: null, 
          custom_html: null, 
          domain: null, 
          is_published: false, 
          ...updates 
        });
      }
    } catch (err) {
      handleError(err);
    }
  }

  async function handleAIGenerate() {
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
  }

  async function handleSearchDomain() {
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
  }

  async function handleRegisterDomain() {
    if (!domainResult || !domainResult.available) return;
    if (!confirm(`¿Estás seguro de registrar ${domainResult.domain} por ${domainResult.marked_price} ${domainResult.currency} / año? Se generará un cargo recurrente anual.`)) return;
    
    try {
      setRegisteringDomain(true);
      const res = await client.request<{ success: boolean; message: string }>("/admin/domains/register", {
        method: "POST",
        body: JSON.stringify({ domain: domainResult.domain, price: domainResult.marked_price }),
      });
      if (res.success) {
        addToast({ title: "Registrado", description: res.message });
        setConfig(prev => prev ? { ...prev, domain: domainResult.domain } : null);
        setDomainResult(null);
        setDomainQuery("");
      }
    } catch (err) {
      handleError(err);
    } finally {
      setRegisteringDomain(false);
    }
  }

  if (loading) {
    return <div className="p-6">Cargando...</div>;
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Website Builder</h1>
          <p className="text-sm text-slate-400 mt-1">Crea y publica la web de tu restaurante</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-300">Estado:</span>
            <button 
              onClick={() => handleSave({ is_published: !config?.is_published })}
              className={`px-3 py-1 rounded text-sm font-medium ${config?.is_published ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}
            >
              {config?.is_published ? "Publicado" : "Borrador"}
            </button>
          </div>
        </div>
      </header>

      <div className="flex gap-4 border-b border-slate-700/50 pb-2">
        <button 
          onClick={() => setActiveTab("templates")}
          className={`px-4 py-2 font-medium transition-colors ${activeTab === "templates" ? "text-indigo-400 border-b-2 border-indigo-500" : "text-slate-400 hover:text-slate-200"}`}
        >
          Plantillas Premium
        </button>
        <button 
          onClick={() => setActiveTab("ai")}
          className={`px-4 py-2 font-medium transition-colors ${activeTab === "ai" ? "text-indigo-400 border-b-2 border-indigo-500" : "text-slate-400 hover:text-slate-200"}`}
        >
          Constructor con IA
        </button>
        <button 
          onClick={() => setActiveTab("domain")}
          className={`px-4 py-2 font-medium transition-colors ${activeTab === "domain" ? "text-indigo-400 border-b-2 border-indigo-500" : "text-slate-400 hover:text-slate-200"}`}
        >
          Dominio Personalizado
        </button>
      </div>

      {activeTab === "templates" && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {TEMPLATES.map((tmpl) => (
            <div 
              key={tmpl.id} 
              className={`rounded-xl border bg-slate-800/50 overflow-hidden transition-all ${config?.template_id === tmpl.id ? 'border-indigo-500 ring-1 ring-indigo-500' : 'border-slate-700 hover:border-slate-600'}`}
            >
              <img src={tmpl.img} alt={tmpl.name} className="w-full h-48 object-cover" />
              <div className="p-4 flex items-center justify-between">
                <span className="font-medium text-slate-200">{tmpl.name}</span>
                <Button 
                  variant={config?.template_id === tmpl.id ? "primary" : "secondary"}
                  size="sm"
                  onClick={() => handleSave({ template_id: tmpl.id, custom_html: null })}
                >
                  {config?.template_id === tmpl.id ? "Seleccionado" : "Elegir"}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === "ai" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
              <h2 className="text-lg font-medium text-slate-200 mb-2">Generar con IA</h2>
              <p className="text-sm text-slate-400 mb-4">Describe cómo quieres que se vea tu sitio web. Nuestra IA creará el código HTML/CSS por ti, integrando tus menús y horarios automáticamente.</p>
              <textarea 
                className="w-full h-32 bg-slate-900 border border-slate-700 rounded-lg p-3 text-slate-200 text-sm focus:ring-1 focus:ring-indigo-500 outline-none"
                placeholder="Ej: Quiero una web moderna con fondo oscuro y detalles en dorado. Usa una tipografía elegante y muestra mi menú de arroces en la página principal..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
              />
              <div className="mt-4 flex justify-end">
                <Button 
                  variant="primary" 
                  onClick={handleAIGenerate}
                  disabled={!prompt.trim() || generating}
                >
                  {generating ? "Generando magia..." : "Generar Web"}
                </Button>
              </div>
            </div>
          </div>
          
          <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden flex flex-col h-[500px]">
            <div className="bg-slate-900 p-3 border-b border-slate-700 flex justify-between items-center">
              <span className="text-sm font-medium text-slate-300">Vista Previa (HTML Personalizado)</span>
            </div>
            <div className="flex-1 bg-white p-4 overflow-auto">
              {config?.custom_html ? (
                <div dangerouslySetInnerHTML={{ __html: config.custom_html }} />
              ) : (
                <div className="h-full flex items-center justify-center text-slate-400 text-sm">
                  No hay HTML generado aún
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === "domain" && (
        <div className="max-w-2xl bg-slate-800/50 rounded-xl p-6 border border-slate-700">
          <h2 className="text-xl font-medium text-slate-100 mb-2">Dominio Personalizado</h2>
          
          {config?.domain ? (
            <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4 mb-6">
              <p className="text-sm text-green-400 font-medium">Tienes un dominio activo</p>
              <div className="text-2xl font-bold text-slate-100 mt-1">{config.domain}</div>
            </div>
          ) : (
            <p className="text-sm text-slate-400 mb-6">Busca y registra un dominio para tu sitio web. El pago se añadirá a tu facturación anual.</p>
          )}

          <div className="flex gap-2 mb-6">
            <input 
              type="text"
              placeholder="Ej: mirestaurante.com"
              value={domainQuery}
              onChange={(e) => setDomainQuery(e.target.value)}
              className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              onKeyDown={(e) => e.key === "Enter" && handleSearchDomain()}
            />
            <Button variant="secondary" onClick={handleSearchDomain} disabled={searchingDomain || !domainQuery.trim()}>
              {searchingDomain ? "Buscando..." : "Buscar"}
            </Button>
          </div>

          {domainResult && (
            <div className="border border-slate-700 rounded-lg p-4 bg-slate-900/50">
              <div className="flex justify-between items-center">
                <div>
                  <div className="font-medium text-slate-200 text-lg">{domainResult.domain}</div>
                  {domainResult.available ? (
                    <span className="text-sm text-green-400 font-medium">¡Disponible!</span>
                  ) : (
                    <span className="text-sm text-red-400 font-medium">No disponible</span>
                  )}
                </div>
                {domainResult.available && (
                  <div className="text-right">
                    <div className="text-xl font-bold text-slate-100">{domainResult.marked_price.toFixed(2)} {domainResult.currency} <span className="text-sm text-slate-400 font-normal">/ año</span></div>
                    <Button 
                      variant="primary" 
                      className="mt-2 w-full" 
                      onClick={handleRegisterDomain}
                      disabled={registeringDomain}
                    >
                      {registeringDomain ? "Registrando..." : "Registrar ahora"}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}