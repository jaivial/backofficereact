import React, { useCallback, useEffect, useMemo, useState } from "react";
import { X, Send, Mail, MessageSquare, Clock, AlertCircle } from "lucide-react";
import type { Invoice, ReminderTemplate, SendReminderInput } from "../../../../api/types";
import { Select } from "../../../../ui/inputs/Select";
import { useToasts } from "../../../../ui/feedback/useToasts";
import { createClient } from "../../../../api/client";

interface ReminderModalProps {
  invoice: Invoice;
  open: boolean;
  onClose: () => void;
  onReminderSent?: () => void;
}

const DEFAULT_EMAIL_SUBJECT = "Recordatorio de pago - Factura {invoice_number}";
const DEFAULT_EMAIL_BODY = `Estimado/a {customer_name},

Le escribimos para recordarle que la factura #{invoice_number} por importe de {amount} EUR vence el {due_date}.

Por favor, proceda al pago a la mayor brevedad posible. Si ya ha realizado el pago, por favor ignore este mensaje.

Un saludo,
Equipo de Villa Carmen`;

const DEFAULT_WHATSAPP_BODY = `Hola {customer_name}, te recordamos que la factura #{invoice_number} por {amount} EUR vence el {due_date}. Por favor, procede al pago. Un saludo, Villa Carmen`;

