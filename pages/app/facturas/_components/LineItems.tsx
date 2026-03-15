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
    <div className="bo-lineItems">
      <div className="bo-lineItemsHeader">
        <h4 className="bo-lineItemsTitle">Lineas de factura</h4>
        <button
          type="button"
          className="inline-flex h-8 items-center justify-center gap-2 rounded-lg border border-white/[0.06] bg-transparent text-bo-text text-xs font-bold transition-all hover:bg-white/[0.04]"
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
            className="inline-flex h-8 items-center justify-center gap-2 rounded-lg border border-white/[0.09] bg-bo-surface-2 text-bo-text text-xs font-bold transition-all hover:border-bo-primary hover:bg-bo-surface-2/80 disabled:opacity-55 disabled:cursor-not-allowed"
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
              <div className="p-3 text-bo-sm text-bo-text bo-lineItemCell--description">
                <List size={14} className="bo-lineItemHeaderIcon" aria-hidden="true" />
                <span className="sr-only">Descripcion</span>
              </div>
              <div className="p-3 text-bo-sm text-bo-text bo-lineItemCell--quantity">
                <Hash size={14} className="bo-lineItemHeaderIcon" aria-hidden="true" />
                <span className="sr-only">Cantidad</span>
              </div>
              <div className="p-3 text-bo-sm text-bo-text bo-lineItemCell--price">
                <CircleDollarSign size={14} className="bo-lineItemHeaderIcon" aria-hidden="true" />
                <span className="sr-only">Precio unit.</span>
              </div>
              <div className="p-3 text-bo-sm text-bo-text bo-lineItemCell--iva">
                <Percent size={14} className="bo-lineItemHeaderIcon" aria-hidden="true" />
                <span className="sr-only">IVA</span>
              </div>
              <div className="p-3 text-bo-sm text-bo-text bo-lineItemCell--ivaAmount">
                <Receipt size={14} className="bo-lineItemHeaderIcon" aria-hidden="true" />
                <span className="sr-only">Importe IVA</span>
              </div>
              <div className="p-3 text-bo-sm text-bo-text bo-lineItemCell--total">
                <Calculator size={14} className="bo-lineItemHeaderIcon" aria-hidden="true" />
                <span className="sr-only">Total</span>
              </div>
              <div className="p-3 text-bo-sm text-bo-text bo-lineItemCell--actions"></div>
            </div>

            {items.map((item, index) => (
              <div key={index} className="bo-lineItemsTableRow">
                <div className="p-3 text-bo-sm text-bo-text bo-lineItemCell--description">
                  <input
                    type="text"
                    className="h-10 rounded-bo-md border border-bo-border bg-white/5 text-bo-text px-3 outline-none min-w-0 transition-colors"
                    value={item.description}
                    onChange={(e) => handleUpdateItem(index, "description", e.target.value)}
                    placeholder="Descripcion del producto/servicio"
                    disabled={disabled}
                  />
                </div>
                <div className="p-3 text-bo-sm text-bo-text bo-lineItemCell--quantity">
                  <input
                    type="number"
                    className="h-10 rounded-bo-md border border-bo-border bg-white/5 text-bo-text px-3 outline-none min-w-0 transition-colors bo-lineItemInputNumber"
                    inputMode="decimal"
                    value={item.quantity}
                    onChange={(e) => handleUpdateItem(index, "quantity", e.target.value)}
                    min="0"
                    step="1"
                    disabled={disabled}
                    aria-label="Cantidad"
                  />
                </div>
                <div className="p-3 text-bo-sm text-bo-text bo-lineItemCell--price">
                  <input
                    type="number"
                    className="h-10 rounded-bo-md border border-bo-border bg-white/5 text-bo-text px-3 outline-none min-w-0 transition-colors bo-lineItemInputNumber"
                    inputMode="decimal"
                    value={item.unit_price}
                    onChange={(e) => handleUpdateItem(index, "unit_price", e.target.value)}
                    min="0"
                    step="0.01"
                    disabled={disabled}
                    aria-label="Precio unitario"
                  />
                </div>
                <div className="p-3 text-bo-sm text-bo-text bo-lineItemCell--iva">
                  <input
                    type="number"
                    className="h-10 rounded-bo-md border border-bo-border bg-white/5 text-bo-text px-3 outline-none min-w-0 transition-colors bo-lineItemInputNumber"
                    inputMode="decimal"
                    value={item.iva_rate}
                    onChange={(e) => handleUpdateItem(index, "iva_rate", e.target.value)}
                    min="0"
                    max="100"
                    step="0.1"
                    disabled={disabled}
                    aria-label="IVA"
                  />
                </div>
                <div className="p-3 text-bo-sm text-bo-text bo-lineItemCell--ivaAmount">
                  <span className="bo-lineItemValue">
                    {item.iva_amount.toFixed(2)} {currencySymbol}
                  </span>
                </div>
                <div className="p-3 text-bo-sm text-bo-text bo-lineItemCell--total">
                  <span className="bo-lineItemValue bo-lineItemValue--total">
                    {item.total.toFixed(2)} {currencySymbol}
                  </span>
                </div>
                <div className="p-3 text-bo-sm text-bo-text bo-lineItemCell--actions">
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

      {selectedLineItem && (
        <Modal
          open={lineItemDetailsIndex !== null}
          title={`Detalle de línea ${lineItemDetailsIndex !== null ? lineItemDetailsIndex + 1 : ""}`}
          onClose={closeLineItemDetails}
          size="sm"
        >
          <div className="flex items-center justify-between p-4 border-b border-bo-border">
            <h3 className="text-lg font-semibold text-bo-text">Detalle de línea {lineItemDetailsIndex !== null ? lineItemDetailsIndex + 1 : ""}</h3>
            <button
              type="button"
              className="inline-flex h-8 items-center justify-center gap-2 rounded-lg border border-white/[0.06] bg-transparent text-bo-text text-xs font-bold transition-all hover:bg-white/[0.04]"
              onClick={closeLineItemDetails}
              aria-label="Cerrar detalle de línea"
            >
              <X size={16} />
            </button>
          </div>

          <div className="bo-lineItemsDetail">
            <div className="bo-lineItemsDetailField">
              <span className="text-bo-sm font-semibold text-bo-muted">Descripción</span>
              <div className="bo-lineItemsDetailValue">{selectedLineItem.description || "—"}</div>
            </div>

            <div className="bo-lineItemsDetailGrid">
              <div className="bo-lineItemsDetailField">
                <span className="text-bo-sm font-semibold text-bo-muted">Cantidad</span>
                <div className="bo-lineItemsDetailValue">{selectedLineItem.quantity}</div>
              </div>
              <div className="bo-lineItemsDetailField">
                <span className="text-bo-sm font-semibold text-bo-muted">Precio unitario</span>
                <div className="bo-lineItemsDetailValue">
                  {selectedLineItem.unit_price.toFixed(2)} {currencySymbol}
                </div>
              </div>
              <div className="bo-lineItemsDetailField">
                <span className="text-bo-sm font-semibold text-bo-muted">IVA</span>
                <div className="bo-lineItemsDetailValue">{selectedLineItem.iva_rate}%</div>
              </div>
              <div className="bo-lineItemsDetailField">
                <span className="text-bo-sm font-semibold text-bo-muted">Importe IVA</span>
                <div className="bo-lineItemsDetailValue">
                  {selectedLineItem.iva_amount.toFixed(2)} {currencySymbol}
                </div>
              </div>
              <div className="bo-lineItemsDetailField">
                <span className="text-bo-sm font-semibold text-bo-muted">Total</span>
                <div className="bo-lineItemsDetailValue bo-lineItemsDetailValue--strong">
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
