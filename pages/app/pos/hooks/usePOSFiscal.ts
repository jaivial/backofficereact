import { useCallback, useEffect, useState } from "react";
import { request } from "./usePOSRegister";
import type { POSFiscalChain, POSFiscalDocument, POSFiscalSeries } from "../types/fiscal";

/**
 * Issuing the fiscal documents of a ticket, and reading the numbering series.
 *
 * Everything here talks to /api/admin/pos/fiscal/* and goes through the same
 * `request()` the rest of the till uses, so a session cookie, an error message
 * and the offline policy all behave the same way as on the sell screen.
 *
 * Issuing is deliberately NOT queued offline: a fiscal document must never be
 * created on a guess about what the server will accept, and a number that only
 * exists locally would be renumbered the moment the network came back.
 */
export function usePOSFiscal(ticketId: number | null) {
  const [series, setSeries] = useState<POSFiscalSeries[]>([]);
  const [document, setDocument] = useState<POSFiscalDocument | null>(null);
  const [chain, setChain] = useState<POSFiscalChain | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadSeries = useCallback(async () => {
    try {
      const data = await request<{ series: POSFiscalSeries[] }>("/fiscal/series");
      setSeries(data.series || []);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudieron leer las series de facturación");
    }
  }, []);

  useEffect(() => { void loadSeries(); }, [loadSeries]);

  /** Emits, duplicates or rectifies a document for the current ticket. */
  const issue = useCallback(async (action: "issue" | "duplicate" | "rectify", extra?: { reason?: string; copyNumber?: number; terminalKey?: string }) => {
    if (!ticketId) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const data = await request<{ document: POSFiscalDocument }>(`/tickets/${ticketId}/fiscal-document`, {
        method: "POST",
        body: JSON.stringify({ action, ...extra }),
      });
      setDocument(data.document);
      const verb = action === "duplicate" ? "Duplicado emitido" : action === "rectify" ? "Factura rectificativa emitida" : "Factura simplificada emitida";
      setNotice(`${verb}: ${data.document.fullNumber}`);
      await loadSeries();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo emitir el documento");
    } finally {
      setBusy(false);
    }
  }, [loadSeries, ticketId]);

  /** Runs the chain self-check on a series and says plainly what it proved. */
  const verifyChain = useCallback(async (seriesId: number) => {
    setBusy(true); setError(""); setNotice("");
    try {
      const data = await request<{ chain: POSFiscalChain }>(`/fiscal/series/${seriesId}/verify`);
      setChain(data.chain);
      setNotice(data.chain.chainIntact ? "Cadena íntegra: ningún documento fue alterado." : `Cadena con ${data.chain.problems.length} problema(s).`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo comprobar la cadena");
    } finally {
      setBusy(false);
    }
  }, []);

  /** Forgets a document so switching tables never shows the previous one. */
  const reset = useCallback(() => { setDocument(null); setChain(null); setError(""); setNotice(""); }, []);

  return { series, document, chain, busy, error, notice, issue, verifyChain, loadSeries, reset, setError };
}
