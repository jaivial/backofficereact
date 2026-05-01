import React, { useCallback, useEffect, useMemo, useState } from "react";
import { X, FileText, Calendar, CreditCard, TrendingUp, Mail, Phone, Loader2 } from "lucide-react";
import type { Invoice, InvoiceStatus } from "../../../../api/types";
import { Modal } from "../../../../ui/overlays/Modal";

type CustomerHistoryModalProps = {
  open: boolean;
  customerName: string;
  customerEmail: string;
  onClose: () => void;
  fetchInvoicesByEmail: (email: string) => Promise<Invoice[]>;
};

function formatPrice(price: number): string {
  return `${price.toFixed(2)} €`;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" });
}

const INVOICE_STATUS_CONFIG: Record<InvoiceStatus, { label: string; className: string }> = {
  borrador: { label: "Borrador", className: "bo-badge--muted" },
  solicitada: { label: "Solicitada", className: "bo-badge--warning" },
  pendiente: { label: "Pendiente", className: "bo-badge--info" },
  enviada: { label: "Enviada", className: "bo-badge--success" },
  pagada: { label: "Pagada", className: "bo-badge--success" },
};

function StatusBadge({ status }: { status: InvoiceStatus }) {
  const config = INVOICE_STATUS_CONFIG[status] || { label: status, className: "" };
  return <span className={`bo-badge ${config.className}`}>{config.label}</span>;
}

function PaymentMethodBadge({ method }: { method?: string }) {
  if (!method) return <span className="bo-badge bo-badge--muted">Sin especificar</span>;

  const methodLabels: Record<string, string> = {
    efectivo: "Efectivo",
    tarjeta: "Tarjeta",
    transferencia: "Transferencia",
    bizum: "Bizum",
    cheque: "Cheque",
  };

  return <span className="bo-badge bo-badge--info">{methodLabels[method] || method}</span>;
}

