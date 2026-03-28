import React, { useCallback, useEffect, useMemo, useState } from "react";
import { X, Mail, MessageSquare, Clock, AlertCircle, CheckCircle, XCircle } from "lucide-react";
import type { InvoiceReminder } from "../../../../api/types";
import { createClient } from "../../../../api/client";

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
      className: "bg-[var(--text-warning)]/[0.16] text-[var(--text-warning)] border-[var(--text-warning)]/[0.30]",
    },
    sent: {
      label: "Enviado",
      icon: <CheckCircle size={12} />,
      className: "bg-[var(--text-success)]/[0.16] text-[var(--text-success)] border-[var(--text-success)]/[0.30]",
    },
    failed: {
      label: "Fallido",
      icon: <XCircle size={12} />,
      className: "bg-[var(--text-danger)]/[0.16] text-[var(--text-danger)] border-[var(--text-danger)]/[0.30]",
    },
  };

  const { label, icon, className } = config[status] || config.pending;

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${className}`}>
      {icon}
      {label}
    </span>
  );
}

function SentViaBadge({ via }: { via: InvoiceReminder["sent_via"] }) {
  if (via === "email") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--text-info)]/[0.16] text-[var(--text-info)] border-[var(--text-info)]/[0.30]">
        <Mail size={12} />
        Email
      </span>
    );
  }
  if (via === "whatsapp") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--text-info)]/[0.16] text-[var(--text-info)] border-[var(--text-info)]/[0.30]">
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
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="rounded-lg bg-card shadow-soft max-w-lg w-full bo-modal--md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border">
          <h2 className="text-lg font-semibold text-foreground">Historial de recordatorios</h2>
          <button
            className="inline-flex h-8 items-center justify-center gap-2 rounded-lg border border-white/[0.06] bg-transparent text-foreground text-xs font-bold transition-all hover:bg-white/[0.04]"
            onClick={onClose}
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-4">
          {/* Invoice Info */}
          <div className="bo-reminderHistoryInfo">
            <span>
              <strong>{customerName}</strong>
            </span>
            <span className="text-mutedText">
              Factura {invoiceNumber || `#${invoiceId}`}
            </span>
          </div>

          {/* Loading State */}
          {loading && (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <div className="animate-spin h-5 w-5" />
              <span>Cargando historial...</span>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="bg-surface-2 border border-border rounded-lg p-4 bg-red-500/10 border-red-500/30 text-red-500">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          {/* Empty State */}
          {!loading && !error && reminders.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-muted-foreground text-center gap-3">
              <Clock size={32} />
              <p>No hay recordatorios enviados</p>
              <span className="text-mutedText">
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
                        <span className="text-mutedText">Pendiente</span>
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
          <button className="h-9 px-4 rounded-sm font-semibold inline-flex items-center justify-center gap-2 cursor-pointer bg-transparent border border-transparent hover:bg-white/5 bg-transparent" onClick={onClose}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
