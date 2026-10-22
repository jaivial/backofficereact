import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Send, Loader2, Mail, MessageCircle, CheckCircle, AlertCircle, Bold, Italic, Underline, List, Link2, ExternalLink, Download, ChevronDown } from "lucide-react";
import { Modal } from "../../../../ui/overlays/Modal";
import { ModalHeader } from "../../../../ui/overlays/ModalHeader";
import { useToasts } from "../../../../ui/feedback/useToasts";
import type { Invoice } from "../../../../api/types";
import { createClient } from "../../../../api/client";
import { useAtomValue } from "jotai";
import { sessionAtom } from "../../../../state/atoms";
import { InvoiceWhatsAppChatPreview } from "./InvoiceWhatsAppChatPreview";
import { invoiceTotal, moneyEs } from "../utils";

/**
 * Send-invoice modal: email and/or WhatsApp in a single action.
 * Email body is an editable HTML template (sanitised again on the server),
 * WhatsApp is an editable chat clone of the real conversation, and the
 * send goes to POST /invoices/{id}/send-whatsapp (invoice_send_whatsapp_v1).
 * Coordination id: invoice_send_multichannel_v1
 */
interface SendEmailModalProps {
  open: boolean;
  invoice: Invoice | null;
  onClose: () => void;
  onSent: (invoice: Invoice) => void;
}

type Channel = "email" | "whatsapp";
type Result = { ok: boolean; text: string };

const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function fill(tpl: string, vars: Record<string, string>): string {
  return Object.entries(vars).reduce((acc, [k, v]) => acc.split(`{${k}}`).join(v), tpl);
}

const EMAIL_HTML = `<p>Estimado/a {customer_name},</p><p>Adjuntamos la factura <b>{invoice_number}</b> por importe de <b>{total}</b>.</p><p>Quedamos a su disposición para cualquier consulta.</p><p>Un saludo,<br>{restaurant_name}</p>`;
const WA_TEXT = `Hola {customer_name}, le enviamos la factura {invoice_number} por importe de {total}.\n\nQuedamos a su disposición para cualquier consulta.\n\n{restaurant_name}`;

function htmlToText(html: string): string {
  const d = document.createElement("div");
  d.innerHTML = html.replace(/<br\s*\/?>/gi, "\n").replace(/<\/(p|li|h2|h3)>/gi, "\n");
  return (d.textContent || "").replace(/\n{3,}/g, "\n\n").trim();
}

// invoice_send_whatsapp_v1: one idempotency key per send intent, persisted
// per invoice so closing/reopening the modal resumes the same attempt; the
// key clears on full success (a later open is then a deliberate new intent).
const waStorageKey = (userId: number, restaurantId: number, invoiceId: number) => `bo-wa-send-key:u${userId}:r${restaurantId}:i${invoiceId}`;
const newWaKey = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `wa-${Date.now()}-${Math.random().toString(36).slice(2)}`);