export function ReminderModal({ invoice, open, onClose, onReminderSent }: ReminderModalProps) {
  const api = useMemo(() => createClient({ baseUrl: "" }), []);
  const { pushToast } = useToasts();

  const [templates, setTemplates] = useState<ReminderTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [sending, setSending] = useState(false);

  const [selectedTemplateId, setSelectedTemplateId] = useState<number | "">("");
  const [sendVia, setSendVia] = useState<"email" | "whatsapp">("email");
  const [customMessage, setCustomMessage] = useState("");

  // Load templates on mount
  useEffect(() => {
    if (!open) return;

    setLoadingTemplates(true);
    api.reminderTemplates
      .list()
      .then((res) => {
        if (res.success) {
          setTemplates(res.templates);
          // Auto-select default template
          const defaultTemplate = res.templates.find((t) => t.is_default);
          if (defaultTemplate) {
            setSelectedTemplateId(defaultTemplate.id);
            setSendVia(defaultTemplate.send_via);
          }
        }
      })
      .catch(console.error)
      .finally(() => setLoadingTemplates(false));
  }, [api, open]);

  // Reset form when opening for different invoice
  useEffect(() => {
    if (open) {
      setCustomMessage("");
    }
  }, [open, invoice.id]);

  const selectedTemplate = useMemo(
    () => templates.find((t) => t.id === selectedTemplateId),
    [templates, selectedTemplateId]
  );

  const previewMessage = useMemo(() => {
    if (customMessage.trim()) {
      return customMessage;
    }

    if (selectedTemplate) {
      return selectedTemplate.body;
    }

    // Default template
    const template = sendVia === "email" ? DEFAULT_EMAIL_BODY : DEFAULT_WHATSAPP_BODY;
    return template
      .replace(/{customer_name}/g, invoice.customer_name)
      .replace(/{invoice_number}/g, invoice.invoice_number || String(invoice.id))
      .replace(/{amount}/g, invoice.total?.toFixed(2) || invoice.amount.toFixed(2))
      .replace(/{due_date}/g, invoice.payment_date || "pronto");
  }, [customMessage, selectedTemplate, sendVia, invoice]);

  const previewSubject = useMemo(() => {
    if (selectedTemplate?.subject) {
      return selectedTemplate.subject
        .replace(/{customer_name}/g, invoice.customer_name)
        .replace(/{invoice_number}/g, invoice.invoice_number || String(invoice.id))
        .replace(/{amount}/g, invoice.total?.toFixed(2) || invoice.amount.toFixed(2));
    }

    if (sendVia === "email") {
      return DEFAULT_EMAIL_SUBJECT
        .replace(/{customer_name}/g, invoice.customer_name)
        .replace(/{invoice_number}/g, invoice.invoice_number || String(invoice.id));
    }

    return null;
  }, [selectedTemplate, sendVia, invoice]);

  const handleSend = useCallback(async () => {
    setSending(true);
    try {
      const input: SendReminderInput = {
        template_id: selectedTemplateId ? Number(selectedTemplateId) : undefined,
        custom_message: customMessage.trim() || undefined,
        send_via: sendVia,
      };

      const res = await api.reminders.send(invoice.id, input);

      if (res.success) {
        pushToast({
          kind: "success",
          title: "Recordatorio enviado",
          message: `El recordatorio ha sido enviado a ${invoice.customer_email}`,
        });
        onReminderSent?.();
        onClose();
      } else {
        pushToast({
          kind: "error",
          title: "Error",
          message: res.message || "No se pudo enviar el recordatorio",
        });
      }
    } catch (e) {
      pushToast({
        kind: "error",
        title: "Error",
        message: e instanceof Error ? e.message : "Error desconocido",
      });
    } finally {
      setSending(false);
    }
  }, [api, invoice, selectedTemplateId, customMessage, sendVia, onReminderSent, onClose, pushToast]);

  if (!open) return null;

  const templateOptions = [
    { value: "", label: "-- Seleccionar plantilla --" },
    ...templates.map((t) => ({
      value: String(t.id),
      label: `${t.name} (${t.send_via === "email" ? "Email" : "WhatsApp"})`,
    })),
  ];

  return (
    <div className="bo-modal-overlay" onClick={onClose}>
      <div className="bo-modal bo-modal--sm" onClick={(e) => e.stopPropagation()}>
        <div className="bo-modalHeader">
          <h2 className="bo-modalTitle">Enviar recordatorio de pago</h2>
          <button
            className="bo-btn bo-btn--ghost bo-btn--sm"
            onClick={onClose}
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
        </div>

        <div className="bo-modalBody">
          {/* Invoice Info */}
          <div className="bo-reminderInvoiceInfo">
            <div className="bo-field">
              <div className="bo-label">Cliente</div>
              <div className="bo-value">{invoice.customer_name}</div>
            </div>
            <div className="bo-field">
              <div className="bo-label">Factura</div>
              <div className="bo-value">{invoice.invoice_number || `#${invoice.id}`}</div>
            </div>
            <div className="bo-field">
              <div className="bo-label">Importe</div>
              <div className="bo-value">{invoice.total?.toFixed(2) || invoice.amount.toFixed(2)} EUR</div>
            </div>
          </div>

          {/* Template Selection */}
          <div className="bo-field">
            <label className="bo-label" htmlFor="template-select">
              Plantilla
            </label>
            <Select
              value={String(selectedTemplateId)}
              onChange={(v) => setSelectedTemplateId(v ? Number(v) : "")}
              options={templateOptions}
              disabled={loadingTemplates}
              ariaLabel="Seleccionar plantilla"
            />
          </div>

          {/* Send Via */}
          <div className="bo-field">
            <label className="bo-label">Enviar via</label>
            <div className="bo-radioGroup">
              <label className="bo-radio">
                <input
                  type="radio"
                  name="send_via"
                  value="email"
                  checked={sendVia === "email"}
                  onChange={() => setSendVia("email")}
                />
                <Mail size={14} />
                <span>Email</span>
              </label>
              <label className="bo-radio">
                <input
                  type="radio"
                  name="send_via"
                  value="whatsapp"
                  checked={sendVia === "whatsapp"}
                  onChange={() => setSendVia("whatsapp")}
                />
                <MessageSquare size={14} />
                <span>WhatsApp</span>
              </label>
            </div>
          </div>

          {/* Custom Message */}
          <div className="bo-field">
            <label className="bo-label" htmlFor="custom-message">
              Mensaje personalizado (opcional)
            </label>
            <textarea
              id="custom-message"
              className="bo-textarea"
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              placeholder="Deja en blanco para usar la plantilla"
              rows={4}
            />
            <div className="bo-fieldHelp">
              Usa {"{customer_name}"}, {"{invoice_number}"}, {"{amount}"}, {"{due_date}"} como variables
            </div>
          </div>

          {/* Preview */}
          <div className="bo-reminderPreview">
            <div className="bo-reminderPreviewHeader">
              <Clock size={14} />
              <span>Vista previa</span>
            </div>
            {previewSubject && (
              <div className="bo-reminderPreviewSubject">
                <strong>Asunto:</strong> {previewSubject}
              </div>
            )}
            <div className="bo-reminderPreviewBody">
              {previewMessage}
            </div>
          </div>
        </div>

        <div className="bo-modalFooter">
          <button className="bo-btn bo-btn--ghost" onClick={onClose}>
            Cancelar
          </button>
          <button
            className="bo-btn bo-btn--primary"
            onClick={handleSend}
            disabled={sending || loadingTemplates}
          >
            <Send size={16} />
            {sending ? "Enviando..." : "Enviar recordatorio"}
          </button>
        </div>
      </div>
    </div>
  );
}
