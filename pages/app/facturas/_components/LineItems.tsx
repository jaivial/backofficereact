import React, { useCallback, useMemo, useState } from "react";
import { CircleDollarSign, Hash, List, Percent, Receipt, Eye, Plus, X, Trash2, Calculator } from "lucide-react";
import type { InvoiceLineItem, InvoiceLineItemInput } from "../../../../api/types";
import { CURRENCY_SYMBOLS, type CurrencyCode } from "../../../../api/types";
import { Modal } from "../../../../ui/overlays/Modal";
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
  disabled?: boolean;
};

export const LineItems = React.forwardRef<LineItemsRef, LineItemsProps>(function LineItems(
  { items, onChange, currency = "EUR", defaultIvaRate = 10, disabled = false }: LineItemsProps,
  ref
) {
  const currencySymbol = CURRENCY_SYMBOLS[currency] || "€";
  const [lineItemDetailsIndex, setLineItemDetailsIndex] = useState<number | null>(null);

  // Calculate item totals
  const calculateItemTotal = useCallback((quantity: number, unitPrice: number, ivaRate: number) => {
    const base = quantity * unitPrice;
    const iva = base * (ivaRate / 100);
    return {
      ivaAmount: iva,
      total: base + iva,
    };
  }, []);

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
      totalIva += item.iva_amount;
      total += item.total;
    });

    return { subtotal, totalIva, total };
  }, [items]);

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
        iva_rate: item.iva_rate,
      }));
    },
    isValid: () => {
      return items.length > 0 && items.every((item) => item.description.trim() && item.quantity > 0 && item.unit_price >= 0);
    },
  }));

  return (
    <div className="bo-lineItems" data-slot="line-items">
      <div className="bo-lineItemsHeader" data-slot="line-items-header">
        <h4 className="bo-lineItemsTitle" data-slot="line-items-title">Lineas de factura</h4>
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
        <div className="bo-lineItemsEmpty" data-slot="line-items-empty">
          <p data-slot="line-items-empty-text">No hay lineas de factura. Añade una linea para continuar.</p>
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
          <div className="bo-lineItemsTable" data-slot="line-items-table">
            <div className="bo-lineItemsTableHeader" data-slot="line-items-table-header">
              <div className="bo-lineItemCell bo-lineItemCell--description" data-slot="line-items-cell-description">
                <List size={14} className="bo-lineItemHeaderIcon" aria-hidden="true" />
                <span className="bo-srOnly" data-slot="lineItems-srOnly">Descripcion</span>
              </div>
              <div className="bo-lineItemCell bo-lineItemCell--quantity" data-slot="line-items-cell-quantity">
                <Hash size={14} className="bo-lineItemHeaderIcon" aria-hidden="true" />
                <span className="bo-srOnly" data-slot="lineItems-srOnly">Cantidad</span>
              </div>
              <div className="bo-lineItemCell bo-lineItemCell--price" data-slot="line-items-cell-price">
                <CircleDollarSign size={14} className="bo-lineItemHeaderIcon" aria-hidden="true" />
                <span className="bo-srOnly" data-slot="lineItems-srOnly">Precio unit.</span>
              </div>
              <div className="bo-lineItemCell bo-lineItemCell--iva" data-slot="line-items-cell-iva">
                <Percent size={14} className="bo-lineItemHeaderIcon" aria-hidden="true" />
                <span className="bo-srOnly" data-slot="lineItems-srOnly">IVA</span>
              </div>
              <div className="bo-lineItemCell bo-lineItemCell--ivaAmount" data-slot="line-items-cell-ivaAmount">
                <Receipt size={14} className="bo-lineItemHeaderIcon" aria-hidden="true" />
                <span className="bo-srOnly" data-slot="lineItems-srOnly">Importe IVA</span>
              </div>
              <div className="bo-lineItemCell bo-lineItemCell--total" data-slot="line-items-cell-total">
                <Calculator size={14} className="bo-lineItemHeaderIcon" aria-hidden="true" />
                <span className="bo-srOnly" data-slot="lineItems-srOnly">Total</span>
              </div>
              <div className="bo-lineItemCell bo-lineItemCell--actions" data-slot="line-items-cell-actions"></div>
            </div>

            {items.map((item, index) => (
              <div key={index} className="bo-lineItemsTableRow" data-slot="line-items-row">
                <div className="bo-lineItemCell bo-lineItemCell--description" data-slot="line-items-row-description">
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
                <div className="bo-lineItemCell bo-lineItemCell--quantity" data-slot="line-items-row-quantity">
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
                <div className="bo-lineItemCell bo-lineItemCell--price" data-slot="line-items-row-price">
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
                <div className="bo-lineItemCell bo-lineItemCell--iva" data-slot="line-items-row-iva">
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
                <div className="bo-lineItemCell bo-lineItemCell--ivaAmount" data-slot="line-items-row-ivaAmount">
                  <span className="bo-lineItemValue" data-slot="line-items-iva-value">
                    {item.iva_amount.toFixed(2)} {currencySymbol}
                  </span>
                </div>
                <div className="bo-lineItemCell bo-lineItemCell--total" data-slot="line-items-row-total">
                  <span className="bo-lineItemValue bo-lineItemValue--total" data-slot="line-items-total-value">
                    {item.total.toFixed(2)} {currencySymbol}
                  </span>
                </div>
                <div className="bo-lineItemCell bo-lineItemCell--actions" data-slot="line-items-row-actions">
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
          <div className="bo-lineItemsSummary" data-slot="line-items-summary">
            <div className="bo-lineItemsSummaryRow" data-slot="line-items-summary-row-subtotal">
              <span className="bo-lineItemsSummaryLabel" data-slot="line-items-summary-label-subtotal">Subtotal:</span>
              <span className="bo-lineItemsSummaryValue" data-slot="line-items-summary-value-subtotal">{summary.subtotal.toFixed(2)} {currencySymbol}</span>
            </div>
            <div className="bo-lineItemsSummaryRow" data-slot="line-items-summary-row-iva">
              <span className="bo-lineItemsSummaryLabel" data-slot="line-items-summary-label-iva">Total IVA:</span>
              <span className="bo-lineItemsSummaryValue" data-slot="line-items-summary-value-iva">{summary.totalIva.toFixed(2)} {currencySymbol}</span>
            </div>
            <div className="bo-lineItemsSummaryRow bo-lineItemsSummaryRow--total" data-slot="line-items-summary-row-total">
              <span className="bo-lineItemsSummaryLabel" data-slot="line-items-summary-label-total">Total:</span>
              <span className="bo-lineItemsSummaryValue" data-slot="line-items-summary-value-total">{summary.total.toFixed(2)} {currencySymbol}</span>
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
        >
          <div className="bo-modalHead" data-slot="lineItems-modalHead">
            <h3 className="bo-modalTitle" data-slot="lineItems-modalTitle">Detalle de línea {lineItemDetailsIndex !== null ? lineItemDetailsIndex + 1 : ""}</h3>
            <button
              type="button"
              className="bo-btn bo-btn--ghost bo-btn--sm"
              onClick={closeLineItemDetails}
              aria-label="Cerrar detalle de línea"
              data-testid="line-item-close-details"
            >
              <X size={16} />
            </button>
          </div>

          <div className="bo-lineItemsDetail" data-slot="lineItems-lineItemsDetail">
            <div className="bo-lineItemsDetailField" data-slot="lineItems-lineItemsDetailField">
              <span className="bo-label" data-slot="lineItems-label">Descripción</span>
              <div className="bo-lineItemsDetailValue" data-slot="lineItems-lineItemsDetailValue">{selectedLineItem.description || "—"}</div>
            </div>

            <div className="bo-lineItemsDetailGrid" data-slot="lineItems-lineItemsDetailGrid">
              <div className="bo-lineItemsDetailField" data-slot="lineItems-lineItemsDetailField">
                <span className="bo-label" data-slot="lineItems-label">Cantidad</span>
                <div className="bo-lineItemsDetailValue" data-slot="lineItems-lineItemsDetailValue">{selectedLineItem.quantity}</div>
              </div>
              <div className="bo-lineItemsDetailField" data-slot="lineItems-lineItemsDetailField">
                <span className="bo-label" data-slot="lineItems-label">Precio unitario</span>
                <div className="bo-lineItemsDetailValue" data-slot="lineItems-lineItemsDetailValue">
                  {selectedLineItem.unit_price.toFixed(2)} {currencySymbol}
                </div>
              </div>
              <div className="bo-lineItemsDetailField" data-slot="lineItems-lineItemsDetailField">
                <span className="bo-label" data-slot="lineItems-label">IVA</span>
                <div className="bo-lineItemsDetailValue" data-slot="lineItems-lineItemsDetailValue">{selectedLineItem.iva_rate}%</div>
              </div>
              <div className="bo-lineItemsDetailField" data-slot="lineItems-lineItemsDetailField">
                <span className="bo-label" data-slot="lineItems-label">Importe IVA</span>
                <div className="bo-lineItemsDetailValue" data-slot="lineItems-lineItemsDetailValue">
                  {selectedLineItem.iva_amount.toFixed(2)} {currencySymbol}
                </div>
              </div>
              <div className="bo-lineItemsDetailField" data-slot="lineItems-lineItemsDetailField">
                <span className="bo-label" data-slot="lineItems-label">Total</span>
                <div className="bo-lineItemsDetailValue bo-lineItemsDetailValue--strong" data-slot="lineItems-lineItemsDetailValue--strong">
                  {selectedLineItem.total.toFixed(2)} {currencySymbol}
                </div>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
});
