import React, { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "../../../../../ui/actions/Button";
import { InlineAlert } from "../../../../../ui/feedback/InlineAlert";
import { FormField } from "../../../../../ui/inputs/FormField";

type Order = { id: number; recipeName: string; batches: number; standardLabourCost: number; actualMinutes: number; actualCost?: number | null; actualCostComplete: boolean };
type Entry = { id: number; workDate: string; memberName: string; remainingMinutes: number };
type Allocation = { id: number; timeEntryId: number; minutes: number; memberName: string; workDate: string; actualCost?: number | null; costComplete: boolean };

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/admin/stock${path}`, { ...init, credentials: "include", headers: { "Content-Type": "application/json", ...init?.headers } });
  const body = await response.json();
  if (!response.ok || !body.success) throw new Error(body.message || "Error de mano de obra");
  return body as T;
}

export function ProductionLabourPanel() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [orderId, setOrderId] = useState(0);
  const [entryId, setEntryId] = useState(0);
  const [minutes, setMinutes] = useState("60");
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const selectedEntry = useMemo(() => entries.find(item => item.id === entryId), [entries, entryId]);

  const load = useCallback(async () => {
    try { const [data, entryData] = await Promise.all([req<{ items: Order[] }>("/production-orders"), req<{ items: Entry[] }>("/production-labour/entries")]); setOrders(data.items || []); setEntries(entryData.items || []); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo cargar mano de obra"); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const selectOrder = useCallback(async (id: number) => {
    setOrderId(id); setAllocations([]);
    if (!id) return;
    try { const data = await req<{ items: Allocation[] }>(`/production-orders/${id}/labour`); setAllocations(data.items || []); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo cargar asignación"); }
  }, []);

  const remove = useCallback(async (id: number) => {
    if (!orderId) return;
    try { await req(`/production-orders/${orderId}/labour/${id}`, { method: "DELETE" }); await Promise.all([load(), selectOrder(orderId)]); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo eliminar asignación"); }
  }, [load, orderId, selectOrder]);

  const save = useCallback(async () => {
    const value = Number(minutes);
    if (!orderId || !entryId || !Number.isInteger(value) || value <= 0 || value > (selectedEntry?.remainingMinutes || 0)) { setError("Minutos no válidos"); return; }
    try { await req(`/production-orders/${orderId}/labour`, { method: "POST", body: JSON.stringify({ timeEntryId: entryId, minutes: value, idempotencyKey: crypto.randomUUID() }) }); setMessage("Tiempo real asignado."); setEntryId(0); await Promise.all([load(), selectOrder(orderId)]); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo asignar tiempo"); }
  }, [entryId, load, minutes, orderId, selectOrder, selectedEntry]);

  return (
    <details className="bo-panel bo-stockDetails" data-ui="production-labour-panel">
      <summary className="bo-stockDetailsSummary" data-ui="production-labour-summary">Mano de obra real de elaboraciones</summary>
      <div className="bo-stockDetailsBody" data-ui="production-labour-body">
        <p className="bo-stockNote" data-ui="production-labour-help">Asigna minutos de fichajes cerrados. Salarios ausentes permanecen pendientes.</p>

        <div className="bo-stockFormGrid bo-stockFormGrid--4" data-ui="production-labour-fields">
          <FormField label="Elaboración" htmlFor="production-labour-order">
            <select id="production-labour-order" className="bo-input" value={orderId} onChange={event => void selectOrder(Number(event.target.value))} data-testid="production-labour-order">
              <option value={0} data-ui="production-labour-order-empty">Elaboración</option>
              {orders.map(item => <option value={item.id} key={item.id} data-ui="production-labour-order-option">#{item.id} · {item.recipeName}</option>)}
            </select>
          </FormField>
          <FormField label="Fichaje" htmlFor="production-labour-entry">
            <select id="production-labour-entry" className="bo-input" value={entryId} onChange={event => setEntryId(Number(event.target.value))} data-testid="production-labour-entry">
              <option value={0} data-ui="production-labour-entry-empty">Fichaje</option>
              {entries.map(item => <option value={item.id} key={item.id} data-ui="production-labour-entry-option">{item.workDate} · {item.memberName} · {item.remainingMinutes} min</option>)}
            </select>
          </FormField>
          <FormField label="Minutos reales" htmlFor="production-labour-minutes">
            <input id="production-labour-minutes" className="bo-input" inputMode="numeric" value={minutes} onChange={event => setMinutes(event.target.value)} data-testid="production-labour-minutes" />
          </FormField>
          <Button variant="primary" className="bo-btn--fit" style={{ alignSelf: "end" }} onClick={() => void save()} data-testid="production-labour-save">Asignar</Button>
        </div>

        {allocations.length ? (
          <div className="bo-stockRowList" data-ui="production-labour-list">
            {allocations.map(item => (
              <div className="bo-stockRow" key={item.id} data-ui="production-labour-item">
                <span data-ui="production-labour-item-detail">{item.workDate} · {item.memberName} · {item.minutes} min · {item.costComplete ? `${(item.actualCost || 0).toFixed(2)} €` : "coste pendiente"}</span>
                <Button variant="danger" size="sm" onClick={() => void remove(item.id)} data-ui="production-labour-delete">Eliminar</Button>
              </div>
            ))}
          </div>
        ) : null}

        {error ? <InlineAlert kind="error" title="Mano de obra" message={error} /> : null}
        {message ? <InlineAlert kind="success" title="Mano de obra" message={message} /> : null}
      </div>
    </details>
  );
}
