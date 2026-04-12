import React, { useCallback, useState, useMemo } from "react";
import { X, Send, Loader2, Mail, User, FileText, AlertCircle, CheckCircle, MessageCircle, Phone } from "lucide-react";
import { Modal } from "../../../../ui/overlays/Modal";
import { useToasts } from "../../../../ui/feedback/useToasts";
import type { Invoice } from "../../../../api/types";
import { createClient } from "../../../../api/client";

interface SendEmailModalProps {
  open: boolean;
  invoice: Invoice | null;
  onClose: () => void;
  onSent: (invoice: Invoice) => void;
}

function formatPrice(price: number): string {
  return `${price.toFixed(2)} €`;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// Default subject and message templates
const DEFAULT_SUBJECT = "Factura {invoice_number} - {restaurant_name}";
const DEFAULT_MESSAGE = `Estimado/a {customer_name},

Adjuntamos la factura {invoice_number} por importe de {total}.

Puede ver y descargar su factura en el siguiente enlace:
{invoice_link}

Quedamos a su disposicion para cualquier consulta.

Un saludo,

{restaurant_name}`;

export function SendEmailModal({ open, invoice, onClose, onSent }: SendEmailModalProps) {
  const { pushToast } = useToasts();
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  // Form fields
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [showPreview, setShowPreview] = useState(false);

  // Notification method: email or whatsapp
  const [notificationMethod, setNotificationMethod] = useState<"email" | "whatsapp">("email");

  // Reset form when opening
  const isResend = useMemo(() => invoice?.status === "enviada", [invoice?.status]);

  // Generate public invoice URL
  const publicInvoiceUrl = useMemo(() => {
    if (!invoice) return "";
    // In production, this would be the actual public URL
    // The backend will replace {invoice_link} with the actual URL
    return `[Ver factura en ligne]`;
  }, [invoice]);

  // Initialize form with defaults when modal opens
  React.useEffect(() => {
    if (open && invoice) {
      // Check if invoice has been sent before (status is "enviada")
      setSubject(DEFAULT_SUBJECT.replace("{invoice_number}", invoice.invoice_number || String(invoice.id)));
      setMessage(DEFAULT_MESSAGE);
      setSent(false);
      setShowPreview(false);
      setNotificationMethod("email");
    }
  }, [open, invoice]);

  // Generate preview with replaced variables
  const previewContent = useMemo(() => {
    if (!invoice) return { subject: "", message: "" };

    const invoiceNumber = invoice.invoice_number || String(invoice.id);
    const customerName = `${invoice.customer_name}${invoice.customer_surname ? ` ${invoice.customer_surname}` : ""}`;
    const totalAmount = formatPrice(invoice.total || invoice.amount);

    const subjectPreview = subject
      .replace(/{invoice_number}/g, invoiceNumber)
      .replace(/{customer_name}/g, customerName)
      .replace(/{total}/g, totalAmount)
      .replace(/{restaurant_name}/g, "Villa Carmen");

    const messagePreview = message
      .replace(/{invoice_number}/g, invoiceNumber)
      .replace(/{customer_name}/g, customerName)
      .replace(/{total}/g, totalAmount)
      .replace(/{restaurant_name}/g, "Villa Carmen")
      .replace(/{invoice_link}/g, publicInvoiceUrl);

    return { subject: subjectPreview, message: messagePreview };
  }, [invoice, subject, message, publicInvoiceUrl]);

  // Format phone number for WhatsApp
  const formatPhoneForWhatsApp = (phone: string): string => {
    let cleaned = phone.replace(/[\s\-\(\)]/g, "");
    if (!cleaned.startsWith("+")) {
      if (cleaned.startsWith("34")) {
        cleaned = "+" + cleaned;
      } else if (cleaned.length === 9) {
        cleaned = "+34" + cleaned;
      } else {
        cleaned = "+" + cleaned;
      }
    }
    return cleaned;
  };

  // Generate WhatsApp URL
  const whatsappUrl = useMemo(() => {
    if (!invoice?.customer_phone) return "";
    const phone = formatPhoneForWhatsApp(invoice.customer_phone);
    const encodedMessage = encodeURIComponent(previewContent.message);
    return `https://wa.me/${phone.replace(/\+/g, "")}?text=${encodedMessage}`;
  }, [invoice, previewContent.message]);

  const handleSend = useCallback(async () => {
    if (!invoice) return;

    if (notificationMethod === "whatsapp" && !invoice.customer_phone) {
      pushToast({
        kind: "error",
        title: "Error",
        message: "El cliente no tiene un numero de telefono registrado",
      });
      return;
    }

    setSending(true);
    try {
      const api = createClient({ baseUrl: "" });

      if (notificationMethod === "whatsapp") {
        // Try to send via WhatsApp API first
        const res = await api.reminders.send(invoice.id, {
          send_via: "whatsapp",
          custom_message: previewContent.message || undefined,
        });

        if (res.success) {
          setSent(true);
          pushToast({
            kind: "success",
            title: "WhatsApp enviado",
            message: `El mensaje de WhatsApp ha sido enviado a ${invoice.customer_phone}`,
          });
          if (invoice.status !== "enviada") {
            onSent({ ...invoice, status: "enviada" });
          } else {
            onSent(invoice);
          }
          setTimeout(() => {
            onClose();
          }, 1500);
        } else {
          // Fallback: open WhatsApp Web directly
          if (whatsappUrl) {
            window.open(whatsappUrl, "_blank");
            setSent(true);
            pushToast({
              kind: "info",
              title: "Abrir WhatsApp",
              message: "Se abrira WhatsApp Web para enviar el mensaje",
            });
            if (invoice.status !== "enviada") {
              onSent({ ...invoice, status: "enviada" });
            } else {
              onSent(invoice);
            }
            setTimeout(() => {
              onClose();
            }, 1500);
          } else {
            pushToast({
              kind: "error",
              title: "Error",
              message: res.message || "No se pudo enviar el WhatsApp",
            });
          }
        }
      } else {
        // Send via email
        const res = await api.invoices.sendWithCustomization(invoice.id, {
          subject: previewContent.subject || undefined,
          message: previewContent.message || undefined,
        });

        if (res.success) {
          setSent(true);
          pushToast({
            kind: "success",
            title: "Email enviado",
            message: `La factura ha sido enviada a ${invoice.customer_email}`,
          });
          if (invoice.status !== "enviada") {
            onSent({ ...invoice, status: "enviada" });
          } else {
            onSent(invoice);
          }
          setTimeout(() => {
            onClose();
          }, 1500);
        } else {
          pushToast({
            kind: "error",
            title: "Error",
            message: res.message || "No se pudo enviar el email",
          });
        }
      }
    } catch (e) {
      // Fallback for WhatsApp: open WhatsApp Web
      if (notificationMethod === "whatsapp" && whatsappUrl) {
        window.open(whatsappUrl, "_blank");
        setSent(true);
        pushToast({
          kind: "info",
          title: "Abrir WhatsApp",
          message: "Se abrira WhatsApp Web para enviar el mensaje",
        });
        if (invoice.status !== "enviada") {
          onSent({ ...invoice, status: "enviada" });
        } else {
          onSent(invoice);
        }
        setTimeout(() => {
          onClose();
        }, 1500);
      } else {
        pushToast({
          kind: "error",
          title: "Error",
          message: e instanceof Error ? e.message : "Error desconocido al enviar",
        });
      }
    } finally {
      setSending(false);
    }
  }, [invoice, previewContent, onSent, onClose, pushToast, notificationMethod, whatsappUrl]);

  const handleOpenWhatsApp = useCallback(() => {
    if (whatsappUrl) {
      window.open(whatsappUrl, "_blank");
    }
  }, [whatsappUrl]);

  const handleClose = useCallback(() => {
    if (!sending) {
      onClose();
    }
  }, [sending, onClose]);

  if (!invoice) return null;

  const modalTitle = notificationMethod === "whatsapp"
    ? (isResend ? "Reenviar factura por WhatsApp" : "Enviar factura por WhatsApp")
    : (isResend ? "Reenviar factura por email" : "Enviar factura por email");

  const successTitle = notificationMethod === "whatsapp" ? "WhatsApp enviado" : "Email enviado";
  const successDestination = notificationMethod === "whatsapp" ? invoice.customer_phone : invoice.customer_email;

  return (
    <Modal open={open} onClose={handleClose} title={modalTitle} widthPx={550}>
      <div className="bo-sendEmailModal" data-slot="send-email-modal">
        {/* Success state */}
        {sent ? (
          <div className="bo-sendEmailSuccess" data-slot="send-email-success">
            <div className="bo-sendEmailSuccessIcon" data-slot="send-email-success-icon">
              <CheckCircle size={48} />
            </div>
            <h3 data-slot="send-email-success-title">{successTitle}</h3>
            <p data-slot="send-email-success-description">La factura ha sido enviada correctamente a:</p>
            <p className="bo-sendEmailTo" data-slot="send-email-success-recipient">{successDestination}</p>
          </div>
        ) : (
          <>
            {/* Notification method toggle */}
            <div className="bo-sendNotificationToggle" data-slot="send-email-notification-toggle">
              <button
                type="button"
                className={`bo-sendNotificationTab ${notificationMethod === "email" ? "is-active" : ""}`}
                onClick={() => setNotificationMethod("email")}
                disabled={!invoice.customer_email}
                data-testid="send-email-method-email"
              >
                <Mail size={16} />
                <span data-slot="sendEmailModal-ail">Email</span>
              </button>
              <button
                type="button"
                className={`bo-sendNotificationTab ${notificationMethod === "whatsapp" ? "is-active" : ""}`}
                onClick={() => setNotificationMethod("whatsapp")}
                disabled={!invoice.customer_phone}
                data-testid="send-email-method-whatsapp"
              >
                <MessageCircle size={16} />
                <span data-slot="sendEmailModal-app">WhatsApp</span>
              </button>
            </div>

            {/* Invoice summary */}
            <div className="bo-sendEmailSummary" data-slot="send-email-invoice-summary">
              <div className="bo-sendEmailSummaryRow" data-slot="send-email-summary-row-customer">
                <User size={16} />
                <span data-slot="send-email-customer-name">
                  {invoice.customer_name} {invoice.customer_surname}
                </span>
              </div>
              {notificationMethod === "email" ? (
                <div className="bo-sendEmailSummaryRow" data-slot="send-email-summary-row-email">
                  <Mail size={16} />
                  <span data-slot="send-email-customer-email">{invoice.customer_email || "Sin email"}</span>
                </div>
              ) : (
                <div className="bo-sendEmailSummaryRow" data-slot="send-email-summary-row-phone">
                  <Phone size={16} />
                  <span data-slot="send-email-customer-phone">{invoice.customer_phone || "Sin telefono"}</span>
                </div>
              )}
              <div className="bo-sendEmailSummaryRow" data-slot="send-email-summary-row-invoice">
                <FileText size={16} />
                <span data-slot="send-email-invoice-detail">
                  Factura {invoice.invoice_number || `#${invoice.id}`} - {formatPrice(invoice.total || invoice.amount)}
                </span>
              </div>
            </div>

            {/* Resend warning */}
            {isResend && (
              <div className="bo-sendEmailWarning" data-slot="send-email-resend-warning">
                <AlertCircle size={16} />
                <span data-slot="send-email-resend-text">Esta factura ya ha sido enviada anteriormente. Se reenviara al mismo email.</span>
              </div>
            )}

            {/* Email form */}
            <div className="bo-sendEmailForm" data-slot="send-email-form">
              <div className="bo-field" data-slot="send-email-field-subject">
                <label className="bo-label" data-slot="sendEmailModal-label">Asunto</label>
                <input
                  className="bo-input"
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Asunto del email"
                  disabled={sending}
                  data-testid="send-email-subject-input"
                />
                <span className="bo-fieldHint" data-slot="sendEmailModal-fieldHint">
                  Variables: {"{invoice_number}"}, {"{customer_name}"}, {"{total}"}, {"{restaurant_name}"}, {"{invoice_link}"}
                </span>
              </div>

              <div className="bo-field" data-slot="send-email-field-message">
                <div className="bo-fieldHeader" data-slot="send-email-message-header">
                  <label className="bo-label" data-slot="sendEmailModal-label">Mensaje</label>
                  <button
                    type="button"
                    className="bo-btn bo-btn--ghost bo-btn--sm"
                    onClick={() => setShowPreview(!showPreview)}
                    disabled={sending}
                    data-testid="send-email-toggle-preview"
                  >
                    {showPreview ? "Editar" : "Vista previa"}
                  </button>
                </div>
                {showPreview ? (
                  <div className="bo-sendEmailPreview" data-slot="send-email-message-preview">{previewContent.message}</div>
                ) : (
                  <textarea
                    className="bo-textarea"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={8}
                    placeholder="Cuerpo del mensaje..."
                    disabled={sending}
                    data-testid="send-email-message-textarea"
                  />
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="bo-sendEmailActions" data-slot="send-email-actions">
              <button type="button" className="bo-btn bo-btn--secondary" onClick={handleClose} disabled={sending} data-testid="send-email-cancel">
                Cancelar
              </button>
              {notificationMethod === "whatsapp" && invoice.customer_phone ? (
                <>
                  <button
                    type="button"
                    className="bo-btn bo-btn--secondary"
                    onClick={handleOpenWhatsApp}
                    disabled={sending || !whatsappUrl}
                    data-testid="send-email-open-whatsapp"
                  >
                    <MessageCircle size={16} />
                    Abrir WhatsApp
                  </button>
                  <button
                    type="button"
                    className="bo-btn bo-btn--primary"
                    onClick={handleSend}
                    disabled={sending}
                    data-testid="send-email-submit"
                  >
                    {sending ? (
                      <>
                        <Loader2 size={16} className="bo-spin" />
                        Enviando...
                      </>
                    ) : (
                      <>
                        <Send size={16} />
                        {isResend ? "Reenviar WhatsApp" : "Enviar WhatsApp"}
                      </>
                    )}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="bo-btn bo-btn--primary"
                  onClick={handleSend}
                  disabled={sending || (notificationMethod === "email" && !invoice.customer_email)}
                  data-testid="send-email-submit"
                >
                  {sending ? (
                    <>
                      <Loader2 size={16} className="bo-spin" />
                      Enviando...
                    </>
                  ) : (
                    <>
                      <Send size={16} />
                      {isResend ? "Reenviar email" : "Enviar email"}
                    </>
                  )}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
