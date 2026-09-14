import React, { useState, useCallback } from "react";
import { X, Loader2, Trash2 } from "lucide-react";
import { useToasts } from "../../../../ui/feedback/useToasts";
import { Select } from "../../../../ui/inputs/Select";
import { DatePicker } from "../../../../ui/inputs/DatePicker";
import { ModalHeader } from "../../../../ui/overlays/ModalHeader";
import type { Invoice, InvoicePayment, InvoicePaymentInput, PaymentMethod } from "../../../../api/types";

type RegisterPaymentModalProps = {
  invoice: Invoice;
  payments: InvoicePayment[];
  onClose: () => void;
  onAddPayment: (invoiceId: number, input: InvoicePaymentInput) => Promise<void>;
  onDeletePayment: (paymentId: number) => Promise<void>;
};

const PAYMENT_METHOD_OPTIONS: { value: PaymentMethod; label: string }[] = [
  { value: "efectivo", label: "Efectivo" },
  { value: "tarjeta", label: "Tarjeta" },
  { value: "transferencia", label: "Transferencia" },
  { value: "bizum", label: "Bizum" },
  { value: "cheque", label: "Cheque" },
];

function formatPrice(price: number): string {
  return `${price.toFixed(2)} €`;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function RegisterPaymentModal({ invoice, payments, onClose, onAddPayment, onDeletePayment }: RegisterPaymentModalProps) {
  const { pushToast } = useToasts();
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("efectivo");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingPaymentId, setDeletingPaymentId] = useState<number | null>(null);

  // Calculate totals
  const totalAmount = invoice.total || invoice.amount;
  const paidAmount = payments.reduce((sum, p) => sum + p.amount, 0);
  const remainingBalance = totalAmount - paidAmount;
  const isFullyPaid = paidAmount >= totalAmount;

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      pushToast({ kind: "error", title: "Error", message: "Introduce un importe válido" });
      return;
    }

    if (amountNum > remainingBalance) {
      pushToast({ kind: "error", title: "Error", message: `El importe no puede ser mayor que el pendiente (${formatPrice(remainingBalance)})` });
      return;
    }

    setIsSubmitting(true);
    try {
      await onAddPayment(invoice.id, {
        amount: amountNum,
        payment_method: paymentMethod,
        payment_date: paymentDate,
        notes: notes || undefined,
      });
      pushToast({ kind: "success", title: "Pago registrado", message: `Se ha registrado un pago de ${formatPrice(amountNum)}` });
      setAmount("");
      setNotes("");
    } catch (err) {
      pushToast({ kind: "error", title: "Error", message: err instanceof Error ? err.message : "Error al registrar el pago" });
    } finally {
      setIsSubmitting(false);
    }
  }, [invoice.id, amount, paymentMethod, paymentDate, notes, remainingBalance, onAddPayment, pushToast]);

  const handleDeletePayment = useCallback(async (paymentId: number) => {
    setDeletingPaymentId(paymentId);
    try {
      await onDeletePayment(paymentId);
      pushToast({ kind: "success", title: "Pago eliminado", message: "El pago ha sido eliminado" });
    } catch (err) {
      pushToast({ kind: "error", title: "Error", message: err instanceof Error ? err.message : "Error al eliminar el pago" });
    } finally {
      setDeletingPaymentId(null);
    }
  }, [onDeletePayment, pushToast]);

  return (
    <div data-testid="registerPaymentModal-modalOverlay" className="bo-modalOverlay" onClick={onClose} data-slot="registerPaymentModal-modalOverlay">
      <div data-testid="registerPaymentModal-modal" className="bo-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-labelledby="payment-modal-title" data-slot="registerPaymentModal-modal">
        <ModalHeader title="Registrar pago" onClose={onClose} />

        <div data-testid="register-payment-modal-body" className="bo-modalBody" data-slot="register-payment-modal-body">
          {/* Invoice Summary */}
          <div data-testid="register-payment-summary" className="bo-paymentSummary" data-slot="register-payment-summary">
            <div data-testid="registerPaymentModal-paymentSummaryRow" className="bo-paymentSummaryRow" data-slot="registerPaymentModal-paymentSummaryRow">
              <span data-testid="registerPaymentModal-ura" data-slot="registerPaymentModal-ura">Factura:</span>
              <strong data-testid="RegisterPaymentModal-strong">{invoice.invoice_number || `#${invoice.id}`}</strong>
            </div>
            <div data-testid="registerPaymentModal-paymentSummaryRow-2" className="bo-paymentSummaryRow" data-slot="registerPaymentModal-paymentSummaryRow">
              <span data-testid="registerPaymentModal-nte" data-slot="registerPaymentModal-nte">Cliente:</span>
              <strong data-testid="RegisterPaymentModal-strong-2">{invoice.customer_name} {invoice.customer_surname || ""}</strong>
            </div>
            <div data-testid="registerPaymentModal-paymentSummaryRow-3" className="bo-paymentSummaryRow" data-slot="registerPaymentModal-paymentSummaryRow">
              <span data-testid="registerPaymentModal-tal" data-slot="registerPaymentModal-tal">Importe total:</span>
              <strong data-testid="RegisterPaymentModal-strong-3">{formatPrice(totalAmount)}</strong>
            </div>
            <div data-testid="registerPaymentModal-paymentSummaryRow-4" className="bo-paymentSummaryRow" data-slot="registerPaymentModal-paymentSummaryRow">
              <span data-testid="registerPaymentModal-ado" data-slot="registerPaymentModal-ado">Pagado:</span>
              <strong data-testid="RegisterPaymentModal-strong-4" className={isFullyPaid ? "bo-text--success" : ""}>{formatPrice(paidAmount)}</strong>
            </div>
            <div data-testid="registerPaymentModal-paymentSummaryRow-remaining" className="bo-paymentSummaryRow bo-paymentSummaryRow--remaining" data-slot="registerPaymentModal-paymentSummaryRow--remaining">
              <span data-testid="registerPaymentModal-nte-2" data-slot="registerPaymentModal-nte">Pendiente:</span>
              <strong data-testid="RegisterPaymentModal-strong-5" className={isFullyPaid ? "bo-text--success" : "bo-text--warning"}>
                {isFullyPaid ? "0.00 €" : formatPrice(remainingBalance)}
              </strong>
            </div>

            {/* Progress bar */}
            <div data-testid="register-payment-progress" className="bo-paymentProgress" data-slot="register-payment-progress">
              <div data-testid="register-payment-progress-bar" className="bo-paymentProgressBar" data-slot="register-payment-progress-bar">
                <div data-testid="register-payment-progress-fill"
                  className={`bo-paymentProgressFill ${isFullyPaid ? "is-complete" : ""}`}
                  style={{ width: `${Math.min((paidAmount / totalAmount) * 100, 100)}%` }}
                  data-slot="register-payment-progress-fill"
                />
              </div>
              <span data-testid="register-payment-progress-label" className="bo-paymentProgressLabel" data-slot="register-payment-progress-label">
                {Math.round((paidAmount / totalAmount) * 100)}% pagado
              </span>
            </div>
          </div>

          {/* Payment History */}
          {payments.length > 0 && (
            <div data-testid="register-payment-history" className="bo-paymentHistory" data-slot="register-payment-history">
              <h3 data-testid="register-payment-history-title" className="bo-paymentHistoryTitle" data-slot="register-payment-history-title">Historial de pagos</h3>
              <div data-testid="register-payment-history-list" className="bo-paymentHistoryList" data-slot="register-payment-history-list">
                {payments.map((payment) => (
                  <div data-testid="register-payment-history-item" key={payment.id} className="bo-paymentHistoryItem" data-slot="register-payment-history-item">
                    <div data-testid="register-payment-history-item-info" className="bo-paymentHistoryItemInfo" data-slot="register-payment-history-item-info">
                      <span data-testid="register-payment-history-item-amount" className="bo-paymentHistoryItemAmount" data-slot="register-payment-history-item-amount">{formatPrice(payment.amount)}</span>
                      <span data-testid="register-payment-history-item-method" className="bo-paymentHistoryItemMethod" data-slot="register-payment-history-item-method">
                        {PAYMENT_METHOD_OPTIONS.find((o) => o.value === payment.payment_method)?.label || payment.payment_method}
                      </span>
                      <span data-testid="registerPaymentModal-paymentHistoryItemDate" className="bo-paymentHistoryItemDate" data-slot="registerPaymentModal-paymentHistoryItemDate">{formatDate(payment.payment_date)}</span>
                    </div>
                    <button
                      className="bo-btn bo-btn--ghost bo-btn--sm bo-btn--danger"
                      onClick={() => handleDeletePayment(payment.id)}
                      disabled={deletingPaymentId === payment.id}
                      title="Eliminar pago"
                      aria-label="Eliminar pago"
                      data-testid={`register-payment-delete-${payment.id}`}
                    >
                      {deletingPaymentId === payment.id ? <Loader2 size={14} className="bo-spin" /> : <Trash2 size={14} />}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Add Payment Form */}
          {!isFullyPaid && (
            <form onSubmit={handleSubmit} className="bo-paymentForm" data-slot="register-payment-form" data-testid="register-payment-form">
              <h3 data-testid="register-payment-form-title" className="bo-paymentFormTitle" data-slot="register-payment-form-title">Nuevo pago</h3>

              <div data-testid="register-payment-form-row-amount" className="bo-paymentFormRow" data-slot="register-payment-form-row-amount">
                <label data-testid="registerPaymentModal-field" className="bo-field" data-slot="registerPaymentModal-field">
                  <span data-testid="registerPaymentModal-label" className="bo-label" data-slot="registerPaymentModal-label">Importe *</span>
                  <input
                    className="bo-input"
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={remainingBalance}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder={`Max. ${formatPrice(remainingBalance)}`}
                    required
                    data-testid="register-payment-amount-input"
                  />
                </label>
              </div>

              <div data-testid="register-payment-form-row-method" className="bo-paymentFormRow" data-slot="register-payment-form-row-method">
                <label data-testid="registerPaymentModal-field-2" className="bo-field" data-slot="registerPaymentModal-field">
                  <span data-testid="registerPaymentModal-label-2" className="bo-label" data-slot="registerPaymentModal-label">Método de pago</span>
                  <Select
                    value={paymentMethod}
                    onChange={(value) => setPaymentMethod(value as PaymentMethod)}
                    options={PAYMENT_METHOD_OPTIONS}
                    ariaLabel="Método de pago"
                    data-testid="register-payment-method-select"
                  />
                </label>
              </div>

              <div data-testid="register-payment-form-row-date" className="bo-paymentFormRow" data-slot="register-payment-form-row-date">
                <label data-testid="registerPaymentModal-field-3" className="bo-field" data-slot="registerPaymentModal-field">
                  <span data-testid="registerPaymentModal-label-3" className="bo-label" data-slot="registerPaymentModal-label">Fecha de pago</span>
                  <DatePicker value={paymentDate} onChange={setPaymentDate} />
                </label>
              </div>

              <div data-testid="register-payment-form-row-notes" className="bo-paymentFormRow" data-slot="register-payment-form-row-notes">
                <label data-testid="registerPaymentModal-field-4" className="bo-field" data-slot="registerPaymentModal-field">
                  <span data-testid="registerPaymentModal-label-4" className="bo-label" data-slot="registerPaymentModal-label">Notas</span>
                  <input
                    className="bo-input"
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Notas opcionales..."
                    data-testid="register-payment-notes-input"
                  />
                </label>
              </div>

              <button
                type="submit"
                className="bo-btn bo-btn--primary"
                disabled={isSubmitting || !amount || parseFloat(amount) <= 0}
                data-testid="register-payment-submit-btn"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={16} className="bo-spin" />
                    Registrando...
                  </>
                ) : (
                  "Registrar pago"
                )}
              </button>
            </form>
          )}

          {isFullyPaid && (
            <div data-testid="register-payment-complete" className="bo-paymentComplete" data-slot="register-payment-complete">
              <p data-testid="register-payment-complete-text" data-slot="register-payment-complete-text">La factura está completamente pagada.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
