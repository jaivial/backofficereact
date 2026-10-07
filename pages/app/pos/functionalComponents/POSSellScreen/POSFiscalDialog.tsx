import React, { useState } from "react";
import { POSDialog } from "./POSDialog";
import { POSOfflineBar } from "./POSOfflineBar";
import { money } from "../../utils/money";
import { usePOSFiscal, usePOSPaidTickets } from "../../hooks/usePOSFiscal";
import type { Ticket, Visit } from "../../types/register";
import type { POSPaidTicketSummary } from "../../types/fiscal";

/**
 * The fiscal panel of a ticket: what the numbering series looks like, and the
 * three documents a Spanish restaurant actually needs on a table.
 *
 *   - Factura simplificada: issued once per paid ticket, on its own series per
 *     terminal, with a number that is never reused;
 *   - Duplicado: the same document printed again (guest's copy / file copy).
 *     Same number, same hash, different copy number, so the two can never be
 *     mistaken for two invoices;
 *   - Factura rectificativa: issued for a refund, naming the document it
 *     corrects and carrying the reason the law requires.
 *
 * WHAT THIS PANEL IS NOT: none of this is a certified fiscal document. Nothing
 * is signed, nothing is filed with the AEAT, and none of it implements
 * VERI*FACTU (RD 1007/2023). The banner below the title says so, permanently,
 * and it is not dismissible. A panel that lets someone mistake this for a
 * compliant invoice would be worse than no panel.
 */
