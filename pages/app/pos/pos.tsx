import React, { useCallback, useEffect, useMemo, useState } from "react";
import "../../../components/styles/features/pos/sell-screen.css";
import { POSAdminPanel } from "./functionalComponents/POSAdminPanel/POSAdminPanel";
import { POSSellScreen } from "./functionalComponents/POSSellScreen/POSSellScreen";
import { POSSectionMenu } from "./functionalComponents/POSSellScreen/POSSectionMenu";
import { KitchenDisplay } from "./functionalComponents/KitchenDisplay/KitchenDisplay";
import { POSActivationPanel } from "./functionalComponents/POSActivationPanel/POSActivationPanel";
import { KitchenSettings } from "./functionalComponents/KitchenSettings/KitchenSettings";
import { CardReconciliation } from "./functionalComponents/CardReconciliation/CardReconciliation";
import { CashControl } from "./functionalComponents/CashControl/CashControl";
import { usePOSCashDay, isValidPOSDate } from "./hooks/usePOSCashDay";
import { POSNoCashDayModal } from "./functionalComponents/CashDay/POSNoCashDayModal";
import "../../../components/styles/features/pos/cash-day.css";

type Settings = { isEnabled: boolean; stockMode: "OFF" | "SHADOW" | "LIVE"; coversMode: "MANUAL" | "SHADOW" | "LIVE"; timezone: string; businessDayCutoff: string; autoCloseVisit?: boolean; requireOpenShift?: boolean; receiptPrefix?: string };
type Product = { id: number; name: string; priceGrossCents: number; vatRate: number; categoryName?: string; isActive: boolean };
type Table = { id: number; name: string; capacity: number; occupied: boolean };
type TicketLine = { id: number; productName: string; quantity: number; unitPriceGrossCents: number; lineTotalGrossCents: number; status?: string };
type Ticket = { id: number; ticketNumber?: string; version: number; status?: string; lines: TicketLine[]; subtotalGrossCents?: number; discountCents?: number; taxCents?: number; totalGrossCents: number };
type Visit = { id: number; channel?: string; tableId?: number | null; tableName?: string; covers: number; status?: string; totalGrossCents?: number; ticket?: Ticket; tickets?: Ticket[] };
type Bootstrap = { settings: Settings; products: Product[]; tables: Table[]; visits: Visit[] };
type Readiness = { activeProducts: number; mappedProducts: number; unmappedProducts: number; untrackedProducts: number; invalidMappings: number; salesCoveragePct: number };
type StockOption = { id: number; name: string; deductionSource: string; quantityBase?: number };
type Warehouse = { id: number; name: string; isDefault: boolean };
type Reservation = { id:number;customerName:string;reservationDate:string;reservationTime:string;partySize:number;status:string;visitId?:number|null;visitStatus?:string|null };
type Recipe = { id: number; name: string; outputItemId: number };

const DEFAULT_SETTINGS: Settings = { isEnabled: false, stockMode: "OFF", coversMode: "MANUAL", timezone: "Europe/Madrid", businessDayCutoff: "05:00", autoCloseVisit: true, receiptPrefix: "TPV" };

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set("Content-Type", "application/json");
  const response = await fetch(`/api/admin/pos${path}`, { ...init, credentials: "include", headers });
  const body = await response.json();
  if (!response.ok || !body.success) throw new Error(body.message || "Error de TPV");
  return body as T;
}
async function stockRequest<T>(path: string): Promise<T> {
  const response = await fetch(`/api/admin/stock${path}`, { credentials: "include", headers: { "Content-Type": "application/json" } });
  const body = await response.json();
  if (!response.ok || !body.success) throw new Error(body.message || "Error de stock");
  return body as T;
}
function money(cents: number): string { return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format((cents || 0) / 100); }

function dateFromLocation(): string | null {
  if (typeof window === "undefined") return null;
  const value = new URLSearchParams(window.location.search).get("date");
  // A malformed date falls back to the business date the backend resolves,
  // rather than showing an empty till for a day that does not exist.
  return isValidPOSDate(value) ? value : null;
}

