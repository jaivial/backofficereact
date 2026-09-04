import React, { useMemo } from "react";
import { User, Mail, Phone, Calendar, FileText, Hash, Tag as TagIcon, CreditCard, MapPin, BadgeCheck, Clock, Users, ExternalLink, Download, Send, MessageCircle } from "lucide-react";
import { Modal } from "../../../../ui/overlays/Modal";
import { ModalHeader } from "../../../../ui/overlays/ModalHeader";
import { ScrollArea } from "../../../../ui/layout/ScrollArea";
import type { Invoice, InvoiceStatus } from "../../../../api/types";
import { CURRENCY_SYMBOLS } from "../../../../api/types";
import { INVOICE_STATUS_CONFIG } from "../types/invoice";

interface InvoiceDetailsModalProps {
  open: boolean;
  invoice: Invoice | null;
  onClose: () => void;
  onSendEmail?: (invoice: Invoice) => void;
  onSendWhatsApp?: (invoice: Invoice) => void;
  onDownloadPdf?: (invoice: Invoice) => void;
}

function formatPrice(price: number, currency: string = "EUR"): string {
  const sym = CURRENCY_SYMBOLS[currency as keyof typeof CURRENCY_SYMBOLS] || "€";
  return `${sym}${price.toFixed(2)}`;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString("es-ES", {
    day: "2-digit", month: "long", year: "numeric",
  });
}

function DetailRow({ icon, label, value, isLong }: { icon: React.ReactNode; label: string; value: React.ReactNode; isLong?: boolean }) {
  return (
    <div data-slot="invoiceDetailsModal-detailRow" className="bo-detailRow">
      <span data-slot="invoiceDetailsModal-detailRow-icon" className="bo-detailRow__icon">{icon}</span>
      <span data-slot="invoiceDetailsModal-detailRow-label" className="bo-detailRow__label">{label}</span>
      <span data-slot="invoiceDetailsModal-span" className={`bo-detailRow__value ${isLong ? "bo-detailRow__value--long" : ""}`}>{value}</span>
    </div>
  );
}

function StatusBadge({ status }: { status: InvoiceStatus }) {
  const cfg = INVOICE_STATUS_CONFIG[status] || { label: status, className: "" };
  return <span className={`bo-badge ${cfg.className}`}>{cfg.label}</span>;
}

