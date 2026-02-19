import React, { useCallback, useEffect, useState } from "react";
import { X, Clock, User, FileText, Edit3, Send, Copy, Trash2, History } from "lucide-react";
import type { InvoiceHistory, InvoiceHistoryAction } from "../../../../api/types";
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
    <div className="bo-modal-overlay" onClick={onClose}>
      <div className="bo-modal-content bo-historyModal" onClick={(e) => e.stopPropagation()}>
        <div className="bo-modal-header">
          <div className="bo-modal-title">
            <History size={20} />
            <span>Historial de cambios</span>
          </div>
          <button
            className="bo-btn bo-btn--ghost bo-btn--sm"
            onClick={onClose}
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
        </div>

        <div className="bo-modal-body">
          {invoiceNumber && (
            <div className="bo-historyInvoiceInfo">
              <strong>Factura:</strong> {invoiceNumber}
              {customerName && <span className="bo-historyCustomer"> - {customerName}</span>}
            </div>
          )}

          {loading && (
            <div className="bo-historyLoading">
              <div className="bo-spinner" />
              <span>Cargando historial...</span>
            </div>
          )}

          {error && (
            <div className="bo-historyError">
              <span>{error}</span>
            </div>
          )}

          {!loading && !error && history.length === 0 && (
            <div className="bo-historyEmpty">
              <Clock size={32} />
              <span>No hay historial disponible</span>
              <p>Los cambios realizados en esta factura se mostraran aqui.</p>
            </div>
          )}

          {!loading && !error && history.length > 0 && (
            <div className="bo-historyTimeline">
              {history.map((entry, index) => {
                const actionConfig = ACTION_CONFIG[entry.action] || {
                  label: entry.action,
                  icon: <History size={14} />,
                  className: "",
                };

                const hasChanges = entry.field_name && (entry.old_value !== undefined || entry.new_value !== undefined);

                return (
                  <div
                    key={entry.id}
                    className={`bo-historyEntry ${index === history.length - 1 ? "bo-historyEntry--latest" : ""}`}
                  >
                    <div className="bo-historyEntryIcon">
                      {actionConfig.icon}
                    </div>
                    <div className="bo-historyEntryContent">
                      <div className="bo-historyEntryHeader">
                        <span className={`bo-historyAction ${actionConfig.className}`}>
                          {actionConfig.label}
                        </span>
                        <span className="bo-historyEntryDate">
                          <Clock size={12} />
                          {formatDateTime(entry.created_at)}
                        </span>
                      </div>

                      {entry.user_name && (
                        <div className="bo-historyEntryUser">
                          <User size={12} />
                          <span>{entry.user_name}</span>
                          {entry.user_email && <span className="bo-historyUserEmail">({entry.user_email})</span>}
                        </div>
                      )}

                      {hasChanges && entry.field_name && (
                        <div className="bo-historyChanges">
                          <span className="bo-historyFieldName">{formatFieldName(entry.field_name)}:</span>
                          <div className="bo-historyValues">
                            <span className="bo-historyOldValue" title="Valor anterior">
                              {formatValue(entry.old_value)}
                            </span>
                            <span className="bo-historyArrow">→</span>
                            <span className="bo-historyNewValue" title="Nuevo valor">
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
      </div>
    </div>
  );
}
