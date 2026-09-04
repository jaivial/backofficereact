import React, { useCallback, useEffect, useMemo, useState } from "react";
import { downloadCashClosurePdf, type CashClosureSummary } from "../../utils/cashClosurePdf";

type Movement = { id: number; type: "IN" | "OUT"; amountCents: number; reason: string; createdAt: string };
type Closure = { id: number; shiftId: number; closureType: "X" | "Y" | "Z"; generatedAt: string; expectedCashCents: number; countedCashCents?: number | null; differenceCents?: number | null; summary?: CashClosureSummary };

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers); headers.set("Content-Type", "application/json");
  const response = await fetch(`/api/admin/pos${path}`, { ...init, credentials: "include", headers });
  const body = await response.json(); if (!response.ok || !body.success) throw new Error(body.message || "Error de caja"); return body as T;
}
const money = (cents: number | null | undefined) => new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format((cents || 0) / 100);
const key = (prefix: string) => `${prefix}:${crypto.randomUUID()}`;

export function CashControl({ onChanged }: { onChanged?: () => void | Promise<void> }) {
  const [summary, setSummary] = useState<CashClosureSummary | null>(null);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [closures, setClosures] = useState<Closure[]>([]);
  const [movementType, setMovementType] = useState<"IN" | "OUT">("IN");
  const [movementAmount, setMovementAmount] = useState("");
  const [movementReason, setMovementReason] = useState("");
  const [countedCash, setCountedCash] = useState("");
  const [discrepancyReason, setDiscrepancyReason] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [summaryData, movementData, closureData] = await Promise.all([request<{ summary: CashClosureSummary | null }>("/cash/summary"), request<{ items: Movement[] }>("/cash/movements"), request<{ items: Closure[] }>("/cash/closures")]);
      setSummary(summaryData.summary); setMovements(movementData.items || []); setClosures(closureData.items || []); setError("");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo cargar caja"); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const createMovement = useCallback(async () => {
    const amountCents = Math.round(Number(movementAmount) * 100);
    if (!summary || amountCents <= 0 || !movementReason.trim()) return;
    setBusy(true); try { await request("/cash/movements", { method: "POST", body: JSON.stringify({ shiftId: summary.shiftId, type: movementType, amountCents, reason: movementReason.trim(), idempotencyKey: key("cash-movement") }) }); setMovementAmount(""); setMovementReason(""); setMessage("Movimiento de caja registrado."); await load(); await onChanged?.(); } catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo registrar movimiento"); } finally { setBusy(false); }
  }, [load, movementAmount, movementReason, movementType, onChanged, summary]);

  const createClosure = useCallback(async (closureType: "X" | "Y" | "Z") => {
    if (!summary) return;
    const counted = countedCash.trim() === "" ? undefined : Math.round(Number(countedCash) * 100);
    if (closureType === "Z" && counted == null) { setError("El cierre Z requiere efectivo contado."); return; }
    setBusy(true); try { const data = await request<{ summary: CashClosureSummary; closureId: number }>("/cash/closures", { method: "POST", body: JSON.stringify({ shiftId: summary.shiftId, closureType, countedCashCents: counted, discrepancyReason: discrepancyReason.trim(), note: note.trim(), idempotencyKey: key(`cash-closure-${closureType}`) }) }); setMessage(`Cierre ${closureType} generado.`); setSummary(data.summary); setCountedCash(""); setDiscrepancyReason(""); setNote(""); await load(); await onChanged?.(); } catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo generar cierre"); } finally { setBusy(false); }
  }, [countedCash, discrepancyReason, load, note, onChanged, summary]);

  const lastClosure = useMemo(() => closures[0], [closures]);
  const pdf = useCallback(async (closure: Closure) => { try { const full = closure.summary ? closure : await request<{ closure: Closure }>(`/cash/closures/${closure.id}`).then((data) => data.closure); if (full.summary) await downloadCashClosurePdf({ closureType: full.closureType, summary: full.summary }); } catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo generar PDF"); } }, []);

  return <section className="grid gap-4" data-ui="pos-cash-control">
    {error ? <p className="rounded-lg border border-[var(--bo-color-danger)] p-3 text-[var(--bo-text-danger)]" role="alert" data-ui="pos-cash-error">{error}</p> : null}
    {message ? <p className="rounded-lg border border-[var(--bo-color-success)] p-3 text-[var(--bo-text-success)]" role="status" data-ui="pos-cash-message">{message}</p> : null}
    <article className="rounded-xl border border-[var(--bo-border)] bg-[var(--bo-surface)] p-4" data-ui="pos-cash-summary">
      <div data-slot="cashControl-gap-2" className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="font-semibold text-[var(--bo-text)]" data-ui="pos-cash-title">Control de caja</h2><p className="text-xs text-[var(--bo-muted)]" data-ui="pos-cash-subtitle">Resumen por turno, entradas/salidas y cierres X/Y/Z.</p></div>{summary ? <span className="rounded-full border border-[var(--bo-border)] px-3 py-1 text-xs text-[var(--bo-muted)]" data-ui="pos-cash-shift">Turno {summary.shiftId} · {summary.terminalKey}</span> : null}</div>
      {summary ? <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4" data-ui="pos-cash-metrics"><div data-ui="pos-cash-metric-sales"><span className="text-xs text-[var(--bo-muted)]">Ventas netas</span><strong className="block text-lg text-[var(--bo-accent)]">{money(summary.netSalesCents)}</strong></div><div data-ui="pos-cash-metric-cash"><span className="text-xs text-[var(--bo-muted)]">Efectivo esperado</span><strong className="block text-lg text-[var(--bo-accent)]">{money(summary.expectedCashCents)}</strong></div><div data-ui="pos-cash-metric-tips"><span className="text-xs text-[var(--bo-muted)]">Propinas</span><strong className="block text-lg text-[var(--bo-accent)]">{money(summary.tipsCents)}</strong></div><div data-ui="pos-cash-metric-tickets"><span className="text-xs text-[var(--bo-muted)]">Tickets / pax</span><strong className="block text-lg text-[var(--bo-accent)]">{summary.ticketCount} / {summary.covers}</strong></div></div> : <p className="mt-4 text-sm text-[var(--bo-muted)]" data-ui="pos-cash-empty">No hay turno abierto.</p>}
    </article>
    {summary ? <>
      <article className="rounded-xl border border-[var(--bo-border)] bg-[var(--bo-surface)] p-4" data-ui="pos-cash-movement-form"><h3 className="font-semibold text-[var(--bo-text)]" data-ui="pos-cash-movement-title">Entrada / salida de caja</h3><div className="mt-3 grid gap-2 sm:grid-cols-4"><select className="min-h-11 rounded-lg border border-[var(--bo-border-2)] bg-[var(--bo-surface-2)] px-3" value={movementType} onChange={(event) => setMovementType(event.target.value as "IN" | "OUT")} aria-label="Tipo movimiento caja" data-ui="pos-cash-movement-type"><option value="IN">Entrada</option><option value="OUT">Salida</option></select><input className="min-h-11 rounded-lg border border-[var(--bo-border-2)] bg-[var(--bo-surface-2)] px-3" inputMode="decimal" value={movementAmount} onChange={(event) => setMovementAmount(event.target.value)} placeholder="Importe €" aria-label="Importe movimiento caja" data-ui="pos-cash-movement-amount"/><input className="min-h-11 rounded-lg border border-[var(--bo-border-2)] bg-[var(--bo-surface-2)] px-3" value={movementReason} onChange={(event) => setMovementReason(event.target.value)} placeholder="Motivo" aria-label="Motivo movimiento caja" data-ui="pos-cash-movement-reason"/><button className="min-h-11 rounded-lg bg-[var(--bo-accent)] px-4 font-semibold text-[var(--bo-bg)] disabled:opacity-50" disabled={busy} type="button" onClick={() => void createMovement()} data-ui="pos-cash-movement-submit">Registrar</button></div><div className="mt-3 grid gap-2">{movements.slice(0, 8).map((movement) => <div className="flex justify-between rounded-lg border border-[var(--bo-border)] p-3 text-sm" key={movement.id} data-ui="pos-cash-movement-row"><span className="text-[var(--bo-text)]">{movement.type === "IN" ? "Entrada" : "Salida"} · {movement.reason}</span><strong className={movement.type === "IN" ? "text-[var(--bo-text-success)]" : "text-[var(--bo-text-danger)]"}>{movement.type === "IN" ? "+" : "-"}{money(movement.amountCents)}</strong></div>)}</div></article>
      <article className="rounded-xl border border-[var(--bo-border)] bg-[var(--bo-surface)] p-4" data-ui="pos-cash-closure-form"><h3 className="font-semibold text-[var(--bo-text)]" data-ui="pos-cash-closure-title">Generar cierre</h3><div className="mt-3 grid gap-2 sm:grid-cols-4"><input className="min-h-11 rounded-lg border border-[var(--bo-border-2)] bg-[var(--bo-surface-2)] px-3" inputMode="decimal" value={countedCash} onChange={(event) => setCountedCash(event.target.value)} placeholder="Efectivo contado €" aria-label="Efectivo contado cierre" data-ui="pos-cash-counted"/><input className="min-h-11 rounded-lg border border-[var(--bo-border-2)] bg-[var(--bo-surface-2)] px-3" value={discrepancyReason} onChange={(event) => setDiscrepancyReason(event.target.value)} placeholder="Motivo diferencia (si aplica)" aria-label="Motivo diferencia cierre" data-ui="pos-cash-discrepancy"/><input className="min-h-11 rounded-lg border border-[var(--bo-border-2)] bg-[var(--bo-surface-2)] px-3" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Nota" aria-label="Nota cierre" data-ui="pos-cash-note"/><div className="flex flex-wrap gap-2"><button className="min-h-11 rounded-lg border border-[var(--bo-border-2)] px-3 text-[var(--bo-accent)]" disabled={busy} type="button" onClick={() => void createClosure("X")} data-ui="pos-cash-close-x">Cierre X</button><button className="min-h-11 rounded-lg border border-[var(--bo-border-2)] px-3 text-[var(--bo-accent)]" disabled={busy} type="button" onClick={() => void createClosure("Y")} data-ui="pos-cash-close-y">Cierre Y</button><button className="min-h-11 rounded-lg bg-[var(--bo-accent)] px-3 font-semibold text-[var(--bo-bg)]" disabled={busy} type="button" onClick={() => void createClosure("Z")} data-ui="pos-cash-close-z">Cerrar Z</button></div></div><p className="mt-2 text-xs text-[var(--bo-muted)]" data-ui="pos-cash-closure-help">El cierre Z exige efectivo contado, motivo si hay descuadre y no permite tickets o visitas abiertas.</p></article>
    </> : null}
    <article className="rounded-xl border border-[var(--bo-border)] bg-[var(--bo-surface)] p-4" data-ui="pos-cash-history"><div className="flex items-center justify-between"><h3 className="font-semibold text-[var(--bo-text)]">Histórico de cierres</h3>{lastClosure ? <button className="min-h-11 rounded-lg border border-[var(--bo-border-2)] px-3 text-[var(--bo-accent)]" type="button" onClick={() => void pdf(lastClosure)} data-ui="pos-cash-last-pdf">PDF último</button> : null}</div><div className="mt-3 grid gap-2">{closures.map((closure) => <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--bo-border)] p-3 text-sm" key={closure.id} data-ui="pos-cash-closure-row"><span className="text-[var(--bo-text)]">Cierre {closure.closureType} · turno {closure.shiftId} · {new Date(closure.generatedAt).toLocaleString("es-ES")}</span><span className="flex items-center gap-2"><strong className="text-[var(--bo-accent)]">{money(closure.differenceCents)}</strong><button className="min-h-11 rounded-lg border border-[var(--bo-border-2)] px-3 text-[var(--bo-accent)]" type="button" onClick={() => void pdf(closure)} data-ui="pos-cash-closure-pdf">PDF</button></span></div>)}</div></article>
  </section>;
}
