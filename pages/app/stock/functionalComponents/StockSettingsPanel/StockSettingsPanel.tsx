import React, { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "../../../../../ui/actions/Button";
import { InlineAlert } from "../../../../../ui/feedback/InlineAlert";
import { FormField } from "../../../../../ui/inputs/FormField";
import { MarginBandsPanel } from "../MarginBandsPanel/MarginBandsPanel";

type Settings = { warehouseDisplayMode: string; countCadence: string; allowNegativeStock: boolean; labourCostEnabled: boolean; businessProfile: string; seasonalityProfile: Record<string, unknown>; onboardingCompleted: boolean };
type VATRate = { id: number; name: string; rate: number; isDefault: boolean; isActive: boolean };
const DEFAULT_SETTINGS: Settings = { warehouseDisplayMode: "AGGREGATED", countCadence: "WEEKLY", allowNegativeStock: true, labourCostEnabled: false, businessProfile: "", seasonalityProfile: {}, onboardingCompleted: false };

async function settingsRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/admin/stock${path}`, { ...init, credentials: "include", headers: { "Content-Type": "application/json", ...init?.headers } });
  const body = await response.json();
  if (!response.ok || !body.success) throw new Error(body.message || "Error de configuración");
  return body as T;
}

export function StockSettingsPanel() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [vatRates, setVatRates] = useState<VATRate[]>([]);
  const [vatName, setVatName] = useState("General");
  const [vatRate, setVatRate] = useState("10");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    try { const [settingsData, vatData] = await Promise.all([settingsRequest<Settings>("/settings"), settingsRequest<{ vatRates: VATRate[] }>("/vat-rates")]); setSettings(settingsData); setVatRates(vatData.vatRates || []); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo cargar la configuración"); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const save = useCallback(async () => {
    try { await settingsRequest("/settings", { method: "PATCH", body: JSON.stringify({ ...settings, onboardingCompleted: true }) }); setSettings((current) => ({ ...current, onboardingCompleted: true })); setMessage("Configuración guardada."); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo guardar"); }
  }, [settings]);

  const classify = useCallback(async () => {
    if (!settings.businessProfile.trim()) return;
    try { const result = await settingsRequest<{ seasonalityProfile: Record<string, unknown> }>("/settings/classify-seasonality", { method: "POST", body: JSON.stringify({ businessProfile: settings.businessProfile }) }); setSettings((current) => ({ ...current, seasonalityProfile: result.seasonalityProfile })); setMessage("Perfil estacional clasificado. Guarda para aplicarlo."); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo clasificar"); }
  }, [settings.businessProfile]);

  const addVAT = useCallback(async () => {
    try { await settingsRequest("/vat-rates", { method: "POST", body: JSON.stringify({ name: vatName, rate: Number(vatRate), isDefault: vatRates.length === 0 }) }); await load(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo crear IVA"); }
  }, [load, vatName, vatRate, vatRates.length]);

  const editVAT = useCallback(async (vat: VATRate) => {
    const name=window.prompt("Nombre IVA",vat.name)?.trim(); if(!name)return; const rate=Number(window.prompt("Porcentaje IVA",String(vat.rate))); if(!Number.isFinite(rate))return;
    try { await settingsRequest(`/vat-rates/${vat.id}`,{method:"PATCH",body:JSON.stringify({name,rate,isDefault:vat.isDefault,isActive:vat.isActive})}); await load(); }
    catch(reason){setError(reason instanceof Error?reason.message:"No se pudo editar IVA");}
  },[load]);
  const deleteVAT = useCallback(async (vat: VATRate) => { if(!window.confirm(`¿Eliminar ${vat.name}?`))return; try{await settingsRequest(`/vat-rates/${vat.id}`,{method:"DELETE"});await load();}catch(reason){setError(reason instanceof Error?reason.message:"No se pudo eliminar IVA");}},[load]);

  const seasonalityText = useMemo(() => Object.keys(settings.seasonalityProfile || {}).length ? JSON.stringify(settings.seasonalityProfile, null, 2) : "Sin clasificación", [settings.seasonalityProfile]);

  return (
    <section className="bo-stockSplit" data-ui="stock-settings-panel">
      <article className="bo-panel" data-ui="stock-settings-general">
        <div className="bo-panelHead" data-ui="stock-settings-header">
          <h2 className="bo-panelTitle" data-ui="stock-settings-title">Configuración y onboarding</h2>
        </div>
        <div className="bo-panelBody bo-stockForm" data-ui="stock-settings-body">
          <div className="bo-stockFormGrid bo-stockFormGrid--2" data-ui="stock-settings-fields">
            <FormField label="Vista" htmlFor="stock-settings-display">
              <select id="stock-settings-display" className="bo-input" value={settings.warehouseDisplayMode} onChange={(event) => setSettings({ ...settings, warehouseDisplayMode: event.target.value })} data-ui="stock-settings-display">
                <option value="AGGREGATED" data-ui="stock-settings-aggregated">Agregada</option>
                <option value="BY_WAREHOUSE" data-ui="stock-settings-by-warehouse">Por almacén</option>
              </select>
            </FormField>
            <FormField label="Frecuencia de recuento" htmlFor="stock-settings-cadence">
              <select id="stock-settings-cadence" className="bo-input" value={settings.countCadence} onChange={(event) => setSettings({ ...settings, countCadence: event.target.value })} data-ui="stock-settings-cadence">
                <option value="DAILY" data-ui="stock-settings-daily">Diaria</option>
                <option value="WEEKLY" data-ui="stock-settings-weekly">Semanal</option>
                <option value="BIWEEKLY" data-ui="stock-settings-biweekly">Quincenal</option>
                <option value="MONTHLY" data-ui="stock-settings-monthly">Mensual</option>
                <option value="NEVER" data-ui="stock-settings-never">Nunca</option>
              </select>
            </FormField>
          </div>

          <label className="bo-stockCheckbox" data-ui="stock-settings-negative-label">
            <input type="checkbox" checked={settings.allowNegativeStock} onChange={(event) => setSettings({ ...settings, allowNegativeStock: event.target.checked })} data-ui="stock-settings-negative" />
            Permitir stock negativo con alerta
          </label>
          <label className="bo-stockCheckbox" data-ui="stock-settings-labour-label">
            <input type="checkbox" checked={settings.labourCostEnabled} onChange={(event) => setSettings({ ...settings, labourCostEnabled: event.target.checked })} data-ui="stock-settings-labour" />
            Activar coste laboral cuando exista coste/hora
          </label>

          <FormField label="Perfil del negocio" htmlFor="stock-settings-business-profile">
            <textarea id="stock-settings-business-profile" className="bo-input bo-input--textarea" value={settings.businessProfile} onChange={(event) => setSettings({ ...settings, businessProfile: event.target.value })} placeholder="Terraza, turismo, servicios, temporada alta…" data-testid="stock-settings-business-profile" />
          </FormField>

          <div className="bo-stockFormActions" data-ui="stock-settings-actions">
            <Button variant="secondary" onClick={() => void classify()} data-ui="stock-settings-classify">Clasificar con MiniMax</Button>
            <Button variant="primary" onClick={() => void save()} data-testid="stock-settings-save">Guardar onboarding</Button>
          </div>

          <pre className="bo-stockCode" data-ui="stock-settings-seasonality">{seasonalityText}</pre>
        </div>
      </article>

      <article className="bo-panel" data-ui="stock-settings-finance">
        <div className="bo-panelHead" data-ui="stock-settings-finance-header">
          <h2 className="bo-panelTitle" data-ui="stock-settings-finance-title">IVA y bandas de margen</h2>
        </div>
        <div className="bo-panelBody" data-ui="stock-settings-finance-body">
          <div className="bo-stockForm" data-ui="stock-settings-vat">
            <h3 className="bo-stockSubtitle" data-ui="stock-settings-vat-title">Tipos de IVA</h3>
            <div className="bo-stockToolbar" data-ui="stock-settings-vat-form">
              <FormField className="bo-stockFilterField" label="Nombre IVA" htmlFor="stock-settings-vat-name">
                <input id="stock-settings-vat-name" className="bo-input" value={vatName} onChange={(event) => setVatName(event.target.value)} data-ui="stock-settings-vat-name" />
              </FormField>
              <FormField label="Porcentaje IVA" htmlFor="stock-settings-vat-rate">
                <input id="stock-settings-vat-rate" className="bo-input" style={{ width: 104 }} inputMode="decimal" value={vatRate} onChange={(event) => setVatRate(event.target.value)} data-ui="stock-settings-vat-rate" />
              </FormField>
              <Button variant="secondary" onClick={() => void addVAT()} data-ui="stock-settings-vat-add">Añadir</Button>
            </div>
            <div className="bo-stockRowList" data-ui="stock-settings-vat-list">
              {vatRates.map((vat) => (
                <div className="bo-stockRow" key={vat.id} data-ui="stock-settings-vat-item">
                  <span data-ui="stock-settings-vat-item-label">{vat.name} {vat.rate}%{vat.isDefault ? " · principal" : ""}</span>
                  <span className="bo-stockRowActions" data-ui="stock-settings-vat-item-actions">
                    <Button variant="ghost" size="sm" onClick={()=>void editVAT(vat)} data-ui="stock-settings-vat-edit">Editar</Button>
                    <Button variant="danger" size="sm" onClick={()=>void deleteVAT(vat)} data-ui="stock-settings-vat-delete">Eliminar</Button>
                  </span>
                </div>
              ))}
            </div>
          </div>

          <MarginBandsPanel />
        </div>
      </article>

      {error ? <InlineAlert kind="error" title="Configuración" message={error} /> : null}
      {message ? <InlineAlert kind="success" title="Configuración" message={message} /> : null}
    </section>
  );
}
