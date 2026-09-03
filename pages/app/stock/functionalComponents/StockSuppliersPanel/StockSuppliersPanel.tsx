import React, { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Plus, Tags, TrendingUp, Truck } from "lucide-react";

import { Button } from "../../../../../ui/actions/Button";
import { EmptyState } from "../../../../../ui/feedback/EmptyState";
import { InlineAlert } from "../../../../../ui/feedback/InlineAlert";
import { LoadingSpinner } from "../../../../../ui/feedback/LoadingSpinner";
import { StatusBadge } from "../../../../../ui/feedback/StatusBadge";
import { FormField } from "../../../../../ui/inputs/FormField";

type Supplier = { id: number; name: string; notes: string; isActive: boolean; aliasCount: number; itemCount: number; pricePointCount: number; lastPriceAt: string | null };
type ItemOption = { id: number; name: string };
type Unit = { id: number; label: string; isDefaultPurchase: boolean };
type AliasRow = { key: string; supplierCode: string; description: string; stockItemId: number; stockUnitId: number };
type PriceOther = { supplierName: string; avgCost: number; samples: number };
type PriceItem = { itemId: number; itemName: string; baseUnit: string; samples: number; minCost: number; maxCost: number; avgCost: number; lastCost: number; lastAt: string; others: PriceOther[] };
type SupplierDetail = { mode: "aliases" | "prices"; supplier: Supplier };

const EUR = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 4 });

async function suppliersRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set("Content-Type", "application/json");
  const response = await fetch(`/api/admin/stock${path}`, { ...init, credentials: "include", headers });
  const body = await response.json();
  if (!response.ok || !body.success) throw new Error(body.message || "Error de stock");
  return body as T;
}

// Purchase prices are stored per base unit (g / ml / ud); g or ml read better as kg / l.
function displayCost(unitCost: number, baseUnit: string): string {
  if ((baseUnit === "g" || baseUnit === "ml") && unitCost > 0 && unitCost < 1) return `${EUR.format(unitCost * 1000)}/${baseUnit === "g" ? "kg" : "l"}`;
  return `${EUR.format(unitCost)}/${baseUnit || "ud"}`;
}