export function SendEmailModal({ open, invoice, onClose, onSent }: SendEmailModalProps) {
  const { pushToast } = useToasts();
  const editorRef = useRef<HTMLDivElement>(null);
  const [channels, setChannels] = useState<Record<Channel, boolean>>({ email: true, whatsapp: false });
  const [subject, setSubject] = useState("");
  const [waText, setWaText] = useState("");
  const [showPdf, setShowPdf] = useState(false);
  const [sending, setSending] = useState(false);
  const [results, setResults] = useState<Partial<Record<Channel, Result>> | null>(null);
  // invoice_send_whatsapp_v1: one idempotency key per send intent (retries of
  // the same intent resume, never duplicate); a fresh modal open = new intent.
  const [waKey, setWaKey] = useState("");
  const [waPhoneConfirm, setWaPhoneConfirm] = useState<string | null>(null);
  const [waUncertainStage, setWaUncertainStage] = useState<string | null>(null);
  const [waUncertainStatus, setWaUncertainStatus] = useState<string | null>(null);
  const [waPhoneChanged, setWaPhoneChanged] = useState<{ from: string; to: string } | null>(null);
  const [waNewIntentConfirm, setWaNewIntentConfirm] = useState<string | null>(null); // phone of the proposed new intent
  const [waUncertainPhone, setWaUncertainPhone] = useState<string>("");
  const session = useAtomValue(sessionAtom);
  const waUserId = session?.user?.id ?? 0;

  const hasEmail = Boolean(invoice?.customer_email);
  const hasPhone = Boolean(invoice?.customer_phone);
  const vars = useMemo(() => {
    if (!invoice) return {} as Record<string, string>;
    return {
      invoice_number: invoice.invoice_number || String(invoice.id),
      customer_name: `${invoice.customer_name}${invoice.customer_surname ? ` ${invoice.customer_surname}` : ""}`,
      // invoice_amount_consistency_v1: canonical total (total ?? amount) and
      // Spanish style identical to the attached PDF, so the email/WhatsApp
      // body reads the same number as the document it cites (184,80 €).
      total: moneyEs(invoiceTotal(invoice), invoice.currency),
      restaurant_name:
        session?.restaurants.find((r) => r.id === session?.activeRestaurantId)?.name ??
        "Restaurante",
    };
  }, [invoice, session]);
  const pdfUrl = invoice?.id ? `/api/admin/invoices/${invoice.id}/pdf` : "";
  const invoicePDFFileName = invoice?.id ? `factura-${invoice.invoice_number || invoice.id}.pdf` : "";

  useEffect(() => {
    if (!open || !invoice) return;
    const safe: Record<string, string> = Object.fromEntries(Object.entries(vars).map(([k, v]) => [k, esc(v)]));
    setSubject(fill("Factura {invoice_number} - {restaurant_name}", vars));
    setWaText(fill(WA_TEXT, vars));
    setChannels({ email: Boolean(invoice.customer_email), whatsapp: !invoice.customer_email && Boolean(invoice.customer_phone) });
    setResults(null);
    setShowPdf(false);
    setWaPhoneConfirm(null);
    setWaUncertainStage(null);
    setWaUncertainStatus(null);
    setWaPhoneChanged(null);
    setWaNewIntentConfirm(null);
    setWaUncertainPhone("");
    let cancelled = false;
    const scopedKey = waStorageKey(waUserId, invoice.restaurant_id, invoice.id);
    void (async () => {
      try {
        const stored = localStorage.getItem(scopedKey);
        if (stored) {
          if (!cancelled) setWaKey(stored);
          return;
        }
      } catch { /* storage optional */ }
      // No local key (fresh browser or post-logout): recover the durable
      // attempt from the backend instead of starting a blind new intent.
      try {
        const api = createClient({ baseUrl: "" });
        const res = await api.invoices.getWhatsAppAttempt(invoice.id);
        const att = res.success ? res.attempt : null;
        const resumable = att != null && !(att.text_status === "sent" && att.pdf_status === "sent");
        const key = resumable && att ? att.idempotency_key : newWaKey();
        try { localStorage.setItem(scopedKey, key); } catch { /* storage optional */ }
        if (!cancelled) setWaKey(key);
      } catch {
        if (!cancelled) setWaKey(newWaKey());
      }
    })();
    requestAnimationFrame(() => { if (editorRef.current) editorRef.current.innerHTML = fill(EMAIL_HTML, safe); });
    return () => { cancelled = true; };
  }, [open, invoice, vars, waUserId]);

  // Explicit new send intent: fresh idempotency key (persisted so close/
  // reopen resumes it), old attempt preserved server-side as audit record.

  const exec = (cmd: string, arg?: string) => { editorRef.current?.focus(); document.execCommand(cmd, false, arg); };
  const addLink = () => {
    const url = window.prompt("Dirección del enlace (https://…)");
    if (url && /^(https?:\/\/|mailto:)/i.test(url)) exec("createLink", url);
  };

  const selected = (Object.keys(channels) as Channel[]).filter((c) => channels[c]);
  const done = results != null;

  const send = useCallback(async (opts?: { freshKey?: string }) => {
    if (!invoice || sending || selected.length === 0) return;
    // A fresh intent (new idempotency key) starts clean: no phone-confirm or
    // uncertain-stage carry-over, and the WhatsApp channel always re-runs.
    const fresh = opts?.freshKey != null;
    const effKey = opts?.freshKey ?? waKey;
    const effConfirm = fresh ? null : waPhoneConfirm;
    const effUncertain = fresh ? null : waUncertainStage;
    setSending(true);
    const api = createClient({ baseUrl: "" });
    const out: Partial<Record<Channel, Result>> = { ...(results || {}) };
    if (fresh) delete out.whatsapp;
    if (channels.email && !results?.email?.ok) {
      const html = editorRef.current?.innerHTML || "";
      try {
        const res = await api.invoices.sendWithCustomization(invoice.id, { subject: subject || undefined, message: htmlToText(html) || undefined, message_html: html || undefined });
        out.email = res.success ? { ok: true, text: `Email enviado a ${invoice.customer_email}` } : { ok: false, text: res.message || "No se pudo enviar el email" };
      } catch { out.email = { ok: false, text: "No se pudo enviar el email" }; }
    }
    if (channels.whatsapp && (fresh || !results?.whatsapp?.ok || effUncertain != null)) {
      try {
        const res = await api.invoices.sendWhatsApp(invoice.id, { message: waText || undefined, idempotency_key: effKey, confirm_phone: effConfirm != null, retry_stage: effUncertain === "text" || effUncertain === "pdf" ? effUncertain : undefined });
        if (!res.success && res.code === "phone_confirm_needed") {
          // The invoice phone has no explicit international prefix: the operator
          // must confirm the normalised destination before anything is sent.
          setWaPhoneConfirm(res.phone_normalized || "");
          setResults(out);
          setSending(false);
          return;
        }
        if (!res.success && res.code === "phone_changed") {
          // The invoice phone was edited after this intent started: the old
          // attempt is preserved and only a NEW intent may target the new
          // number (never a silent switch of destination mid-intent).
          setWaPhoneChanged({ from: res.attempt_phone || "", to: res.phone_normalized || "" });
          setResults(out);
          setSending(false);
          return;
        }
        if (!res.success && res.code === "stage_uncertain") {
          // A previous attempt may have delivered this stage before crashing;
          // the backend retained it without re-sending. The operator must
          // verify with the customer and explicitly retry just this stage
          // (unknown) or start a new intent (inflight: writer may be live).
          setWaUncertainStage(res.stage || "text");
          setWaUncertainStatus(res.stage_status || "unknown");
          setWaUncertainPhone(res.phone_normalized || invoice.customer_phone || "");
          setResults(out);
          setSending(false);
          return;
        }
        if (res.success) {
          setWaPhoneConfirm(null);
          setWaPhoneChanged(null);
          if (res.pdf_uncertain) {
            // Text is confirmed sent but the PDF may have gone out in a
            // crashed attempt: keep the key (a new intent would resend the
            // text) and offer the explicit pdf-only retry.
            setWaUncertainStage("pdf");
            setWaUncertainStatus(res.pdf_status || "unknown");
          } else {
            setWaUncertainStage(null);
            try { localStorage.removeItem(waStorageKey(waUserId, invoice.restaurant_id, invoice.id)); } catch { /* storage optional */ }
          }
        }
        out.whatsapp = res.success
          ? { ok: true, text: `WhatsApp enviado a ${res.phone_normalized || invoice.customer_phone}${res.pdf_attached === false ? (res.pdf_uncertain ? " (PDF en estado incierto: un intento anterior pudo haberlo enviado; no se reenvió)" : " (sin PDF adjunto)") : ""}` }
          : { ok: false, text: res.message || "No se pudo enviar el WhatsApp" };
      } catch { out.whatsapp = { ok: false, text: "No se pudo enviar el WhatsApp" }; }
    }
    setResults(out);
    setSending(false);
    const selectedResults = selected.map((c) => out[c]).filter((r): r is Result => Boolean(r));
    const okAny = selectedResults.some((r) => r.ok);
    if (okAny) onSent(invoice.status === "enviada" || invoice.status === "pagada" ? invoice : { ...invoice, status: "enviada" });
    pushToast({ kind: okAny && selectedResults.every((r) => r.ok) ? "success" : "error", title: okAny ? "Envío completado" : "Error", message: selectedResults.map((r) => r.text).join(" · ") });
    if (okAny && selectedResults.every((r) => r.ok)) setTimeout(onClose, 1800);
  }, [invoice, sending, selected, channels, subject, waText, waKey, waPhoneConfirm, waUncertainStage, waUserId, results, onSent, onClose, pushToast]);

  const startNewIntent = useCallback(() => {
    if (!invoice || !waNewIntentConfirm) return;
    const freshKey = newWaKey();
    try { localStorage.setItem(waStorageKey(waUserId, invoice.restaurant_id, invoice.id), freshKey); } catch { /* storage optional */ }
    setWaKey(freshKey);
    setWaPhoneConfirm(null);
    setWaUncertainStage(null);
    setWaUncertainStatus(null);
    setWaPhoneChanged(null);
    setWaNewIntentConfirm(null);
    void send({ freshKey });
  }, [invoice, waUserId, waNewIntentConfirm, send]);

  const close = useCallback(() => { if (!sending) onClose(); }, [sending, onClose]);
  if (!invoice) return null;
  const isResend = invoice.status === "enviada";

  return (
    <Modal open={open} onClose={close} title={isResend ? "Reenviar factura" : "Enviar factura"} widthPx={680} className="bo-sendInvoiceModal" hideClose>
      <ModalHeader title={isResend ? "Reenviar factura" : "Enviar factura"} onClose={close} />
      <div className="bo-sendInvoiceBody" data-testid="send-invoice-body" data-slot="send-invoice-body">
        <div className="bo-sendInvoiceChannels" data-testid="send-invoice-channels" role="group" aria-label="Canales de envío">
          <button type="button" className={`bo-sendNotificationTab ${channels.email ? "is-active" : ""}`} aria-pressed={channels.email} disabled={!hasEmail || sending} onClick={() => setChannels((c) => ({ ...c, email: !c.email }))} data-testid="send-invoice-channel-email">
            <span className={`bo-channelBox${channels.email ? " is-on" : ""}`} aria-hidden="true" /><Mail size={16} aria-hidden="true" /> <span data-testid="send-invoice-channel-email-label">Email</span>
          </button>
          <button type="button" className={`bo-sendNotificationTab ${channels.whatsapp ? "is-active" : ""}`} aria-pressed={channels.whatsapp} disabled={!hasPhone || sending} onClick={() => setChannels((c) => ({ ...c, whatsapp: !c.whatsapp }))} data-testid="send-invoice-channel-whatsapp">
            <span className={`bo-channelBox${channels.whatsapp ? " is-on" : ""}`} aria-hidden="true" /><MessageCircle size={16} aria-hidden="true" /> <span data-testid="send-invoice-channel-whatsapp-label">WhatsApp</span>
          </button>
        </div>
        {/* invoice_send_channels_v1: independent toggles, both may be on; the
            submit button always names exactly the chosen channels. */}
        <p className="bo-sendInvoiceChannelsHint" data-testid="send-invoice-channels-hint">Canales independientes: puedes marcar ambos. El botón de envío indica exactamente por cuáles se enviará.</p>

        <div className="bo-sendInvoiceMeta" data-testid="send-invoice-meta">
          <b data-testid="send-invoice-customer">{vars.customer_name}</b>
          <span data-testid="send-invoice-total">{vars.total}</span>
          {pdfUrl ? (
            <button type="button" className="bo-btn bo-btn--ghost bo-btn--sm" onClick={() => setShowPdf((v) => !v)} aria-expanded={showPdf} data-testid="send-invoice-pdf-toggle">
              PDF <ChevronDown size={14} aria-hidden="true" />
            </button>
          ) : null}
        </div>
        {showPdf && pdfUrl ? (
          <div className="bo-sendInvoicePdf" data-testid="send-invoice-pdf">
            <div className="bo-sendInvoicePdfActions" data-testid="send-invoice-pdf-actions">
              <a className="bo-btn bo-btn--ghost bo-btn--sm" href={pdfUrl} target="_blank" rel="noreferrer" aria-label="Ver página completa" data-testid="send-invoice-pdf-open"><ExternalLink size={14} aria-hidden="true" /></a>
              <a className="bo-btn bo-btn--ghost bo-btn--sm" href={pdfUrl} download aria-label="Descargar" data-testid="send-invoice-pdf-download"><Download size={14} aria-hidden="true" /></a>
            </div>
            <iframe src={pdfUrl} title="Vista previa del PDF" className="bo-sendInvoicePdfFrame" data-testid="send-invoice-pdf-frame" />
          </div>
        ) : null}

        {channels.email ? (
          <section className="bo-sendInvoiceSection" data-testid="send-invoice-email-section" aria-label="Email">
            <div className="bo-sendInvoiceTo" data-testid="send-invoice-email-to"><Mail size={14} aria-hidden="true" /> {invoice.customer_email}</div>
            <label className="bo-field" data-testid="send-invoice-subject-field">
              <span className="bo-label" data-testid="send-invoice-subject-label">Asunto</span>
              <input className="bo-input" value={subject} onChange={(e) => setSubject(e.target.value)} disabled={sending} data-testid="send-invoice-subject" />
            </label>
            <div className="bo-field" data-testid="send-invoice-editor-field">
              <span className="bo-label" data-testid="send-invoice-editor-label">Mensaje (plantilla HTML editable)</span>
              <div className="bo-sendInvoiceToolbar" data-testid="send-invoice-toolbar" role="toolbar" aria-label="Formato">
                <button type="button" className="bo-btn bo-btn--ghost bo-btn--sm" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("bold")} aria-label="Negrita" data-testid="send-invoice-fmt-bold"><Bold size={14} aria-hidden="true" /></button>
                <button type="button" className="bo-btn bo-btn--ghost bo-btn--sm" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("italic")} aria-label="Cursiva" data-testid="send-invoice-fmt-italic"><Italic size={14} aria-hidden="true" /></button>
                <button type="button" className="bo-btn bo-btn--ghost bo-btn--sm" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("underline")} aria-label="Subrayado" data-testid="send-invoice-fmt-underline"><Underline size={14} aria-hidden="true" /></button>
                <button type="button" className="bo-btn bo-btn--ghost bo-btn--sm" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("insertUnorderedList")} aria-label="Lista" data-testid="send-invoice-fmt-list"><List size={14} aria-hidden="true" /></button>
                <button type="button" className="bo-btn bo-btn--ghost bo-btn--sm" onMouseDown={(e) => e.preventDefault()} onClick={addLink} aria-label="Enlace" data-testid="send-invoice-fmt-link"><Link2 size={14} aria-hidden="true" /></button>
              </div>
              <div ref={editorRef} className="bo-sendInvoiceEditor" contentEditable={!sending} suppressContentEditableWarning role="textbox" aria-multiline="true" aria-label="Mensaje del email" data-testid="send-invoice-editor" />
            </div>
          </section>
        ) : null}

        {channels.whatsapp ? (
          <section className="bo-sendInvoiceSection" data-testid="send-invoice-wa-section" aria-label="WhatsApp">
            <div className="bo-sendInvoiceTo" data-testid="send-invoice-wa-to"><MessageCircle size={14} aria-hidden="true" /> {invoice.customer_phone}</div>
            <InvoiceWhatsAppChatPreview
              key={`${invoice.id}-${open}`}
              brandName={vars.restaurant_name || "Restaurante"}
              value={waText}
              pdfName={invoicePDFFileName}
              disabled={sending}
              onChange={setWaText}
            />
            {/(https?:\/\/|www\.)/i.test(waText) ? (
              <p className="bo-sendInvoiceWaLinkNote" data-testid="send-invoice-wa-link-note">El mensaje contiene enlaces: se enviarán como botones interactivos de WhatsApp; el formato puede diferir del texto editado.</p>
            ) : null}
          </section>
        ) : null}

        {waPhoneChanged != null ? (
          <div className="bo-sendInvoicePhoneConfirm" data-testid="send-invoice-phone-changed" role="alert">
            <p data-testid="send-invoice-phone-changed-text">
              El teléfono de la factura cambió desde que se inició este envío ({waPhoneChanged.from || "—"} → {waPhoneChanged.to || "—"}). El intento anterior se conserva sin reenviar. Para el nuevo número, inicia un envío nuevo.
            </p>
            <div className="bo-sendInvoicePhoneConfirmActions">
              <button type="button" className="bo-btn bo-btn--ghost bo-btn--sm" onClick={() => setWaPhoneChanged(null)} disabled={sending} data-testid="send-invoice-phone-changed-cancel">Cancelar</button>
              {waPhoneChanged.to ? (
                <button type="button" className="bo-btn bo-btn--primary bo-btn--sm" onClick={() => setWaNewIntentConfirm(waPhoneChanged.to)} disabled={sending} data-testid="send-invoice-phone-changed-new">Iniciar nuevo envío a {waPhoneChanged.to}</button>
              ) : (
                <span className="bo-sendInvoiceMissingPhone" data-testid="send-invoice-phone-changed-missing">Sin número de destino válido: corrige el teléfono en la factura.</span>
              )}
            </div>
          </div>
        ) : null}

        {waPhoneConfirm != null ? (
          <div className="bo-sendInvoicePhoneConfirm" data-testid="send-invoice-phone-confirm" role="alert">
            <p data-testid="send-invoice-phone-confirm-text">
              El teléfono de la factura no lleva prefijo internacional. Se enviará a <b>{waPhoneConfirm}</b> (se ha asumido +34). Confirma el número antes de enviar.
            </p>
            <div className="bo-sendInvoicePhoneConfirmActions">
              <button type="button" className="bo-btn bo-btn--ghost bo-btn--sm" onClick={() => setWaPhoneConfirm(null)} disabled={sending} data-testid="send-invoice-phone-confirm-cancel">Corregir factura</button>
              <button type="button" className="bo-btn bo-btn--primary bo-btn--sm" onClick={() => void send()} disabled={sending} data-testid="send-invoice-phone-confirm-ok">Confirmar {waPhoneConfirm} y enviar</button>
            </div>
          </div>
        ) : null}

        {waUncertainStage != null ? (
          <div className="bo-sendInvoicePhoneConfirm" data-testid="send-invoice-stage-uncertain" role="alert">
            <p data-testid="send-invoice-stage-uncertain-text">
              Un intento anterior pudo haber enviado {waUncertainStage === "pdf" ? "el PDF" : "el texto"} antes de fallar. No se ha reenviado automáticamente para no duplicar el mensaje al cliente. Verifica la entrega; solo reenvía si confirmas que no llegó.
            </p>
            <div className="bo-sendInvoicePhoneConfirmActions">
              <button type="button" className="bo-btn bo-btn--ghost bo-btn--sm" onClick={() => setWaUncertainStage(null)} disabled={sending} data-testid="send-invoice-stage-uncertain-cancel">Cancelar</button>
              {waUncertainStatus === "unknown" ? (
                <button type="button" className="bo-btn bo-btn--primary bo-btn--sm" onClick={() => void send()} disabled={sending} data-testid="send-invoice-stage-uncertain-retry">Verifiqué que no llegó: reenviar {waUncertainStage === "pdf" ? "el PDF" : "el texto"}</button>
              ) : (
                waUncertainPhone ? (
                  <button type="button" className="bo-btn bo-btn--primary bo-btn--sm" onClick={() => setWaNewIntentConfirm(waUncertainPhone)} disabled={sending} data-testid="send-invoice-stage-uncertain-new">Verifiqué que no llegó: iniciar envío nuevo</button>
                ) : (
                  <span className="bo-sendInvoiceMissingPhone" data-testid="send-invoice-stage-uncertain-missing">Sin número de destino válido: corrige el teléfono en la factura.</span>
                )
              )}
            </div>
          </div>
        ) : null}

        {waNewIntentConfirm != null ? (
          <div className="bo-sendInvoicePhoneConfirm" data-testid="send-invoice-new-intent-confirm" role="alert">
            <p data-testid="send-invoice-new-intent-confirm-text">
              Se enviarán de nuevo el texto y el PDF a <b>{waNewIntentConfirm}</b>. Si el envío anterior llegó, el cliente recibirá mensajes DUPLICADOS. Revisa el texto y el destinatario en la vista previa de este modal antes de confirmar.
            </p>
            <div className="bo-sendInvoicePhoneConfirmActions">
              <button type="button" className="bo-btn bo-btn--ghost bo-btn--sm" onClick={() => setWaNewIntentConfirm(null)} disabled={sending} data-testid="send-invoice-new-intent-cancel">Cancelar</button>
              <button type="button" className="bo-btn bo-btn--primary bo-btn--sm" onClick={startNewIntent} disabled={sending} data-testid="send-invoice-new-intent-ok">Confirmar y enviar de nuevo a {waNewIntentConfirm}</button>
            </div>
          </div>
        ) : null}

        {results ? (
          <ul className="bo-sendInvoiceResults" data-testid="send-invoice-results">
            {(Object.entries(results) as [Channel, Result][]).map(([k, r]) => (
              <li key={k} className={r.ok ? "is-ok" : "is-error"} data-testid={`send-invoice-result-${k}`}>
                {r.ok ? <CheckCircle size={16} aria-hidden="true" /> : <AlertCircle size={16} aria-hidden="true" />} {r.text}
              </li>
            ))}
          </ul>
        ) : null}

        <div className="bo-sendInvoiceFooter" data-testid="send-invoice-footer">
          <button type="button" className="bo-btn bo-btn--secondary" onClick={close} disabled={sending} data-testid="send-invoice-cancel">{done ? "Cerrar" : "Cancelar"}</button>
          <button type="button" className="bo-btn bo-btn--primary" onClick={() => void send()} disabled={sending || selected.length === 0} data-testid="send-invoice-submit">
            {sending ? <Loader2 size={16} className="bo-spinner" aria-hidden="true" /> : <Send size={16} aria-hidden="true" />}
            {sending ? "Enviando…" : selected.length === 2 ? "Enviar por email y WhatsApp" : selected[0] === "whatsapp" ? "Enviar por WhatsApp" : "Enviar por email"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
