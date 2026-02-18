import React, { useCallback, useMemo } from "react";
import { Plus, X, Trash2 } from "lucide-react";
import type { InvoiceLineItem, InvoiceLineItemInput } from "../../../../api/types";
import { CURRENCY_SYMBOLS, type CurrencyCode } from "../../../../api/types";

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
    <div className="bo-lineItems">
      <div className="bo-lineItemsHeader">
        <h4 className="bo-lineItemsTitle">Lineas de factura</h4>
        <button
          type="button"
          className="bo-btn bo-btn--ghost bo-btn--sm"
          onClick={handleAddItem}
          disabled={disabled}
        >
          <Plus size={16} />
          Añadir linea
        </button>
      </div>

      {items.length === 0 ? (
        <div className="bo-lineItemsEmpty">
          <p>No hay lineas de factura. Añade una linea para continuar.</p>
          <button
            type="button"
            className="bo-btn bo-btn--secondary bo-btn--sm"
            onClick={handleAddItem}
            disabled={disabled}
          >
            <Plus size={16} />
            Añadir primera linea
          </button>
        </div>
      ) : (
        <>
          <div className="bo-lineItemsTable">
            <div className="bo-lineItemsTableHeader">
              <div className="bo-lineItemCell bo-lineItemCell--description">Descripcion</div>
              <div className="bo-lineItemCell bo-lineItemCell--quantity">Cantidad</div>
              <div className="bo-lineItemCell bo-lineItemCell--price">Precio unit.</div>
              <div className="bo-lineItemCell bo-lineItemCell--iva">IVA (%)</div>
              <div className="bo-lineItemCell bo-lineItemCell--ivaAmount">Importe IVA</div>
              <div className="bo-lineItemCell bo-lineItemCell--total">Total</div>
              <div className="bo-lineItemCell bo-lineItemCell--actions"></div>
            </div>

            {items.map((item, index) => (
              <div key={index} className="bo-lineItemsTableRow">
                <div className="bo-lineItemCell bo-lineItemCell--description">
                  <input
                    type="text"
                    className="bo-input"
                    value={item.description}
                    onChange={(e) => handleUpdateItem(index, "description", e.target.value)}
                    placeholder="Descripcion del producto/servicio"
                    disabled={disabled}
                  />
                </div>
                <div className="bo-lineItemCell bo-lineItemCell--quantity">
                  <input
                    type="number"
                    className="bo-input"
                    value={item.quantity}
                    onChange={(e) => handleUpdateItem(index, "quantity", e.target.value)}
                    min="0"
                    step="1"
                    disabled={disabled}
                  />
                </div>
                <div className="bo-lineItemCell bo-lineItemCell--price">
                  <input
                    type="number"
                    className="bo-input"
                    value={item.unit_price}
                    onChange={(e) => handleUpdateItem(index, "unit_price", e.target.value)}
                    min="0"
                    step="0.01"
                    disabled={disabled}
                  />
                </div>
                <div className="bo-lineItemCell bo-lineItemCell--iva">
                  <input
                    type="number"
                    className="bo-input"
                    value={item.iva_rate}
                    onChange={(e) => handleUpdateItem(index, "iva_rate", e.target.value)}
                    min="0"
                    max="100"
                    step="0.1"
                    disabled={disabled}
                  />
                </div>
                <div className="bo-lineItemCell bo-lineItemCell--ivaAmount">
                  <span className="bo-lineItemValue">
                    {item.iva_amount.toFixed(2)} {currencySymbol}
                  </span>
                </div>
                <div className="bo-lineItemCell bo-lineItemCell--total">
                  <span className="bo-lineItemValue bo-lineItemValue--total">
                    {item.total.toFixed(2)} {currencySymbol}
                  </span>
                </div>
                <div className="bo-lineItemCell bo-lineItemCell--actions">
                  <button
                    type="button"
                    className="bo-btn bo-btn--ghost bo-btn--danger bo-btn--sm"
                    onClick={() => handleRemoveItem(index)}
                    disabled={disabled}
                    title="Eliminar linea"
                    aria-label={`Eliminar linea ${index + 1}`}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Summary */}
          <div className="bo-lineItemsSummary">
            <div className="bo-lineItemsSummaryRow">
              <span className="bo-lineItemsSummaryLabel">Subtotal:</span>
              <span className="bo-lineItemsSummaryValue">{summary.subtotal.toFixed(2)} {currencySymbol}</span>
            </div>
            <div className="bo-lineItemsSummaryRow">
              <span className="bo-lineItemsSummaryLabel">Total IVA:</span>
              <span className="bo-lineItemsSummaryValue">{summary.totalIva.toFixed(2)} {currencySymbol}</span>
            </div>
            <div className="bo-lineItemsSummaryRow bo-lineItemsSummaryRow--total">
              <span className="bo-lineItemsSummaryLabel">Total:</span>
              <span className="bo-lineItemsSummaryValue">{summary.total.toFixed(2)} {currencySymbol}</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
});
