import React, { useCallback, useEffect, useState } from "react";
import { X, Clock, User, FileText, Edit3, Send, Copy, Trash2, History } from "lucide-react";
import type { InvoiceHistory, InvoiceHistoryAction } from "../../../../api/types";
import { ScrollArea } from "../../../../ui/layout/ScrollArea";
import { createClient } from "../../../../api/client";

interface InvoiceHistoryModalProps {
  invoiceId: number;
  invoiceNumber?: string;
  customerName?: string;
  open: boolean;
  onClose: () => void;
}

const ACTION_CONFIG: Record<InvoiceHistoryAction, { label: string; icon: React.ReactNode; className: string }> = {
  created: { label: "Creada", icon: <FileText size={14} />, className: "bo-historyAction--created" },
  updated: { label: "Actualizada", icon: <Edit3 size={14} />, className: "bo-historyAction--updated" },
  status_changed: { label: "Estado cambiado", icon: <Clock size={14} />, className: "bo-historyAction--status" },
  deleted: { label: "Eliminada", icon: <Trash2 size={14} />, className: "bo-historyAction--deleted" },
  sent: { label: "Enviada", icon: <Send size={14} />, className: "bo-historyAction--sent" },
  duplicated: { label: "Duplicada", icon: <Copy size={14} />, className: "bo-historyAction--duplicated" },
  renumbered: { label: "Renumerada", icon: <History size={14} />, className: "bo-historyAction--updated" },
};

function formatDateTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatFieldName(field: string): string {
  const fieldMap: Record<string, string> = {
    customer_name: "Nombre del cliente",
    customer_surname: "Apellidos",
    customer_email: "Email",
    customer_dni_cif: "DNI/CIF",
    customer_phone: "Telefono",
    amount: "Importe",
    iva_rate: "IVA",
    iva_amount: "Importe IVA",
    total: "Total",
    payment_method: "Metodo de pago",
    invoice_date: "Fecha de factura",
    payment_date: "Fecha de pago",
    status: "Estado",
    invoice_number: "Numero de factura",
  };
  return fieldMap[field] || field;
}

function formatValue(value: string | undefined): string {
  if (value === undefined || value === null || value === "") {
    return "(vacio)";
  }
  return value;
}

