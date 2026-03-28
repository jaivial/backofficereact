import React, { useState, useCallback } from "react";
import { X, Loader2, Trash2 } from "lucide-react";
import { useToasts } from "../../../../ui/feedback/useToasts";
import { Select } from "../../../../ui/inputs/Select";
import { DatePicker } from "../../../../ui/inputs/DatePicker";
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
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bo-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-labelledby="payment-modal-title">
        <div className="flex items-center justify-between p-4 border-b border">
          <h2 id="payment-modal-title" className="text-lg font-semibold text-foreground">Registrar pago</h2>
          <button className="inline-flex h-8 items-center justify-center gap-2 rounded-lg border border-white/[0.06] bg-transparent text-foreground text-xs font-bold transition-all hover:bg-white/[0.04]" onClick={onClose} aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>

        <div className="p-4">
          {/* Invoice Summary */}
          <div className="bo-paymentSummary">
            <div className="flex justify-between py-1 text-sm">
              <span>Factura:</span>
              <strong>{invoice.invoice_number || `#${invoice.id}`}</strong>
            </div>
            <div className="flex justify-between py-1 text-sm">
              <span>Cliente:</span>
              <strong>{invoice.customer_name} {invoice.customer_surname || ""}</strong>
            </div>
            <div className="flex justify-between py-1 text-sm">
              <span>Importe total:</span>
              <strong>{formatPrice(totalAmount)}</strong>
            </div>
            <div className="flex justify-between py-1 text-sm">
              <span>Pagado:</span>
              <strong className={isFullyPaid ? "text--success" : ""}>{formatPrice(paidAmount)}</strong>
            </div>
            <div className="bo-paymentSummaryRow bo-paymentSummaryRow--remaining">
              <span>Pendiente:</span>
              <strong className={isFullyPaid ? "text--success" : "text--warning"}>
                {isFullyPaid ? "0.00 €" : formatPrice(remainingBalance)}
              </strong>
            </div>

            {/* Progress bar */}
            <div className="bo-paymentProgress">
              <div className="bo-paymentProgressBar">
                <div
                  className={`bo-paymentProgressFill ${isFullyPaid ? "is-complete" : ""}`}
                  style={{ width: `${Math.min((paidAmount / totalAmount) * 100, 100)}%` }}
                />
              </div>
              <span className="bo-paymentProgressLabel">
                {Math.round((paidAmount / totalAmount) * 100)}% pagado
              </span>
            </div>
          </div>

          {/* Payment History */}
          {payments.length > 0 && (
            <div className="bo-paymentHistory">
              <h3 className="bo-paymentHistoryTitle">Historial de pagos</h3>
              <div className="bo-paymentHistoryList">
                {payments.map((payment) => (
                  <div key={payment.id} className="bo-paymentHistoryItem">
                    <div className="bo-paymentHistoryItemInfo">
                      <span className="bo-paymentHistoryItemAmount">{formatPrice(payment.amount)}</span>
                      <span className="bo-paymentHistoryItemMethod">
                        {PAYMENT_METHOD_OPTIONS.find((o) => o.value === payment.payment_method)?.label || payment.payment_method}
                      </span>
                      <span className="bo-paymentHistoryItemDate">{formatDate(payment.payment_date)}</span>
                    </div>
                    <button
                      className="h-9 px-4 rounded-sm font-semibold inline-flex items-center justify-center gap-2 cursor-pointer bg-transparent border border-transparent hover:bg-white/5 bg-transparent text-sm text-danger/80"
                      onClick={() => handleDeletePayment(payment.id)}
                      disabled={deletingPaymentId === payment.id}
                      title="Eliminar pago"
                      aria-label="Eliminar pago"
                    >
                      {deletingPaymentId === payment.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Add Payment Form */}
          {!isFullyPaid && (
            <form onSubmit={handleSubmit} className="bo-paymentForm">
              <h3 className="bo-paymentFormTitle">Nuevo pago</h3>

              <div className="mb-3">
                <label className="grid gap-2">
                  <span className="text-sm font-semibold text-muted-foreground">Importe *</span>
                  <input
                    className="h-10 rounded-md border border bg-white/5 text-foreground px-3 outline-none min-w-0 transition-colors"
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={remainingBalance}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder={`Max. ${formatPrice(remainingBalance)}`}
                    required
                  />
                </label>
              </div>

              <div className="mb-3">
                <label className="grid gap-2">
                  <span className="text-sm font-semibold text-muted-foreground">Método de pago</span>
                  <Select
                    value={paymentMethod}
                    onChange={(value) => setPaymentMethod(value as PaymentMethod)}
                    options={PAYMENT_METHOD_OPTIONS}
                    ariaLabel="Método de pago"
                  />
                </label>
              </div>

              <div className="mb-3">
                <label className="grid gap-2">
                  <span className="text-sm font-semibold text-muted-foreground">Fecha de pago</span>
                  <DatePicker value={paymentDate} onChange={setPaymentDate} />
                </label>
              </div>

              <div className="mb-3">
                <label className="grid gap-2">
                  <span className="text-sm font-semibold text-muted-foreground">Notas</span>
                  <input
                    className="h-10 rounded-md border border bg-white/5 text-foreground px-3 outline-none min-w-0 transition-colors"
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Notas opcionales..."
                  />
                </label>
              </div>

              <button
                type="submit"
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[rgba(185,168,255,0.30)] bg-[rgba(185,168,255,0.16)] text-foreground text-sm font-bold transition-all hover:border-[rgba(185,168,255,0.40)] hover:bg-[rgba(185,168,255,0.24)] disabled:opacity-55 disabled:cursor-not-allowed mx-auto"
                disabled={isSubmitting || !amount || parseFloat(amount) <= 0}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Registrando...
                  </>
                ) : (
                  "Registrar pago"
                )}
              </button>
            </form>
          )}

          {isFullyPaid && (
            <div className="bo-paymentComplete">
              <p>La factura está completamente pagada.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
