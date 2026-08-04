import React, { useCallback, useEffect, useMemo, useState } from "react";
import { usePageContext } from "vike-react/usePageContext";
import { Boxes, Minus, Plus, Search, Warehouse as WarehouseIcon, X } from "lucide-react";

import { Breadcrumbs } from "../../../ui/nav/Breadcrumbs";
import { SimpleTabs } from "../../../ui/nav/SimpleTabs";
import { Button } from "../../../ui/actions/Button";
import { EmptyState } from "../../../ui/feedback/EmptyState";
import { InlineAlert } from "../../../ui/feedback/InlineAlert";
import { LoadingSpinner } from "../../../ui/feedback/LoadingSpinner";
import { StatusBadge } from "../../../ui/feedback/StatusBadge";
import { FormField } from "../../../ui/inputs/FormField";
import { Modal } from "../../../ui/overlays/Modal";
import { StockCountPanel } from "./functionalComponents/StockCountPanel/StockCountPanel";
import { StockDocumentsPanel } from "./functionalComponents/StockDocumentsPanel/StockDocumentsPanel";
import { StockImportPanel } from "./functionalComponents/StockImportPanel/StockImportPanel";
import { StockOperationsPanel } from "./functionalComponents/StockOperationsPanel/StockOperationsPanel";
import { ProductionLabourPanel } from "./functionalComponents/ProductionLabourPanel/ProductionLabourPanel";
import { PortionWastePanel } from "./functionalComponents/PortionWastePanel/PortionWastePanel";
import { StockSettingsPanel } from "./functionalComponents/StockSettingsPanel/StockSettingsPanel";

type Warehouse = { id: number; name: string; code?: string; type: string; isDefault: boolean; isActive: boolean; sortOrder: number; notes?: string };
type Unit = { id: number; code: string; label: string; factorToBase: number };
type StockItem = { id: number; name: string; sku?: string; categoryName?: string; kind: string; baseDimension: string; baseUnit: string; isTracked: boolean; deductionSource: string; quantityBase: number; parLevelBase: number; reorderPointBase: number; displayUnit: Unit };
type StockItemOption = Pick<StockItem, "id" | "name" | "kind" | "isTracked" | "displayUnit">;
type Summary = { itemsTracked: number; belowPar: number; belowReorder: number; outOfStock: number; negative: number; coveragePct: number };
type Movement = { id: number; quantityBase: number; type: string; wasteReason?: string; enteredQuantity: number; enteredUnit: string; warehouseName: string; note?: string; actorName: string; occurredAt: string };
type Section = "inventory" | "operations" | "ocr" | "settings";

const EMPTY_SUMMARY: Summary = { itemsTracked: 0, belowPar: 0, belowReorder: 0, outOfStock: 0, negative: 0, coveragePct: 0 };

const SECTION_TABS: { id: Section; label: string }[] = [
  { id: "inventory", label: "Existencias" },
  { id: "operations", label: "Recetas y previsión" },
  { id: "ocr", label: "OCR documentos" },
  { id: "settings", label: "Configuración" },
];

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set("Content-Type", "application/json");
  const response = await fetch(`/api/admin/stock${path}`, { ...init, credentials: "include", headers });
  const body = await response.json();
  if (!response.ok || !body.success) throw new Error(body.message || "Error de stock");
  return body as T;
}

function displayQuantity(item: StockItem): string {
  return `${new Intl.NumberFormat("es-ES", { maximumFractionDigits: 2 }).format(item.quantityBase / item.displayUnit.factorToBase)} ${item.displayUnit.label}`;
}

function progressClass(item: StockItem): string {
  if (item.quantityBase < 0) return "bo-stockProgressFill bo-stockProgressFill--danger";
  if (item.reorderPointBase > 0 && item.quantityBase < item.reorderPointBase) return "bo-stockProgressFill bo-stockProgressFill--danger";
  if (item.parLevelBase > 0 && item.quantityBase < item.parLevelBase) return "bo-stockProgressFill bo-stockProgressFill--warning";
  return "bo-stockProgressFill";
}

