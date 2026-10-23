import React, { useMemo, useState, useEffect, useCallback } from "react";
import { User, Mail, Phone, Calendar, FileText, Hash, Tag as TagIcon, CreditCard, MapPin, BadgeCheck, Clock, Users, ExternalLink, Download, Send, MessageCircle, Share2, PencilLine, Trash2 } from "lucide-react";
import { Modal } from "../../../../ui/overlays/Modal";
import { ModalHeader } from "../../../../ui/overlays/ModalHeader";
import { ScrollArea } from "../../../../ui/layout/ScrollArea";
import type { Invoice, InvoiceStatus } from "../../../../api/types";
import { CURRENCY_SYMBOLS } from "../../../../api/types";
import { INVOICE_STATUS_CONFIG } from "../types/invoice";
import { invoiceTotal, moneyEs, dniCifLabel } from "../utils";

interface InvoiceDetailsModalProps {
  open: boolean;
  invoice: Invoice | null;
  onClose: () => void;
  onSendEmail?: (invoice: Invoice) => void;
  onSendWhatsApp?: (invoice: Invoice) => void;
  onDownloadPdf?: (invoice: Invoice) => void;
  // Editar y eliminar, junto a las acciones de envio (facturas_details_actions_v1).
  onEdit?: (invoice: Invoice) => void;
  onDelete?: (invoice: Invoice) => void;
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
    <div data-testid="invoiceDetailsModal-detailRow" data-slot="invoiceDetailsModal-detailRow" className="bo-detailRow">
      <span data-testid="invoiceDetailsModal-detailRow-icon" data-slot="invoiceDetailsModal-detailRow-icon" className="bo-detailRow__icon">{icon}</span>
      <span data-testid="invoiceDetailsModal-detailRow-label" data-slot="invoiceDetailsModal-detailRow-label" className="bo-detailRow__label">{label}</span>
      <span data-testid="invoiceDetailsModal-span" data-slot="invoiceDetailsModal-span" className={`bo-detailRow__value ${isLong ? "bo-detailRow__value--long" : ""}`}>{value}</span>
    </div>
  );
}

function StatusBadge({ status }: { status: InvoiceStatus }) {
  const cfg = INVOICE_STATUS_CONFIG[status] || { label: status, className: "" };
  return <span data-testid="StatusBadge-span-2" className={`bo-badge ${cfg.className}`}>{cfg.label}</span>;
}

