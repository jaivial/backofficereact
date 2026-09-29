import React, { useCallback, useEffect, useState } from "react";
import { POSDialog } from "../POSSellScreen/POSDialog";
import { downloadCashClosurePdf, type CashClosureSummary } from "../../utils/cashClosurePdf";
import { money, parseAmount } from "../../utils/money";
import { request } from "../../hooks/usePOSRegister";

type ClosureType = "X" | "Y";

const COPY: Record<ClosureType, { title: string; hint: string }> = {
  X: { title: "Cierre X · lectura del turno", hint: "Acumulado desde la apertura del turno. No cierra nada: puedes generarlo las veces que quieras." },
  Y: { title: "Cierre Y · corte parcial", hint: "Solo lo ocurrido desde el último cierre Y (o desde la apertura). Úsalo para cambios de camarero o de caja." },
};

/**
 * Preview + confirm for Cierre X / Y from the sell screen. Shows the exact
 * figures the closure will record (fetched with ?closureType so Y previews its
 * partial period), accepts an optional cash count with discrepancy reason and
 * offers the PDF once generated. Coordination id: pos_cash_closure_dialog_v1
 */
export function POSClosureDialog({ closureType, shiftId, onClose, onGenerated }: {
  closureType: ClosureType;
  shiftId: number;
  onClose: () => void;
  onGenerated?: (message: string) => void;
}) {
  const [summary, setSummary] = useState<CashClosureSummary | null>(null);
  const [counted, setCounted] = useState("");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [generated, setGenerated] = useState<CashClosureSummary | null>(null);

  useEffect(() => {
    let alive = true;
    request<{ summary: CashClosureSummary | null }>(`/cash/summary?shiftId=${shiftId}&closureType=${closureType}`)
      .then((data) => { if (alive) setSummary(data.summary); })
      .catch((reason) => { if (alive) setError(reason instanceof Error ? reason.message : "No se pudo cargar el resumen."); });
    return () => { alive = false; };
  }, [closureType, shiftId]);

  const countedCents = counted.trim() === "" ? null : Math.round(parseAmount(counted) * 100);
  const countedInvalid = countedCents != null && (!Number.isFinite(countedCents) || countedCents < 0);
  const difference = summary && countedCents != null && !countedInvalid ? countedCents - summary.expectedCashCents : null;
  const needsReason = difference != null && difference !== 0 && !reason.trim();

  const generate = useCallback(async () => {
    if (!summary || countedInvalid || needsReason) return;
    setBusy(true); setError("");
    try {
      const data = await request<{ summary: CashClosureSummary }>("/cash/closures", { method: "POST", body: JSON.stringify({ shiftId, closureType, countedCashCents: countedCents ?? undefined, discrepancyReason: reason.trim(), note: note.trim(), idempotencyKey: `pos-closure-${closureType}:${crypto.randomUUID()}` }) });
      const saved = { ...data.summary, countedCashCents: countedCents, differenceCents: difference };
      setGenerated(saved);
      onGenerated?.(`Cierre ${closureType} generado.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : `No se pudo generar el cierre ${closureType}.`);
    } finally { setBusy(false); }
  }, [closureType, countedCents, countedInvalid, difference, needsReason, note, onGenerated, reason, shiftId, summary]);

  const shown = generated || summary;
  const rows: Array<[string, string, number | null | undefined]> = shown ? [
    ["Fondo inicial", "opening", shown.openingCashCents],
    ["Ventas netas", "net", shown.netSalesCents],
    ["Efectivo", "cash", shown.cashSalesCents],
    ["Tarjeta", "card", shown.cardSalesCents],
    ["Otros medios", "other", shown.bankSalesCents + shown.otherSalesCents],
    ["Propinas", "tips", shown.tipsCents],
    ["Descuentos", "discounts", shown.discountsCents],
    ["Reembolsos", "refunds", shown.refundsCents],
    ["Entradas / salidas", "movements", shown.cashInCents - shown.cashOutCents],
    ["Efectivo esperado", "expected", shown.expectedCashCents],
  ] : [];
  const t = `pos-closure-${closureType.toLowerCase()}`;

  return (
    <POSDialog testId={t} title={COPY[closureType].title} busy={busy} error={error} onClose={onClose}>
      <p className="pos-modal__pending" data-testid={`${t}-hint`}>{COPY[closureType].hint}</p>
      {shown ? (
        <div className="pos-closure" data-ui="pos-closure-body" data-testid={`${t}-body`}>
          <p className="pos-closure__period" data-testid={`${t}-period`}>Desde {new Date(shown.openedAt || Date.now()).toLocaleString("es-ES")} · {shown.ticketCount} tickets · {shown.covers} comensales{shown.openTicketCount ? ` · ${shown.openTicketCount} abiertos` : ""}</p>
          <dl className="pos-closure__grid" data-testid={`${t}-figures`}>
            {rows.map(([label, key, cents]) => (
              <div className={key === "expected" ? "pos-closure__row pos-closure__row--total" : "pos-closure__row"} key={key} data-testid={`${t}-row-${key}`}>
                <dt data-testid={`${t}-row-${key}-label`}>{label}</dt>
                <dd data-testid={`${t}-row-${key}-value`}>{money(cents ?? 0)}</dd>
              </div>
            ))}
          </dl>
          {generated ? (
            <div className="pos-modal__confirm" data-testid={`${t}-done`}>
              <p className="pos-modal__pending" role="status" data-testid={`${t}-done-message`}>Cierre {closureType} registrado{generated.differenceCents != null ? ` · diferencia ${money(generated.differenceCents)}` : ""}.</p>
              <button className="pos-modal__primary" type="button" onClick={() => void downloadCashClosurePdf({ closureType, summary: generated })} data-testid={`${t}-pdf`}>Descargar PDF</button>
              <button className="pos-modal__secondary" type="button" onClick={onClose} data-testid={`${t}-finish`}>Cerrar</button>
            </div>
          ) : (
            <div className="pos-modal__confirm" data-testid={`${t}-form`}>
              <label className="pos-modal__covers" htmlFor={`${t}-counted`} data-testid={`${t}-counted-field`}>Efectivo contado (opcional)
                <input id={`${t}-counted`} inputMode="decimal" value={counted} onChange={(event) => setCounted(event.target.value)} placeholder={money(shown.expectedCashCents)} aria-invalid={countedInvalid} data-testid={`${t}-counted`} />
              </label>
              {difference != null ? <p className={difference === 0 ? "pos-closure__diff" : "pos-closure__diff pos-closure__diff--off"} data-testid={`${t}-difference`}>Diferencia {money(difference)}</p> : null}
              {difference != null && difference !== 0 ? (
                <label className="pos-modal__covers" htmlFor={`${t}-reason`} data-testid={`${t}-reason-field`}>Motivo del descuadre
                  <input id={`${t}-reason`} value={reason} onChange={(event) => setReason(event.target.value)} aria-invalid={needsReason} data-testid={`${t}-reason`} />
                </label>
              ) : null}
              <label className="pos-modal__covers" htmlFor={`${t}-note`} data-testid={`${t}-note-field`}>Nota (opcional)
                <input id={`${t}-note`} value={note} onChange={(event) => setNote(event.target.value)} data-testid={`${t}-note`} />
              </label>
              <button className="pos-modal__primary" type="button" disabled={busy || countedInvalid || needsReason} onClick={() => void generate()} data-testid={`${t}-confirm`}>Generar cierre {closureType}</button>
            </div>
          )}
        </div>
      ) : !error ? <p className="pos-modal__pending" data-testid={`${t}-loading`}>Calculando…</p> : null}
    </POSDialog>
  );
}