export function InvoiceDetailsModal({ open, invoice, onClose, onSendEmail, onSendWhatsApp, onDownloadPdf }: InvoiceDetailsModalProps) {
  const fullName = useMemo(() => {
    if (!invoice) return "";
    return `${invoice.customer_name}${invoice.customer_surname ? ` ${invoice.customer_surname}` : ""}`;
  }, [invoice]);

  const addressParts = useMemo(() => {
    if (!invoice) return [];
    const parts: string[] = [];
    const st = invoice.customer_address_street;
    const num = invoice.customer_address_number;
    if (st) parts.push(num ? `${st}, ${num}` : st);
    if (invoice.customer_address_city) parts.push(invoice.customer_address_city);
    if (invoice.customer_address_province) parts.push(invoice.customer_address_province);
    if (invoice.customer_address_postal_code) parts.push(invoice.customer_address_postal_code);
    if (invoice.customer_address_country) parts.push(invoice.customer_address_country);
    return parts;
  }, [invoice]);

  const totalAmount = invoice?.total ?? invoice?.amount ?? 0;
  const paidAmount = invoice?.paid_amount ?? 0;
  const remaining = totalAmount - paidAmount;
  const hasActions = onSendEmail || onSendWhatsApp || onDownloadPdf;

  if (!invoice) return null;

  return (
    <Modal open={open} title="Detalles de factura" onClose={onClose} size="md" hideClose>
      <ModalHeader title="Detalles de factura" onClose={onClose} />
      <div data-slot="invoiceDetailsModal-invoiceDetails" className="bo-invoiceDetails">
        <ScrollArea dataSlot="invoice-details-body">
          <div data-slot="invoiceDetailsModal-invoiceDetailsBody" className="bo-invoiceDetailsBody">
          {/* Status & number header */}
          <div data-slot="invoiceDetailsModal-invoiceDetailsHeader" className="bo-invoiceDetailsHeader">
            <div data-slot="invoiceDetailsModal-invoiceDetailsHeaderLeft" className="bo-invoiceDetailsHeaderLeft">
              <div data-slot="invoiceDetailsModal-invoiceDetailsNumber" className="bo-invoiceDetailsNumber">
                <Hash size={12} />
                {invoice.invoice_number || `#${invoice.id}`}
              </div>
              <div data-slot="invoiceDetailsModal-invoiceDetailsAmount" className="bo-invoiceDetailsAmount">{formatPrice(totalAmount, invoice.currency)}</div>
            </div>
            <div data-slot="invoiceDetailsModal-invoiceDetailsStatus" className="bo-invoiceDetailsStatus">
              <StatusBadge status={invoice.status} />
            </div>
          </div>

          {/* Two-column grid (single column on mobile via CSS) */}
          <div data-slot="invoiceDetailsModal-invoiceDetailsColumns" className="bo-invoiceDetailsColumns">
            {/* Left column: Customer */}
            <div data-slot="invoiceDetailsModal-invoiceDetailsSection" className="bo-invoiceDetailsSection">
              <div data-slot="invoiceDetailsModal-invoiceDetailsSectionTitle" className="bo-invoiceDetailsSectionTitle">Cliente</div>
              <DetailRow icon={<User size={14} />} label="Nombre" value={fullName} />
              {invoice.customer_email && <DetailRow icon={<Mail size={14} />} label="Email" value={invoice.customer_email} isLong />}
              {invoice.customer_phone && <DetailRow icon={<Phone size={14} />} label="Teléfono" value={invoice.customer_phone} />}
              {invoice.customer_dni_cif && <DetailRow icon={<BadgeCheck size={14} />} label="DNI/CIF" value={invoice.customer_dni_cif} />}
              {addressParts.length > 0 && <DetailRow icon={<MapPin size={14} />} label="Dirección" value={addressParts.join(", ")} isLong />}
            </div>

            {/* Right column: Invoice info */}
            <div data-slot="invoiceDetailsModal-invoiceDetailsSection" className="bo-invoiceDetailsSection">
              <div data-slot="invoiceDetailsModal-invoiceDetailsSectionTitle" className="bo-invoiceDetailsSectionTitle">Factura</div>
              <DetailRow icon={<Calendar size={14} />} label="Fecha" value={formatDate(invoice.invoice_date)} />
              {invoice.due_date && <DetailRow icon={<Clock size={14} />} label="Vencimiento" value={formatDate(invoice.due_date)} />}
              {invoice.payment_date && <DetailRow icon={<CreditCard size={14} />} label="Pagado" value={formatDate(invoice.payment_date)} />}
              {invoice.payment_method && <DetailRow icon={<TagIcon size={14} />} label="Método" value={invoice.payment_method} />}
              {invoice.category && <DetailRow icon={<FileText size={14} />} label="Categoría" value={invoice.category} />}
            </div>
          </div>

          {/* Payment progress */}
          {invoice.status !== "borrador" && (
            <div data-slot="invoiceDetailsModal-invoiceDetailsSection" className="bo-invoiceDetailsSection">
              <div data-slot="invoiceDetailsModal-invoiceDetailsSectionTitle" className="bo-invoiceDetailsSectionTitle">Pago</div>
              <div data-slot="invoiceDetailsModal-invoiceDetailsPayment" className="bo-invoiceDetailsPayment">
                <div data-slot="invoiceDetailsModal-invoiceDetailsPaymentBar" className="bo-invoiceDetailsPaymentBar">
                  <div data-slot="invoiceDetailsModal-invoiceDetailsPaymentText" className="bo-invoiceDetailsPaymentText">
                    <span data-slot="invoiceDetailsModal-span" style={{ color: "var(--bo-muted)" }}>{formatPrice(paidAmount, invoice.currency)} pagado</span>
                    <span data-slot="invoiceDetailsModal-span" style={{ color: "var(--bo-faint)" }}>{formatPrice(remaining, invoice.currency)} restante</span>
                  </div>
                  <div data-slot="invoiceDetailsModal-invoiceDetailsPaymentTrack" className="bo-invoiceDetailsPaymentTrack">
                    <div data-slot="invoiceDetailsModal-div"
                      className={`bo-invoiceDetailsPaymentFill ${remaining <= 0 ? "bo-invoiceDetailsPaymentFill--complete" : ""}`}
                      style={{ width: `${totalAmount > 0 ? Math.min((paidAmount / totalAmount) * 100, 100) : 0}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Line items */}
          {invoice.line_items && invoice.line_items.length > 0 && (
            <div data-slot="invoiceDetailsModal-invoiceDetailsSection" className="bo-invoiceDetailsSection">
              <div data-slot="invoiceDetailsModal-invoiceDetailsSectionTitle" className="bo-invoiceDetailsSectionTitle">Líneas</div>
              <div data-slot="invoiceDetailsModal-div">
                {invoice.line_items.map((item, idx) => (
                  <div data-slot="invoiceDetailsModal-invoiceDetailsLineItem" key={idx} className="bo-invoiceDetailsLineItem">
                    <span data-slot="invoiceDetailsModal-invoiceDetailsLineItem-desc" className="bo-invoiceDetailsLineItem__desc">
                      {item.quantity && item.quantity > 1 ? `${item.quantity}x ` : ""}{item.description}
                    </span>
                    <span data-slot="invoiceDetailsModal-invoiceDetailsLineItem-price" className="bo-invoiceDetailsLineItem__price">
                      {item.total ? formatPrice(item.total, invoice.currency) : item.unit_price ? formatPrice(item.unit_price * (item.quantity || 1), invoice.currency) : ""}
                    </span>
                  </div>
                ))}
                {invoice.iva_rate != null && (
                  <div data-slot="invoiceDetailsModal-invoiceDetailsLineItemIva" className="bo-invoiceDetailsLineItemIva">
                    <span data-slot="invoiceDetailsModal-span">IVA {invoice.iva_rate}%</span>
                    <span data-slot="invoiceDetailsModal-span">{invoice.iva_amount ? formatPrice(invoice.iva_amount, invoice.currency) : ""}</span>
                  </div>
                )}
                <div data-slot="invoiceDetailsModal-invoiceDetailsTotal" className="bo-invoiceDetailsTotal">
                  <span data-slot="invoiceDetailsModal-span">Total</span>
                  <span data-slot="invoiceDetailsModal-span">{formatPrice(totalAmount, invoice.currency)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Reservation info */}
          {invoice.is_reservation && (
            <div data-slot="invoiceDetailsModal-invoiceDetailsSection" className="bo-invoiceDetailsSection">
              <div data-slot="invoiceDetailsModal-invoiceDetailsSectionTitle" className="bo-invoiceDetailsSectionTitle">Reserva</div>
              {invoice.reservation_date && <DetailRow icon={<Calendar size={14} />} label="Fecha" value={formatDate(invoice.reservation_date)} />}
              {invoice.reservation_customer_name && <DetailRow icon={<User size={14} />} label="Cliente" value={invoice.reservation_customer_name} />}
              {invoice.reservation_party_size && <DetailRow icon={<Users size={14} />} label="Comensales" value={String(invoice.reservation_party_size)} />}
            </div>
          )}

          {/* Internal notes */}
          {invoice.internal_notes && (
            <div data-slot="invoiceDetailsModal-invoiceDetailsSection" className="bo-invoiceDetailsSection">
              <div data-slot="invoiceDetailsModal-invoiceDetailsSectionTitle" className="bo-invoiceDetailsSectionTitle">Notas internas</div>
              <p data-slot="invoiceDetailsModal-invoiceDetailsNotes" className="bo-invoiceDetailsNotes">{invoice.internal_notes}</p>
            </div>
          )}

          {/* Attachments */}
          {invoice.attachments && invoice.attachments.length > 0 && (
            <div data-slot="invoiceDetailsModal-invoiceDetailsSection" className="bo-invoiceDetailsSection">
              <div data-slot="invoiceDetailsModal-invoiceDetailsSectionTitle" className="bo-invoiceDetailsSectionTitle">Adjuntos ({invoice.attachments.length})</div>
              <div data-slot="invoiceDetailsModal-invoiceDetailsTags" className="bo-invoiceDetailsTags">
                {invoice.attachments.map((att) => (
                  <a data-testid="invoicedetailsattachmentlink" key={att.id} href={att.url} target="_blank" rel="noopener noreferrer" className="bo-invoiceDetailsAttachmentLink">
                    <Download size={12} />
                    {att.filename || "Adjunto"}
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Tags */}
          {invoice.tags && invoice.tags.length > 0 && (
            <div data-slot="invoiceDetailsModal-invoiceDetailsSection" className="bo-invoiceDetailsSection">
              <div data-slot="invoiceDetailsModal-invoiceDetailsSectionTitle" className="bo-invoiceDetailsSectionTitle">Etiquetas</div>
              <div data-slot="invoiceDetailsModal-invoiceDetailsTags" className="bo-invoiceDetailsTags">
                {invoice.tags.map((tag, idx) => (
                  <span data-slot="invoiceDetailsModal-invoiceDetailsTag" key={idx} className="bo-invoiceDetailsTag">
                    <TagIcon size={10} />{tag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
        </ScrollArea>

        {/* Action buttons at the bottom */}
        {hasActions && (
          <div data-slot="invoiceDetailsModal-invoiceDetailsActions" className="bo-invoiceDetailsActions">
            {onDownloadPdf && (
              <button type="button" className="bo-btn bo-btn--ghost bo-btn--sm" onClick={() => onDownloadPdf(invoice)} data-testid="details-download-btn">
                <Download size={14} /> Descargar PDF
              </button>
            )}
            {invoice.customer_email && onSendEmail && (
              <button type="button" className="bo-btn bo-btn--secondary bo-btn--sm" onClick={() => onSendEmail(invoice)} data-testid="details-send-email-btn">
                <Send size={14} /> Email
              </button>
            )}
            {invoice.customer_phone && onSendWhatsApp && (
              <button type="button" className="bo-btn bo-btn--secondary bo-btn--sm" onClick={() => onSendWhatsApp(invoice)} data-testid="details-send-whatsapp-btn">
                <MessageCircle size={14} /> WhatsApp
              </button>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}