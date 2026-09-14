import React, { useState, useCallback, useMemo } from "react";
import { X, Loader2, AlertTriangle, Check, User } from "lucide-react";
import type { Invoice, InvoiceMergeInput } from "../../../../api/types";
import { ScrollArea } from "../../../../ui/layout/ScrollArea";
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
    <div data-testid="merge-invoice-overlay" className="bo-modal-overlay" onClick={onClose} data-slot="merge-invoice-overlay">
      <div data-testid="merge-invoice-modal" className="bo-modal-content bo-mergeModal" onClick={(e) => e.stopPropagation()} data-slot="merge-invoice-modal">
        <div data-testid="merge-invoice-header" className="bo-modal-header" data-slot="merge-invoice-header">
          <div data-testid="mergeInvoicesModal-modal-title" className="bo-modal-title" data-slot="mergeInvoicesModal-modal-title">
            <AlertTriangle size={20} />
            <span data-testid="mergeInvoicesModal-ras" data-slot="mergeInvoicesModal-ras">Fusionar facturas</span>
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

        <div data-testid="merge-invoice-body" className="bo-modal-body" data-slot="merge-invoice-body">
          {/* Warning */}
          <div data-testid="merge-invoice-warning" className="bo-mergeWarning" data-slot="merge-invoice-warning">
            <AlertTriangle size={16} />
            <span data-testid="mergeInvoicesModal-span" data-slot="mergeInvoicesModal-span">
              Se fusionaran {invoices.length} facturas en una sola factura
            </span>
          </div>

          {/* Selected invoices list */}
          <div data-testid="merge-invoice-list" className="bo-mergeList" data-slot="merge-invoice-list">
            <h4 data-testid="mergeInvoicesModal-nar" data-slot="mergeInvoicesModal-nar">Facturas a fusionar</h4>
            <ScrollArea dataSlot="merge-invoice-list-items">
              <div data-testid="mergeInvoicesModal-mergeListItems" data-slot="mergeInvoicesModal-mergeListItems" className="bo-mergeListItems">
              {invoices.map((inv) => (
                <div data-testid="merge-invoice-list-item" key={inv.id} className="bo-mergeListItem" data-slot="merge-invoice-list-item">
                  <div data-testid="merge-invoice-list-item-main" className="bo-mergeListItemMain" data-slot="merge-invoice-list-item-main">
                    <span data-testid="mergeInvoicesModal-mergeListItemNumber" className="bo-mergeListItemNumber" data-slot="mergeInvoicesModal-mergeListItemNumber">
                      {inv.invoice_number || `#${inv.id}`}
                    </span>
                    <span data-testid="mergeInvoicesModal-mergeListItemCustomer" className="bo-mergeListItemCustomer" data-slot="mergeInvoicesModal-mergeListItemCustomer">
                      {inv.customer_name}
                    </span>
                  </div>
                  <div data-testid="mergeInvoicesModal-mergeListItemAmount" className="bo-mergeListItemAmount" data-slot="mergeInvoicesModal-mergeListItemAmount">
                    {formatPrice(inv.amount, inv.currency)}
                  </div>
                </div>
              ))}
            </div>
            </ScrollArea>
          </div>

          {/* Different customers warning */}
          {totals.customerCount > 1 && (
            <div data-testid="merge-invoice-customers-warning" className="bo-mergeCustomersWarning" data-slot="merge-invoice-customers-warning">
              <User size={16} />
              <span data-testid="mergeInvoicesModal-span-2" data-slot="mergeInvoicesModal-span">
                <strong data-testid="MergeInvoicesModal-strong">Atencion:</strong> Las facturas son de {totals.customerCount} clientes diferentes.
                La factura fusionada usara los datos del primer cliente.
              </span>
            </div>
          )}

          {/* Combined totals */}
          <div data-testid="merge-invoice-totals" className="bo-mergeTotals" data-slot="merge-invoice-totals">
            <div data-testid="mergeInvoicesModal-mergeTotalsRow" className="bo-mergeTotalsRow" data-slot="mergeInvoicesModal-mergeTotalsRow">
              <span data-testid="mergeInvoicesModal-ble" data-slot="mergeInvoicesModal-ble">Base imponible:</span>
              <span data-testid="mergeInvoicesModal-unt" data-slot="mergeInvoicesModal-unt">{formatPrice(totals.combinedAmount)}</span>
            </div>
            <div data-testid="mergeInvoicesModal-mergeTotalsRow-2" className="bo-mergeTotalsRow" data-slot="mergeInvoicesModal-mergeTotalsRow">
              <span data-testid="mergeInvoicesModal-iva" data-slot="mergeInvoicesModal-iva">IVA:</span>
              <span data-testid="mergeInvoicesModal-iva-2" data-slot="mergeInvoicesModal-iva">{formatPrice(totals.combinedIva)}</span>
            </div>
            <div data-testid="mergeInvoicesModal-mergeTotalsRow-total" className="bo-mergeTotalsRow bo-mergeTotalsRow--total" data-slot="mergeInvoicesModal-mergeTotalsRow--total">
              <span data-testid="mergeInvoicesModal-tal" data-slot="mergeInvoicesModal-tal">Total:</span>
              <span data-testid="mergeInvoicesModal-tal-2" data-slot="mergeInvoicesModal-tal">{formatPrice(totals.combinedTotal)}</span>
            </div>
          </div>

          {/* Delete originals option */}
          <div data-testid="merge-invoice-options" className="bo-mergeOptions" data-slot="merge-invoice-options">
            <label data-testid="mergeInvoicesModal-checkboxContainer" className="bo-checkboxContainer" data-slot="mergeInvoicesModal-checkboxContainer">
              <input
                type="checkbox"
                checked={deleteOriginals}
                onChange={(e) => setDeleteOriginals(e.target.checked)}
                disabled={isSubmitting}
                data-testid="merge-invoices-delete-originals-checkbox"
              />
              <span data-testid="mergeInvoicesModal-checkboxMark" className="bo-checkboxMark" data-slot="mergeInvoicesModal-checkboxMark"></span>
              <span data-testid="mergeInvoicesModal-checkboxLabel" className="bo-checkboxLabel" data-slot="mergeInvoicesModal-checkboxLabel">
                Eliminar facturas originales despues de fusionar
              </span>
            </label>
            {!deleteOriginals && (
              <p data-testid="mergeInvoicesModal-mergeOptionsHint" className="bo-mergeOptionsHint" data-slot="mergeInvoicesModal-mergeOptionsHint">
                Las facturas originales se mantendran como borradores
              </p>
            )}
          </div>
        </div>

        <div data-testid="merge-invoice-footer" className="bo-modal-footer" data-slot="merge-invoice-footer">
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
