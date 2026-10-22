import React from "react";
import { FileText, Phone, Video, MoreVertical, CheckCheck } from "lucide-react";
import { WHATSAPP_CHAT_BG, WHATSAPP_HEADER_BG } from "../../campanas/functionalComponents/WhatsAppPreview";

/*
 * Editable WhatsApp chat clone for the invoice send modal: the operator
 * proof-reads and edits the exact text bubble the customer receives, with the
 * PDF document card the backend sends right after it. Same palette as the
 * campaign preview so every WhatsApp surface in the backoffice looks alike.
 * Coordination id: invoice_send_whatsapp_v1
 */
type InvoiceWhatsAppChatPreviewProps = {
  /** Restaurant name shown as the chat peer (the sender is the restaurant). */
  brandName: string;
  /** Current message text; rendered once as the editable bubble content. */
  value: string;
  /** Display name of the PDF document bubble; empty hides it. */
  pdfName: string;
  disabled?: boolean;
  onChange: (text: string) => void;
};

export function InvoiceWhatsAppChatPreview({ brandName, value, pdfName, disabled, onChange }: InvoiceWhatsAppChatPreviewProps) {
  const initial = (brandName.trim()[0] || "R").toUpperCase();
  return (
    <div className="bo-waChat" style={{ backgroundColor: WHATSAPP_CHAT_BG }} data-testid="send-invoice-wa-chat">
      <div className="bo-waChatHeader" style={{ backgroundColor: WHATSAPP_HEADER_BG }} data-testid="send-invoice-wa-chat-header">
        <span className="bo-waChatAvatar" aria-hidden="true">{initial}</span>
        <span className="bo-waChatPeer">
          <b data-testid="send-invoice-wa-peer">{brandName.trim() || "Restaurante"}</b>
          <small>en línea</small>
        </span>
        <Phone size={15} aria-hidden="true" />
        <Video size={16} aria-hidden="true" />
        <MoreVertical size={15} aria-hidden="true" />
      </div>
      <div className="bo-waChatBody">
        <div
          className="bo-waBubble bo-waBubble--editable"
          contentEditable={!disabled}
          suppressContentEditableWarning
          role="textbox"
          aria-multiline="true"
          aria-label="Mensaje de WhatsApp"
          data-testid="send-invoice-wa-text"
          onInput={(e) => onChange(e.currentTarget.textContent || "")}
        >
          {value}
        </div>
        {pdfName ? (
          <div className="bo-waBubble bo-waDoc" data-testid="send-invoice-wa-doc">
            <span className="bo-waDocIcon" aria-hidden="true"><FileText size={20} /></span>
            <span className="bo-waDocMeta">
              <b data-testid="send-invoice-wa-doc-name">{pdfName}</b>
              <small>PDF · adjunto</small>
            </span>
            <span className="bo-waTicks" aria-hidden="true"><CheckCheck size={14} /></span>
          </div>
        ) : null}
        <small className="bo-waChatHint" data-testid="send-invoice-wa-meta">Vista previa del chat · toca el texto para editarlo</small>
      </div>
    </div>
  );
}
