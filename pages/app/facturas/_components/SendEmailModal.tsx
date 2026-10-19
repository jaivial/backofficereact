import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Send, Loader2, Mail, MessageCircle, CheckCircle, AlertCircle, Bold, Italic, Underline, List, Link2, ExternalLink, Download, ChevronDown } from "lucide-react";
import { Modal } from "../../../../ui/overlays/Modal";
import { ModalHeader } from "../../../../ui/overlays/ModalHeader";
import { useToasts } from "../../../../ui/feedback/useToasts";
import type { Invoice } from "../../../../api/types";
import { createClient } from "../../../../api/client";

/**
 * Send-invoice modal: email and/or WhatsApp in a single action.
 * Email body is an editable HTML template (sanitised again on the server),
 * WhatsApp is an editable chat bubble. Coordination id: invoice_send_multichannel_v1
 */
interface SendEmailModalProps {
  open: boolean;
  invoice: Invoice | null;
  onClose: () => void;
  onSent: (invoice: Invoice) => void;
}

type Channel = "email" | "whatsapp";
type Result = { ok: boolean; text: string };

const eur = (n: number) => `${n.toFixed(2)} €`;
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

export function SendEmailModal({ open, invoice, onClose, onSent }: SendEmailModalProps) {
  const { pushToast } = useToasts();
  const editorRef = useRef<HTMLDivElement>(null);
  const [channels, setChannels] = useState<Record<Channel, boolean>>({ email: true, whatsapp: false });
  const [subject, setSubject] = useState("");
  const [waText, setWaText] = useState("");
  const [showPdf, setShowPdf] = useState(false);
  const [sending, setSending] = useState(false);
  const [results, setResults] = useState<Partial<Record<Channel, Result>> | null>(null);

  const hasEmail = Boolean(invoice?.customer_email);
  const hasPhone = Boolean(invoice?.customer_phone);
  const vars = useMemo(() => {
    if (!invoice) return {} as Record<string, string>;
    return {
      invoice_number: invoice.invoice_number || String(invoice.id),
      customer_name: `${invoice.customer_name}${invoice.customer_surname ? ` ${invoice.customer_surname}` : ""}`,
      total: eur(invoice.total || invoice.amount),
      restaurant_name: "Villa Carmen",
    };
  }, [invoice]);
  const pdfUrl = invoice?.id ? `/api/admin/invoices/${invoice.id}/pdf` : "";

  useEffect(() => {
    if (!open || !invoice) return;
    const safe: Record<string, string> = Object.fromEntries(Object.entries(vars).map(([k, v]) => [k, esc(v)]));
    setSubject(fill("Factura {invoice_number} - {restaurant_name}", vars));
    setWaText(fill(WA_TEXT, vars));
    setChannels({ email: Boolean(invoice.customer_email), whatsapp: !invoice.customer_email && Boolean(invoice.customer_phone) });
    setResults(null);
    setShowPdf(false);
    requestAnimationFrame(() => { if (editorRef.current) editorRef.current.innerHTML = fill(EMAIL_HTML, safe); });
  }, [open, invoice, vars]);

  const exec = (cmd: string, arg?: string) => { editorRef.current?.focus(); document.execCommand(cmd, false, arg); };
  const addLink = () => {
    const url = window.prompt("Dirección del enlace (https://…)");
    if (url && /^(https?:\/\/|mailto:)/i.test(url)) exec("createLink", url);
  };

  const selected = (Object.keys(channels) as Channel[]).filter((c) => channels[c]);
  const done = results != null;

  const send = useCallback(async () => {
    if (!invoice || sending || selected.length === 0) return;
    setSending(true);
    const api = createClient({ baseUrl: "" });
    const out: Partial<Record<Channel, Result>> = {};
    if (channels.email) {
      const html = editorRef.current?.innerHTML || "";
      try {
        const res = await api.invoices.sendWithCustomization(invoice.id, { subject: subject || undefined, message: htmlToText(html) || undefined, message_html: html || undefined });
        out.email = res.success ? { ok: true, text: `Email enviado a ${invoice.customer_email}` } : { ok: false, text: res.message || "No se pudo enviar el email" };
      } catch { out.email = { ok: false, text: "No se pudo enviar el email" }; }
    }
    if (channels.whatsapp) {
      try {
        const res = await api.reminders.send(invoice.id, { send_via: "whatsapp", custom_message: waText || undefined });
        out.whatsapp = res.success ? { ok: true, text: `WhatsApp enviado a ${invoice.customer_phone}` } : { ok: false, text: res.message || "No se pudo enviar el WhatsApp" };
      } catch { out.whatsapp = { ok: false, text: "No se pudo enviar el WhatsApp" }; }
    }
    setResults(out);
    setSending(false);
    const okAny = Object.values(out).some((r) => r?.ok);
    if (okAny) onSent(invoice.status === "enviada" ? invoice : { ...invoice, status: "enviada" });
    pushToast({ kind: okAny && Object.values(out).every((r) => r?.ok) ? "success" : "error", title: okAny ? "Envío completado" : "Error", message: Object.values(out).map((r) => r?.text).join(" · ") });
    if (okAny && Object.values(out).every((r) => r?.ok)) setTimeout(onClose, 1800);
  }, [invoice, sending, selected.length, channels, subject, waText, onSent, onClose, pushToast]);

  const close = useCallback(() => { if (!sending) onClose(); }, [sending, onClose]);
  if (!invoice) return null;
  const isResend = invoice.status === "enviada";

  return (
    <Modal open={open} onClose={close} title={isResend ? "Reenviar factura" : "Enviar factura"} widthPx={680} className="bo-sendInvoiceModal" hideClose>
      <ModalHeader title={isResend ? "Reenviar factura" : "Enviar factura"} onClose={close} />
      <div className="bo-sendInvoiceBody" data-testid="send-invoice-body" data-slot="send-invoice-body">
        <div className="bo-sendInvoiceChannels" data-testid="send-invoice-channels" role="group" aria-label="Canales de envío">
          <button type="button" className={`bo-sendNotificationTab ${channels.email ? "is-active" : ""}`} aria-pressed={channels.email} disabled={!hasEmail || sending} onClick={() => setChannels((c) => ({ ...c, email: !c.email }))} data-testid="send-invoice-channel-email">
            <Mail size={16} aria-hidden="true" /> <span data-testid="send-invoice-channel-email-label">Email</span>
          </button>
          <button type="button" className={`bo-sendNotificationTab ${channels.whatsapp ? "is-active" : ""}`} aria-pressed={channels.whatsapp} disabled={!hasPhone || sending} onClick={() => setChannels((c) => ({ ...c, whatsapp: !c.whatsapp }))} data-testid="send-invoice-channel-whatsapp">
            <MessageCircle size={16} aria-hidden="true" /> <span data-testid="send-invoice-channel-whatsapp-label">WhatsApp</span>
          </button>
        </div>

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
            <div className="bo-sendInvoiceWa" data-testid="send-invoice-wa-preview">
              <textarea className="bo-sendInvoiceWaText" value={waText} onChange={(e) => setWaText(e.target.value)} rows={6} disabled={sending} aria-label="Mensaje de WhatsApp" data-testid="send-invoice-wa-text" />
              <small className="bo-sendInvoiceWaMeta" data-testid="send-invoice-wa-meta">Vista previa del mensaje · editable</small>
            </div>
          </section>
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
