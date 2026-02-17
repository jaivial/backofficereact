import React, { useMemo } from "react";
import { Paperclip, PencilLine } from "lucide-react";
import type { Invoice, InvoiceStatus } from "../../../../api/types";

type InvoiceTableProps = {
  invoices: Invoice[];
  loading: boolean;
  page: number;
  totalPages: number;
  total: number;
  onEdit: (invoice: Invoice) => void;
  onPageChange: (page: number) => void;
};

function formatPrice(price: number): string {
  return `${price.toFixed(2)} €`;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function StatusBadge({ status }: { status: InvoiceStatus }) {
  const statusConfig: Record<InvoiceStatus, { label: string; className: string }> = {
    borrador: { label: "Borrador", className: "bo-badge--muted" },
    solicitada: { label: "Solicitada", className: "bo-badge--warning" },
    pendiente: { label: "Pendiente", className: "bo-badge--info" },
    enviada: { label: "Enviada", className: "bo-badge--success" },
  };

  const config = statusConfig[status] || { label: status, className: "" };

  return <span className={`bo-badge ${config.className}`}>{config.label}</span>;
}

function ReservationBadge({ isReservation }: { isReservation: boolean }) {
  return (
    <span className={`bo-badge ${isReservation ? "bo-badge--info" : "bo-badge--muted"}`}>
      {isReservation ? "Reserva" : "Sin reserva"}
    </span>
  );
}

export function InvoiceTable({ invoices, loading, page, totalPages, total, onEdit, onPageChange }: InvoiceTableProps) {
  const columns = useMemo(
    () => [
      { key: "customer_name", label: "Cliente", visible: true, priority: 1 },
      { key: "customer_email", label: "Email", visible: true, priority: 2 },
      { key: "amount", label: "Importe", visible: true, priority: 1 },
      { key: "invoice_date", label: "Fecha", visible: true, priority: 1 },
      { key: "status", label: "Estado", visible: true, priority: 1 },
      { key: "is_reservation", label: "Tipo", visible: true, priority: 2 },
      { key: "attachment", label: "", visible: true, priority: 3 },
      { key: "actions", label: "", visible: true, priority: 3 },
    ],
    [],
  );

  const showPagerBtns = totalPages > 1;

  if (loading) {
    return (
      <div className="bo-tableWrap">
        <div className="bo-tableLoading">
          <div className="bo-spinner" />
          <span>Cargando facturas...</span>
        </div>
      </div>
    );
  }

  if (!invoices.length) {
    return (
      <div className="bo-tableWrap">
        <div className="bo-tableEmpty">No hay facturas que coincidan con los filtros.</div>
      </div>
    );
  }

  return (
    <div className="bo-tableWrap" style={{ marginTop: 14 }}>
      <div className="bo-tableScroll">
        <table className="bo-table bo-table--facturas" aria-label="Tabla de facturas">
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col.key} className={`col-${col.key}`}>
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {invoices.map((invoice) => (
              <tr key={invoice.id} className="bo-tableRow">
                <td className={`col-customer_name`}>
                  <div className="bo-tableCustomer">
                    <span className="bo-tableCustomerName">{invoice.customer_name}</span>
                    {invoice.customer_surname && (
                      <span className="bo-tableCustomerSurname"> {invoice.customer_surname}</span>
                    )}
                  </div>
                </td>
                <td className={`col-customer_email`}>{invoice.customer_email}</td>
                <td className={`col-amount`}>{formatPrice(invoice.amount)}</td>
                <td className={`col-invoice_date`}>{formatDate(invoice.invoice_date)}</td>
                <td className={`col-status`}>
                  <StatusBadge status={invoice.status} />
                </td>
                <td className={`col-is_reservation`}>
                  <ReservationBadge isReservation={invoice.is_reservation} />
                </td>
                <td className={`col-attachment`}>
                  {invoice.account_image_url && (
                    <span className="bo-tableAttachment" title="Imagen adjunta">
                      <Paperclip size={14} />
                    </span>
                  )}
                </td>
                <td className={`col-actions`}>
                  <button
                    className="bo-btn bo-btn--ghost bo-btn--sm"
                    type="button"
                    onClick={() => onEdit(invoice)}
                    aria-label={`Editar factura ${invoice.id}`}
                    title="Editar"
                  >
                    <PencilLine size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className={`bo-pager${showPagerBtns ? "" : " is-solo"}`} aria-label="Paginación">
        <div className="bo-pagerText">
          Página {page} de {totalPages} · {total} resultados
        </div>
        {showPagerBtns ? (
          <div className="bo-pagerBtns">
            <button className="bo-btn bo-btn--ghost" type="button" onClick={() => onPageChange(page - 1)} disabled={loading || page <= 1}>
              Anterior
            </button>
            <button className="bo-btn bo-btn--ghost" type="button" onClick={() => onPageChange(page + 1)} disabled={loading || page >= totalPages}>
              Siguiente
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