export function StockSuppliersPanel({ canWrite }: { canWrite: boolean }) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [newName, setNewName] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [detail, setDetail] = useState<SupplierDetail | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await suppliersRequest<{ suppliers: Supplier[] }>("/suppliers");
      setSuppliers(data.suppliers || []);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudieron cargar los proveedores");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const createSupplier = useCallback(async (event: React.FormEvent) => {
    event.preventDefault();
    if (!newName.trim()) { setError("El nombre es obligatorio"); return; }
    try {
      await suppliersRequest("/suppliers", { method: "POST", body: JSON.stringify({ name: newName, notes: newNotes }) });
      setNewName("");
      setNewNotes("");
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo crear el proveedor");
    }
  }, [load, newNotes, newName]);

  const editSupplier = useCallback(async (supplier: Supplier) => {
    const name = window.prompt("Nombre del proveedor", supplier.name);
    if (name === null) return;
    const notes = window.prompt("Notas (contacto, condiciones…)", supplier.notes);
    if (notes === null) return;
    try {
      await suppliersRequest(`/suppliers/${supplier.id}`, { method: "PATCH", body: JSON.stringify({ name, notes, isActive: supplier.isActive }) });
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo editar el proveedor");
    }
  }, [load]);

  const toggleSupplier = useCallback(async (supplier: Supplier) => {
    try {
      await suppliersRequest(`/suppliers/${supplier.id}`, { method: "PATCH", body: JSON.stringify({ name: supplier.name, notes: supplier.notes, isActive: !supplier.isActive }) });
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo cambiar el proveedor");
    }
  }, [load]);

  const deleteSupplier = useCallback(async (supplier: Supplier) => {
    if (!window.confirm(`Eliminar ${supplier.name}? Los alias y el historial de precios quedan asociados a ese nombre y volverán si lo vuelves a crear.`)) return;
    try {
      await suppliersRequest(`/suppliers/${supplier.id}`, { method: "DELETE" });
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo eliminar el proveedor");
    }
  }, [load]);

  return (
    <section className="bo-panel" aria-labelledby="stock-suppliers-title" data-ui="stock-suppliers-panel" data-testid="stock-suppliers-panel">
      <div className="bo-panelHead" data-ui="stock-suppliers-header">
        <div data-ui="stock-suppliers-heading">
          <h2 id="stock-suppliers-title" className="bo-panelTitle" data-ui="stock-suppliers-title">
            <Truck className="bo-ico" size={18} aria-hidden="true" data-ui="stock-suppliers-title-icon" />
            Proveedores
          </h2>
          <p className="bo-panelMeta" data-ui="stock-suppliers-subtitle">Registro de proveedores, alias de albaranes y comparación de precios.</p>
        </div>
        {detail ? (
          <Button variant="ghost" size="sm" onClick={() => setDetail(null)} data-ui="stock-suppliers-back" data-testid="stock-suppliers-back">
            <ArrowLeft className="bo-ico" size={16} aria-hidden="true" data-ui="stock-suppliers-back-icon" />
            Volver
          </Button>
        ) : null}
      </div>
      <div className="bo-panelBody" data-ui="stock-suppliers-body">
        {error ? <InlineAlert kind="error" title="Proveedores" message={error} /> : null}

        {detail ? (
          detail.mode === "aliases" ? (
            <SupplierAliasesEditor supplierId={detail.supplier.id} supplierName={detail.supplier.name} canWrite={canWrite} onChanged={load} />
          ) : (
            <SupplierPrices supplierId={detail.supplier.id} supplierName={detail.supplier.name} />
          )
        ) : loading ? (
          <LoadingSpinner centered size="sm" label="Cargando proveedores…" />
        ) : suppliers.length === 0 && !error ? (
          <EmptyState
            icon={<Truck size={32} aria-hidden="true" data-ui="stock-suppliers-empty-icon" />}
            title="Sin proveedores"
            description={canWrite ? "Da de alta el primero; los alias de albarán se pueden capturar después." : "Todavía no hay proveedores registrados."}
            data-ui="stock-suppliers-empty"
          />
        ) : (
          <>
            {suppliers.length > 0 ? (
              <div className="bo-stockTableScroll" data-ui="stock-suppliers-table-wrap">
                <table className="bo-table" data-ui="stock-suppliers-table" data-testid="stock-suppliers-table">
                  <thead data-ui="stock-suppliers-table-head">
                    <tr data-ui="stock-suppliers-table-head-row">
                      <th scope="col" data-ui="stock-suppliers-th-name">Proveedor</th>
                      <th scope="col" data-ui="stock-suppliers-th-aliases">Alias</th>
                      <th scope="col" data-ui="stock-suppliers-th-items">Artículos</th>
                      <th scope="col" data-ui="stock-suppliers-th-prices">Precios</th>
                      <th scope="col" data-ui="stock-suppliers-th-last">Último precio</th>
                      <th scope="col" data-ui="stock-suppliers-th-actions"><span className="sr-only">Acciones</span></th>
                    </tr>
                  </thead>
                  <tbody data-ui="stock-suppliers-table-body">
                    {suppliers.map((supplier) => (
                      <tr key={supplier.id} data-ui="stock-suppliers-row" data-testid={`stock-suppliers-row-${supplier.id}`}>
                        <td data-ui="stock-suppliers-name">
                          {supplier.name}
                          {!supplier.isActive ? <StatusBadge variant="neutral" size="sm" data-ui="stock-suppliers-inactive">Inactivo</StatusBadge> : null}
                          {supplier.notes ? <span className="bo-stockSuppliersNotes" data-ui="stock-suppliers-notes">{supplier.notes}</span> : null}
                        </td>
                        <td data-ui="stock-suppliers-alias-count">{supplier.aliasCount}</td>
                        <td data-ui="stock-suppliers-item-count">{supplier.itemCount}</td>
                        <td data-ui="stock-suppliers-price-count">{supplier.pricePointCount}</td>
                        <td data-ui="stock-suppliers-last-price">{supplier.lastPriceAt || "—"}</td>
                        <td data-ui="stock-suppliers-actions">
                          <span className="bo-stockRowActions" data-ui="stock-suppliers-row-actions">
                            <Button variant="ghost" size="sm" onClick={() => setDetail({ mode: "aliases", supplier })} data-testid={`stock-supplier-aliases-${supplier.id}`}>
                              <Tags className="bo-ico" size={14} aria-hidden="true" data-ui="stock-supplier-aliases-icon" />
                              Alias
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => setDetail({ mode: "prices", supplier })} data-testid={`stock-supplier-prices-${supplier.id}`}>
                              <TrendingUp className="bo-ico" size={14} aria-hidden="true" data-ui="stock-supplier-prices-icon" />
                              Precios
                            </Button>
                            {canWrite ? (
                              <>
                                <Button variant="ghost" size="sm" onClick={() => void editSupplier(supplier)} data-testid={`stock-supplier-edit-${supplier.id}`}>Editar</Button>
                                <Button variant="ghost" size="sm" onClick={() => void toggleSupplier(supplier)} data-testid={`stock-supplier-toggle-${supplier.id}`}>{supplier.isActive ? "Desactivar" : "Activar"}</Button>
                                <Button variant="danger" size="sm" onClick={() => void deleteSupplier(supplier)} data-testid={`stock-supplier-delete-${supplier.id}`}>Eliminar</Button>
                              </>
                            ) : null}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}

            {canWrite ? (
              <form className="bo-stockToolbar" onSubmit={createSupplier} data-ui="stock-suppliers-create-form">
                <label className="sr-only" htmlFor="stock-supplier-name" data-ui="stock-supplier-name-label">Nombre</label>
                <input id="stock-supplier-name" className="bo-input" value={newName} onChange={(event) => setNewName(event.target.value)} placeholder="Nuevo proveedor" required maxLength={180} data-testid="stock-supplier-name" />
                <label className="sr-only" htmlFor="stock-supplier-notes" data-ui="stock-supplier-notes-label">Notas</label>
                <input id="stock-supplier-notes" className="bo-input" value={newNotes} onChange={(event) => setNewNotes(event.target.value)} placeholder="Notas (opcional)" maxLength={500} data-testid="stock-supplier-notes" />
                <Button variant="primary" type="submit" data-testid="stock-supplier-create">
                  <Plus className="bo-ico" size={16} aria-hidden="true" data-ui="stock-supplier-create-icon" />
                  Crear
                </Button>
              </form>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}

function SupplierAliasesEditor({ supplierId, supplierName, canWrite, onChanged }: { supplierId: number; supplierName: string; canWrite: boolean; onChanged: () => Promise<void> }) {
  const [rows, setRows] = useState<AliasRow[]>([]);
  const [items, setItems] = useState<ItemOption[]>([]);
  const [unitsByItem, setUnitsByItem] = useState<Record<number, Unit[]>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadUnits = useCallback(async (itemId: number) => {
    try {
      const data = await suppliersRequest<{ units: Unit[] }>(`/items/${itemId}/units`);
      setUnitsByItem((current) => ({ ...current, [itemId]: data.units || [] }));
      return data.units || [];
    } catch {
      setUnitsByItem((current) => ({ ...current, [itemId]: [] }));
      return [];
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    setNotice("");
    try {
      const [aliasData, optionData] = await Promise.all([
        suppliersRequest<{ aliases: { id: number; supplierCode: string; description: string; stockItemId: number; stockUnitId: number }[] }>(`/suppliers/${supplierId}/aliases`),
        suppliersRequest<{ items: ItemOption[] }>("/item-options"),
      ]);
      setItems(optionData.items || []);
      const mapped = (aliasData.aliases || []).map((alias) => ({ key: `a${alias.id}`, supplierCode: alias.supplierCode, description: alias.description, stockItemId: alias.stockItemId, stockUnitId: alias.stockUnitId }));
      setRows(mapped);
      await Promise.all([...new Set(mapped.map((row) => row.stockItemId))].filter((itemId) => itemId > 0).map((itemId) => loadUnits(itemId)));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudieron cargar los alias");
    } finally {
      setLoading(false);
    }
  }, [loadUnits, supplierId]);

  useEffect(() => { void load(); }, [load]);

  const updateRow = useCallback((key: string, patch: Partial<AliasRow>) => {
    setRows((current) => current.map((row) => row.key === key ? { ...row, ...patch } : row));
  }, []);

  const setRowItem = useCallback(async (key: string, itemId: number) => {
    updateRow(key, { stockItemId: itemId, stockUnitId: 0 });
    if (itemId <= 0) return;
    const units = unitsByItem[itemId] || await loadUnits(itemId);
    const purchase = units.find((unit) => unit.isDefaultPurchase) || units[0];
    if (purchase) updateRow(key, { stockUnitId: purchase.id });
  }, [loadUnits, unitsByItem, updateRow]);

  const addRow = useCallback(() => {
    setRows((current) => [...current, { key: `n${Date.now()}${current.length}`, supplierCode: "", description: "", stockItemId: 0, stockUnitId: 0 }]);
  }, []);

  const removeRow = useCallback((key: string) => {
    setRows((current) => current.filter((row) => row.key !== key));
  }, []);

  const save = useCallback(async () => {
    if (rows.some((row) => !row.description.trim() || row.stockItemId <= 0)) {
      setError("Cada alias necesita descripción y artículo");
      return;
    }
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await suppliersRequest(`/suppliers/${supplierId}/aliases`, {
        method: "PUT",
        body: JSON.stringify({ aliases: rows.map((row) => ({ supplierCode: row.supplierCode.trim(), description: row.description, stockItemId: row.stockItemId, stockUnitId: row.stockUnitId })) }),
      });
      setNotice("Alias guardados. Las descripciones se normalizan en minúsculas.");
      await load();
      await onChanged();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudieron guardar los alias");
    } finally {
      setSaving(false);
    }
  }, [load, onChanged, rows, supplierId]);

  if (loading) return <LoadingSpinner centered size="sm" label={`Cargando alias de ${supplierName}…`} />;

  return (
    <div className="bo-stockSubsection" data-ui="stock-supplier-aliases" data-testid="stock-supplier-aliases">
      <h3 className="bo-stockSubtitle" data-ui="stock-supplier-aliases-title">Alias de albarán · {supplierName}</h3>
      <p className="bo-panelMeta" data-ui="stock-supplier-aliases-hint">Cómo aparece cada artículo en los albaranes de este proveedor (OCR). Guardar reemplaza la lista completa: las filas borradas se eliminan.</p>

      {error ? <InlineAlert kind="error" title="Alias" message={error} /> : null}
      {notice ? <InlineAlert kind="success" title="Alias" message={notice} /> : null}

      {rows.length === 0 ? (
        <p className="bo-panelMeta" data-ui="stock-supplier-aliases-empty">Sin alias. Añade uno por cada línea de albarán que no coincide con el catálogo.</p>
      ) : (
        <div className="bo-stockTableScroll" data-ui="stock-supplier-aliases-table-wrap">
          <table className="bo-table" data-ui="stock-supplier-aliases-table" data-testid="stock-supplier-aliases-table">
            <thead data-ui="stock-supplier-aliases-head">
              <tr data-ui="stock-supplier-aliases-head-row">
                <th scope="col" data-ui="stock-supplier-aliases-th-code">Código</th>
                <th scope="col" data-ui="stock-supplier-aliases-th-description">Descripción en albarán</th>
                <th scope="col" data-ui="stock-supplier-aliases-th-item">Artículo</th>
                <th scope="col" data-ui="stock-supplier-aliases-th-unit">Unidad</th>
                {canWrite ? <th scope="col" data-ui="stock-supplier-aliases-th-remove"><span className="sr-only">Quitar</span></th> : null}
              </tr>
            </thead>
            <tbody data-ui="stock-supplier-aliases-body">
              {rows.map((row) => {
                const units = row.stockItemId > 0 ? unitsByItem[row.stockItemId] || [] : [];
                return (
                  <tr key={row.key} data-ui="stock-supplier-alias-row" data-testid={`stock-supplier-alias-row-${row.key}`}>
                    <td data-ui="stock-supplier-alias-code">
                      <label data-slot="stockSuppliersPanel-sr-only" className="sr-only" htmlFor={`stock-alias-code-${row.key}`}>Código</label>
                      <input id={`stock-alias-code-${row.key}`} className="bo-input" value={row.supplierCode} disabled={!canWrite} onChange={(event) => updateRow(row.key, { supplierCode: event.target.value })} placeholder="—" data-testid={`stock-alias-code-${row.key}`} />
                    </td>
                    <td data-ui="stock-supplier-alias-description">
                      <label data-slot="stockSuppliersPanel-sr-only" className="sr-only" htmlFor={`stock-alias-description-${row.key}`}>Descripción</label>
                      <input id={`stock-alias-description-${row.key}`} className="bo-input" value={row.description} disabled={!canWrite} onChange={(event) => updateRow(row.key, { description: event.target.value })} required data-testid={`stock-alias-description-${row.key}`} />
                    </td>
                    <td data-ui="stock-supplier-alias-item">
                      <label data-slot="stockSuppliersPanel-sr-only" className="sr-only" htmlFor={`stock-alias-item-${row.key}`}>Artículo</label>
                      <select id={`stock-alias-item-${row.key}`} className="bo-input" value={row.stockItemId} disabled={!canWrite} onChange={(event) => void setRowItem(row.key, Number(event.target.value))} data-testid={`stock-alias-item-${row.key}`}>
                        <option value={0}>Artículo…</option>
                        {items.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                      </select>
                    </td>
                    <td data-ui="stock-supplier-alias-unit">
                      <label data-slot="stockSuppliersPanel-sr-only" className="sr-only" htmlFor={`stock-alias-unit-${row.key}`}>Unidad</label>
                      <select id={`stock-alias-unit-${row.key}`} className="bo-input" value={row.stockUnitId} disabled={!canWrite} onChange={(event) => updateRow(row.key, { stockUnitId: Number(event.target.value) })} data-testid={`stock-alias-unit-${row.key}`}>
                        {units.length === 0 ? <option value={0}>—</option> : null}
                        {units.map((unit) => <option key={unit.id} value={unit.id}>{unit.label}</option>)}
                      </select>
                    </td>
                    {canWrite ? (
                      <td data-ui="stock-supplier-alias-remove">
                        <button type="button" className="bo-stockIconBtn bo-stockIconBtn--danger" aria-label={`Quitar alias ${row.description || row.key}`} onClick={() => removeRow(row.key)} data-testid={`stock-alias-remove-${row.key}`}>
                          ×
                        </button>
                      </td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {canWrite ? (
        <div className="bo-stockToolbar" data-ui="stock-supplier-aliases-actions">
          <Button variant="secondary" onClick={addRow} data-testid="stock-supplier-alias-add">
            <Plus className="bo-ico" size={16} aria-hidden="true" data-ui="stock-supplier-alias-add-icon" />
            Añadir alias
          </Button>
          <Button variant="primary" disabled={saving} onClick={() => void save()} data-testid="stock-supplier-alias-save">
            Guardar alias
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function SupplierPrices({ supplierId, supplierName }: { supplierId: number; supplierName: string }) {
  const [days, setDays] = useState(180);
  const [items, setItems] = useState<PriceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await suppliersRequest<{ items: PriceItem[] }>(`/suppliers/${supplierId}/prices?days=${days}`);
      setItems(data.items || []);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo cargar el historial de precios");
    } finally {
      setLoading(false);
    }
  }, [days, supplierId]);

  useEffect(() => { void load(); }, [load]);

  return (
    <div className="bo-stockSubsection" data-ui="stock-supplier-prices" data-testid="stock-supplier-prices">
      <div className="bo-stockSubsectionHead" data-ui="stock-supplier-prices-header">
        <h3 className="bo-stockSubtitle" data-ui="stock-supplier-prices-title">Comparación de precios · {supplierName}</h3>
        <label className="bo-stockExportLabel" htmlFor="stock-supplier-prices-days" data-ui="stock-supplier-prices-days-label">Periodo</label>
        <select id="stock-supplier-prices-days" className="bo-input" value={days} onChange={(event) => setDays(Number(event.target.value))} data-testid="stock-supplier-prices-days">
          <option value={30}>30 días</option>
          <option value={90}>90 días</option>
          <option value={180}>180 días</option>
          <option value={365}>365 días</option>
        </select>
      </div>

      {error ? <InlineAlert kind="error" title="Precios" message={error} /> : null}

      {loading ? (
        <LoadingSpinner centered size="sm" label="Calculando comparación…" />
      ) : items.length === 0 ? (
        <p className="bo-panelMeta" data-ui="stock-supplier-prices-empty">Sin precios registrados para este proveedor en el periodo. Los precios llegan de albaranes (OCR) o de costes manuales.</p>
      ) : (
        <div className="bo-stockTableScroll" data-ui="stock-supplier-prices-table-wrap">
          <table className="bo-table" data-ui="stock-supplier-prices-table" data-testid="stock-supplier-prices-table">
            <thead data-ui="stock-supplier-prices-head">
              <tr data-ui="stock-supplier-prices-head-row">
                <th scope="col" data-ui="stock-supplier-prices-th-item">Artículo</th>
                <th scope="col" data-ui="stock-supplier-prices-th-samples">Muestras</th>
                <th scope="col" data-ui="stock-supplier-prices-th-min">Mín</th>
                <th scope="col" data-ui="stock-supplier-prices-th-avg">Medio</th>
                <th scope="col" data-ui="stock-supplier-prices-th-max">Máx</th>
                <th scope="col" data-ui="stock-supplier-prices-th-last">Último</th>
                <th scope="col" data-ui="stock-supplier-prices-th-others">Otros proveedores</th>
              </tr>
            </thead>
            <tbody data-ui="stock-supplier-prices-body">
              {items.map((item) => (
                <tr key={item.itemId} data-ui="stock-supplier-price-row" data-testid={`stock-supplier-price-row-${item.itemId}`}>
                  <td data-ui="stock-supplier-price-item">
                    {item.itemName}
                    <span className="bo-stockSuppliersNotes" data-ui="stock-supplier-price-date">{item.lastAt}</span>
                  </td>
                  <td data-ui="stock-supplier-price-samples">{item.samples}</td>
                  <td data-ui="stock-supplier-price-min">{displayCost(item.minCost, item.baseUnit)}</td>
                  <td data-ui="stock-supplier-price-avg">{displayCost(item.avgCost, item.baseUnit)}</td>
                  <td data-ui="stock-supplier-price-max">{displayCost(item.maxCost, item.baseUnit)}</td>
                  <td data-ui="stock-supplier-price-last">{displayCost(item.lastCost, item.baseUnit)}</td>
                  <td data-ui="stock-supplier-price-others">
                    {item.others.length === 0 ? (
                      <span data-ui="stock-supplier-price-others-none">—</span>
                    ) : (
                      <span className="bo-stockPriceOthers" data-ui="stock-supplier-price-others-list">
                        {item.others.map((other) => {
                          const delta = item.avgCost > 0 ? (other.avgCost - item.avgCost) / item.avgCost : 0;
                          return (
                            <span key={other.supplierName} className={`bo-stockPriceDelta ${delta <= 0 ? "bo-stockPriceDelta--better" : "bo-stockPriceDelta--worse"}`} data-ui="stock-supplier-price-other" data-testid={`stock-supplier-price-other-${item.itemId}-${other.supplierName}`}>
                              {other.supplierName}: {displayCost(other.avgCost, item.baseUnit)} ({delta > 0 ? "+" : ""}{Math.round(delta * 100)}%)
                            </span>
                          );
                        })}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