export function InvoiceDetailsModal({ open, invoice, onClose, onSendEmail, onSendWhatsApp, onDownloadPdf, onEdit, onDelete }: InvoiceDetailsModalProps) {
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

  // Mobile-friendly tabs: detail / PDF / email / WhatsApp previews. Coordination id: invoice_details_tabs_v1
  const [tab, setTab] = useState<"detalle" | "pdf" | "email" | "whatsapp">("detalle");
  useEffect(() => { if (open) setTab("detalle"); }, [open, invoice?.id]);
  const pdfUrl = invoice?.id ? `/api/admin/invoices/${invoice.id}/pdf` : "";
  const shareLink = useCallback(async () => {
    if (!pdfUrl) return;
    const url = new URL(pdfUrl, window.location.origin).toString();
    try {
      if (typeof navigator.share === "function") await navigator.share({ title: invoice?.invoice_number || "Factura", url });
      else await navigator.clipboard.writeText(url);
    } catch { /* cancelled share */ }
  }, [pdfUrl, invoice?.invoice_number]);
  // invoice_amount_consistency_v1: same canonical total + PDF money style as
  // the send modal, so this preview reads exactly what will be sent.
  const msgText = `Hola ${fullName}, le enviamos la factura ${invoice?.invoice_number || invoice?.id} por importe de ${invoice ? moneyEs(invoiceTotal(invoice), invoice.currency) : ""}.\n\nQuedamos a su disposición para cualquier consulta.\n\nVilla Carmen`;

  const totalAmount = invoice?.total ?? invoice?.amount ?? 0;
  const paidAmount = invoice?.paid_amount ?? 0;
  const remaining = totalAmount - paidAmount;
  const hasActions = onSendEmail || onSendWhatsApp || onDownloadPdf || onEdit || onDelete;

  if (!invoice) return null;

  return (
    <Modal open={open} title="Detalles de factura" onClose={onClose} size="md" hideClose className="bo-invoiceDetailsModal">
      <ModalHeader title="Detalles de factura" onClose={onClose} />
      <div className="bo-detailsTabs" role="tablist" aria-label="Vista" data-testid="details-tabs">
        {([["detalle", "Detalle", FileText], ["pdf", "PDF", FileText], ["email", "Email", Mail], ["whatsapp", "WhatsApp", MessageCircle]] as const).map(([k, l, Icon]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} className={`bo-detailsTab ${tab === k ? "is-active" : ""}`} onClick={() => setTab(k)} data-testid={`details-tab-${k}`}>
            <Icon size={14} aria-hidden="true" /> <span data-testid={`details-tab-${k}-label`}>{l}</span>
          </button>
        ))}
      </div>
      {tab === "pdf" ? (
        <div className="bo-detailsPanel" data-testid="details-panel-pdf">
          <div className="bo-detailsPanelBar" data-testid="details-pdf-bar">
            <a className="bo-btn bo-btn--ghost bo-btn--sm" href={pdfUrl} target="_blank" rel="noreferrer" aria-label="Ver página completa" title="Ver página completa" data-testid="details-pdf-open"><ExternalLink size={14} aria-hidden="true" /></a>
            <a className="bo-btn bo-btn--ghost bo-btn--sm" href={pdfUrl} download aria-label="Descargar" title="Descargar" data-testid="details-pdf-download"><Download size={14} aria-hidden="true" /></a>
            <button type="button" className="bo-btn bo-btn--ghost bo-btn--sm" onClick={() => void shareLink()} aria-label="Compartir" title="Compartir" data-testid="details-pdf-share"><Share2 size={14} aria-hidden="true" /></button>
          </div>
          <iframe src={pdfUrl} title="Vista previa del PDF" className="bo-detailsPdfFrame" data-testid="details-pdf-frame" />
        </div>
      ) : null}
      {tab === "email" ? (
        <div className="bo-detailsPanel" data-testid="details-panel-email">
          <p className="bo-muted" data-testid="details-email-to">Para: {invoice.customer_email || "sin email"}</p>
          <div className="bo-detailsBubble" data-testid="details-email-preview"><b data-testid="details-email-subject">Factura {invoice.invoice_number || invoice.id} - Villa Carmen</b><p data-testid="details-email-body">{msgText}</p><small data-testid="details-email-attach">Adjunto: factura en PDF</small></div>
          {onSendEmail && invoice.customer_email ? <button type="button" className="bo-btn bo-btn--primary" onClick={() => onSendEmail(invoice)} data-testid="details-email-send"><Send size={14} aria-hidden="true" /> Editar y enviar</button> : null}
        </div>
      ) : null}
      {tab === "whatsapp" ? (
        <div className="bo-detailsPanel" data-testid="details-panel-whatsapp">
          <p className="bo-muted" data-testid="details-wa-to">Para: {invoice.customer_phone || "sin teléfono"}</p>
          <div className="bo-detailsBubble bo-detailsBubble--wa" data-testid="details-wa-preview"><p data-testid="details-wa-body">{msgText}</p></div>
          {onSendWhatsApp && invoice.customer_phone ? <button type="button" className="bo-btn bo-btn--primary" onClick={() => onSendWhatsApp(invoice)} data-testid="details-wa-send"><MessageCircle size={14} aria-hidden="true" /> Editar y enviar</button> : null}
        </div>
      ) : null}
      {tab === "detalle" ? (
      <div data-testid="invoiceDetailsModal-invoiceDetails" data-slot="invoiceDetailsModal-invoiceDetails" className="bo-invoiceDetails">
        <ScrollArea dataSlot="invoice-details-body">
          <div data-testid="invoiceDetailsModal-invoiceDetailsBody" data-slot="invoiceDetailsModal-invoiceDetailsBody" className="bo-invoiceDetailsBody">
          {/* Status & number header */}
          <div data-testid="invoiceDetailsModal-invoiceDetailsHeader" data-slot="invoiceDetailsModal-invoiceDetailsHeader" className="bo-invoiceDetailsHeader">
            <div data-testid="invoiceDetailsModal-invoiceDetailsHeaderLeft" data-slot="invoiceDetailsModal-invoiceDetailsHeaderLeft" className="bo-invoiceDetailsHeaderLeft">
              <div data-testid="invoiceDetailsModal-invoiceDetailsNumber" data-slot="invoiceDetailsModal-invoiceDetailsNumber" className="bo-invoiceDetailsNumber">
                <Hash size={12} />
                {invoice.invoice_number || `#${invoice.id}`}
              </div>
              <div data-testid="invoiceDetailsModal-invoiceDetailsAmount" data-slot="invoiceDetailsModal-invoiceDetailsAmount" className="bo-invoiceDetailsAmount">{formatPrice(totalAmount, invoice.currency)}</div>
            </div>
            <div data-testid="invoiceDetailsModal-invoiceDetailsStatus" data-slot="invoiceDetailsModal-invoiceDetailsStatus" className="bo-invoiceDetailsStatus">
              <StatusBadge status={invoice.status} />
            </div>
          </div>

          {/* Two-column grid (single column on mobile via CSS) */}
          <div data-testid="invoiceDetailsModal-invoiceDetailsColumns" data-slot="invoiceDetailsModal-invoiceDetailsColumns" className="bo-invoiceDetailsColumns">
            {/* Left column: Customer */}
            <div data-testid="invoiceDetailsModal-invoiceDetailsSection" data-slot="invoiceDetailsModal-invoiceDetailsSection" className="bo-invoiceDetailsSection">
              <div data-testid="invoiceDetailsModal-invoiceDetailsSectionTitle" data-slot="invoiceDetailsModal-invoiceDetailsSectionTitle" className="bo-invoiceDetailsSectionTitle">Cliente</div>
              <DetailRow icon={<User size={14} />} label="Nombre" value={fullName} />
              {invoice.customer_email && <DetailRow icon={<Mail size={14} />} label="Email" value={invoice.customer_email} isLong />}
              {invoice.customer_phone && <DetailRow icon={<Phone size={14} />} label="Teléfono" value={invoice.customer_phone} />}
              {invoice.customer_dni_cif && <DetailRow icon={<BadgeCheck size={14} />} label={dniCifLabel(invoice)} value={invoice.customer_dni_cif} />}
              {addressParts.length > 0 && <DetailRow icon={<MapPin size={14} />} label="Dirección" value={addressParts.join(", ")} isLong />}
            </div>

            {/* Right column: Invoice info */}
            <div data-testid="invoiceDetailsModal-invoiceDetailsSection-2" data-slot="invoiceDetailsModal-invoiceDetailsSection" className="bo-invoiceDetailsSection">
              <div data-testid="invoiceDetailsModal-invoiceDetailsSectionTitle-2" data-slot="invoiceDetailsModal-invoiceDetailsSectionTitle" className="bo-invoiceDetailsSectionTitle">Factura</div>
              <DetailRow icon={<Calendar size={14} />} label="Fecha" value={formatDate(invoice.invoice_date)} />
              {invoice.due_date && <DetailRow icon={<Clock size={14} />} label="Vencimiento" value={formatDate(invoice.due_date)} />}
              {invoice.payment_date && <DetailRow icon={<CreditCard size={14} />} label="Pagado" value={formatDate(invoice.payment_date)} />}
              {invoice.payment_method && <DetailRow icon={<TagIcon size={14} />} label="Método" value={invoice.payment_method} />}
              {invoice.category && <DetailRow icon={<FileText size={14} />} label="Categoría" value={invoice.category} />}
            </div>
          </div>

          {/* Payment progress */}
          {invoice.status !== "borrador" && (
            <div data-testid="invoiceDetailsModal-invoiceDetailsSection-3" data-slot="invoiceDetailsModal-invoiceDetailsSection" className="bo-invoiceDetailsSection">
              <div data-testid="invoiceDetailsModal-invoiceDetailsSectionTitle-3" data-slot="invoiceDetailsModal-invoiceDetailsSectionTitle" className="bo-invoiceDetailsSectionTitle">Pago</div>
              <div data-testid="invoiceDetailsModal-invoiceDetailsPayment" data-slot="invoiceDetailsModal-invoiceDetailsPayment" className="bo-invoiceDetailsPayment">
                <div data-testid="invoiceDetailsModal-invoiceDetailsPaymentBar" data-slot="invoiceDetailsModal-invoiceDetailsPaymentBar" className="bo-invoiceDetailsPaymentBar">
                  <div data-testid="invoiceDetailsModal-invoiceDetailsPaymentText" data-slot="invoiceDetailsModal-invoiceDetailsPaymentText" className="bo-invoiceDetailsPaymentText">
                    <span data-testid="invoiceDetailsModal-span-2" data-slot="invoiceDetailsModal-span" style={{ color: "var(--bo-muted)" }}>{formatPrice(paidAmount, invoice.currency)} pagado</span>
                    <span data-testid="invoiceDetailsModal-span-3" data-slot="invoiceDetailsModal-span" style={{ color: "var(--bo-faint)" }}>{formatPrice(remaining, invoice.currency)} restante</span>
                  </div>
                  <div data-testid="invoiceDetailsModal-invoiceDetailsPaymentTrack" data-slot="invoiceDetailsModal-invoiceDetailsPaymentTrack" className="bo-invoiceDetailsPaymentTrack">
                    <div data-testid="invoiceDetailsModal-div" data-slot="invoiceDetailsModal-div"
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
            <div data-testid="invoiceDetailsModal-invoiceDetailsSection-4" data-slot="invoiceDetailsModal-invoiceDetailsSection" className="bo-invoiceDetailsSection">
              <div data-testid="invoiceDetailsModal-invoiceDetailsSectionTitle-4" data-slot="invoiceDetailsModal-invoiceDetailsSectionTitle" className="bo-invoiceDetailsSectionTitle">Líneas</div>
              <div data-testid="invoiceDetailsModal-div-2" data-slot="invoiceDetailsModal-div">
                {invoice.line_items.map((item, idx) => (
                  <div data-testid="invoiceDetailsModal-invoiceDetailsLineItem" data-slot="invoiceDetailsModal-invoiceDetailsLineItem" key={idx} className="bo-invoiceDetailsLineItem">
                    <span data-testid="invoiceDetailsModal-invoiceDetailsLineItem-desc" data-slot="invoiceDetailsModal-invoiceDetailsLineItem-desc" className="bo-invoiceDetailsLineItem__desc">
                      {item.quantity && item.quantity > 1 ? `${item.quantity}x ` : ""}{item.description}
                    </span>
                    <span data-testid="invoiceDetailsModal-invoiceDetailsLineItem-price" data-slot="invoiceDetailsModal-invoiceDetailsLineItem-price" className="bo-invoiceDetailsLineItem__price">
                      {item.total ? formatPrice(item.total, invoice.currency) : item.unit_price ? formatPrice(item.unit_price * (item.quantity || 1), invoice.currency) : ""}
                    </span>
                  </div>
                ))}
                {invoice.iva_rate != null && (
                  <div data-testid="invoiceDetailsModal-invoiceDetailsLineItemIva" data-slot="invoiceDetailsModal-invoiceDetailsLineItemIva" className="bo-invoiceDetailsLineItemIva">
                    <span data-testid="invoiceDetailsModal-span-4" data-slot="invoiceDetailsModal-span">IVA {invoice.iva_rate}%</span>
                    <span data-testid="invoiceDetailsModal-span-5" data-slot="invoiceDetailsModal-span">{invoice.iva_amount ? formatPrice(invoice.iva_amount, invoice.currency) : ""}</span>
                  </div>
                )}
                <div data-testid="invoiceDetailsModal-invoiceDetailsTotal" data-slot="invoiceDetailsModal-invoiceDetailsTotal" className="bo-invoiceDetailsTotal">
                  <span data-testid="invoiceDetailsModal-span-6" data-slot="invoiceDetailsModal-span">Total</span>
                  <span data-testid="invoiceDetailsModal-span-7" data-slot="invoiceDetailsModal-span">{formatPrice(totalAmount, invoice.currency)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Reservation info */}
          {invoice.is_reservation && (
            <div data-testid="invoiceDetailsModal-invoiceDetailsSection-5" data-slot="invoiceDetailsModal-invoiceDetailsSection" className="bo-invoiceDetailsSection">
              <div data-testid="invoiceDetailsModal-invoiceDetailsSectionTitle-5" data-slot="invoiceDetailsModal-invoiceDetailsSectionTitle" className="bo-invoiceDetailsSectionTitle">Reserva</div>
              {invoice.reservation_date && <DetailRow icon={<Calendar size={14} />} label="Fecha" value={formatDate(invoice.reservation_date)} />}
              {invoice.reservation_customer_name && <DetailRow icon={<User size={14} />} label="Cliente" value={invoice.reservation_customer_name} />}
              {invoice.reservation_party_size && <DetailRow icon={<Users size={14} />} label="Comensales" value={String(invoice.reservation_party_size)} />}
            </div>
          )}

          {/* Internal notes */}
          {invoice.internal_notes && (
            <div data-testid="invoiceDetailsModal-invoiceDetailsSection-6" data-slot="invoiceDetailsModal-invoiceDetailsSection" className="bo-invoiceDetailsSection">
              <div data-testid="invoiceDetailsModal-invoiceDetailsSectionTitle-6" data-slot="invoiceDetailsModal-invoiceDetailsSectionTitle" className="bo-invoiceDetailsSectionTitle">Notas internas</div>
              <p data-testid="invoiceDetailsModal-invoiceDetailsNotes" data-slot="invoiceDetailsModal-invoiceDetailsNotes" className="bo-invoiceDetailsNotes">{invoice.internal_notes}</p>
            </div>
          )}

          {/* Attachments */}
          {invoice.attachments && invoice.attachments.length > 0 && (
            <div data-testid="invoiceDetailsModal-invoiceDetailsSection-7" data-slot="invoiceDetailsModal-invoiceDetailsSection" className="bo-invoiceDetailsSection">
              <div data-testid="invoiceDetailsModal-invoiceDetailsSectionTitle-7" data-slot="invoiceDetailsModal-invoiceDetailsSectionTitle" className="bo-invoiceDetailsSectionTitle">Adjuntos ({invoice.attachments.length})</div>
              <div data-testid="invoiceDetailsModal-invoiceDetailsTags" data-slot="invoiceDetailsModal-invoiceDetailsTags" className="bo-invoiceDetailsTags">
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
            <div data-testid="invoiceDetailsModal-invoiceDetailsSection-8" data-slot="invoiceDetailsModal-invoiceDetailsSection" className="bo-invoiceDetailsSection">
              <div data-testid="invoiceDetailsModal-invoiceDetailsSectionTitle-8" data-slot="invoiceDetailsModal-invoiceDetailsSectionTitle" className="bo-invoiceDetailsSectionTitle">Etiquetas</div>
              <div data-testid="invoiceDetailsModal-invoiceDetailsTags-2" data-slot="invoiceDetailsModal-invoiceDetailsTags" className="bo-invoiceDetailsTags">
                {invoice.tags.map((tag, idx) => (
                  <span data-testid="invoiceDetailsModal-invoiceDetailsTag" data-slot="invoiceDetailsModal-invoiceDetailsTag" key={idx} className="bo-invoiceDetailsTag">
                    <TagIcon size={10} />{tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Action buttons — inside the scroll body so every action stays
              reachable on short screens (invoices_details_mobile_modal_v1). */}
          {hasActions && (
            <div data-testid="invoiceDetailsModal-invoiceDetailsActions" data-slot="invoiceDetailsModal-invoiceDetailsActions" className="bo-invoiceDetailsActions">
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
              {onEdit && (
                <button type="button" className="bo-btn bo-btn--secondary bo-btn--sm" onClick={() => onEdit(invoice)} data-testid="details-edit-btn">
                  <PencilLine size={14} /> Editar
                </button>
              )}
              {onDelete && (
                <button type="button" className="bo-btn bo-btn--danger bo-btn--sm" onClick={() => onDelete(invoice)} data-testid="details-delete-btn">
                  <Trash2 size={14} /> Eliminar
                </button>
              )}
            </div>
          )}
        </div>
        </ScrollArea>
      </div>
      ) : null}
    </Modal>
  );
}