function sourceLabel(deductionSource: string): string {
  if (deductionSource === "PRODUCTION") return "Elaboración";
  if (deductionSource === "SALE") return "Venta";
  return "Manual";
}

export default function Page() {
  const pageContext = usePageContext();
  const canManageActualLabour = Number(pageContext.bo?.session?.user?.roleImportance ?? 0) >= 90;
  const [items, setItems] = useState<StockItem[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [itemOptions, setItemOptions] = useState<StockItemOption[]>([]);
  const [summary, setSummary] = useState<Summary>(EMPTY_SUMMARY);
  const [warehouseId, setWarehouseId] = useState<number>(0);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [quantities, setQuantities] = useState<Record<number, string>>({});
  const [showItemForm, setShowItemForm] = useState(false);
  const [showWarehouses, setShowWarehouses] = useState(false);
  const [itemName, setItemName] = useState("");
  const [itemDimension, setItemDimension] = useState("MASS");
  const [itemUnit, setItemUnit] = useState("kg");
  const [itemFactor, setItemFactor] = useState("1000");
  const [warehouseName, setWarehouseName] = useState("");
  const [transferItemId, setTransferItemId] = useState(0);
  const [transferFromId, setTransferFromId] = useState(0);
  const [transferToId, setTransferToId] = useState(0);
  const [transferQuantity, setTransferQuantity] = useState("1");
  const [historyItem, setHistoryItem] = useState<StockItem | null>(null);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [section, setSection] = useState<Section>("inventory");

  const selectedWarehouseId = useMemo(() => warehouseId || warehouses.find((warehouse) => warehouse.isDefault)?.id || 0, [warehouseId, warehouses]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: "24" });
      if (query.trim()) params.set("q", query.trim());
      if (warehouseId) params.set("warehouseId", String(warehouseId));
      const [itemData, summaryData, warehouseData, optionData] = await Promise.all([
        request<{ items: StockItem[]; totalPages: number }>(`/items?${params}`),
        request<Summary>("/summary"),
        request<{ warehouses: Warehouse[] }>("/warehouses"),
        request<{ items: StockItemOption[] }>("/item-options"),
      ]);
      setItems(itemData.items);
      setTotalPages(Math.max(1, itemData.totalPages));
      setSummary(summaryData);
      setWarehouses(warehouseData.warehouses);
      setItemOptions(optionData.items);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo cargar el stock");
    } finally {
      setLoading(false);
    }
  }, [page, query, warehouseId]);

  useEffect(() => { void load(); }, [load]);

  const adjust = useCallback(async (item: StockItem, direction: "add" | "subtract") => {
    if (!selectedWarehouseId) { setError("Crea o selecciona un almacén"); return; }
    const quantity = Number(quantities[item.id] || "1");
    if (!Number.isFinite(quantity) || quantity <= 0) { setError("Cantidad no válida"); return; }
    setError("");
    try {
      const result = await request<{ quantityBase: number }>(`/items/${item.id}/movements`, {
        method: "POST",
        body: JSON.stringify({ warehouseId: selectedWarehouseId, quantity, unitId: item.displayUnit.id, type: "ADJUSTMENT", direction: direction === "add" ? "ADD" : "SUBTRACT", idempotencyKey: crypto.randomUUID() }),
      });
      setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, quantityBase: result.quantityBase } : entry));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo ajustar el stock");
    }
  }, [quantities, selectedWarehouseId]);

  const createItem = useCallback(async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      await request("/items", { method: "POST", body: JSON.stringify({ name: itemName, kind: "RAW", baseDimension: itemDimension, isTracked: true, deductionSource: "BOTH_MANUAL", displayUnitCode: itemUnit, displayUnitLabel: itemUnit, displayUnitFactor: Number(itemFactor) }) });
      setItemName(""); setShowItemForm(false); await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo crear el artículo"); }
  }, [itemDimension, itemFactor, itemName, itemUnit, load]);

  const createWarehouse = useCallback(async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      await request("/warehouses", { method: "POST", body: JSON.stringify({ name: warehouseName, type: "STORAGE", isActive: true, sortOrder: warehouses.length }) });
      setWarehouseName(""); await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo crear el almacén"); }
  }, [load, warehouseName, warehouses.length]);

  const transfer = useCallback(async () => {
    const item = itemOptions.find((entry) => entry.id === transferItemId);
    if (!item || !transferFromId || !transferToId || transferFromId === transferToId || Number(transferQuantity) <= 0) { setError("Completa una transferencia válida"); return; }
    try { await request("/transfers", { method: "POST", body: JSON.stringify({ itemId: item.id, fromWarehouseId: transferFromId, toWarehouseId: transferToId, quantity: Number(transferQuantity), unitId: item.displayUnit.id, idempotencyKey: crypto.randomUUID() }) }); await load(); setError(""); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo transferir"); }
  }, [itemOptions, load, transferFromId, transferItemId, transferQuantity, transferToId]);

  const editWarehouse = useCallback(async (warehouse: Warehouse) => {
    const name = window.prompt("Nombre del almacén", warehouse.name)?.trim();
    if (!name) return;
    try {
      await request(`/warehouses/${warehouse.id}`, { method: "PATCH", body: JSON.stringify({ ...warehouse, name }) });
      await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo editar el almacén"); }
  }, [load]);

  const deleteWarehouse = useCallback(async (warehouse: Warehouse) => {
    if (!window.confirm(`Eliminar ${warehouse.name}?`)) return;
    try { await request(`/warehouses/${warehouse.id}`, { method: "DELETE" }); await load(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo eliminar el almacén"); }
  }, [load]);

  const editItem = useCallback(async (item: StockItem) => {
    const name = window.prompt("Nombre del artículo", item.name)?.trim();
    if (!name) return;
    try {
      await request(`/items/${item.id}`, { method: "PATCH", body: JSON.stringify({ name, sku: item.sku || "", kind: item.kind, isTracked: item.isTracked, deductionSource: item.deductionSource }) });
      await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo editar el artículo"); }
  }, [load]);

  const toggleTracked = useCallback(async (item: StockItem) => {
    try {
      await request(`/items/${item.id}`, { method: "PATCH", body: JSON.stringify({ name: item.name, sku: item.sku || "", kind: item.kind, isTracked: !item.isTracked, deductionSource: item.deductionSource }) });
      await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo cambiar el seguimiento"); }
  }, [load]);

  const deleteItem = useCallback(async (item: StockItem) => {
    if (!window.confirm(`Eliminar ${item.name}?`)) return;
    try { await request(`/items/${item.id}`, { method: "DELETE" }); await load(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo eliminar el artículo"); }
  }, [load]);

  const setPurchasePrice = useCallback(async (item: StockItem) => {
    const pricePerDisplayUnit = Number(window.prompt(`Coste de compra por ${item.displayUnit.label} (€)`, ""));
    if (!Number.isFinite(pricePerDisplayUnit) || pricePerDisplayUnit < 0) return;
    const supplierName = window.prompt("Proveedor (opcional)", "") || "";
    try { await request(`/items/${item.id}/prices`, { method: "POST", body: JSON.stringify({ unitCostBase: pricePerDisplayUnit / item.displayUnit.factorToBase, supplierName }) }); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo guardar el coste"); }
  }, []);

  const setTargets = useCallback(async (item: StockItem) => {
    if (!selectedWarehouseId) return;
    const par = Number(window.prompt(`Objetivo de ${item.name} (${item.displayUnit.label})`, String(item.parLevelBase / item.displayUnit.factorToBase || 0)));
    if (!Number.isFinite(par) || par < 0) return;
    const reorder = Number(window.prompt(`Mínimo de reposición (${item.displayUnit.label})`, String(item.reorderPointBase / item.displayUnit.factorToBase || 0)));
    if (!Number.isFinite(reorder) || reorder < 0 || reorder > par) { setError("El mínimo debe estar entre 0 y el objetivo"); return; }
    try { await request(`/items/${item.id}/targets`, { method: "PATCH", body: JSON.stringify({ warehouseId: selectedWarehouseId, unitId: item.displayUnit.id, parLevel: par, reorderPoint: reorder }) }); await load(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudieron guardar objetivos"); }
  }, [load, selectedWarehouseId]);

  const recordWaste = useCallback(async (item: StockItem) => {
    const quantity = Number(window.prompt(`Merma de ${item.name} (${item.displayUnit.label})`, "1"));
    if (!Number.isFinite(quantity) || quantity <= 0 || !selectedWarehouseId) return;
    try {
      await request(`/items/${item.id}/movements`, { method: "POST", body: JSON.stringify({ warehouseId: selectedWarehouseId, quantity, unitId: item.displayUnit.id, type: "WASTE", wasteReason: "OTHER", idempotencyKey: crypto.randomUUID() }) });
      await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo registrar la merma"); }
  }, [load, selectedWarehouseId]);

  const openHistory = useCallback(async (item: StockItem) => {
    setHistoryItem(item);
    try { const data = await request<{ movements: Movement[] }>(`/items/${item.id}/movements?pageSize=50`); setMovements(data.movements); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo cargar el historial"); }
  }, []);

  const summaryCards = useMemo<[string, number][]>(() => [
    ["Artículos", summary.itemsTracked], ["Bajo objetivo", summary.belowPar], ["Bajo mínimo", summary.belowReorder], ["Agotados", summary.outOfStock],
  ], [summary]);

  return (
    <main className="bo-stockPage" data-ui="stock-page">
      <div className="bo-container" data-slot="stock-container">
        <Breadcrumbs items={[{ label: "Stock" }]} />

        <header className="bo-stockHero" data-ui="stock-header">
          <div className="bo-stockHeroTitles" data-ui="stock-heading">
            <h1 className="bo-pageTitle" data-ui="stock-title">Control de stock</h1>
            <p className="bo-pageSubtitle" data-ui="stock-subtitle">Existencias por almacén, movimientos y mermas</p>
          </div>
          <div className="bo-stockHeroActions" data-ui="stock-header-actions">
            <Button variant="secondary" onClick={() => setShowWarehouses((open) => !open)} aria-expanded={showWarehouses} data-testid="stock-manage-warehouses">
              <WarehouseIcon className="bo-ico" size={16} aria-hidden="true" data-ui="stock-warehouse-icon" />
              Almacenes
            </Button>
            <Button variant="primary" onClick={() => setShowItemForm(true)} data-testid="stock-new-item">
              <Plus className="bo-ico" size={16} aria-hidden="true" data-ui="stock-new-icon" />
              Nuevo artículo
            </Button>
          </div>
        </header>

        <div className="bo-stockTabsRow" data-ui="stock-sections">
          <SimpleTabs items={SECTION_TABS} activeId={section} onChange={(id) => setSection(id as Section)} aria-label="Secciones de stock" />
        </div>

        {error ? <InlineAlert kind="error" title="Error de stock" message={error} /> : null}

        <div className="bo-stockStack" data-ui="stock-sections-content">
          {section === "inventory" ? (
            <>
              <StockImportPanel onImported={load} />
              <StockCountPanel warehouses={warehouses} onClosed={load} />

              <section className="bo-stockSummary" aria-label="Resumen de stock" data-ui="stock-summary">
                {summaryCards.map(([label, value]) => (
                  <article className="bo-card bo-stockSummaryCard" key={label} data-ui={`stock-summary-${label.toLowerCase().replaceAll(" ", "-")}`}>
                    <p className="bo-statLabel" data-ui="stock-summary-label">{label}</p>
                    <strong className="bo-statValue" data-ui="stock-summary-value">{value}</strong>
                  </article>
                ))}
                <article className="bo-card bo-stockSummaryCard" data-ui="stock-summary-coverage">
                  <p className="bo-statLabel" data-ui="stock-coverage-label">Cobertura</p>
                  <strong className="bo-statValue" data-ui="stock-coverage-value">{Math.round(summary.coveragePct)}% cubierto</strong>
                </article>
              </section>

              {showWarehouses ? (
                <section className="bo-panel" aria-label="Almacenes" data-ui="stock-warehouse-panel">
                  <div className="bo-panelHead" data-ui="stock-warehouse-panel-header">
                    <h2 className="bo-panelTitle" data-ui="stock-warehouse-title">Almacenes</h2>
                    <button className="bo-stockIconBtn" type="button" aria-label="Cerrar almacenes" onClick={() => setShowWarehouses(false)} data-ui="stock-close-warehouses">
                      <X size={18} aria-hidden="true" data-ui="stock-close-icon" />
                    </button>
                  </div>
                  <div className="bo-panelBody" data-ui="stock-warehouse-panel-body">
                    <div className="bo-stockRowList" data-ui="stock-warehouse-list">
                      {warehouses.map((warehouse) => (
                        <div className="bo-stockRow" key={warehouse.id} data-ui="stock-warehouse-row">
                          <span data-ui="stock-warehouse-chip">{warehouse.name}{warehouse.isDefault ? " · principal" : ""}</span>
                          <span className="bo-stockRowActions" data-ui="stock-warehouse-actions">
                            <Button variant="ghost" size="sm" onClick={() => void editWarehouse(warehouse)} data-testid={`stock-edit-warehouse-${warehouse.id}`}>Editar</Button>
                            <Button variant="danger" size="sm" disabled={warehouse.isDefault} onClick={() => void deleteWarehouse(warehouse)} data-testid={`stock-delete-warehouse-${warehouse.id}`}>Eliminar</Button>
                          </span>
                        </div>
                      ))}
                    </div>

                    <form className="bo-stockToolbar" onSubmit={createWarehouse} data-ui="stock-warehouse-form">
                      <label className="sr-only" htmlFor="stock-warehouse-name" data-ui="stock-warehouse-name-label">Nombre</label>
                      <input id="stock-warehouse-name" className="bo-input bo-stockAdjustInput" value={warehouseName} onChange={(event) => setWarehouseName(event.target.value)} placeholder="Nuevo almacén" required data-testid="stock-warehouse-name" />
                      <Button variant="primary" type="submit" data-testid="stock-create-warehouse">Crear</Button>
                    </form>

                    {warehouses.length > 1 ? (
                      <div className="bo-stockSubsection" data-ui="stock-transfer-form">
                        <h3 className="bo-stockSubtitle" data-ui="stock-transfer-title">Transferir existencias</h3>
                        <div className="bo-stockFormGrid bo-stockFormGrid--3" data-ui="stock-transfer-fields">
                          <FormField label="Artículo" htmlFor="stock-transfer-item">
                            <select id="stock-transfer-item" className="bo-input" value={transferItemId} onChange={(event) => setTransferItemId(Number(event.target.value))} data-ui="stock-transfer-item">
                              <option value={0} data-ui="stock-transfer-item-empty">Artículo</option>
                              {itemOptions.map((item) => <option key={item.id} value={item.id} data-ui="stock-transfer-item-option">{item.name}</option>)}
                            </select>
                          </FormField>
                          <FormField label="Origen" htmlFor="stock-transfer-from">
                            <select id="stock-transfer-from" className="bo-input" value={transferFromId} onChange={(event) => setTransferFromId(Number(event.target.value))} data-ui="stock-transfer-from">
                              <option value={0} data-ui="stock-transfer-from-empty">Origen</option>
                              {warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id} data-ui="stock-transfer-from-option">{warehouse.name}</option>)}
                            </select>
                          </FormField>
                          <FormField label="Destino" htmlFor="stock-transfer-to">
                            <select id="stock-transfer-to" className="bo-input" value={transferToId} onChange={(event) => setTransferToId(Number(event.target.value))} data-ui="stock-transfer-to">
                              <option value={0} data-ui="stock-transfer-to-empty">Destino</option>
                              {warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id} data-ui="stock-transfer-to-option">{warehouse.name}</option>)}
                            </select>
                          </FormField>
                          <FormField label="Cantidad a transferir" htmlFor="stock-transfer-quantity">
                            <input id="stock-transfer-quantity" className="bo-input" inputMode="decimal" value={transferQuantity} onChange={(event) => setTransferQuantity(event.target.value)} data-ui="stock-transfer-quantity" />
                          </FormField>
                        </div>
                        <Button variant="secondary" className="bo-btn--fit" onClick={() => void transfer()} data-ui="stock-transfer-submit">Transferir</Button>
                      </div>
                    ) : null}
                  </div>
                </section>
              ) : null}

              <section className="bo-panel" aria-label="Filtros" data-ui="stock-filters">
                <div className="bo-panelBody bo-stockToolbar" data-ui="stock-filters-body">
                  <span className="bo-stockSearch" data-ui="stock-search-label">
                    <Search size={16} aria-hidden="true" data-ui="stock-search-icon" />
                    <input className="bo-stockSearchInput" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Buscar por nombre o SKU" aria-label="Buscar artículos" data-testid="stock-search" />
                  </span>
                  <div className="bo-stockFilterField" data-ui="stock-warehouse-filter-field">
                    <label className="bo-label" htmlFor="stock-warehouse-filter" data-ui="stock-warehouse-filter-label">Almacén</label>
                    <select id="stock-warehouse-filter" className="bo-input" value={warehouseId} onChange={(event) => { setWarehouseId(Number(event.target.value)); setPage(1); }} data-testid="stock-warehouse-filter">
                      <option value={0} data-ui="stock-all-warehouses-option">Todos los almacenes</option>
                      {warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id} data-ui="stock-warehouse-option">{warehouse.name}</option>)}
                    </select>
                  </div>
                </div>
              </section>

              {loading ? (
                <div className="bo-panel" data-ui="stock-loading">
                  <div className="bo-panelBody" data-slot="stock-loading-body">
                    <LoadingSpinner centered size="sm" label="Cargando existencias…" />
                  </div>
                </div>
              ) : items.length === 0 ? (
                <EmptyState
                  icon={<Boxes size={32} aria-hidden="true" data-ui="stock-empty-icon" />}
                  title="No hay artículos"
                  description="Crea el primero o importa tu catálogo."
                  data-ui="stock-empty"
                />
              ) : (
                <section className="bo-stockGrid" aria-label="Artículos en stock" data-ui="stock-grid">
                  {items.map((item) => {
                    const percent = item.parLevelBase > 0 ? Math.max(0, Math.min(100, item.quantityBase / item.parLevelBase * 100)) : 0;
                    return (
                      <article className="bo-card bo-stockItemCard" key={item.id} data-ui="stock-card">
                        <div className="bo-stockItemHead" data-ui="stock-card-header">
                          <div data-ui="stock-card-heading">
                            <h2 className="bo-stockItemName" data-ui="stock-card-name">{item.name}</h2>
                            <p className="bo-stockItemMeta" data-ui="stock-card-meta">{item.categoryName || item.kind}{item.sku ? ` · ${item.sku}` : ""}</p>
                          </div>
                          <StatusBadge variant="neutral" size="sm" data-ui="stock-card-source">{sourceLabel(item.deductionSource)}</StatusBadge>
                        </div>

                        <div className="bo-stockItemQuantityRow" data-ui="stock-card-quantity-row">
                          <strong className="bo-stockItemQuantity" data-ui="stock-card-quantity">{displayQuantity(item)}</strong>
                          <span className="bo-stockItemTarget" data-ui="stock-card-par">objetivo {item.parLevelBase ? `${item.parLevelBase / item.displayUnit.factorToBase} ${item.displayUnit.label}` : "sin definir"}</span>
                        </div>

                        <div className="bo-stockProgress" role="img" aria-label={`Cobertura de ${item.name}: ${Math.round(percent)}%`} data-ui="stock-progress">
                          <div className={progressClass(item)} style={{ width: `${percent}%` }} data-ui="stock-progress-fill" />
                        </div>

                        <div className="bo-stockAdjust" data-ui="stock-adjustment">
                          <Button variant="secondary" className="bo-stockAdjustBtn" aria-label={`Restar ${item.name}`} onClick={() => void adjust(item, "subtract")} data-testid={`stock-subtract-${item.id}`}>
                            <Minus size={16} aria-hidden="true" data-ui="stock-minus-icon" />
                          </Button>
                          <label className="sr-only" htmlFor={`stock-quantity-${item.id}`} data-ui="stock-quantity-label">Cantidad de {item.name}</label>
                          <input id={`stock-quantity-${item.id}`} className="bo-input bo-stockAdjustInput" inputMode="decimal" value={quantities[item.id] || "1"} onChange={(event) => setQuantities((current) => ({ ...current, [item.id]: event.target.value }))} data-testid={`stock-quantity-${item.id}`} />
                          <span className="bo-stockAdjustUnit" data-ui="stock-adjustment-unit">{item.displayUnit.label}</span>
                          <Button variant="primary" className="bo-stockAdjustBtn" aria-label={`Sumar ${item.name}`} onClick={() => void adjust(item, "add")} data-testid={`stock-add-${item.id}`}>
                            <Plus size={16} aria-hidden="true" data-ui="stock-plus-icon" />
                          </Button>
                        </div>

                        <div className="bo-stockItemActions" data-ui="stock-card-actions">
                          <Button variant="ghost" size="sm" onClick={() => void openHistory(item)} data-ui="stock-history-action">Historial</Button>
                          <Button variant="ghost" size="sm" className="bo-btn--warning" onClick={() => void recordWaste(item)} data-ui="stock-waste-action">Merma</Button>
                          <Button variant="ghost" size="sm" onClick={() => void setTargets(item)} data-ui="stock-targets-action">Objetivos</Button>
                          <Button variant="ghost" size="sm" onClick={() => void setPurchasePrice(item)} data-ui="stock-price-action">Coste</Button>
                          <Button variant="ghost" size="sm" onClick={() => void editItem(item)} data-ui="stock-edit-action">Editar</Button>
                          <Button variant="ghost" size="sm" onClick={() => void toggleTracked(item)} data-ui="stock-tracking-action">{item.isTracked ? "No seguir" : "Seguir"}</Button>
                          <Button variant="danger" size="sm" onClick={() => void deleteItem(item)} data-ui="stock-delete-action">Eliminar</Button>
                        </div>
                      </article>
                    );
                  })}
                </section>
              )}

              <nav className="bo-pager" aria-label="Paginación" data-ui="stock-pagination">
                <span className="bo-pagerText" data-ui="stock-page-count">Página {page} de {totalPages}</span>
                <div className="bo-pagerBtns" data-ui="stock-pager-buttons">
                  <Button variant="ghost" disabled={page <= 1} onClick={() => setPage((value) => value - 1)} data-ui="stock-page-previous">Anterior</Button>
                  <Button variant="ghost" disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)} data-ui="stock-page-next">Siguiente</Button>
                </div>
              </nav>
            </>
          ) : null}

          {section === "operations" ? (
            <>
              <StockOperationsPanel items={itemOptions} warehouses={warehouses} onChanged={load} />
              <PortionWastePanel />
              {canManageActualLabour ? <ProductionLabourPanel /> : null}
            </>
          ) : null}

          {section === "ocr" ? <StockDocumentsPanel items={itemOptions} warehouses={warehouses} /> : null}
          {section === "settings" ? <StockSettingsPanel /> : null}
        </div>
      </div>

      <Modal open={showItemForm} title="Nuevo artículo" onClose={() => setShowItemForm(false)} size="sm">
        <form className="bo-stockForm" onSubmit={createItem} data-ui="stock-item-dialog">
          <FormField label="Nombre" htmlFor="stock-item-name" required>
            <input id="stock-item-name" className="bo-input" value={itemName} onChange={(event) => setItemName(event.target.value)} required data-testid="stock-item-name" />
          </FormField>
          <FormField label="Dimensión" htmlFor="stock-item-dimension">
            <select id="stock-item-dimension" className="bo-input" value={itemDimension} onChange={(event) => setItemDimension(event.target.value)} data-ui="stock-item-dimension">
              <option value="MASS" data-ui="stock-dimension-mass">Masa</option>
              <option value="VOLUME" data-ui="stock-dimension-volume">Volumen</option>
              <option value="COUNT" data-ui="stock-dimension-count">Unidades</option>
            </select>
          </FormField>
          <div className="bo-stockFormGrid bo-stockFormGrid--2" data-ui="stock-item-unit-row">
            <FormField label="Unidad visible" htmlFor="stock-item-unit" required>
              <input id="stock-item-unit" className="bo-input" value={itemUnit} onChange={(event) => setItemUnit(event.target.value)} required data-ui="stock-item-unit" />
            </FormField>
            <FormField label="Factor base" htmlFor="stock-item-factor" required>
              <input id="stock-item-factor" className="bo-input" inputMode="decimal" value={itemFactor} onChange={(event) => setItemFactor(event.target.value)} required data-ui="stock-item-factor" />
            </FormField>
          </div>
          <Button variant="primary" type="submit" data-testid="stock-create-item">Crear artículo</Button>
        </form>
      </Modal>

      {historyItem ? (
        <aside className="bo-stockDrawer" aria-label={`Historial de ${historyItem.name}`} data-ui="stock-history-drawer">
          <div className="bo-stockDrawerHead" data-ui="stock-history-header">
            <div data-ui="stock-history-heading">
              <h2 className="bo-panelTitle" data-ui="stock-history-title">{historyItem.name}</h2>
              <p className="bo-stockNote" data-ui="stock-history-subtitle">Historial de movimientos</p>
            </div>
            <button className="bo-stockIconBtn" type="button" aria-label="Cerrar historial" onClick={() => setHistoryItem(null)} data-ui="stock-history-close">
              <X size={18} aria-hidden="true" data-ui="stock-history-close-icon" />
            </button>
          </div>
          <div className="bo-stockDrawerList" data-ui="stock-history-list">
            {movements.length ? movements.map((movement) => (
              <article className="bo-stockMovement" key={movement.id} data-ui="stock-history-entry">
                <div className="bo-stockMovementTop" data-ui="stock-history-entry-main">
                  <strong data-ui="stock-history-type">{movement.type}</strong>
                  <span className={movement.quantityBase >= 0 ? "bo-stockTextSuccess" : "bo-stockTextDanger"} data-ui="stock-history-quantity">{movement.quantityBase >= 0 ? "+" : ""}{movement.enteredQuantity} {movement.enteredUnit}</span>
                </div>
                <p className="bo-stockRowMeta" data-ui="stock-history-meta">{movement.warehouseName} · {movement.actorName} · {new Date(movement.occurredAt).toLocaleString("es-ES")}</p>
                {movement.note ? <p className="bo-stockNote" data-ui="stock-history-note">{movement.note}</p> : null}
              </article>
            )) : <p className="bo-stockNote" data-ui="stock-history-empty">Sin movimientos.</p>}
          </div>
        </aside>
      ) : null}
    </main>
  );
}
