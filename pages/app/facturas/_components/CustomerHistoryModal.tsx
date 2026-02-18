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
      <div className="bo-customerHistoryModal">
        {/* Customer Info Header */}
        <div className="bo-customerHistoryHeader">
          <div className="bo-customerHistoryAvatar">
            {customerName.charAt(0).toUpperCase()}
          </div>
          <div className="bo-customerHistoryInfo">
            <h3 className="bo-customerHistoryName">{customerName}</h3>
            <div className="bo-customerHistoryContact">
              <span className="bo-customerHistoryEmail">
                <Mail size={14} />
                {customerEmail}
              </span>
            </div>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="bo-customerHistoryStats">
          <div className="bo-customerHistoryStatCard">
            <div className="bo-customerHistoryStatIcon">
              <TrendingUp size={20} />
            </div>
            <div className="bo-customerHistoryStatContent">
              <div className="bo-customerHistoryStatLabel">Total gastado</div>
              <div className="bo-customerHistoryStatValue">{formatPrice(stats.totalSpend)}</div>
            </div>
          </div>

          <div className="bo-customerHistoryStatCard">
            <div className="bo-customerHistoryStatIcon">
              <FileText size={20} />
            </div>
            <div className="bo-customerHistoryStatContent">
              <div className="bo-customerHistoryStatLabel">Media por factura</div>
              <div className="bo-customerHistoryStatValue">{formatPrice(stats.averageInvoice)}</div>
            </div>
          </div>

          <div className="bo-customerHistoryStatCard">
            <div className="bo-customerHistoryStatIcon">
              <Calendar size={20} />
            </div>
            <div className="bo-customerHistoryStatContent">
              <div className="bo-customerHistoryStatLabel">Facturas</div>
              <div className="bo-customerHistoryStatValue">{stats.invoiceCount}</div>
            </div>
          </div>

          <div className="bo-customerHistoryStatCard">
            <div className="bo-customerHistoryStatIcon">
              <CreditCard size={20} />
            </div>
            <div className="bo-customerHistoryStatContent">
              <div className="bo-customerHistoryStatLabel">Pendientes</div>
              <div className="bo-customerHistoryStatValue">{stats.pendingCount}</div>
            </div>
          </div>
        </div>

        {/* Date Range */}
        {stats.firstInvoiceDate && stats.lastInvoiceDate && (
          <div className="bo-customerHistoryDateRange">
            <span className="bo-customerHistoryDateLabel">Cliente desde:</span>
            <span className="bo-customerHistoryDateValue">
              {formatDate(stats.firstInvoiceDate)} - {formatDate(stats.lastInvoiceDate)}
            </span>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="bo-customerHistoryLoading">
            <Loader2 size={24} className="bo-spinner" />
            <span>Cargando historial...</span>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bo-customerHistoryError">
            <p>{error}</p>
          </div>
        )}

        {/* Invoices List */}
        {!loading && !error && invoices.length > 0 && (
          <div className="bo-customerHistoryInvoices">
            <h4 className="bo-customerHistoryInvoicesTitle">Historial de facturas</h4>
            <div className="bo-customerHistoryInvoicesList">
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
                  >
                    <div className="bo-customerHistoryInvoiceMain">
                      <div className="bo-customerHistoryInvoiceNumber">
                        {invoice.invoice_number || `Factura #${invoice.id}`}
                      </div>
                      <div className="bo-customerHistoryInvoiceDate">{formatDate(invoice.invoice_date)}</div>
                    </div>
                    <div className="bo-customerHistoryInvoiceDetails">
                      <StatusBadge status={invoice.status} />
                      <PaymentMethodBadge method={invoice.payment_method} />
                    </div>
                    <div className="bo-customerHistoryInvoiceAmount">
                      {formatPrice(invoice.amount)}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && invoices.length === 0 && (
          <div className="bo-customerHistoryEmpty">
            <FileText size={48} />
            <p>No se encontraron facturas para este cliente</p>
          </div>
        )}

        {/* Actions */}
        <div className="bo-modalActions">
          <button className="bo-btn bo-btn--ghost" type="button" onClick={onClose}>
            Cerrar
          </button>
          <a
            href={`/app/facturas?search=${encodeURIComponent(customerEmail)}`}
            className="bo-btn bo-btn--primary"
          >
            Ver todas las facturas
          </a>
        </div>
      </div>
    </Modal>
  );
}
