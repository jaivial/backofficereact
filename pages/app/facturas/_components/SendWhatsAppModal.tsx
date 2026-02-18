import React, { useCallback, useState, useMemo, useEffect } from "react";
import { X, Send, Loader2, Phone, User, FileText, AlertCircle, CheckCircle, MessageCircle } from "lucide-react";
import { Modal } from "../../../../ui/overlays/Modal";
import { useToasts } from "../../../../ui/feedback/useToasts";
import type { Invoice } from "../../../../api/types";
import { createClient } from "../../../../api/client";

interface SendWhatsAppModalProps {
  open: boolean;
  invoice: Invoice | null;
  onClose: () => void;
  onSent: (invoice: Invoice) => void;
}

function formatPrice(price: number): string {
  return `${price.toFixed(2)} EUR`;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// Format phone number for WhatsApp (remove spaces, dashes, and add country code if needed)
function formatPhoneForWhatsApp(phone: string): string {
  // Remove all spaces, dashes, parentheses
  let cleaned = phone.replace(/[\s\-\(\)]/g, "");

  // If doesn't start with +, add +34 (Spain) by default
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
}

// Default WhatsApp message template
const DEFAULT_WHATSAPP_MESSAGE = `Hola {customer_name},

Adjuntamos la factura {invoice_number} por importe de {total}.

Puede ver y descargar su factura en el siguiente enlace:
{invoice_link}

Quedamos a su disposicion para cualquier consulta.

Un saludo,
Villa Carmen`;

export function SendWhatsAppModal({ open, invoice, onClose, onSent }: SendWhatsAppModalProps) {
  const { pushToast } = useToasts();
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [message, setMessage] = useState("");
  const [showPreview, setShowPreview] = useState(false);

  // Check if this is a resend (already sent via WhatsApp)
  const isResend = useMemo(() => invoice?.status === "enviada", [invoice?.status]);

  // Generate public invoice URL
  const publicInvoiceUrl = useMemo(() => {
    if (!invoice) return "";
    // The backend will replace {invoice_link} with the actual URL
    return "[Ver factura en ligne]";
  }, [invoice]);

  // Initialize form with defaults when modal opens
  useEffect(() => {
    if (open && invoice) {
      setMessage(DEFAULT_WHATSAPP_MESSAGE);
      setSent(false);
      setShowPreview(false);
    }
  }, [open, invoice]);

  // Generate preview with replaced variables
  const previewContent = useMemo(() => {
    if (!invoice) return { message: "" };

    const invoiceNumber = invoice.invoice_number || String(invoice.id);
    const customerName = `${invoice.customer_name}${invoice.customer_surname ? ` ${invoice.customer_surname}` : ""}`;
    const totalAmount = formatPrice(invoice.total || invoice.amount);

    const messagePreview = message
      .replace(/{invoice_number}/g, invoiceNumber)
      .replace(/{customer_name}/g, customerName)
      .replace(/{total}/g, totalAmount)
      .replace(/{restaurant_name}/g, "Villa Carmen")
      .replace(/{invoice_link}/g, publicInvoiceUrl);

    return { message: messagePreview };
  }, [invoice, message, publicInvoiceUrl]);

  // Generate WhatsApp URL
  const whatsappUrl = useMemo(() => {
    if (!invoice || !invoice.customer_phone) return "";

    const phone = formatPhoneForWhatsApp(invoice.customer_phone);
    const encodedMessage = encodeURIComponent(previewContent.message);

    return `https://wa.me/${phone.replace(/\+/g, "")}?text=${encodedMessage}`;
  }, [invoice, previewContent.message]);

  const handleSend = useCallback(async () => {
    if (!invoice) return;

    // If no phone number, show error
    if (!invoice.customer_phone) {
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

      // Try to send via WhatsApp using the reminders API
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
        // Update the invoice status to "enviada" if it wasn't already
        if (invoice.status !== "enviada") {
          onSent({ ...invoice, status: "enviada" });
        } else {
          onSent(invoice);
        }
        // Close modal after short delay
        setTimeout(() => {
          onClose();
        }, 1500);
      } else {
        // If API fails (e.g., WhatsApp not configured), open WhatsApp Web directly
        // This is a fallback approach
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
            message: res.message || "No se pudo enviar el mensaje de WhatsApp",
          });
        }
      }
    } catch (e) {
      // Fallback: open WhatsApp Web directly if API fails
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
          message: e instanceof Error ? e.message : "Error desconocido al enviar",
        });
      }
    } finally {
      setSending(false);
    }
  }, [invoice, previewContent.message, whatsappUrl, onSent, onClose, pushToast]);

  const handleOpenWhatsApp = useCallback(() => {
    if (!whatsappUrl) return;
    window.open(whatsappUrl, "_blank");
  }, [whatsappUrl]);

  const handleClose = useCallback(() => {
    if (!sending) {
      onClose();
    }
  }, [sending, onClose]);

  if (!invoice) return null;

  // Check if customer has phone number
  const hasPhone = !!invoice.customer_phone;

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={isResend ? "Reenviar factura por WhatsApp" : "Enviar factura por WhatsApp"}
      widthPx={550}
    >
      <div className="bo-sendWhatsAppModal">
        {/* Success state */}
        {sent ? (
          <div className="bo-sendWhatsAppSuccess">
            <div className="bo-sendWhatsAppSuccessIcon">
              <CheckCircle size={48} />
            </div>
            <h3>WhatsApp preparado</h3>
            <p>El mensaje ha sido preparado para enviarse a:</p>
            <p className="bo-sendWhatsAppTo">{invoice.customer_phone}</p>
          </div>
        ) : (
          <>
            {/* Invoice summary */}
            <div className="bo-sendWhatsAppSummary">
              <div className="bo-sendWhatsAppSummaryRow">
                <User size={16} />
                <span>
                  {invoice.customer_name} {invoice.customer_surname}
                </span>
              </div>
              <div className="bo-sendWhatsAppSummaryRow">
                <Phone size={16} />
                <span>{invoice.customer_phone || "Sin telefono"}</span>
              </div>
              <div className="bo-sendWhatsAppSummaryRow">
                <FileText size={16} />
                <span>
                  Factura {invoice.invoice_number || `#${invoice.id}`} - {formatPrice(invoice.total || invoice.amount)}
                </span>
              </div>
            </div>

            {/* No phone warning */}
            {!hasPhone && (
              <div className="bo-sendWhatsAppWarning">
                <AlertCircle size={16} />
                <span>El cliente no tiene un numero de telefono registrado. No se puede enviar WhatsApp.</span>
              </div>
            )}

            {/* Resend warning */}
            {isResend && hasPhone && (
              <div className="bo-sendWhatsAppWarning">
                <AlertCircle size={16} />
                <span>Esta factura ya ha sido enviada anteriormente. Se reenviara al mismo numero.</span>
              </div>
            )}

            {/* WhatsApp form */}
            {hasPhone && (
              <div className="bo-sendWhatsAppForm">
                <div className="bo-field">
                  <div className="bo-fieldHeader">
                    <label className="bo-label">Mensaje</label>
                    <button
                      type="button"
                      className="bo-btn bo-btn--ghost bo-btn--sm"
                      onClick={() => setShowPreview(!showPreview)}
                      disabled={sending}
                    >
                      {showPreview ? "Editar" : "Vista previa"}
                    </button>
                  </div>
                  {showPreview ? (
                    <div className="bo-sendWhatsAppPreview">{previewContent.message}</div>
                  ) : (
                    <textarea
                      className="bo-textarea"
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      rows={8}
                      placeholder="Cuerpo del mensaje..."
                      disabled={sending}
                    />
                  )}
                  <span className="bo-fieldHint">
                    Variables: {"{invoice_number}"}, {"{customer_name}"}, {"{total}"}, {"{restaurant_name}"}, {"{invoice_link}"}
                  </span>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="bo-sendWhatsAppActions">
              <button type="button" className="bo-btn bo-btn--secondary" onClick={handleClose} disabled={sending}>
                Cancelar
              </button>
              {hasPhone ? (
                <>
                  <button
                    type="button"
                    className="bo-btn bo-btn--secondary"
                    onClick={handleOpenWhatsApp}
                    disabled={sending}
                  >
                    <MessageCircle size={16} />
                    Abrir WhatsApp
                  </button>
                  <button
                    type="button"
                    className="bo-btn bo-btn--primary"
                    onClick={handleSend}
                    disabled={sending}
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
                <button type="button" className="bo-btn bo-btn--primary" disabled>
                  Sin numero de telefono
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
