import React, { useCallback, useEffect, useMemo, useState } from "react";
import { X, Mail, MessageSquare, Clock, AlertCircle, CheckCircle, XCircle } from "lucide-react";
import type { InvoiceReminder } from "../../../api/types";
import { createClient } from "../../../api/client";

interface ReminderHistoryModalProps {
  invoiceId: number;
  invoiceNumber?: string;
  customerName: string;
  open: boolean;
  onClose: () => void;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ReminderStatusBadge({ status }: { status: InvoiceReminder["status"] }) {
  const config: Record<InvoiceReminder["status"], { label: string; icon: React.ReactNode; className: string }> = {
    pending: {
      label: "Pendiente",
      icon: <Clock size={12} />,
      className: "bo-badge--warning",
    },
    sent: {
      label: "Enviado",
      icon: <CheckCircle size={12} />,
      className: "bo-badge--success",
    },
    failed: {
      label: "Fallido",
      icon: <XCircle size={12} />,
      className: "bo-badge--danger",
    },
  };

  const { label, icon, className } = config[status] || config.pending;

  return (
    <span className={`bo-badge ${className}`}>
      {icon}
      {label}
    </span>
  );
}

function SentViaBadge({ via }: { via: InvoiceReminder["sent_via"] }) {
  if (via === "email") {
    return (
      <span className="bo-badge bo-badge--info">
        <Mail size={12} />
        Email
      </span>
    );
  }
  if (via === "whatsapp") {
    return (
      <span className="bo-badge bo-badge--info">
        <MessageSquare size={12} />
        WhatsApp
      </span>
    );
  }
  return null;
}

export function ReminderHistoryModal({
  invoiceId,
  invoiceNumber,
  customerName,
  open,
  onClose,
}: ReminderHistoryModalProps) {
  const api = useMemo(() => createClient({ baseUrl: "" }), []);

  const [reminders, setReminders] = useState<InvoiceReminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load reminders
  useEffect(() => {
    if (!open) return;

    setLoading(true);
    setError(null);

    api.reminders
      .getHistory(invoiceId)
      .then((res) => {
        if (res.success) {
          setReminders(res.reminders);
        } else {
          setError(res.message || "Error al cargar el historial");
        }
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : "Error desconocido");
      })
      .finally(() => setLoading(false));
  }, [api, invoiceId, open]);

  if (!open) return null;

  return (
    <div className="bo-modal-overlay" onClick={onClose}>
      <div className="bo-modal bo-modal--md" onClick={(e) => e.stopPropagation()}>
        <div className="bo-modalHeader">
          <h2 className="bo-modalTitle">Historial de recordatorios</h2>
          <button
            className="bo-btn bo-btn--ghost bo-btn--sm"
            onClick={onClose}
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
        </div>

        <div className="bo-modalBody">
          {/* Invoice Info */}
          <div className="bo-reminderHistoryInfo">
            <span>
              <strong>{customerName}</strong>
            </span>
            <span className="bo-mutedText">
              Factura {invoiceNumber || `#${invoiceId}`}
            </span>
          </div>

          {/* Loading State */}
          {loading && (
            <div className="bo-loadingState">
              <div className="bo-spinner" />
              <span>Cargando historial...</span>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="bo-alert bo-alert--error">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          {/* Empty State */}
          {!loading && !error && reminders.length === 0 && (
            <div className="bo-emptyState">
              <Clock size={32} />
              <p>No hay recordatorios enviados</p>
              <span className="bo-mutedText">
                Los recordatorios de pago apareceran aqui
              </span>
            </div>
          )}

          {/* Reminder List */}
          {!loading && !error && reminders.length > 0 && (
            <div className="bo-reminderHistoryList">
              {reminders.map((reminder) => (
                <div key={reminder.id} className="bo-reminderHistoryItem">
                  <div className="bo-reminderHistoryItemHeader">
                    <div className="bo-reminderHistoryItemStatus">
                      <ReminderStatusBadge status={reminder.status} />
                      {reminder.sent_via && <SentViaBadge via={reminder.sent_via} />}
                    </div>
                    <div className="bo-reminderHistoryItemDate">
                      {reminder.sent_at ? (
                        formatDate(reminder.sent_at)
                      ) : (
                        <span className="bo-mutedText">Pendiente</span>
                      )}
                    </div>
                  </div>

                  {reminder.template_name && (
                    <div className="bo-reminderHistoryItemTemplate">
                      Plantilla: {reminder.template_name}
                    </div>
                  )}

                  {reminder.error_message && (
                    <div className="bo-reminderHistoryItemError">
                      <AlertCircle size={14} />
                      {reminder.error_message}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bo-modalFooter">
          <button className="bo-btn bo-btn--ghost" onClick={onClose}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
