import React, { useState, useCallback, useMemo, useEffect } from "react";
import { X, Loader2, Plus, Trash2, ArrowRight, AlertCircle } from "lucide-react";
import { useToasts } from "../../../../ui/feedback/useToasts";
import type { Invoice, InvoiceSplitInput, InvoiceSplitMethod, InvoiceSplitItem, CurrencyCode } from "../../../../api/types";
import { CURRENCY_SYMBOLS } from "../../../../api/types";

type SplitInvoiceModalProps = {
  invoice: Invoice;
  isOpen: boolean;
  onClose: () => void;
  onSplit: (input: InvoiceSplitInput) => Promise<{ success: boolean; message?: string }>;
};

const INITIAL_SPLIT_ITEM: Omit<InvoiceSplitItem, "customer_name" | "customer_email"> = {
  customer_dni_cif: "",
  customer_surname: "",
  customer_phone: "",
  customer_address_street: "",
  customer_address_number: "",
  customer_address_postal_code: "",
  customer_address_city: "",
  customer_address_province: "",
  customer_address_country: "",
};

function formatPrice(price: number, currency: CurrencyCode = "EUR"): string {
  const symbol = CURRENCY_SYMBOLS[currency] || "€";
  return `${symbol}${price.toFixed(2)}`;
}