export default function Page() {
  const [requestedDate, setRequestedDate] = useState<string | null>(dateFromLocation);
  const cashDayState = usePOSCashDay(requestedDate);
  const activeDate = cashDayState.date;
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [products, setProducts] = useState<Product[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [section, setSection] = useState<"sell" | "kitchen" | "catalog" | "stock" | "reports" | "settings">("sell");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [readiness, setReadiness] = useState<Readiness | null>(null);
  const [stockItems, setStockItems] = useState<StockOption[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [mappingProductId, setMappingProductId] = useState(0);
  const [mappingItemId, setMappingItemId] = useState(0);
  const [mappingWarehouseId, setMappingWarehouseId] = useState(0);
  const [mappingRecipeId, setMappingRecipeId] = useState(0);
  const [mappingQty, setMappingQty] = useState("1");
  const [mappingRules, setMappingRules] = useState<Array<{stockItemId:number;stockRecipeId?:number|null;warehouseId:number;quantityBasePerSale:number}>>([]);
  const [coverRows, setCoverRows] = useState<Array<{ date: string; serviceType: string; computedCovers: number; aggregateCovers: number; source: string }>>([]);
  const [salesRows, setSalesRows] = useState<Array<{ date: string; serviceType: string; tickets: number; netCents: number; covers: number }>>([]);
  const [importItems, setImportItems] = useState<Array<{ sourceType: string; sourceId: number; name: string; priceGrossCents: number; imported: boolean }>>([]);

  // The business date only exists once the cash day answers. Bootstrap is the
  // heaviest POS endpoint, so it waits for that first answer instead of firing
  // undated and again scoped. It latches: a later refresh must not unmount the
  // sell screen and take the ticket in progress with it.
  const [scopeReady, setScopeReady] = useState(false);
  useEffect(() => { if (!cashDayState.loading) setScopeReady(true); }, [cashDayState.loading]);

  // Once the business date is known the URL states it outright, so a reload,
  // a bookmark or a shared link all land on the same day instead of drifting
  // to whatever "now" happens to be.
  useEffect(() => {
    if (!activeDate || typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (url.searchParams.get("date") === activeDate) return;
    url.searchParams.set("date", activeDate);
    window.history.replaceState(window.history.state, "", url.toString());
  }, [activeDate]);

  // A date with no till open cannot take sales, so the sell screen is replaced
  // by the gate rather than shown behind it. Deliberately not conditioned on
  // `loading`: every date change flips loading back on for a render, and
  // dropping the gate meanwhile would expose a live sell screen scoped to the
  // day the operator just left.
  const needsCashDay = scopeReady && !cashDayState.cashDay;
  const openDay = useCallback(async (openingCashCents: number) => cashDayState.openDay({ openingCashCents }), [cashDayState.openDay]);
  const pickDate = useCallback((iso: string) => {
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("date", iso);
      window.history.replaceState(window.history.state, "", url.toString());
    }
    setRequestedDate(iso);
  }, []);

  const load = useCallback(async () => {
    if (!scopeReady) return;
    setError("");
    try {
      const data = await request<Bootstrap>(activeDate ? `/bootstrap?date=${encodeURIComponent(activeDate)}` : "/bootstrap");
      setSettings(data.settings || DEFAULT_SETTINGS); setProducts(data.products || []); setTables(data.tables || []); setVisits(data.visits || []);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo cargar TPV"); }
  }, [activeDate, scopeReady]);
  useEffect(() => { void load(); }, [load]);

  const saleStockItems = useMemo(()=>stockItems.filter(item=>item.deductionSource!=="PRODUCTION"),[stockItems]);
  const compatibleRecipes = useMemo(()=>recipes.filter(recipe=>recipe.outputItemId===mappingItemId),[mappingItemId,recipes]);
  const loadStockAdmin = useCallback(async () => {
    try { const [ready, items, warehouseData,recipeData] = await Promise.all([request<Readiness>("/stock-readiness"), stockRequest<{ items: StockOption[] }>("/item-options"), stockRequest<{ warehouses: Warehouse[] }>("/warehouses"),stockRequest<{recipes:Recipe[]}>("/recipes")]); setReadiness(ready); setStockItems(items.items || []); setWarehouses(warehouseData.warehouses || []);setRecipes(recipeData.recipes||[]); setMappingWarehouseId((current) => current || warehouseData.warehouses.find((entry) => entry.isDefault)?.id || 0); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo cargar preparación de stock"); }
  }, []);
  useEffect(() => { if (section === "stock") void loadStockAdmin(); }, [loadStockAdmin, section]);

  const selectMappingProduct=useCallback(async(productId:number)=>{setMappingProductId(productId);setMappingRules([]);if(!productId)return;try{const data=await request<{rules:Array<{stockItemId:number;stockRecipeId?:number|null;warehouseId:number;quantityBasePerSale:number}>}>(`/products/${productId}/stock-rules`);setMappingRules((data.rules||[]).map(rule=>({stockItemId:rule.stockItemId,stockRecipeId:rule.stockRecipeId||null,warehouseId:rule.warehouseId,quantityBasePerSale:rule.quantityBasePerSale})))}catch(reason){setError(reason instanceof Error?reason.message:"No se pudieron cargar reglas")}},[]);
  const addMappingRule = useCallback(()=>{if(!mappingItemId||!mappingWarehouseId||Number(mappingQty)<=0)return;setMappingRules(current=>[...current,{stockItemId:mappingItemId,stockRecipeId:mappingRecipeId||null,warehouseId:mappingWarehouseId,quantityBasePerSale:Number(mappingQty)}]);setMappingItemId(0);setMappingRecipeId(0);setMappingQty("1")},[mappingItemId,mappingQty,mappingRecipeId,mappingWarehouseId]);
  const saveMapping = useCallback(async () => {
    if (!mappingProductId || !mappingRules.length) return;
    try { await request(`/products/${mappingProductId}/stock-rules`, { method: "PUT", body: JSON.stringify({ rules: mappingRules }) }); setMessage("Reglas de stock guardadas."); setMappingRules([]); await loadStockAdmin(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo guardar la regla"); }
  }, [loadStockAdmin, mappingProductId, mappingRules]);

  const previewImport = useCallback(async () => { try { const data = await request<{ items: typeof importItems }>("/products/import-preview", { method: "POST" }); setImportItems(data.items || []); } catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo previsualizar Carta"); } }, []);
  const confirmImport = useCallback(async () => { const ids = importItems.filter((entry) => !entry.imported).map((entry) => entry.sourceId); if (!ids.length) return; try { await request("/products/import-confirm", { method: "POST", body: JSON.stringify({ items: importItems.filter((entry) => !entry.imported).map((entry) => ({ sourceType: entry.sourceType, sourceId: entry.sourceId })) }) }); setMessage("Carta importada al TPV."); setImportItems([]); await load(); } catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo importar Carta"); } }, [importItems, load]);

  const loadReports = useCallback(async () => { try { const [coversData, salesData] = await Promise.all([request<{ items: typeof coverRows }>("/covers"), request<{ items: typeof salesRows }>("/reports/sales")]); setCoverRows(coversData.items || []); setSalesRows(salesData.items || []); } catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudieron cargar informes"); } }, []);
  useEffect(() => { if (section === "reports") void loadReports(); }, [loadReports, section]);

  const saveSettings = useCallback(async () => { try { await request("/settings", { method: "PATCH", body: JSON.stringify(settings) }); setMessage("Configuración TPV guardada."); await load(); } catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo guardar configuración"); } }, [load, settings]);

  return <main className="w-full overflow-y-auto" data-ui="pos-page">
    <header className="flex flex-wrap items-start justify-between gap-3" data-ui="pos-header"><div data-ui="pos-heading"><h1 className="text-2xl font-bold text-[var(--bo-text)]" data-ui="pos-title">TPV</h1><p className="text-sm text-[var(--bo-muted)]" data-ui="pos-subtitle">Ventas, stock automático y comensales</p></div><span className="rounded-full border border-[var(--bo-border)] px-3 py-2 text-xs text-[var(--bo-muted)]" data-ui="pos-mode">Stock {settings.stockMode} · comensales {settings.coversMode}</span><POSSectionMenu section={section} onChange={setSection}/></header>
    {error?<div className="mb-4 rounded-lg border border-[var(--bo-color-danger)] p-3 text-[var(--bo-text-danger)]" role="alert" data-ui="pos-error">{error}</div>:null}{message?<div className="mb-4 rounded-lg border border-[var(--bo-color-success)] p-3 text-[var(--bo-text-success)]" role="status" data-ui="pos-message">{message}</div>:null}

    {section==="sell"&&scopeReady?(needsCashDay?(activeDate?<POSNoCashDayModal date={activeDate} error={cashDayState.error} onOpenDay={openDay} onPickDate={pickDate}/>:<section className="rounded-xl border border-[var(--bo-border)] bg-[var(--bo-surface)] p-4" data-ui="pos-cash-day-unavailable"><h2 className="font-semibold text-[var(--bo-text)]" data-ui="pos-cash-day-unavailable-title">No se pudo determinar el día de caja</h2><p className="mt-1 text-sm text-[var(--bo-muted)]" data-ui="pos-cash-day-unavailable-detail">{cashDayState.error||"Sin respuesta del servidor."}</p><button className="mt-3 min-h-11 rounded-lg border border-[var(--bo-border-2)] px-4 text-[var(--bo-accent)]" type="button" onClick={()=>void cashDayState.refresh()} data-ui="pos-cash-day-retry" data-testid="pos-cash-day-retry">Reintentar</button></section>):<POSSellScreen date={activeDate} readOnly={cashDayState.readOnly}/>):null}

    {section==="kitchen"?<KitchenDisplay/>:null}

    {section==="catalog"?<section className="grid gap-4 lg:grid-cols-2" data-ui="pos-catalog"><article className="rounded-xl border border-[var(--bo-border)] bg-[var(--bo-surface)] p-4" data-ui="pos-catalog-products"><h2 className="font-semibold text-[var(--bo-text)]" data-ui="pos-catalog-title">Productos TPV</h2><div className="mt-3 grid gap-2" data-ui="pos-catalog-list">{products.map((product)=><div className="flex justify-between rounded-lg border border-[var(--bo-border)] p-3" key={product.id} data-ui="pos-catalog-product"><span className="text-[var(--bo-text)]" data-ui="pos-catalog-name">{product.name}</span><strong className="text-[var(--bo-accent)]" data-ui="pos-catalog-price">{money(product.priceGrossCents)}</strong></div>)}</div></article><article className="rounded-xl border border-[var(--bo-border)] bg-[var(--bo-surface)] p-4" data-ui="pos-import"><h2 className="font-semibold text-[var(--bo-text)]" data-ui="pos-import-title">Importar Carta</h2><div className="mt-3 flex gap-2" data-ui="pos-import-actions"><button className="min-h-11 rounded-lg border border-[var(--bo-border-2)] px-4 text-[var(--bo-accent)]" type="button" onClick={()=>void previewImport()} data-ui="pos-import-preview">Previsualizar</button><button className="min-h-11 rounded-lg bg-[var(--bo-accent)] px-4 font-semibold text-[var(--bo-bg)] disabled:opacity-50" disabled={!importItems.some((entry)=>!entry.imported)} type="button" onClick={()=>void confirmImport()} data-ui="pos-import-confirm">Importar nuevos</button></div><div className="mt-3 grid gap-2" data-ui="pos-import-list">{importItems.map((entry)=><div className="flex justify-between rounded-lg border border-[var(--bo-border)] p-3 text-sm" key={entry.sourceId} data-ui="pos-import-item"><span className="text-[var(--bo-text)]" data-ui="pos-import-name">{entry.name}</span><span className="text-[var(--bo-muted)]" data-ui="pos-import-status">{entry.imported?"Importado":money(entry.priceGrossCents)}</span></div>)}</div></article><POSAdminPanel mode="catalog" onChanged={load}/></section>:null}

    {section==="stock"?<section className="grid gap-4 lg:grid-cols-2" data-ui="pos-stock"><article className="rounded-xl border border-[var(--bo-border)] bg-[var(--bo-surface)] p-4" data-ui="pos-readiness"><h2 className="font-semibold text-[var(--bo-text)]" data-ui="pos-readiness-title">Preparación stock</h2>{readiness?<div className="mt-4 grid grid-cols-2 gap-3" data-ui="pos-readiness-grid"><strong className="text-2xl text-[var(--bo-accent)]" data-ui="pos-readiness-coverage">{readiness.salesCoveragePct.toFixed(0)}%</strong><span className="text-sm text-[var(--bo-muted)]" data-ui="pos-readiness-detail">{readiness.mappedProducts}/{readiness.activeProducts} mapeados</span><span className="text-sm text-[var(--bo-text-warning)]" data-ui="pos-readiness-unmapped">{readiness.unmappedProducts} sin mapa</span><span className="text-sm text-[var(--bo-text-danger)]" data-ui="pos-readiness-invalid">{readiness.invalidMappings} inválidos</span></div>:null}</article><article className="rounded-xl border border-[var(--bo-border)] bg-[var(--bo-surface)] p-4" data-ui="pos-mapping"><h2 className="font-semibold text-[var(--bo-text)]" data-ui="pos-mapping-title">Regla de consumo</h2><div className="mt-3 grid gap-3" data-ui="pos-mapping-fields"><select className="min-h-11 rounded-lg border border-[var(--bo-border-2)] bg-[var(--bo-surface-2)] px-3" value={mappingProductId} onChange={(event)=>void selectMappingProduct(Number(event.target.value))} data-ui="pos-mapping-product"><option value={0} data-ui="pos-mapping-product-empty">Producto TPV</option>{products.map((product)=><option value={product.id} key={product.id} data-ui="pos-mapping-product-option">{product.name}</option>)}</select><select className="min-h-11 rounded-lg border border-[var(--bo-border-2)] bg-[var(--bo-surface-2)] px-3" value={mappingItemId} onChange={(event)=>setMappingItemId(Number(event.target.value))} data-ui="pos-mapping-item"><option value={0} data-ui="pos-mapping-item-empty">Artículo stock</option>{saleStockItems.map((item)=><option value={item.id} key={item.id} data-ui="pos-mapping-item-option">{item.name}</option>)}</select><select className="min-h-11 rounded-lg border border-[var(--bo-border-2)] bg-[var(--bo-surface-2)] px-3" value={mappingRecipeId} onChange={(event)=>setMappingRecipeId(Number(event.target.value))} data-ui="pos-mapping-recipe"><option value={0} data-ui="pos-mapping-recipe-empty">Sin receta</option>{compatibleRecipes.map(recipe=><option value={recipe.id} key={recipe.id} data-ui="pos-mapping-recipe-option">{recipe.name}</option>)}</select><select className="min-h-11 rounded-lg border border-[var(--bo-border-2)] bg-[var(--bo-surface-2)] px-3" value={mappingWarehouseId} onChange={(event)=>setMappingWarehouseId(Number(event.target.value))} data-ui="pos-mapping-warehouse"><option value={0} data-ui="pos-mapping-warehouse-empty">Almacén</option>{warehouses.map((warehouse)=><option value={warehouse.id} key={warehouse.id} data-ui="pos-mapping-warehouse-option">{warehouse.name}</option>)}</select><input className="min-h-11 rounded-lg border border-[var(--bo-border-2)] bg-[var(--bo-surface-2)] px-3" inputMode="decimal" aria-label="Cantidad base por venta" value={mappingQty} onChange={(event)=>setMappingQty(event.target.value)} data-ui="pos-mapping-quantity"/><button className="min-h-11 rounded-lg border border-[var(--bo-border-2)] px-4 text-[var(--bo-accent)]" type="button" onClick={addMappingRule} data-ui="pos-mapping-add">Añadir regla</button><div className="flex flex-wrap gap-2" data-ui="pos-mapping-rule-list">{mappingRules.map((rule,index)=><span className="rounded-full border border-[var(--bo-border)] px-3 py-2 text-xs text-[var(--bo-muted)]" key={`${rule.stockItemId}-${rule.warehouseId}-${index}`} data-ui="pos-mapping-rule">{stockItems.find(item=>item.id===rule.stockItemId)?.name} · {rule.quantityBasePerSale}<button className="ml-2 min-h-11 text-[var(--bo-text-danger)]" type="button" aria-label="Eliminar regla" onClick={()=>setMappingRules(current=>current.filter((_,ruleIndex)=>ruleIndex!==index))} data-ui="pos-mapping-rule-delete">×</button></span>)}</div><button className="min-h-11 rounded-lg bg-[var(--bo-accent)] px-4 font-semibold text-[var(--bo-bg)] disabled:opacity-50" disabled={!mappingRules.length} type="button" onClick={()=>void saveMapping()} data-ui="pos-mapping-save">Guardar reglas</button></div></article><div className="lg:col-span-2" data-ui="pos-stock-admin"><POSAdminPanel mode="stock" onChanged={loadStockAdmin}/></div></section>:null}

    {section==="reports"?<section className="grid gap-4 lg:grid-cols-2" data-ui="pos-reports"><div className="lg:col-span-2" data-ui="pos-cash-control"><CashControl onChanged={loadReports}/></div><div className="lg:col-span-2" data-ui="pos-card-reconciliation"><CardReconciliation/></div><article className="rounded-xl border border-[var(--bo-border)] bg-[var(--bo-surface)] p-4" data-ui="pos-sales-report"><h2 className="font-semibold text-[var(--bo-text)]" data-ui="pos-sales-title">Ventas</h2><div className="mt-3 grid gap-2" data-ui="pos-sales-list">{salesRows.map((row)=><div className="flex justify-between rounded-lg border border-[var(--bo-border)] p-3 text-sm" key={`${row.date}-${row.serviceType}`} data-ui="pos-sales-row"><span className="text-[var(--bo-text)]" data-ui="pos-sales-key">{row.date} · {row.serviceType}</span><strong className="text-[var(--bo-accent)]" data-ui="pos-sales-value">{money(row.netCents)} · {row.tickets} tickets</strong></div>)}</div></article><article className="rounded-xl border border-[var(--bo-border)] bg-[var(--bo-surface)] p-4" data-ui="pos-covers-report"><h2 className="font-semibold text-[var(--bo-text)]" data-ui="pos-covers-title">Comensales automáticos</h2><div className="mt-3 grid gap-2" data-ui="pos-covers-list">{coverRows.map((row)=><div className="flex justify-between rounded-lg border border-[var(--bo-border)] p-3 text-sm" key={`${row.date}-${row.serviceType}`} data-ui="pos-covers-row"><span className="text-[var(--bo-text)]" data-ui="pos-covers-key">{row.date} · {row.serviceType}</span><strong className="text-[var(--bo-accent)]" data-ui="pos-covers-value">{row.computedCovers} · {row.source||"shadow"}</strong></div>)}</div></article><article className="lg:col-span-2 rounded-xl border border-[var(--bo-border)] bg-[var(--bo-surface)] p-4" data-ui="pos-accounting-exports"><h2 className="font-semibold text-[var(--bo-text)]" data-ui="pos-accounting-title">Exportación contable</h2><div className="mt-3 flex flex-wrap gap-2" data-ui="pos-accounting-links">{["SALES_VAT","PAYMENTS","REFUNDS","STOCK"].map(kind=><a className="min-h-11 rounded-lg border border-[var(--bo-border-2)] px-3 py-2 text-sm text-[var(--bo-accent)]" href={`/api/admin/pos/accounting/export.csv?type=${kind}`} key={kind} data-ui="pos-accounting-link">{kind}</a>)}</div></article><div className="lg:col-span-2" data-ui="pos-reports-admin"><POSAdminPanel mode="reports" onChanged={loadReports}/></div></section>:null}

    {section==="settings"?<section className="rounded-xl border border-[var(--bo-border)] bg-[var(--bo-surface)] p-4" data-ui="pos-settings"><h2 className="font-semibold text-[var(--bo-text)]" data-ui="pos-settings-title">Configuración y activación</h2><div className="mt-4 grid gap-3 sm:grid-cols-2" data-ui="pos-settings-fields"><label className="flex min-h-11 items-center gap-2 text-sm text-[var(--bo-text)]" data-ui="pos-enabled-label"><input type="checkbox" checked={settings.isEnabled} onChange={(event)=>setSettings({...settings,isEnabled:event.target.checked})} data-ui="pos-enabled"/>TPV activo</label><label className="grid gap-1 text-sm text-[var(--bo-text)]" data-ui="pos-stock-mode-label">Stock<select className="min-h-11 rounded-lg border border-[var(--bo-border-2)] bg-[var(--bo-surface-2)] px-3" value={settings.stockMode} onChange={(event)=>setSettings({...settings,stockMode:event.target.value as Settings['stockMode']})} data-ui="pos-stock-mode"><option value="OFF" data-ui="pos-stock-off">Desactivado</option><option value="SHADOW" data-ui="pos-stock-shadow">Simulación</option><option value="LIVE" data-ui="pos-stock-live">En vivo</option></select></label><label className="grid gap-1 text-sm text-[var(--bo-text)]" data-ui="pos-covers-mode-label">Comensales<select className="min-h-11 rounded-lg border border-[var(--bo-border-2)] bg-[var(--bo-surface-2)] px-3" value={settings.coversMode} onChange={(event)=>setSettings({...settings,coversMode:event.target.value as Settings['coversMode']})} data-ui="pos-covers-mode"><option value="MANUAL" data-ui="pos-covers-manual">Manual</option><option value="SHADOW" data-ui="pos-covers-shadow">Simulación</option><option value="LIVE" data-ui="pos-covers-live">En vivo</option></select></label><label className="grid gap-1 text-sm text-[var(--bo-text)]" data-ui="pos-timezone-label">Zona horaria<input className="min-h-11 rounded-lg border border-[var(--bo-border-2)] bg-[var(--bo-surface-2)] px-3" value={settings.timezone} onChange={(event)=>setSettings({...settings,timezone:event.target.value})} data-ui="pos-timezone"/></label><label className="grid gap-1 text-sm text-[var(--bo-text)]" data-ui="pos-cutoff-label">Cierre de día<input className="min-h-11 rounded-lg border border-[var(--bo-border-2)] bg-[var(--bo-surface-2)] px-3" type="time" value={settings.businessDayCutoff} onChange={(event)=>setSettings({...settings,businessDayCutoff:event.target.value})} data-ui="pos-cutoff"/></label></div><button className="mt-4 min-h-11 rounded-lg bg-[var(--bo-accent)] px-4 font-semibold text-[var(--bo-bg)]" type="button" onClick={()=>void saveSettings()} data-ui="pos-settings-save">Guardar configuración</button><POSActivationPanel/><div className="mt-4" data-ui="pos-kitchen-settings"><KitchenSettings/></div><POSAdminPanel mode="settings" onChanged={load}/></section>:null}

    
  </main>;
}
