import React, { useState, useCallback, useMemo } from "react";
import { X, Loader2, AlertTriangle, Check, User } from "lucide-react";
import type { Invoice, InvoiceMergeInput } from "../../../../api/types";
import { CURRENCY_SYMBOLS } from "../../../../api/types";

type MergeInvoicesModalProps = {
  open: boolean;
  invoices: Invoice[];
  onClose: () => void;
  onMerge: (input: InvoiceMergeInput) => Promise<void>;
};

function formatPrice(price: number, currency: string = "EUR"): string {
  const symbol = CURRENCY_SYMBOLS[currency as keyof typeof CURRENCY_SYMBOLS] || "€";
  return `${symbol}${price.toFixed(2)}`;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function MergeInvoicesModal({ open, invoices, onClose, onMerge }: MergeInvoicesModalProps) {
  const [deleteOriginals, setDeleteOriginals] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Calculate combined totals
  const totals = useMemo(() => {
    const combinedAmount = invoices.reduce((sum, inv) => sum + inv.amount, 0);
    const combinedIva = invoices.reduce((sum, inv) => sum + (inv.iva_amount || 0), 0);
    const combinedTotal = invoices.reduce((sum, inv) => sum + (inv.total || inv.amount), 0);

    // Get unique customers
    const customerMap = new Map<string, { name: string; email: string }>();
    invoices.forEach((inv) => {
      const key = inv.customer_email || inv.customer_name;
      if (!customerMap.has(key)) {
        customerMap.set(key, {
          name: inv.customer_name + (inv.customer_surname ? ` ${inv.customer_surname}` : ""),
          email: inv.customer_email,
        });
      }
    });

    return {
      combinedAmount,
      combinedIva,
      combinedTotal,
      customerCount: customerMap.size,
      customers: Array.from(customerMap.values()),
    };
  }, [invoices]);

  const handleMerge = useCallback(async () => {
    setIsSubmitting(true);
    try {
      await onMerge({
        invoice_ids: invoices.map((inv) => inv.id),
        delete_originals: deleteOriginals,
      });
      onClose();
    } catch (err) {
      // Error is handled by parent
    } finally {
      setIsSubmitting(false);
    }
  }, [invoices, deleteOriginals, onMerge, onClose]);

  if (!open) return null;

  return (
    <div className="bo-modal-overlay" onClick={onClose} data-slot="merge-invoice-overlay">
      <div className="bo-modal-content bo-mergeModal" onClick={(e) => e.stopPropagation()} data-slot="merge-invoice-modal">
        <div className="bo-modal-header" data-slot="merge-invoice-header">
          <div className="bo-modal-title">
            <AlertTriangle size={20} />
            <span>Fusionar facturas</span>
          </div>
          <button
            className="bo-btn bo-btn--ghost bo-btn--sm"
            onClick={onClose}
            aria-label="Cerrar"
            disabled={isSubmitting}
            data-testid="merge-invoices-close-btn"
          >
            <X size={18} />
          </button>
        </div>

        <div className="bo-modal-body" data-slot="merge-invoice-body">
          {/* Warning */}
          <div className="bo-mergeWarning" data-slot="merge-invoice-warning">
            <AlertTriangle size={16} />
            <span>
              Se fusionaran {invoices.length} facturas en una sola factura
            </span>
          </div>

          {/* Selected invoices list */}
          <div className="bo-mergeList" data-slot="merge-invoice-list">
            <h4>Facturas a fusionar</h4>
            <div className="bo-mergeListItems" data-slot="merge-invoice-list-items">
              {invoices.map((inv) => (
                <div key={inv.id} className="bo-mergeListItem" data-slot="merge-invoice-list-item">
                  <div className="bo-mergeListItemMain" data-slot="merge-invoice-list-item-main">
                    <span className="bo-mergeListItemNumber">
                      {inv.invoice_number || `#${inv.id}`}
                    </span>
                    <span className="bo-mergeListItemCustomer">
                      {inv.customer_name}
                    </span>
                  </div>
                  <div className="bo-mergeListItemAmount">
                    {formatPrice(inv.amount, inv.currency)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Different customers warning */}
          {totals.customerCount > 1 && (
            <div className="bo-mergeCustomersWarning" data-slot="merge-invoice-customers-warning">
              <User size={16} />
              <span>
                <strong>Atencion:</strong> Las facturas son de {totals.customerCount} clientes diferentes.
                La factura fusionada usara los datos del primer cliente.
              </span>
            </div>
          )}

          {/* Combined totals */}
          <div className="bo-mergeTotals" data-slot="merge-invoice-totals">
            <div className="bo-mergeTotalsRow">
              <span>Base imponible:</span>
              <span>{formatPrice(totals.combinedAmount)}</span>
            </div>
            <div className="bo-mergeTotalsRow">
              <span>IVA:</span>
              <span>{formatPrice(totals.combinedIva)}</span>
            </div>
            <div className="bo-mergeTotalsRow bo-mergeTotalsRow--total">
              <span>Total:</span>
              <span>{formatPrice(totals.combinedTotal)}</span>
            </div>
          </div>

          {/* Delete originals option */}
          <div className="bo-mergeOptions" data-slot="merge-invoice-options">
            <label className="bo-checkboxContainer">
              <input
                type="checkbox"
                checked={deleteOriginals}
                onChange={(e) => setDeleteOriginals(e.target.checked)}
                disabled={isSubmitting}
                data-testid="merge-invoices-delete-originals-checkbox"
              />
              <span className="bo-checkboxMark"></span>
              <span className="bo-checkboxLabel">
                Eliminar facturas originales despues de fusionar
              </span>
            </label>
            {!deleteOriginals && (
              <p className="bo-mergeOptionsHint">
                Las facturas originales se mantendran como borradores
              </p>
            )}
          </div>
        </div>

        <div className="bo-modal-footer" data-slot="merge-invoice-footer">
          <button
            className="bo-btn bo-btn--ghost"
            onClick={onClose}
            disabled={isSubmitting}
            data-testid="merge-invoices-cancel-btn"
          >
            Cancelar
          </button>
          <button
            className="bo-btn bo-btn--primary"
            onClick={handleMerge}
            disabled={isSubmitting}
            data-testid="merge-invoices-confirm-btn"
          >
            {isSubmitting ? (
              <>
                <Loader2 size={16} className="bo-spin" />
                Fusionando...
              </>
            ) : (
              <>
                <Check size={16} />
                Fusionar facturas
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