export function POSFiscalDialog({ ticket, visit, online, onClose }: { ticket: Ticket | null; visit: Visit | null; online: boolean; onClose: () => void }) {
  const [reason, setReason] = useState("");
  const [terminal, setTerminal] = useState("");
  // When the till has no open ticket (the usual case right after ringing a
  // table up) the owner still has to be able to invoice that sale, so the
  // panel offers the day's paid checks and lets one be picked.
  const [picked, setPicked] = useState<POSPaidTicketSummary | null>(null);
  const paidTickets = usePOSPaidTickets(!ticket);

  // Defined before the fiscal hook below uses it.
  const activeId = ticket?.id ?? picked?.id ?? null;
  // The list is requested with status=PAID, so anything picked from it is a
  // paid ticket by construction; the open ticket still has to be checked.
  const paid = picked ? true : Boolean(ticket?.status && ticket.status !== "OPEN" && ticket.status !== "VOIDED");
  const { series, document, chain, busy, error, notice, issue, verifyChain, loadSeries, reset } = usePOSFiscal(activeId);

  const simplificadaSeries = series.find((entry) => entry.documentType === "SIMPLIFICADA");
  const rectificativaSeries = series.find((entry) => entry.documentType === "RECTIFICATIVA");
  const selectedTerminal = terminal || simplificadaSeries?.terminalKey || "main";

  // The picked summary carries no tax breakdown, so the base shown before a
  // document exists is derived the same way the till derives it: total minus
  // the tax already on the ticket. Once a document is issued its own figures
  // win, so this is only ever the pre-issue estimate.
  const pickedTotal = () => {
    const total = picked?.totalGrossCents ?? 0;
    // The summary list carries no VAT breakdown, so this is an ESTIMATE at the
    // 10% restaurant rate, and it is labelled as one. Once the document is
    // issued the server's own figures replace it, so the estimate is never the
    // number that ends up on an invoice.
    return Math.max(0, total - Math.round((total * 10) / 110));
  };

  const close = () => { reset(); setReason(""); setTerminal(""); setPicked(null); onClose(); };

  return (
    <POSDialog
      testId="pos-fiscal"
      title={`Factura · ${ticket?.ticketNumber ?? picked?.ticketNumber ?? "sin cuenta"}`}
      busy={busy}
      error={error || undefined}
      onClose={close}
    >
      <div className="pos-fiscal" data-ui="pos-fiscal-panel" data-testid="pos-fiscal-panel">
        {/* Not dismissible, not conditional. This is the sentence that keeps the
            panel from being read as a certified fiscal system. */}
        <p className="pos-fiscal__disclaimer" role="note" data-ui="pos-fiscal-disclaimer" data-testid="pos-fiscal-disclaimer">
          <strong>Documento no certificado.</strong> Esta factura no está sellada ni se presenta en la AEAT, y no cumple
          VERI*FACTU (RD 1007/2023). Numeración y encadenado por hash preparados; el sellado certificado no existe todavía.
        </p>

        <POSOfflineBar online={online} entries={[]} notice="" onSync={() => void loadSeries()} />

        {/* No open ticket: the sale has already been rung up, so offer the day's
            paid checks. Invoicing a completed sale is the normal case in Spain,
            not an exception. */}
        {!ticket ? (
          <section className="pos-fiscal__picker" data-testid="pos-fiscal-picker">
            <h3 className="pos-fiscal__sectionTitle">Cuentas cobradas</h3>
            {paidTickets.loading ? <p className="pos-fiscal__meta">Cargando cuentas cobradas...</p> : null}
            {paidTickets.error ? <p className="pos-fiscal__meta pos-fiscal__metaError">{paidTickets.error}</p> : null}
            {!paidTickets.loading && !paidTickets.tickets.length ? (
              <p className="pos-fiscal__meta">Todavia no hay cuentas cobradas hoy.</p>
            ) : null}
            <ul className="pos-fiscal__pickerList">
              {paidTickets.tickets.slice(0, 12).map((entry) => (
                <li key={entry.id}>
                  <button
                    type="button"
                    className={`pos-fiscal__pickerItem${picked?.id === entry.id ? " is-active" : ""}`}
                    aria-pressed={picked?.id === entry.id}
                    onClick={() => setPicked(entry)}
                    disabled={busy}
                    data-testid={`pos-fiscal-pick-${entry.id}`}
                  >
                    <strong>{entry.ticketNumber}</strong>
                    <span>
                      {entry.tableName ? `Mesa ${entry.tableName}` : "Sin mesa"}
                      {entry.covers ? ` · ${entry.covers} comensales` : ""} · {money(entry.totalGrossCents)}
                    </span>
                    {entry.refundedCents ? <span className="pos-fiscal__pickerNote">Devuelto {money(entry.refundedCents)}</span> : null}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <dl className="pos-fiscal__grid" data-testid="pos-fiscal-summary">
          <div><dt>Cuenta</dt><dd data-testid="pos-fiscal-ticket">{ticket?.ticketNumber ?? picked?.ticketNumber ?? "—"}</dd></div>
          <div><dt>Estado</dt><dd data-testid="pos-fiscal-status">{paid ? "Cobrada" : "Abierta (no se puede facturar)"}</dd></div>
          <div><dt>Base imponible{picked ? " (estimada)" : ""}</dt><dd data-testid="pos-fiscal-base">{money(document?.baseCents ?? pickedTotal())}</dd></div>
          <div><dt>IVA</dt><dd data-testid="pos-fiscal-tax">{money(document?.taxCents ?? (ticket?.taxCents ?? 0))}</dd></div>
          <div><dt>Total</dt><dd data-testid="pos-fiscal-total">{money(document?.totalCents ?? (ticket?.totalGrossCents ?? picked?.totalGrossCents ?? 0))}</dd></div>
          <div><dt>Comprador</dt><dd data-testid="pos-fiscal-customer">{document?.customerName || visit?.customerName || "Consumidor final"}{document?.customerTaxId ? ` · ${document.customerTaxId}` : ""}</dd></div>
        </dl>

        {series.length > 0 ? (
          <div className="pos-fiscal__series" data-testid="pos-fiscal-series">
            <h3 className="pos-fiscal__sectionTitle">Series de numeración</h3>
            <ul>
              {series.map((entry) => (
                <li key={entry.id} data-testid={`pos-fiscal-series-${entry.id}`}>
                  <span className="pos-fiscal__seriesName">{entry.documentType === "SIMPLIFICADA" ? "Simplificada" : "Rectificativa"}</span>
                  <span>terminal <strong>{entry.terminalKey}</strong></span>
                  <span>siguiente <strong>{entry.prefix}-{String(entry.nextNumber).padStart(4, "0")}</strong></span>
                  <span>{entry.issued} emitida{entry.issued === 1 ? "" : "s"}</span>
                  <button type="button" className="pos-fiscal__link" onClick={() => void verifyChain(entry.id)} disabled={busy} data-ui={`pos-fiscal-verify-${entry.id}`} data-testid={`pos-fiscal-verify-${entry.id}`}>
                    Comprobar cadena
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {document ? (
          <section className="pos-fiscal__document" data-testid="pos-fiscal-document" data-document-type={document.documentType} data-certified={String(document.isCertified)}>
            <h3 className="pos-fiscal__sectionTitle">
              {document.documentType === "SIMPLIFICADA" ? "Factura simplificada" : "Factura rectificativa"}
              {document.copyNumber && document.copyNumber > 1 ? ` · duplicado ${document.copyNumber}` : ""}
            </h3>
            <p className="pos-fiscal__number" data-testid="pos-fiscal-number">{document.fullNumber}</p>
            <p className="pos-fiscal__meta" data-testid="pos-fiscal-meta">
              Terminal {document.terminalKey} · {document.issuerTaxId ? `NIF ${document.issuerTaxId}` : "sin NIF emisor"}
              {document.correctsNumber ? ` · corrige ${document.correctsNumber}` : ""}
              {document.correctionReason ? ` · motivo: ${document.correctionReason}` : ""}
            </p>
            {document.vatBreakdown && Object.keys(document.vatBreakdown).length ? (
              <ul className="pos-fiscal__vat" data-testid="pos-fiscal-vat">
                {Object.entries(document.vatBreakdown).sort((a, b) => Number(a[0]) - Number(b[0])).map(([rate, cents]) => (
                  <li key={rate}>IVA {rate}% <strong>{money(cents)}</strong></li>
                ))}
              </ul>
            ) : null}
            {document.contentHash ? (
              <p className="pos-fiscal__hash" data-testid="pos-fiscal-hash" title={document.contentHash}>
                hash {document.contentHash.slice(0, 16)}…
              </p>
            ) : null}
            <p className="pos-fiscal__notice" data-testid="pos-fiscal-notice">{document.certificationNotice}</p>
          </section>
        ) : null}

        {chain ? (
          <section className={`pos-fiscal__chain ${chain.chainIntact ? "pos-fiscal__chain--ok" : "pos-fiscal__chain--bad"}`} data-testid="pos-fiscal-chain" data-intact={String(chain.chainIntact)}>
            <h3 className="pos-fiscal__sectionTitle">Comprobación de cadena</h3>
            <p data-testid="pos-fiscal-chain-result">
              {chain.chainIntact
                ? `${chain.documents} documento(s): la cadena de hashes está íntegra, ninguno fue alterado.`
                : `${chain.documents} documento(s): ${chain.problems.length} con problemas.`}
            </p>
            <p className="pos-fiscal__meta">{chain.whatThisIs}</p>
            <p className="pos-fiscal__meta">{chain.whatThisIsNot}</p>
            {chain.problems.length ? (
              <ul>{chain.problems.map((problem) => <li key={problem.id}>{problem.fullNumber}: {problem.problems.join("; ")}</li>)}</ul>
            ) : null}
          </section>
        ) : null}

        {notice ? <p className="pos-fiscal__ok" role="status" data-testid="pos-fiscal-notice-ok">{notice}</p> : null}

        <div className="pos-fiscal__actions">
          <label className="pos-fiscal__label">
            Terminal
            <select value={selectedTerminal} onChange={(event) => setTerminal(event.target.value)} data-ui="pos-fiscal-terminal" data-testid="pos-fiscal-terminal">
              {[...new Set([simplificadaSeries?.terminalKey || "main", ...series.map((entry) => entry.terminalKey)])].map((key) => (
                <option key={key} value={key}>{key}</option>
              ))}
            </select>
          </label>
          <button type="button" className="pos-fiscal__primary" disabled={busy || !paid || !online} onClick={() => void issue("issue", { terminalKey: selectedTerminal })} data-ui="pos-fiscal-issue" data-testid="pos-fiscal-issue">
            Emitir factura simplificada
          </button>
          <button type="button" disabled={busy || !document || !online} onClick={() => void issue("duplicate", { copyNumber: (document?.copyNumber ?? 1) + 1, terminalKey: selectedTerminal })} data-ui="pos-fiscal-duplicate" data-testid="pos-fiscal-duplicate">
            Emitir duplicado
          </button>
          <label className="pos-fiscal__label">
            Motivo de la rectificación
            <input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="p. ej. devolución de platos" data-ui="pos-fiscal-reason" data-testid="pos-fiscal-reason" />
          </label>
          <button type="button" disabled={busy || !document || !online || reason.trim() === ""} onClick={() => void issue("rectify", { reason, terminalKey: selectedTerminal })} data-ui="pos-fiscal-rectify" data-testid="pos-fiscal-rectify">
            Emitir factura rectificativa
          </button>
        </div>
        {!online ? <p className="pos-fiscal__meta" data-testid="pos-fiscal-offline">Sin conexión: emitir un documento fiscal necesita el TPV; 也 espera espera a que vuelva la red.</p> : null}
        {!paid ? <p className="pos-fiscal__meta" data-testid="pos-fiscal-not-paid">La cuenta tiene que estar cobrada antes de emitir una factura.</p> : null}
        {rectificativaSeries ? null : <p className="pos-fiscal__meta" data-testid="pos-fiscal-no-rect-series">La serie rectificativa se crea sola la primera vez que se emite una rectificación.</p>}
      </div>
    </POSDialog>
  );
}