export function CustomerHistoryModal({
  open,
  customerName,
  customerEmail,
  onClose,
  fetchInvoicesByEmail,
}: CustomerHistoryModalProps) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch invoices when modal opens
  useEffect(() => {
    if (open && customerEmail) {
      setLoading(true);
      setError(null);
      fetchInvoicesByEmail(customerEmail)
        .then((data) => {
          setInvoices(data);
        })
        .catch((err) => {
          setError(err instanceof Error ? err.message : "Error al cargar el historial");
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [open, customerEmail, fetchInvoicesByEmail]);

  // Calculate statistics
  const stats = useMemo(() => {
    if (invoices.length === 0) {
      return {
        totalSpend: 0,
        averageInvoice: 0,
        invoiceCount: 0,
        paidCount: 0,
        pendingCount: 0,
        draftCount: 0,
        firstInvoiceDate: null as string | null,
        lastInvoiceDate: null as string | null,
      };
    }

    const totalSpend = invoices.reduce((sum, inv) => sum + inv.amount, 0);
    const averageInvoice = totalSpend / invoices.length;
    const paidCount = invoices.filter((inv) => inv.status === "enviada").length;
    const pendingCount = invoices.filter((inv) => inv.status === "pendiente" || inv.status === "solicitada").length;
    const draftCount = invoices.filter((inv) => inv.status === "borrador").length;

    // Sort by date to get first and last
    const sortedByDate = [...invoices].sort(
      (a, b) => new Date(a.invoice_date).getTime() - new Date(b.invoice_date).getTime()
    );

    return {
      totalSpend,
      averageInvoice,
      invoiceCount: invoices.length,
      paidCount,
      pendingCount,
      draftCount,
      firstInvoiceDate: sortedByDate[0]?.invoice_date || null,
      lastInvoiceDate: sortedByDate[sortedByDate.length - 1]?.invoice_date || null,
    };
  }, [invoices]);

  // Handle click on invoice row to view/edit
  const handleInvoiceClick = useCallback((invoice: Invoice) => {
    // Could open invoice details or navigate to it
    // For now, we'll just close the modal - the user can find it in the main list
    onClose();
  }, [onClose]);

  return (
    <Modal open={open} title={`Historial de ${customerName}`} onClose={onClose} widthPx={800}>
      <div className="bo-customerHistoryModal" data-slot="customer-history-modal">
        {/* Customer Info Header */}
        <div className="bo-customerHistoryHeader" data-slot="customer-history-header">
          <div className="bo-customerHistoryAvatar" data-slot="customer-history-avatar">
            {customerName.charAt(0).toUpperCase()}
          </div>
          <div className="bo-customerHistoryInfo" data-slot="customer-history-info">
            <h3 className="bo-customerHistoryName" data-slot="customerHistoryModal-customerHistoryName">{customerName}</h3>
            <div className="bo-customerHistoryContact" data-slot="customer-history-contact">
              <span className="bo-customerHistoryEmail" data-slot="customerHistoryModal-customerHistoryEmail">
                <Mail size={14}>
                {customerEmail}
              </span>
            </div>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="bo-customerHistoryStats" data-slot="customer-history-stats">
          <div className="bo-customerHistoryStatCard" data-slot="customer-history-stat-card-total">
            <div className="bo-customerHistoryStatIcon" data-slot="customerHistoryModal-customerHistoryStatIcon">
              <TrendingUp size={20}>
            </div>
            <div className="bo-customerHistoryStatContent" data-slot="customerHistoryModal-customerHistoryStatContent">
              <div className="bo-customerHistoryStatLabel" data-slot="customerHistoryModal-customerHistoryStatLabel">Total gastado</div>
              <div className="bo-customerHistoryStatValue" data-slot="customerHistoryModal-customerHistoryStatValue">{formatPrice(stats.totalSpend)}</div>
            </div>
          </div>

          <div className="bo-customerHistoryStatCard" data-slot="customer-history-stat-card-average">
            <div className="bo-customerHistoryStatIcon" data-slot="customerHistoryModal-customerHistoryStatIcon">
              <FileText size={20}>
            </div>
            <div className="bo-customerHistoryStatContent" data-slot="customerHistoryModal-customerHistoryStatContent">
              <div className="bo-customerHistoryStatLabel" data-slot="customerHistoryModal-customerHistoryStatLabel">Media por factura</div>
              <div className="bo-customerHistoryStatValue" data-slot="customerHistoryModal-customerHistoryStatValue">{formatPrice(stats.averageInvoice)}</div>
            </div>
          </div>

          <div className="bo-customerHistoryStatCard" data-slot="customer-history-stat-card-invoices">
            <div className="bo-customerHistoryStatIcon" data-slot="customerHistoryModal-customerHistoryStatIcon">
              <Calendar size={20}>
            </div>
            <div className="bo-customerHistoryStatContent" data-slot="customerHistoryModal-customerHistoryStatContent">
              <div className="bo-customerHistoryStatLabel" data-slot="customerHistoryModal-customerHistoryStatLabel">Facturas</div>
              <div className="bo-customerHistoryStatValue" data-slot="customerHistoryModal-customerHistoryStatValue">{stats.invoiceCount}</div>
            </div>
          </div>

          <div className="bo-customerHistoryStatCard" data-slot="customer-history-stat-card-pending">
            <div className="bo-customerHistoryStatIcon" data-slot="customerHistoryModal-customerHistoryStatIcon">
              <CreditCard size={20}>
            </div>
            <div className="bo-customerHistoryStatContent" data-slot="customerHistoryModal-customerHistoryStatContent">
              <div className="bo-customerHistoryStatLabel" data-slot="customerHistoryModal-customerHistoryStatLabel">Pendientes</div>
              <div className="bo-customerHistoryStatValue" data-slot="customerHistoryModal-customerHistoryStatValue">{stats.pendingCount}</div>
            </div>
          </div>
        </div>

        {/* Date Range */}
        {stats.firstInvoiceDate && stats.lastInvoiceDate && (
          <div className="bo-customerHistoryDateRange" data-slot="customer-history-date-range">
            <span className="bo-customerHistoryDateLabel" data-slot="customerHistoryModal-customerHistoryDateLabel">Cliente desde:</span>
            <span className="bo-customerHistoryDateValue" data-slot="customerHistoryModal-customerHistoryDateValue">
              {formatDate(stats.firstInvoiceDate)} - {formatDate(stats.lastInvoiceDate)}
            </span>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="bo-customerHistoryLoading" data-slot="customer-history-loading">
            <Loader2 size={24} className="bo-spinner" />
            <span data-slot="customerHistoryModal-ial">Cargando historial...</span>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bo-customerHistoryError" data-slot="customer-history-error">
            <p data-slot="customerHistoryModal-ror">{error}</p>
          </div>
        )}

        {/* Invoices List */}
        {!loading && !error && invoices.length > 0 && (
          <div className="bo-customerHistoryInvoices" data-slot="customer-history-invoices">
            <h4 className="bo-customerHistoryInvoicesTitle" data-slot="customerHistoryModal-customerHistoryInvoicesTitle">Historial de facturas</h4>
            <div className="bo-customerHistoryInvoicesList" data-slot="customer-history-invoices-list">
              {invoices
                .sort((a, b) => new Date(b.invoice_date).getTime() - new Date(a.invoice_date).getTime())
                .map((invoice) => (
                  <div
                    key={invoice.id}
                    className="bo-customerHistoryInvoiceRow"
                    onClick={() => handleInvoiceClick(invoice)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === "Enter" && handleInvoiceClick(invoice)}
                    data-slot="customer-history-invoice-row"
                  >
                    <div className="bo-customerHistoryInvoiceMain" data-slot="customer-history-invoice-main">
                      <div className="bo-customerHistoryInvoiceNumber" data-slot="customerHistoryModal-customerHistoryInvoiceNumber">
                        {invoice.invoice_number || `Factura #${invoice.id}`}
                      </div>
                      <div className="bo-customerHistoryInvoiceDate" data-slot="customerHistoryModal-customerHistoryInvoiceDate">{formatDate(invoice.invoice_date)}</div>
                    </div>
                    <div className="bo-customerHistoryInvoiceDetails" data-slot="customer-history-invoice-details">
                      <StatusBadge status={invoice.status}>
                      <PaymentMethodBadge method={invoice.payment_method}>
                    </div>
                    <div className="bo-customerHistoryInvoiceAmount" data-slot="customer-history-invoice-amount">
                      {formatPrice(invoice.amount)}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && invoices.length === 0 && (
          <div className="bo-customerHistoryEmpty" data-slot="customer-history-empty">
            <FileText size={48}>
            <p data-slot="customerHistoryModal-nte">No se encontraron facturas para este cliente</p>
          </div>
        )}

        {/* Actions */}
        <div className="bo-modalActions" data-slot="customer-history-actions">
          <button className="bo-btn bo-btn--ghost" type="button" onClick={onClose} data-testid="customer-history-close-btn">
            Cerrar
          </button>
          <a
            href={`/app/facturas?search=${encodeURIComponent(customerEmail)}`}
            className="bo-btn bo-btn--primary"
            data-testid="customer-history-view-all-link"
          >
            Ver todas las facturas
          </a>
        </div>
      </div>
    </Modal>
  );
}
