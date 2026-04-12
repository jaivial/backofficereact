import React, { useCallback, useMemo } from "react";
import { Switch } from "../../../../ui/shadcn/Switch";
import { DatePicker } from "../../../../ui/inputs/DatePicker";
import { Select } from "../../../../ui/inputs/Select";
import { AlertCircle, RefreshCw, Calendar, Clock, Play, Pause, Send } from "lucide-react";
import type { RecurringFrequency, RecurringInvoiceStatus } from "../../../../api/recurring-types";
import { RECURRING_FREQUENCY_OPTIONS } from "../../../../api/recurring-types";

export interface RecurringBillingData {
  is_recurring: boolean;
  frequency?: RecurringFrequency;
  start_date?: string;
  end_date?: string;
  next_billing_date?: string;
  is_active?: boolean;
  auto_send?: boolean;
  invoice_count?: number;
  last_invoice_date?: string;
}

type RecurringBillingSectionProps = {
  data: RecurringBillingData;
  onChange: (data: RecurringBillingData) => void;
  disabled?: boolean;
  showStatus?: boolean;
  status?: RecurringInvoiceStatus;
  onPause?: () => void;
  onResume?: () => void;
};

export function RecurringBillingSection({
  data,
  onChange,
  disabled = false,
  showStatus = false,
  status,
  onPause,
  onResume,
}: RecurringBillingSectionProps) {
  const handleToggle = useCallback((checked: boolean) => {
    const today = new Date().toISOString().split("T")[0];
    onChange({
      ...data,
      is_recurring: checked,
      frequency: checked ? (data.frequency || "monthly") : undefined,
      start_date: checked ? (data.start_date || today) : undefined,
      next_billing_date: checked ? (data.next_billing_date || today) : undefined,
      is_active: checked ? (data.is_active ?? true) : undefined,
      auto_send: checked ? (data.auto_send ?? false) : undefined,
    });
  }, [data, onChange]);

  const handleFrequencyChange = useCallback((value: string) => {
    onChange({
      ...data,
      frequency: value as RecurringFrequency,
    });
  }, [data, onChange]);

  const handleStartDateChange = useCallback((date: string) => {
    onChange({
      ...data,
      start_date: date,
      next_billing_date: date, // Initial next billing date equals start date
    });
  }, [data, onChange]);

  const handleEndDateChange = useCallback((date: string) => {
    onChange({
      ...data,
      end_date: date,
    });
  }, [data, onChange]);

  const frequencyOptions = useMemo(() => {
    return RECURRING_FREQUENCY_OPTIONS.map(opt => ({
      value: opt.value,
      label: opt.label,
    }));
  }, []);

  const getStatusBadge = useCallback((status?: RecurringInvoiceStatus) => {
    switch (status) {
      case "pending":
        return (
          <span className="bo-recurringStatus bo-recurringStatus--pending" data-slot="recurringBillingSection-recurringStatus--pending">
            <Clock size={12} />
            Pendiente
          </span>
        );
      case "sending":
        return (
          <span className="bo-recurringStatus bo-recurringStatus--sending" data-slot="recurringBillingSection-recurringStatus--sending">
            <RefreshCw size={12} className="bo-recurringStatus--spinning" />
            Enviando
          </span>
        );
      case "sent":
        return (
          <span className="bo-recurringStatus bo-recurringStatus--sent" data-slot="recurringBillingSection-recurringStatus--sent">
            <RefreshCw size={12} />
            Enviada
          </span>
        );
      case "failed":
        return (
          <span className="bo-recurringStatus bo-recurringStatus--failed" data-slot="recurringBillingSection-recurringStatus--failed">
            <AlertCircle size={12} />
            Error
          </span>
        );
      default:
        return null;
    }
  }, []);

  const getNextBillingDatePreview = useCallback(() => {
    if (!data.start_date || !data.frequency) return null;

    const startDate = new Date(data.start_date);
    let nextDate = new Date(startDate);

    switch (data.frequency) {
      case "weekly":
        nextDate.setDate(nextDate.getDate() + 7);
        break;
      case "monthly":
        nextDate.setMonth(nextDate.getMonth() + 1);
        break;
      case "quarterly":
        nextDate.setMonth(nextDate.getMonth() + 3);
        break;
    }

    return nextDate.toISOString().split("T")[0];
  }, [data.start_date, data.frequency]);

  return (
    <div className="bo-invoiceFormSection bo-recurringBilling" data-slot="recurring-billing-section">
      <div className="bo-recurringBillingHeader" data-slot="recurring-billing-header">
        <div className="bo-recurringBillingTitle" data-slot="recurringBillingSection-recurringBillingTitle">
          <RefreshCw size={18} />
          <h3 data-slot="recurringBillingSection-nte">Facturación recurrente</h3>
        </div>

        {showStatus && status && getStatusBadge(status)}

        {showStatus && data.is_active && onPause && (
          <button
            type="button"
            className="bo-btn bo-btn--ghost bo-btn--sm"
            onClick={onPause}
            title="Pausar facturación recurrente"
            data-testid="recurring-billing-pause-btn"
          >
            <Pause size={14} />
            Pausar
          </button>
        )}

        {showStatus && !data.is_active && onResume && (
          <button
            type="button"
            className="bo-btn bo-btn--ghost bo-btn--sm"
            onClick={onResume}
            title="Reanudar facturación recurrente"
            data-testid="recurring-billing-resume-btn"
          >
            <Play size={14} />
            Reanudar
          </button>
        )}
      </div>

      {/* Enable/Disable Toggle */}
      <div className="bo-recurringBillingToggle" data-slot="recurring-billing-toggle-section">
        <div className="bo-field bo-field--switch" data-slot="recurringBillingSection-field--switch">
          <Switch
            checked={data.is_recurring ?? false}
            onCheckedChange={handleToggle}
            disabled={disabled}
            data-testid="recurring-billing-toggle"
          />
          <span className="bo-label" data-slot="recurringBillingSection-label">Activar facturación recurrente</span>
        </div>
      </div>

      {/* Recurring Configuration */}
      {data.is_recurring && (
        <div className="bo-recurringBillingConfig" data-slot="recurring-billing-config">
          {/* Frequency Selection */}
          <div className="bo-recurringBillingRow" data-slot="recurring-billing-row-frequency">
            <div className="bo-field" data-slot="recurringBillingSection-field">
              <span className="bo-label" data-slot="recurringBillingSection-label">
                <Clock size={14} />
                Frecuencia
              </span>
              <Select
                value={data.frequency || "monthly"}
                onChange={handleFrequencyChange}
                options={frequencyOptions}
                disabled={disabled}
                ariaLabel="Frecuencia de facturación"
                data-testid="recurring-billing-frequency-select"
              />
            </div>
          </div>

          {/* Date Range */}
          <div className="bo-recurringBillingRow" data-slot="recurring-billing-row-dates">
            <div className="bo-field" data-slot="recurringBillingSection-field">
              <span className="bo-label" data-slot="recurringBillingSection-label">
                <Calendar size={14} />
                Fecha de inicio
              </span>
              <DatePicker
                value={data.start_date || ""}
                onChange={handleStartDateChange}
                disabled={disabled}
                data-testid="recurring-billing-start-date"
              />
            </div>

            <div className="bo-field" data-slot="recurringBillingSection-field">
              <span className="bo-label" data-slot="recurringBillingSection-label">
                <Calendar size={14} />
                Fecha de fin (opcional)
              </span>
              <DatePicker
                value={data.end_date || ""}
                onChange={handleEndDateChange}
                disabled={disabled}
                minDate={data.start_date}
                data-testid="recurring-billing-end-date"
              />
            </div>
          </div>

          {/* Next Billing Date Preview */}
          {data.start_date && data.frequency && (
            <div className="bo-recurringBillingNextPreview" data-slot="recurring-billing-next-preview">
              <div className="bo-recurringBillingNextPreviewLabel" data-slot="recurringBillingSection-recurringBillingNextPreviewLabel">Próxima factura:</div>
              <div className="bo-recurringBillingNextPreviewDate" data-slot="recurringBillingSection-recurringBillingNextPreviewDate">
                {getNextBillingDatePreview()}
              </div>
              <div className="bo-recurringBillingNextPreviewFreq" data-slot="recurringBillingSection-recurringBillingNextPreviewFreq">
                ({RECURRING_FREQUENCY_OPTIONS.find(f => f.value === data.frequency)?.description})
              </div>
            </div>
          )}

          {/* Auto-send Toggle */}
          <div className="bo-recurringBillingRow bo-recurringBillingRow--autoSend" data-slot="recurring-billing-row-auto-send">
            <div className="bo-field bo-field--switch" data-slot="recurringBillingSection-field--switch">
              <Switch
                checked={data.auto_send ?? false}
                onCheckedChange={(checked) => onChange({ ...data, auto_send: checked })}
                disabled={disabled}
                data-testid="recurring-billing-auto-send-toggle"
              />
              <span className="bo-label" data-slot="recurringBillingSection-label">
                <Send size={14} />
                Auto-enviar facturas
              </span>
            </div>
            <div className="bo-mutedText bo-recurringBillingHelp" data-slot="recurringBillingSection-recurringBillingHelp">
              Si está activado, las facturas se enviarán automáticamente al cliente en cada período de facturación
            </div>
          </div>

          {/* Stats (when editing existing recurring invoice) */}
          {showStatus && (
            <div className="bo-recurringBillingStats" data-slot="recurring-billing-stats">
              <div className="bo-recurringBillingStat" data-slot="recurringBillingSection-recurringBillingStat">
                <span className="bo-recurringBillingStatLabel" data-slot="recurringBillingSection-recurringBillingStatLabel">Facturas generadas</span>
                <span className="bo-recurringBillingStatValue" data-slot="recurringBillingSection-recurringBillingStatValue">{data.invoice_count || 0}</span>
              </div>
              {data.last_invoice_date && (
                <div className="bo-recurringBillingStat" data-slot="recurringBillingSection-recurringBillingStat">
                  <span className="bo-recurringBillingStatLabel" data-slot="recurringBillingSection-recurringBillingStatLabel">Última factura</span>
                  <span className="bo-recurringBillingStatValue" data-slot="recurringBillingSection-recurringBillingStatValue">{data.last_invoice_date}</span>
                </div>
              )}
              {data.next_billing_date && (
                <div className="bo-recurringBillingStat" data-slot="recurringBillingSection-recurringBillingStat">
                  <span className="bo-recurringBillingStatLabel" data-slot="recurringBillingSection-recurringBillingStatLabel">Próxima facturación</span>
                  <span className="bo-recurringBillingStatValue" data-slot="recurringBillingSection-recurringBillingStatValue">{data.next_billing_date}</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Helper component for displaying recurring status badge in invoice list
export function RecurringBadge({ isRecurring, nextBillingDate }: { isRecurring?: boolean; nextBillingDate?: string }) {
  if (!isRecurring) return null;

  return (
    <span className="bo-recurringBadge" title={nextBillingDate ? `Próxima: ${nextBillingDate}` : "Facturación recurrente"} data-slot="recurring-badge">
      <RefreshCw size={12} />
      <span data-slot="recurringBillingSection-nte">Recurrente</span>
    </span>
  );
}
