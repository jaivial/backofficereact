import React, { useCallback, useMemo, useState } from "react";
import { CircleDollarSign, Hash, List, Percent, Receipt, Eye, Plus, X, Trash2, Calculator } from "lucide-react";
import type { InvoiceLineItem, InvoiceLineItemInput } from "../../../../api/types";
import { CURRENCY_SYMBOLS, type CurrencyCode } from "../../../../api/types";
import { Modal } from "../../../../ui/overlays/Modal";
import { ModalHeader } from "../../../../ui/overlays/ModalHeader";
import { DropdownMenu } from "../../../../ui/inputs/DropdownMenu";

export interface LineItemsRef {
  getLineItems: () => InvoiceLineItemInput[];
  isValid: () => boolean;
}

type LineItemsProps = {
  items: InvoiceLineItem[];
  onChange: (items: InvoiceLineItem[]) => void;
  currency?: CurrencyCode;
  defaultIvaRate?: number;
  /** When true the entered prices already include IVA: never split it out. */
  ivaIncluded?: boolean;
  disabled?: boolean;
};

export const LineItems = React.forwardRef<LineItemsRef, LineItemsProps>(function LineItems(
  { items, onChange, currency = "EUR", defaultIvaRate = 10, ivaIncluded = false, disabled = false }: LineItemsProps,
  ref
) {
  const currencySymbol = CURRENCY_SYMBOLS[currency] || "€";
  const [lineItemDetailsIndex, setLineItemDetailsIndex] = useState<number | null>(null);

  // Calculate item totals
  const calculateItemTotal = useCallback((quantity: number, unitPrice: number, ivaRate: number) => {
    const base = quantity * unitPrice;
    // IVA incluido: the price is gross, so there is nothing to split out.
    const iva = ivaIncluded ? 0 : base * (ivaRate / 100);
    return {
      ivaAmount: iva,
      total: base + iva,
    };
  }, [ivaIncluded]);

  // Add new item
  const handleAddItem = useCallback(() => {
    const newItem: InvoiceLineItem = {
      description: "",
      quantity: 1,
      unit_price: 0,
      iva_rate: defaultIvaRate,
      iva_amount: 0,
      total: 0,
    };
    onChange([...items, newItem]);
  }, [items, onChange, defaultIvaRate]);

  // Remove item
  const handleRemoveItem = useCallback(
    (index: number) => {
      const newItems = items.filter((_, i) => i !== index);
      onChange(newItems);
    },
    [items, onChange]
  );

  // Update item field
  const handleUpdateItem = useCallback(
    (index: number, field: keyof InvoiceLineItem, value: string | number) => {
      const newItems = [...items];
      const item = { ...newItems[index] };

      if (field === "description") {
        item.description = value as string;
      } else if (field === "quantity") {
        item.quantity = parseFloat(value as string) || 0;
      } else if (field === "unit_price") {
        item.unit_price = parseFloat(value as string) || 0;
      } else if (field === "iva_rate") {
        item.iva_rate = parseFloat(value as string) || 0;
      }

      // Recalculate totals
      const { ivaAmount, total } = calculateItemTotal(item.quantity, item.unit_price, item.iva_rate);
      item.iva_amount = ivaAmount;
      item.total = total;

      newItems[index] = item;
      onChange(newItems);
    },
    [items, onChange, calculateItemTotal]
  );

  // Calculate summary totals
  const summary = useMemo(() => {
    let subtotal = 0;
    let totalIva = 0;
    let total = 0;

    items.forEach((item) => {
      const base = item.quantity * item.unit_price;
      subtotal += base;
      if (ivaIncluded) {
        total += base;
      } else {
        totalIva += item.iva_amount;
        total += item.total;
      }
    });

    return { subtotal, totalIva, total };
  }, [items, ivaIncluded]);

  const openLineItemDetails = useCallback((index: number) => {
    setLineItemDetailsIndex(index);
  }, []);

  const closeLineItemDetails = useCallback(() => {
    setLineItemDetailsIndex(null);
  }, []);

  const selectedLineItem = useMemo(
    () => (lineItemDetailsIndex !== null ? items[lineItemDetailsIndex] : null),
    [items, lineItemDetailsIndex]
  );

  // Expose methods via ref
  React.useImperativeHandle(ref, () => ({
    getLineItems: () => {
      return items.map((item) => ({
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        iva_rate: ivaIncluded ? 0 : item.iva_rate,
      }));
    },
    isValid: () => {
      return items.length > 0 && items.every((item) => item.description.trim() && item.quantity > 0 && item.unit_price >= 0);
    },
  }));

  return (
    <div data-testid="line-items" className="bo-lineItems" data-slot="line-items">
      <div data-testid="line-items-header" className="bo-lineItemsHeader" data-slot="line-items-header">
        <h4 data-testid="line-items-title" className="bo-lineItemsTitle" data-slot="line-items-title">Lineas de factura</h4>
        <button
          type="button"
          className="bo-btn bo-btn--ghost bo-btn--sm"
          onClick={handleAddItem}
          disabled={disabled}
          data-testid="line-item-add-button"
        >
          <Plus size={16} />
          Añadir linea
        </button>
      </div>

      {items.length === 0 ? (
        <div data-testid="line-items-empty" className="bo-lineItemsEmpty" data-slot="line-items-empty">
          <p data-testid="line-items-empty-text" data-slot="line-items-empty-text">No hay lineas de factura. Añade una linea para continuar.</p>
          <button
            type="button"
            className="bo-btn bo-btn--secondary bo-btn--sm"
            onClick={handleAddItem}
            disabled={disabled}
            data-testid="line-item-add-first-button"
          >
            <Plus size={16} />
            Añadir primera linea
          </button>
        </div>
      ) : (
        <>
          <div data-testid="line-items-table" className="bo-lineItemsTable" data-slot="line-items-table">
            <div data-testid="line-items-table-header" className="bo-lineItemsTableHeader" data-slot="line-items-table-header">
              <div data-testid="line-items-cell-description" className="bo-lineItemCell bo-lineItemCell--description" data-slot="line-items-cell-description">
                <List size={14} className="bo-lineItemHeaderIcon" aria-hidden="true" />
                <span data-testid="lineItems-srOnly" className="bo-srOnly" data-slot="lineItems-srOnly">Descripcion</span>
              </div>
              <div data-testid="line-items-cell-quantity" className="bo-lineItemCell bo-lineItemCell--quantity" data-slot="line-items-cell-quantity">
                <Hash size={14} className="bo-lineItemHeaderIcon" aria-hidden="true" />
                <span data-testid="lineItems-srOnly-2" className="bo-srOnly" data-slot="lineItems-srOnly">Cantidad</span>
              </div>
              <div data-testid="line-items-cell-price" className="bo-lineItemCell bo-lineItemCell--price" data-slot="line-items-cell-price">
                <CircleDollarSign size={14} className="bo-lineItemHeaderIcon" aria-hidden="true" />
                <span data-testid="lineItems-srOnly-3" className="bo-srOnly" data-slot="lineItems-srOnly">Precio unit.</span>
              </div>
              {!ivaIncluded && (
                <>
                  <div data-testid="line-items-cell-iva" className="bo-lineItemCell bo-lineItemCell--iva" data-slot="line-items-cell-iva">
                    <Percent size={14} className="bo-lineItemHeaderIcon" aria-hidden="true" />
                    <span data-testid="lineItems-srOnly-4" className="bo-srOnly" data-slot="lineItems-srOnly">IVA</span>
                  </div>
                  <div data-testid="line-items-cell-ivaAmount" className="bo-lineItemCell bo-lineItemCell--ivaAmount" data-slot="line-items-cell-ivaAmount">
                    <Receipt size={14} className="bo-lineItemHeaderIcon" aria-hidden="true" />
                    <span data-testid="lineItems-srOnly-5" className="bo-srOnly" data-slot="lineItems-srOnly">Importe IVA</span>
                  </div>
                </>
              )}
              <div data-testid="line-items-cell-total" className="bo-lineItemCell bo-lineItemCell--total" data-slot="line-items-cell-total">
                <Calculator size={14} className="bo-lineItemHeaderIcon" aria-hidden="true" />
                <span data-testid="lineItems-srOnly-6" className="bo-srOnly" data-slot="lineItems-srOnly">Total</span>
              </div>
              <div data-testid="line-items-cell-actions" className="bo-lineItemCell bo-lineItemCell--actions" data-slot="line-items-cell-actions"></div>
            </div>

            {items.map((item, index) => (
              <div data-testid="line-items-row" key={index} className="bo-lineItemsTableRow" data-slot="line-items-row">
                <div data-testid="line-items-row-description" className="bo-lineItemCell bo-lineItemCell--description" data-slot="line-items-row-description">
                  <input
                    type="text"
                    className="bo-input"
                    value={item.description}
                    onChange={(e) => handleUpdateItem(index, "description", e.target.value)}
                    placeholder="Descripcion del producto/servicio"
                    disabled={disabled}
                    data-testid={`line-item-description-${index}`}
                  />
                </div>
                <div data-testid="line-items-row-quantity" className="bo-lineItemCell bo-lineItemCell--quantity" data-slot="line-items-row-quantity">
                  <input
                    type="number"
                    className="bo-input bo-lineItemInputNumber"
                    inputMode="decimal"
                    value={item.quantity}
                    onChange={(e) => handleUpdateItem(index, "quantity", e.target.value)}
                    min="0"
                    step="1"
                    disabled={disabled}
                    aria-label="Cantidad"
                    data-testid={`line-item-quantity-${index}`}
                  />
                </div>
                <div data-testid="line-items-row-price" className="bo-lineItemCell bo-lineItemCell--price" data-slot="line-items-row-price">
                  <input
                    type="number"
                    className="bo-input bo-lineItemInputNumber"
                    inputMode="decimal"
                    value={item.unit_price}
                    onChange={(e) => handleUpdateItem(index, "unit_price", e.target.value)}
                    min="0"
                    step="0.01"
                    disabled={disabled}
                    aria-label="Precio unitario"
                    data-testid={`line-item-unit-price-${index}`}
                  />
                </div>
                {!ivaIncluded && (
                  <>
                    <div data-testid="line-items-row-iva" className="bo-lineItemCell bo-lineItemCell--iva" data-slot="line-items-row-iva">
                      <input
                        type="number"
                        className="bo-input bo-lineItemInputNumber"
                        inputMode="decimal"
                        value={item.iva_rate}
                        onChange={(e) => handleUpdateItem(index, "iva_rate", e.target.value)}
                        min="0"
                        max="100"
                        step="0.1"
                        disabled={disabled}
                        aria-label="IVA"
                        data-testid={`line-item-iva-rate-${index}`}
                      />
                    </div>
                    <div data-testid="line-items-row-ivaAmount" className="bo-lineItemCell bo-lineItemCell--ivaAmount" data-slot="line-items-row-ivaAmount">
                      <span data-testid="line-items-iva-value" className="bo-lineItemValue" data-slot="line-items-iva-value">
                        {item.iva_amount.toFixed(2)} {currencySymbol}
                      </span>
                    </div>
                  </>
                )}
                <div data-testid="line-items-row-total" className="bo-lineItemCell bo-lineItemCell--total" data-slot="line-items-row-total">
                  <span data-testid="line-items-total-value" className="bo-lineItemValue bo-lineItemValue--total" data-slot="line-items-total-value">
                    {(ivaIncluded ? item.quantity * item.unit_price : item.total).toFixed(2)} {currencySymbol}
                  </span>
                </div>
                <div data-testid="line-items-row-actions" className="bo-lineItemCell bo-lineItemCell--actions" data-slot="line-items-row-actions">
                  <DropdownMenu
                    label={`Acciones linea ${index + 1}`}
                    items={[
                      { id: "view", label: "Ver detalle", icon: <Eye size={16} />, onSelect: () => { if (!disabled) openLineItemDetails(index); } },
                      { id: "delete", label: "Eliminar", icon: <Trash2 size={16} />, tone: "danger", onSelect: () => { if (!disabled) handleRemoveItem(index); } },
                    ]}
                    menuMinWidthPx={120}
                    triggerClassName="bo-btn bo-btn--ghost bo-btn--sm bo-lineItemActionBtn"
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Summary */}
          <div data-testid="line-items-summary" className="bo-lineItemsSummary" data-slot="line-items-summary">
            <div data-testid="line-items-summary-row-subtotal" className="bo-lineItemsSummaryRow" data-slot="line-items-summary-row-subtotal">
              <span data-testid="line-items-summary-label-subtotal" className="bo-lineItemsSummaryLabel" data-slot="line-items-summary-label-subtotal">Subtotal:</span>
              <span data-testid="line-items-summary-value-subtotal" className="bo-lineItemsSummaryValue" data-slot="line-items-summary-value-subtotal">{summary.subtotal.toFixed(2)} {currencySymbol}</span>
            </div>
            {!ivaIncluded && (
              <div data-testid="line-items-summary-row-iva" className="bo-lineItemsSummaryRow" data-slot="line-items-summary-row-iva">
                <span data-testid="line-items-summary-label-iva" className="bo-lineItemsSummaryLabel" data-slot="line-items-summary-label-iva">Total IVA:</span>
                <span data-testid="line-items-summary-value-iva" className="bo-lineItemsSummaryValue" data-slot="line-items-summary-value-iva">{summary.totalIva.toFixed(2)} {currencySymbol}</span>
              </div>
            )}
            <div data-testid="line-items-summary-row-total" className="bo-lineItemsSummaryRow bo-lineItemsSummaryRow--total" data-slot="line-items-summary-row-total">
              <span data-testid="line-items-summary-label-total" className="bo-lineItemsSummaryLabel" data-slot="line-items-summary-label-total">Total:</span>
              <span data-testid="line-items-summary-value-total" className="bo-lineItemsSummaryValue" data-slot="line-items-summary-value-total">{summary.total.toFixed(2)} {currencySymbol}</span>
            </div>
          </div>
        </>
      )}

      {selectedLineItem && (
        <Modal
          open={lineItemDetailsIndex !== null}
          title={`Detalle de línea ${lineItemDetailsIndex !== null ? lineItemDetailsIndex + 1 : ""}`}
          onClose={closeLineItemDetails}
          size="sm"
          hideClose
        >
          <ModalHeader title={`Detalle de línea ${lineItemDetailsIndex !== null ? lineItemDetailsIndex + 1 : ""}`} onClose={closeLineItemDetails} />

          <div data-testid="lineItems-lineItemsDetail" className="bo-lineItemsDetail" data-slot="lineItems-lineItemsDetail">
            <div data-testid="lineItems-lineItemsDetailField" className="bo-lineItemsDetailField" data-slot="lineItems-lineItemsDetailField">
              <span data-testid="lineItems-label" className="bo-label" data-slot="lineItems-label">Descripción</span>
              <div data-testid="lineItems-lineItemsDetailValue" className="bo-lineItemsDetailValue" data-slot="lineItems-lineItemsDetailValue">{selectedLineItem.description || "—"}</div>
            </div>

            <div data-testid="lineItems-lineItemsDetailGrid" className="bo-lineItemsDetailGrid" data-slot="lineItems-lineItemsDetailGrid">
              <div data-testid="lineItems-lineItemsDetailField-2" className="bo-lineItemsDetailField" data-slot="lineItems-lineItemsDetailField">
                <span data-testid="lineItems-label-2" className="bo-label" data-slot="lineItems-label">Cantidad</span>
                <div data-testid="lineItems-lineItemsDetailValue-2" className="bo-lineItemsDetailValue" data-slot="lineItems-lineItemsDetailValue">{selectedLineItem.quantity}</div>
              </div>
              <div data-testid="lineItems-lineItemsDetailField-3" className="bo-lineItemsDetailField" data-slot="lineItems-lineItemsDetailField">
                <span data-testid="lineItems-label-3" className="bo-label" data-slot="lineItems-label">Precio unitario</span>
                <div data-testid="lineItems-lineItemsDetailValue-3" className="bo-lineItemsDetailValue" data-slot="lineItems-lineItemsDetailValue">
                  {selectedLineItem.unit_price.toFixed(2)} {currencySymbol}
                </div>
              </div>
              {!ivaIncluded && (
                <>
                  <div data-testid="lineItems-lineItemsDetailField-4" className="bo-lineItemsDetailField" data-slot="lineItems-lineItemsDetailField">
                    <span data-testid="lineItems-label-4" className="bo-label" data-slot="lineItems-label">IVA</span>
                    <div data-testid="lineItems-lineItemsDetailValue-4" className="bo-lineItemsDetailValue" data-slot="lineItems-lineItemsDetailValue">{selectedLineItem.iva_rate}%</div>
                  </div>
                  <div data-testid="lineItems-lineItemsDetailField-5" className="bo-lineItemsDetailField" data-slot="lineItems-lineItemsDetailField">
                    <span data-testid="lineItems-label-5" className="bo-label" data-slot="lineItems-label">Importe IVA</span>
                    <div data-testid="lineItems-lineItemsDetailValue-5" className="bo-lineItemsDetailValue" data-slot="lineItems-lineItemsDetailValue">
                      {selectedLineItem.iva_amount.toFixed(2)} {currencySymbol}
                    </div>
                  </div>
                </>
              )}
              <div data-testid="lineItems-lineItemsDetailField-6" className="bo-lineItemsDetailField" data-slot="lineItems-lineItemsDetailField">
                <span data-testid="lineItems-label-6" className="bo-label" data-slot="lineItems-label">Total</span>
                <div data-testid="lineItems-lineItemsDetailValue-strong" className="bo-lineItemsDetailValue bo-lineItemsDetailValue--strong" data-slot="lineItems-lineItemsDetailValue--strong">
                  {(ivaIncluded ? selectedLineItem.quantity * selectedLineItem.unit_price : selectedLineItem.total).toFixed(2)} {currencySymbol}
                </div>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
});
