import React, { useCallback, useEffect, useMemo, useState } from "react";

import { createClient } from "../../../../../api/client";
import type { ManualBillingEntry } from "../../../../../api/types";
import { useToasts } from "../../../../../ui/feedback/useToasts";
import { DatePicker } from "../../../../../ui/inputs/DatePicker";
import { EuroInput } from "../../../../../ui/inputs/EuroInput";
import { FormField } from "../../../../../ui/inputs/FormField";
import { SwitchField } from "../../../../../ui/inputs/SwitchField";
import { Modal } from "../../../../../ui/overlays/Modal";

/** Default VAT used by the modal when the amount includes VAT (10%, IVA reducido). */
const DEFAULT_VAT_RATE = 10;
const EUR_FORMATTER = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" });

function todayISO(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function parseAmount(raw: string): number {
  return Number.parseFloat(raw.replace(",", "."));
}

function formatCurrency(value: number): string {
  return Number.isFinite(value) ? EUR_FORMATTER.format(value) : "—";
}

/**
 * One-shot modal for a simple billing entry. The split shown here is only a
 * preview: the backend recomputes it with the same rounding before saving.
 * Coordination id: manual_billing_stats_v1.
 */
export function ManualBillingModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (entry: ManualBillingEntry) => void;
}) {
  const api = useMemo(() => createClient({ baseUrl: "" }), []);
  const { pushToast } = useToasts();
  const [date, setDate] = useState(todayISO);
  const [amount, setAmount] = useState("");
  const [includesVat, setIncludesVat] = useState(true);
  const [vatRate, setVatRate] = useState(String(DEFAULT_VAT_RATE));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setDate(todayISO());
    setAmount("");
    setIncludesVat(true);
    setVatRate(String(DEFAULT_VAT_RATE));
    setBusy(false);
    setError(null);
  }, [open]);

  const numericAmount = parseAmount(amount);
  const numericRate = includesVat ? parseAmount(vatRate) : 0;
  const validRate = Number.isFinite(numericRate) && numericRate >= 0 && numericRate <= 100;
  const validAmount = Number.isFinite(numericAmount) && numericAmount !== 0;
  const previewNet = includesVat && validRate && validAmount ? numericAmount / (1 + numericRate / 100) : numericAmount;
  const previewVat = validAmount ? numericAmount - previewNet : 0;

  const handleSubmit = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      if (!validAmount) {
        setError("Introduce un importe distinto de 0 (puede ser negativo para restar).");
        return;
      }
      if (!validRate) {
        setError("El IVA debe estar entre 0 y 100 %.");
        return;
      }
      setBusy(true);
      setError(null);
      try {
        const response = await api.analytics.createManualBillingEntry({
          date,
          amount: numericAmount,
          includesVat,
          vatRate: includesVat ? numericRate : undefined,
        });
        if (!response.success) {
          setError(response.message);
          return;
        }
        pushToast({ kind: "success", title: "Facturación añadida", message: `${formatCurrency(response.entry.grossEUR)} · ${response.entry.date}` });
        onCreated(response.entry);
        onClose();
      } catch (submitError) {
        setError(submitError instanceof Error ? submitError.message : "No se pudo guardar la facturación");
      } finally {
        setBusy(false);
      }
    },
    [api.analytics, date, includesVat, numericAmount, numericRate, onClose, onCreated, pushToast, validAmount, validRate],
  );

  return (
    <Modal open={open} onClose={onClose} title="Añadir facturación" size="sm">
      <form className="bo-modalBody flex flex-col gap-4" onSubmit={handleSubmit} data-testid="manual-billing-form" data-ui="manual-billing-form">
        <FormField label="Fecha" htmlFor="manual-billing-date">
          <DatePicker id="manual-billing-date" value={date} onChange={setDate} data-testid="manual-billing-date-picker" />
        </FormField>

        <FormField label="Importe" htmlFor="manual-billing-amount">
          <EuroInput
            id="manual-billing-amount"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder="0,00"
            step="0.01"
            required
            aria-describedby="manual-billing-amount-hint"
            data-testid="manual-billing-amount-input"
          />
          <p id="manual-billing-amount-hint" className="bo-mutedText" data-testid="manual-billing-amount-hint">
            Un importe negativo resta de los totales del periodo.
          </p>
        </FormField>

        <SwitchField
          checked={includesVat}
          onChange={setIncludesVat}
          label="El importe incluye IVA"
          description="Si está desactivado, el importe se cuenta entero como base neta (0 %)."
          data-testid="manual-billing-includes-vat"
        />

        {includesVat ? (
          <FormField label="IVA (%)" htmlFor="manual-billing-vat-rate">
            <input
              id="manual-billing-vat-rate"
              className="bo-input"
              type="number"
              inputMode="decimal"
              min={0}
              max={100}
              step="0.01"
              value={vatRate}
              onChange={(event) => setVatRate(event.target.value)}
              required
              data-testid="manual-billing-vat-rate-input"
            />
          </FormField>
        ) : null}

        <div className="rounded-lg border border-[var(--bo-border-2)] bg-[var(--bo-surface-3)] p-3 text-sm" data-testid="manual-billing-preview" data-ui="manual-billing-preview">
          <div className="flex items-center justify-between gap-3" data-testid="manual-billing-preview-net-row">
            <span className="text-[var(--bo-muted)]" data-testid="manual-billing-preview-net-label">Base neta</span>
            <strong data-testid="manual-billing-preview-net-value">{formatCurrency(validAmount ? previewNet : 0)}</strong>
          </div>
          <div className="mt-1.5 flex items-center justify-between gap-3" data-testid="manual-billing-preview-vat-row">
            <span className="text-[var(--bo-muted)]" data-testid="manual-billing-preview-vat-label">IVA {includesVat ? `${validRate ? numericRate : 0} %` : "0 %"}</span>
            <strong data-testid="manual-billing-preview-vat-value">{formatCurrency(validAmount ? previewVat : 0)}</strong>
          </div>
          <div className="mt-1.5 flex items-center justify-between gap-3 border-t border-[var(--bo-border)] pt-1.5" data-testid="manual-billing-preview-gross-row">
            <span className="text-[var(--bo-muted)]" data-testid="manual-billing-preview-gross-label">Total</span>
            <strong data-testid="manual-billing-preview-gross-value">{formatCurrency(validAmount ? numericAmount : 0)}</strong>
          </div>
        </div>

        {error ? (
          <p className="text-sm text-[var(--bo-on-surface-danger)]" role="alert" data-testid="manual-billing-form-error" data-ui="manual-billing-error">
            {error}
          </p>
        ) : null}

        <div className="bo-foodModal-actions" data-ui="manual-billing-actions">
          <button type="button" className="bo-btn bo-btn--ghost" onClick={onClose} disabled={busy} data-testid="manual-billing-cancel">
            Cancelar
          </button>
          <button type="submit" className="bo-btn bo-btn--primary" disabled={busy || !validAmount || !validRate} data-testid="manual-billing-submit">
            {busy ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