export function InvoiceHistoryModal({
  invoiceId,
  invoiceNumber,
  customerName,
  open,
  onClose,
}: InvoiceHistoryModalProps) {
  const [history, setHistory] = useState<InvoiceHistory[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const api = createClient({ baseUrl: "" });

  const fetchHistory = useCallback(async () => {
    if (!invoiceId || !open) return;

    setLoading(true);
    setError(null);

    try {
      const res = await api.invoices.getHistory(invoiceId);
      if (res.success) {
        setHistory(res.history);
      } else {
        const msg = "message" in res ? res.message : undefined;
        setError(msg || "Error al cargar el historial");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  }, [api, invoiceId, open]);

  useEffect(() => {
    if (open) {
      fetchHistory();
    }
  }, [fetchHistory, open]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div data-testid="invoice-history-overlay" className="bo-modal-overlay" onClick={onClose} data-slot="invoice-history-overlay">
      <div data-testid="invoice-history-modal" className="bo-modal-content bo-historyModal" onClick={(e) => e.stopPropagation()} data-slot="invoice-history-modal">
        <div data-testid="invoice-history-header" className="bo-modal-header" data-slot="invoice-history-header">
          <div data-testid="invoiceHistoryModal-modal-title" className="bo-modal-title" data-slot="invoiceHistoryModal-modal-title">
            <History size={20} />
            <span data-testid="invoiceHistoryModal-ios" data-slot="invoiceHistoryModal-ios">Historial de cambios</span>
          </div>
          <button
            className="bo-btn bo-btn--ghost bo-btn--sm"
            onClick={onClose}
            aria-label="Cerrar"
            data-testid="invoice-history-modal-close-btn"
          >
            <X size={18} />
          </button>
        </div>

        <ScrollArea dataSlot="invoice-history-body">
          <div data-testid="invoiceHistoryModal-modal-body" data-slot="invoiceHistoryModal-modal-body" className="bo-modal-body">
          {invoiceNumber && (
            <div data-testid="invoice-history-info" className="bo-historyInvoiceInfo" data-slot="invoice-history-info">
              <strong data-testid="InvoiceHistoryModal-strong">Factura:</strong> {invoiceNumber}
              {customerName && <span data-testid="InvoiceHistoryModal-span" className="bo-historyCustomer"> - {customerName}</span>}
            </div>
          )}

          {loading && (
            <div data-testid="invoice-history-loading" className="bo-historyLoading" data-slot="invoice-history-loading">
              <div data-testid="invoiceHistoryModal-spinner" className="bo-spinner" data-slot="invoiceHistoryModal-spinner" />
              <span data-testid="invoiceHistoryModal-ial" data-slot="invoiceHistoryModal-ial">Cargando historial...</span>
            </div>
          )}

          {error && (
            <div data-testid="invoice-history-error" className="bo-historyError" data-slot="invoice-history-error">
              <span data-testid="invoiceHistoryModal-ror" data-slot="invoiceHistoryModal-ror">{error}</span>
            </div>
          )}

          {!loading && !error && history.length === 0 && (
            <div data-testid="invoice-history-empty" className="bo-historyEmpty" data-slot="invoice-history-empty">
              <Clock size={32} />
              <span data-testid="invoiceHistoryModal-ble" data-slot="invoiceHistoryModal-ble">No hay historial disponible</span>
              <p data-testid="invoiceHistoryModal-qui" data-slot="invoiceHistoryModal-qui">Los cambios realizados en esta factura se mostraran aqui.</p>
            </div>
          )}

          {!loading && !error && history.length > 0 && (
            <div data-testid="invoice-history-timeline" className="bo-historyTimeline" data-slot="invoice-history-timeline">
              {history.map((entry, index) => {
                const actionConfig = ACTION_CONFIG[entry.action] || {
                  label: entry.action,
                  icon: <History size={14} />,
                  className: "",
                };

                const hasChanges = entry.field_name && (entry.old_value !== undefined || entry.new_value !== undefined);

                return (
                  <div data-testid="invoice-history-entry"
                    key={entry.id}
                    className={`bo-historyEntry ${index === history.length - 1 ? "bo-historyEntry--latest" : ""}`}
                    data-slot="invoice-history-entry"
                  >
                    <div data-testid="invoice-history-entry-icon" className="bo-historyEntryIcon" data-slot="invoice-history-entry-icon">
                      {actionConfig.icon}
                    </div>
                    <div data-testid="invoice-history-entry-content" className="bo-historyEntryContent" data-slot="invoice-history-entry-content">
                      <div data-testid="invoiceHistoryModal-historyEntryHeader" className="bo-historyEntryHeader" data-slot="invoiceHistoryModal-historyEntryHeader">
                        <span data-testid="invoiceHistoryModal-span" className={`bo-historyAction ${actionConfig.className}`} data-slot="invoiceHistoryModal-span">
                          {actionConfig.label}
                        </span>
                        <span data-testid="invoiceHistoryModal-historyEntryDate" className="bo-historyEntryDate" data-slot="invoiceHistoryModal-historyEntryDate">
                          <Clock size={12} />
                          {formatDateTime(entry.created_at)}
                        </span>
                      </div>

                      {entry.user_name && (
                        <div data-testid="invoice-history-entry-user" className="bo-historyEntryUser" data-slot="invoice-history-entry-user">
                          <User size={12} />
                          <span data-testid="invoiceHistoryModal-ame" data-slot="invoiceHistoryModal-ame">{entry.user_name}</span>
                          {entry.user_email && <span data-testid="InvoiceHistoryModal-span-2" className="bo-historyUserEmail">({entry.user_email})</span>}
                        </div>
                      )}

                      {hasChanges && entry.field_name && (
                        <div data-testid="invoice-history-entry-changes" className="bo-historyChanges" data-slot="invoice-history-entry-changes">
                          <span data-testid="invoiceHistoryModal-historyFieldName" className="bo-historyFieldName" data-slot="invoiceHistoryModal-historyFieldName">{formatFieldName(entry.field_name)}:</span>
                          <div data-testid="invoice-history-values" className="bo-historyValues" data-slot="invoice-history-values">
                            <span data-testid="invoiceHistoryModal-historyOldValue" className="bo-historyOldValue" title="Valor anterior" data-slot="invoiceHistoryModal-historyOldValue">
                              {formatValue(entry.old_value)}
                            </span>
                            <span data-testid="invoiceHistoryModal-historyArrow" className="bo-historyArrow" data-slot="invoiceHistoryModal-historyArrow">→</span>
                            <span data-testid="invoiceHistoryModal-historyNewValue" className="bo-historyNewValue" title="Nuevo valor" data-slot="invoiceHistoryModal-historyNewValue">
                              {formatValue(entry.new_value)}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        </ScrollArea>
      </div>
    </div>
  );
}