function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function SplitInvoiceModal({ invoice, isOpen, onClose, onSplit }: SplitInvoiceModalProps) {
  const { pushToast } = useToasts();

  // Split method: percentage or equal
  const [method, setMethod] = useState<InvoiceSplitMethod>("percentage");

  // For equal split: number of parts
  const [splitCount, setSplitCount] = useState(2);

  // For percentage split: custom items
  const [splitItems, setSplitItems] = useState<InvoiceSplitItem[]>([
    { ...INITIAL_SPLIT_ITEM, customer_name: "", customer_email: "", percentage: 50 },
    { ...INITIAL_SPLIT_ITEM, customer_name: "", customer_email: "", percentage: 50 },
  ]);

  // Form state
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setMethod("percentage");
      setSplitCount(2);
      setSplitItems([
        { ...INITIAL_SPLIT_ITEM, customer_name: invoice.customer_name, customer_email: invoice.customer_email, percentage: 50 },
        { ...INITIAL_SPLIT_ITEM, customer_name: "", customer_email: "", percentage: 50 },
      ]);
    }
  }, [isOpen, invoice.customer_name, invoice.customer_email]);

  // Calculate totals
  const originalAmount = invoice.amount;
  const currency = invoice.currency || "EUR";

  // Calculate amounts based on method
  const calculatedSplits = useMemo(() => {
    if (method === "equal") {
      const amountPerPart = originalAmount / splitCount;
      return Array.from({ length: splitCount }, (_, i) => ({
        index: i,
        percentage: 100 / splitCount,
        amount: amountPerPart,
      }));
    } else {
      // Percentage method
      let totalPercentage = 0;
      const splits = splitItems.map((item, index) => {
        const pct = item.percentage || 0;
        totalPercentage += pct;
        return {
          index,
          percentage: pct,
          amount: (originalAmount * pct) / 100,
          customer_name: item.customer_name,
          customer_email: item.customer_email,
        };
      });
      return { splits, totalPercentage };
    }
  }, [method, splitCount, splitItems, originalAmount]);

  // Handle adding a new split item
  const handleAddItem = useCallback(() => {
    setSplitItems((prev) => [
      ...prev,
      { ...INITIAL_SPLIT_ITEM, customer_name: "", customer_email: "", percentage: 0 },
    ]);
  }, []);

  // Handle removing a split item
  const handleRemoveItem = useCallback((index: number) => {
    setSplitItems((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // Handle updating a split item
  const handleUpdateItem = useCallback((index: number, field: keyof InvoiceSplitItem, value: string | number) => {
    setSplitItems((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  }, []);

  // Validation
  const validationErrors = useMemo(() => {
    const errors: string[] = [];

    if (method === "percentage") {
      const totalPercentage = splitItems.reduce((sum, item) => sum + (item.percentage || 0), 0);
      if (Math.abs(totalPercentage - 100) > 0.01) {
        errors.push(`Los porcentajes deben sumar 100% (actual: ${totalPercentage.toFixed(1)}%)`);
      }

      splitItems.forEach((item, index) => {
        if (!item.customer_name.trim()) {
          errors.push(`El nombre del cliente es obligatorio en la factura ${index + 1}`);
        }
        if (!item.customer_email.trim()) {
          errors.push(`El email del cliente es obligatorio en la factura ${index + 1}`);
        } else if (!validateEmail(item.customer_email)) {
          errors.push(`El email "${item.customer_email}" no es válido en la factura ${index + 1}`);
        }
      });
    } else {
      if (splitCount < 2) {
        errors.push("Debe haber al menos 2 partes para dividir");
      }
      if (splitCount > 10) {
        errors.push("No se puede dividir en más de 10 partes");
      }
    }

    return errors;
  }, [method, splitItems, splitCount]);

  // Handle submit
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    if (validationErrors.length > 0) {
      pushToast({ kind: "error", title: "Error de validación", message: validationErrors[0] });
      return;
    }

    setIsSubmitting(true);
    try {
      let input: InvoiceSplitInput;

      if (method === "equal") {
        input = {
          source_invoice_id: invoice.id,
          method: "equal",
          split_count: splitCount,
        };
      } else {
        input = {
          source_invoice_id: invoice.id,
          method: "percentage",
          items: splitItems.map((item) => ({
            customer_name: item.customer_name,
            customer_email: item.customer_email,
            customer_dni_cif: item.customer_dni_cif || undefined,
            customer_surname: item.customer_surname || undefined,
            customer_phone: item.customer_phone || undefined,
            customer_address_street: item.customer_address_street || undefined,
            customer_address_number: item.customer_address_number || undefined,
            customer_address_postal_code: item.customer_address_postal_code || undefined,
            customer_address_city: item.customer_address_city || undefined,
            customer_address_province: item.customer_address_province || undefined,
            customer_address_country: item.customer_address_country || undefined,
            percentage: item.percentage,
          })),
        };
      }

      const result = await onSplit(input);
      if (result.success) {
        pushToast({
          kind: "success",
          title: "Factura dividida",
          message: `La factura ha sido dividida en ${method === "equal" ? splitCount : splitItems.length} facturas`,
        });
        onClose();
      } else {
        pushToast({ kind: "error", title: "Error", message: result.message || "Error al dividir la factura" });
      }
    } catch (err) {
      pushToast({ kind: "error", title: "Error", message: err instanceof Error ? err.message : "Error al dividir la factura" });
    } finally {
      setIsSubmitting(false);
    }
  }, [method, splitCount, splitItems, invoice.id, onSplit, onClose, pushToast, validationErrors]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="rounded-bo-lg bg-bo-surface shadow-bo-soft max-w-lg w-full bo-modal--lg" onClick={(e) => e.stopPropagation()} role="dialog" aria-labelledby="split-modal-title">
        <div className="flex items-center justify-between p-4 border-b border-bo-border">
          <h2 id="split-modal-title" className="text-lg font-semibold text-bo-text">Dividir factura</h2>
          <button className="inline-flex h-8 items-center justify-center gap-2 rounded-lg border border-white/[0.06] bg-transparent text-bo-text text-xs font-bold transition-all hover:bg-white/[0.04]" onClick={onClose} aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="p-4">
            {/* Original Invoice Info */}
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-bo-text mb-3">Factura original</h3>
              <div className="bo-invoiceSplitOriginal">
                <div className="bo-invoiceSplitOriginalInfo">
                  <span className="bo-invoiceSplitOriginalNumber">{invoice.invoice_number || `#${invoice.id}`}</span>
                  <span className="bo-invoiceSplitOriginalCustomer">{invoice.customer_name}</span>
                </div>
                <div className="bo-invoiceSplitOriginalAmount">
                  <span className="bo-invoiceSplitOriginalAmountLabel">Importe original:</span>
                  <span className="bo-invoiceSplitOriginalAmountValue">{formatPrice(originalAmount, currency)}</span>
                </div>
              </div>
            </div>

            {/* Split Method Selection */}
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-bo-text mb-3">Metodo de division</h3>
              <div className="flex flex-col gap-2">
                <label className="flex flex-col gap-2">
                  <input
                    type="radio"
                    name="method"
                    value="percentage"
                    checked={method === "percentage"}
                    onChange={() => setMethod("percentage")}
                    className="bo-radioInput"
                  />
                  <span className="bo-radioLabel">
                    <strong>Porcentaje personalizado</strong>
                    <span className="bo-radioDescription">Definir el porcentaje para cada cliente</span>
                  </span>
                </label>
                <label className="flex flex-col gap-2">
                  <input
                    type="radio"
                    name="method"
                    value="equal"
                    checked={method === "equal"}
                    onChange={() => setMethod("equal")}
                    className="bo-radioInput"
                  />
                  <span className="bo-radioLabel">
                    <strong>Division igualitaria</strong>
                    <span className="bo-radioDescription">Dividir en partes iguales</span>
                  </span>
                </label>
              </div>
            </div>

            {/* Split Configuration */}
            <div className="mb-6">
              {method === "equal" ? (
                <div className="flex flex-col gap-2">
                  <label htmlFor="splitCount" className="text-bo-sm font-semibold text-bo-muted">Numero de partes</label>
                  <input
                    id="splitCount"
                    type="number"
                    min="2"
                    max="10"
                    value={splitCount}
                    onChange={(e) => setSplitCount(parseInt(e.target.value) || 2)}
                    className="h-10 rounded-bo-md border border-bo-border bg-white/5 text-bo-text px-3 outline-none min-w-0 transition-colors"
                  />
                  <p className="bo-formHelp">
                    Cada parte sera de: <strong>{formatPrice(originalAmount / splitCount, currency)}</strong>
                  </p>
                </div>
              ) : (
                <>
                  <div className="bo-splitItemsHeader">
                    <h3 className="text-sm font-semibold text-bo-text mb-0">Facturas resultantes</h3>
                    <button
                      type="button"
                      className="inline-flex h-8 items-center justify-center gap-2 rounded-lg border border-white/[0.09] bg-bo-surface-2 text-bo-text text-xs font-bold transition-all hover:border-bo-primary hover:bg-bo-surface-2/80 disabled:opacity-55 disabled:cursor-not-allowed"
                      onClick={handleAddItem}
                    >
                      <Plus size={14} />
                      Añadir
                    </button>
                  </div>

                  {/* Percentage total warning */}
                  {(() => {
                    const totalPct = splitItems.reduce((sum, item) => sum + (item.percentage || 0), 0);
                    const isValid = Math.abs(totalPct - 100) < 0.01;
                    return (
                      <div className={`bo-splitPercentageTotal ${isValid ? "is-valid" : "is-invalid"}`}>
                        <span>Total: {totalPct.toFixed(1)}%</span>
                        {!isValid && (
                          <span className="bo-splitPercentageWarning">
                            <AlertCircle size={14} />
                            Debe ser 100%
                          </span>
                        )}
                      </div>
                    );
                  })()}

                  {/* Split Items */}
                  <div className="bo-splitItems">
                    {splitItems.map((item, index) => (
                      <div key={index} className="bo-splitItem">
                        <div className="bo-splitItemHeader">
                          <span className="bo-splitItemNumber">Factura {index + 1}</span>
                          {splitItems.length > 2 && (
                            <button
                              type="button"
                              className="h-9 px-4 rounded-bo-sm font-semibold inline-flex items-center justify-center gap-2 cursor-pointer bg-transparent border border-transparent hover:bg-white/5 bo-btn--ghost bo-btn--sm bo-btn--danger"
                              onClick={() => handleRemoveItem(index)}
                              aria-label={`Eliminar factura ${index + 1}`}
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>

                        <div className="bo-splitItemFields">
                          <div className="bo-formRow">
                            <div className="flex flex-col gap-2">
                              <label className="text-bo-sm font-semibold text-bo-muted">Nombre del cliente *</label>
                              <input
                                type="text"
                                value={item.customer_name}
                                onChange={(e) => handleUpdateItem(index, "customer_name", e.target.value)}
                                className="h-10 rounded-bo-md border border-bo-border bg-white/5 text-bo-text px-3 outline-none min-w-0 transition-colors"
                                placeholder="Nombre"
                                required
                              />
                            </div>
                            <div className="flex flex-col gap-2">
                              <label className="text-bo-sm font-semibold text-bo-muted">Apellidos</label>
                              <input
                                type="text"
                                value={item.customer_surname || ""}
                                onChange={(e) => handleUpdateItem(index, "customer_surname", e.target.value)}
                                className="h-10 rounded-bo-md border border-bo-border bg-white/5 text-bo-text px-3 outline-none min-w-0 transition-colors"
                                placeholder="Apellidos"
                              />
                            </div>
                          </div>

                          <div className="bo-formRow">
                            <div className="flex flex-col gap-2">
                              <label className="text-bo-sm font-semibold text-bo-muted">Email *</label>
                              <input
                                type="email"
                                value={item.customer_email}
                                onChange={(e) => handleUpdateItem(index, "customer_email", e.target.value)}
                                className="h-10 rounded-bo-md border border-bo-border bg-white/5 text-bo-text px-3 outline-none min-w-0 transition-colors"
                                placeholder="email@ejemplo.com"
                                required
                              />
                            </div>
                            <div className="flex flex-col gap-2">
                              <label className="text-bo-sm font-semibold text-bo-muted">DNI/CIF</label>
                              <input
                                type="text"
                                value={item.customer_dni_cif || ""}
                                onChange={(e) => handleUpdateItem(index, "customer_dni_cif", e.target.value)}
                                className="h-10 rounded-bo-md border border-bo-border bg-white/5 text-bo-text px-3 outline-none min-w-0 transition-colors"
                                placeholder="12345678A"
                              />
                            </div>
                          </div>

                          <div className="bo-formRow">
                            <div className="flex flex-col gap-2">
                              <label className="text-bo-sm font-semibold text-bo-muted">Telefono</label>
                              <input
                                type="tel"
                                value={item.customer_phone || ""}
                                onChange={(e) => handleUpdateItem(index, "customer_phone", e.target.value)}
                                className="h-10 rounded-bo-md border border-bo-border bg-white/5 text-bo-text px-3 outline-none min-w-0 transition-colors"
                                placeholder="600 000 000"
                              />
                            </div>
                            <div className="flex flex-col gap-2">
                              <label className="text-bo-sm font-semibold text-bo-muted">Porcentaje (%)</label>
                              <div className="bo-inputGroup">
                                <input
                                  type="number"
                                  min="0"
                                  max="100"
                                  step="0.01"
                                  value={item.percentage || 0}
                                  onChange={(e) => handleUpdateItem(index, "percentage", parseFloat(e.target.value) || 0)}
                                  className="h-10 rounded-bo-md border border-bo-border bg-white/5 text-bo-text px-3 outline-none min-w-0 transition-colors"
                                  required
                                />
                                <span className="bo-inputGroupAddon">%</span>
                              </div>
                            </div>
                          </div>

                          <div className="bo-splitItemAmount">
                            <span>Importe:</span>
                            <strong>{formatPrice((originalAmount * (item.percentage || 0)) / 100, currency)}</strong>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Preview */}
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-bo-text mb-3">Vista previa</h3>
              <div className="bo-splitPreview">
                {method === "equal" ? (
                  Array.from({ length: splitCount }).map((_, index) => (
                    <div key={index} className="bo-splitPreviewItem">
                      <div className="bo-splitPreviewItemHeader">
                        <span>Factura {index + 1}</span>
                        <ArrowRight size={14} />
                      </div>
                      <div className="bo-splitPreviewItemAmount">
                        {formatPrice(originalAmount / splitCount, currency)}
                      </div>
                    </div>
                  ))
                ) : (
                  splitItems.map((item, index) => (
                    <div key={index} className="bo-splitPreviewItem">
                      <div className="bo-splitPreviewItemHeader">
                        <span>{item.customer_name || `Cliente ${index + 1}`}</span>
                        <ArrowRight size={14} />
                      </div>
                      <div className="bo-splitPreviewItemDetails">
                        <span className="bo-splitPreviewItemPercentage">{item.percentage || 0}%</span>
                        <span className="bo-splitPreviewItemAmount">
                          {formatPrice((originalAmount * (item.percentage || 0)) / 100, currency)}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Validation Errors */}
            {validationErrors.length > 0 && (
              <div className="bo-alert bo-alert--error">
                <AlertCircle size={16} />
                <ul className="flex flex-col gap-2">
                  {validationErrors.map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="bo-modalFooter">
            <button
              type="button"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-white/[0.09] bg-bo-surface-2 text-bo-text text-sm font-bold transition-all hover:border-bo-primary hover:bg-bo-surface-2/80 disabled:opacity-55 disabled:cursor-not-allowed"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[rgba(185,168,255,0.30)] bg-[rgba(185,168,255,0.16)] text-bo-text text-sm font-bold transition-all hover:border-[rgba(185,168,255,0.40)] hover:bg-[rgba(185,168,255,0.24)] disabled:opacity-55 disabled:cursor-not-allowed mx-auto"
              disabled={isSubmitting || validationErrors.length > 0}
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className="animate-spin h-5 w-5" />
                  Dividiendo...
                </>
              ) : (
                <>
                  <Plus size={16} />
                  Dividir factura
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
