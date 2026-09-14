import React, { useState, useCallback, useMemo, useEffect } from "react";
import { X, Loader2, Plus, Trash2, ArrowRight, AlertCircle } from "lucide-react";
import { ModalHeader } from "../../../../ui/overlays/ModalHeader";
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
    <div className="bo-modalOverlay" onClick={onClose} data-testid="split-invoice-overlay">
      <div className="bo-modal bo-modal--lg" onClick={(e) => e.stopPropagation()} role="dialog" aria-labelledby="split-modal-title" data-testid="split-invoice-modal">
        <ModalHeader title="Dividir factura" onClose={onClose} />

        <form onSubmit={handleSubmit} data-testid="split-invoice-form">
          <div data-testid="splitInvoiceModal-modalBody" className="bo-modalBody" data-slot="splitInvoiceModal-modalBody">
            {/* Original Invoice Info */}
            <div data-testid="splitInvoiceModal-formSection" className="bo-formSection" data-slot="splitInvoiceModal-formSection">
              <h3 data-testid="splitInvoiceModal-formSectionTitle" className="bo-formSectionTitle" data-slot="splitInvoiceModal-formSectionTitle">Factura original</h3>
              <div data-testid="splitInvoiceModal-invoiceSplitOriginal" className="bo-invoiceSplitOriginal" data-slot="splitInvoiceModal-invoiceSplitOriginal">
                <div data-testid="splitInvoiceModal-invoiceSplitOriginalInfo" className="bo-invoiceSplitOriginalInfo" data-slot="splitInvoiceModal-invoiceSplitOriginalInfo">
                  <span data-testid="splitInvoiceModal-invoiceSplitOriginalNumber" className="bo-invoiceSplitOriginalNumber" data-slot="splitInvoiceModal-invoiceSplitOriginalNumber">{invoice.invoice_number || `#${invoice.id}`}</span>
                  <span data-testid="splitInvoiceModal-invoiceSplitOriginalCustomer" className="bo-invoiceSplitOriginalCustomer" data-slot="splitInvoiceModal-invoiceSplitOriginalCustomer">{invoice.customer_name}</span>
                </div>
                <div data-testid="splitInvoiceModal-invoiceSplitOriginalAmount" className="bo-invoiceSplitOriginalAmount" data-slot="splitInvoiceModal-invoiceSplitOriginalAmount">
                  <span data-testid="splitInvoiceModal-invoiceSplitOriginalAmountLabel" className="bo-invoiceSplitOriginalAmountLabel" data-slot="splitInvoiceModal-invoiceSplitOriginalAmountLabel">Importe original:</span>
                  <span data-testid="splitInvoiceModal-invoiceSplitOriginalAmountValue" className="bo-invoiceSplitOriginalAmountValue" data-slot="splitInvoiceModal-invoiceSplitOriginalAmountValue">{formatPrice(originalAmount, currency)}</span>
                </div>
              </div>
            </div>

            {/* Split Method Selection */}
            <div data-testid="splitInvoiceModal-formSection-2" className="bo-formSection" data-slot="splitInvoiceModal-formSection">
              <h3 data-testid="splitInvoiceModal-formSectionTitle-2" className="bo-formSectionTitle" data-slot="splitInvoiceModal-formSectionTitle">Metodo de division</h3>
              <div data-testid="splitInvoiceModal-formGroup" className="bo-formGroup" data-slot="splitInvoiceModal-formGroup">
                <label data-testid="splitInvoiceModal-radioGroup" className="bo-radioGroup" data-slot="splitInvoiceModal-radioGroup">
                  <input
                    type="radio"
                    name="method"
                    value="percentage"
                    checked={method === "percentage"}
                    onChange={() => setMethod("percentage")}
                    className="bo-radioInput"
                    data-testid="split-invoice-method-percentage-input"
                  />
                  <span data-testid="splitInvoiceModal-radioLabel" className="bo-radioLabel" data-slot="splitInvoiceModal-radioLabel">
                    <strong data-testid="SplitInvoiceModal-strong">Porcentaje personalizado</strong>
                    <span data-testid="splitInvoiceModal-radioDescription" className="bo-radioDescription" data-slot="splitInvoiceModal-radioDescription">Definir el porcentaje para cada cliente</span>
                  </span>
                </label>
                <label data-testid="splitInvoiceModal-radioGroup-2" className="bo-radioGroup" data-slot="splitInvoiceModal-radioGroup">
                  <input
                    type="radio"
                    name="method"
                    value="equal"
                    checked={method === "equal"}
                    onChange={() => setMethod("equal")}
                    className="bo-radioInput"
                    data-testid="split-invoice-method-equal-input"
                  />
                  <span data-testid="splitInvoiceModal-radioLabel-2" className="bo-radioLabel" data-slot="splitInvoiceModal-radioLabel">
                    <strong data-testid="SplitInvoiceModal-strong-2">Division igualitaria</strong>
                    <span data-testid="splitInvoiceModal-radioDescription-2" className="bo-radioDescription" data-slot="splitInvoiceModal-radioDescription">Dividir en partes iguales</span>
                  </span>
                </label>
              </div>
            </div>

            {/* Split Configuration */}
            <div data-testid="splitInvoiceModal-formSection-3" className="bo-formSection" data-slot="splitInvoiceModal-formSection">
              {method === "equal" ? (
                <div data-testid="splitInvoiceModal-formGroup-2" className="bo-formGroup" data-slot="splitInvoiceModal-formGroup">
                  <label data-testid="split-invoice-split-count-label" htmlFor="splitCount" className="bo-label" data-slot="split-invoice-split-count-label">Numero de partes</label>
                  <input
                    id="splitCount"
                    type="number"
                    min="2"
                    max="10"
                    value={splitCount}
                    onChange={(e) => setSplitCount(parseInt(e.target.value) || 2)}
                    className="bo-input"
                    data-testid="split-invoice-split-count-input"
                  />
                  <p data-testid="splitInvoiceModal-formHelp" className="bo-formHelp" data-slot="splitInvoiceModal-formHelp">
                    Cada parte sera de: <strong data-testid="SplitInvoiceModal-strong-3">{formatPrice(originalAmount / splitCount, currency)}</strong>
                  </p>
                </div>
              ) : (
                <>
                  <div data-testid="splitInvoiceModal-splitItemsHeader" className="bo-splitItemsHeader" data-slot="splitInvoiceModal-splitItemsHeader">
                    <h3 data-testid="splitInvoiceModal-formSectionTitle-3" className="bo-formSectionTitle" data-slot="splitInvoiceModal-formSectionTitle">Facturas resultantes</h3>
                    <button
                      type="button"
                      className="bo-btn bo-btn--secondary bo-btn--sm"
                      onClick={handleAddItem}
                      data-testid="split-invoice-add-line-btn"
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
                      <div data-testid="splitInvoiceModal-div" className={`bo-splitPercentageTotal ${isValid ? "is-valid" : "is-invalid"}`} data-slot="splitInvoiceModal-div">
                        <span data-testid="splitInvoiceModal-xed" data-slot="splitInvoiceModal-xed">Total: {totalPct.toFixed(1)}%</span>
                        {!isValid && (
                          <span data-testid="splitInvoiceModal-splitPercentageWarning" className="bo-splitPercentageWarning" data-slot="splitInvoiceModal-splitPercentageWarning">
                            <AlertCircle size={14} />
                            Debe ser 100%
                          </span>
                        )}
                      </div>
                    );
                  })()}

                  {/* Split Items */}
                  <div data-testid="splitInvoiceModal-splitItems" className="bo-splitItems" data-slot="splitInvoiceModal-splitItems">
                    {splitItems.map((item, index) => (
                      <div data-testid="splitInvoiceModal-splitItem" key={index} className="bo-splitItem" data-slot="splitInvoiceModal-splitItem">
                        <div data-testid="splitInvoiceModal-splitItemHeader" className="bo-splitItemHeader" data-slot="splitInvoiceModal-splitItemHeader">
                          <span data-testid="splitInvoiceModal-splitItemNumber" className="bo-splitItemNumber" data-slot="splitInvoiceModal-splitItemNumber">Factura {index + 1}</span>
                          {splitItems.length > 2 && (
                            <button
                              type="button"
                              className="bo-btn bo-btn--ghost bo-btn--sm bo-btn--danger"
                              onClick={() => handleRemoveItem(index)}
                              aria-label={`Eliminar factura ${index + 1}`}
                              data-testid={`split-invoice-remove-line-${index}-btn`}
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>

                        <div data-testid="splitInvoiceModal-splitItemFields" className="bo-splitItemFields" data-slot="splitInvoiceModal-splitItemFields">
                          <div data-testid="splitInvoiceModal-formRow" className="bo-formRow" data-slot="splitInvoiceModal-formRow">
                            <div data-testid="splitInvoiceModal-formGroup-3" className="bo-formGroup" data-slot="splitInvoiceModal-formGroup">
                              <label data-testid="split-invoice-customer-name-label" className="bo-label" data-slot="split-invoice-customer-name-label">Nombre del cliente *</label>
                              <input
                                type="text"
                                value={item.customer_name}
                                onChange={(e) => handleUpdateItem(index, "customer_name", e.target.value)}
                                className="bo-input"
                                placeholder="Nombre"
                                required
                                data-testid={`split-invoice-customer-name-${index}-input`}
                              />
                            </div>
                            <div data-testid="splitInvoiceModal-formGroup-4" className="bo-formGroup" data-slot="splitInvoiceModal-formGroup">
                              <label data-testid="split-invoice-customer-surname-label" className="bo-label" data-slot="split-invoice-customer-surname-label">Apellidos</label>
                              <input
                                type="text"
                                value={item.customer_surname || ""}
                                onChange={(e) => handleUpdateItem(index, "customer_surname", e.target.value)}
                                className="bo-input"
                                placeholder="Apellidos"
                                data-testid={`split-invoice-customer-surname-${index}-input`}
                              />
                            </div>
                          </div>

                          <div data-testid="splitInvoiceModal-formRow-2" className="bo-formRow" data-slot="splitInvoiceModal-formRow">
                            <div data-testid="splitInvoiceModal-formGroup-5" className="bo-formGroup" data-slot="splitInvoiceModal-formGroup">
                              <label data-testid="split-invoice-customer-email-label" className="bo-label" data-slot="split-invoice-customer-email-label">Email *</label>
                              <input
                                type="email"
                                value={item.customer_email}
                                onChange={(e) => handleUpdateItem(index, "customer_email", e.target.value)}
                                className="bo-input"
                                placeholder="email@ejemplo.com"
                                required
                                data-testid={`split-invoice-customer-email-${index}-input`}
                              />
                            </div>
                            <div data-testid="splitInvoiceModal-formGroup-6" className="bo-formGroup" data-slot="splitInvoiceModal-formGroup">
                              <label data-testid="split-invoice-customer-dni-label" className="bo-label" data-slot="split-invoice-customer-dni-label">DNI/CIF</label>
                              <input
                                type="text"
                                value={item.customer_dni_cif || ""}
                                onChange={(e) => handleUpdateItem(index, "customer_dni_cif", e.target.value)}
                                className="bo-input"
                                placeholder="12345678A"
                                data-testid={`split-invoice-customer-dni-${index}-input`}
                              />
                            </div>
                          </div>

                          <div data-testid="splitInvoiceModal-formRow-3" className="bo-formRow" data-slot="splitInvoiceModal-formRow">
                            <div data-testid="splitInvoiceModal-formGroup-7" className="bo-formGroup" data-slot="splitInvoiceModal-formGroup">
                              <label data-testid="split-invoice-customer-phone-label" className="bo-label" data-slot="split-invoice-customer-phone-label">Telefono</label>
                              <input
                                type="tel"
                                value={item.customer_phone || ""}
                                onChange={(e) => handleUpdateItem(index, "customer_phone", e.target.value)}
                                className="bo-input"
                                placeholder="600 000 000"
                                data-testid={`split-invoice-customer-phone-${index}-input`}
                              />
                            </div>
                            <div data-testid="splitInvoiceModal-formGroup-8" className="bo-formGroup" data-slot="splitInvoiceModal-formGroup">
                              <label data-testid="split-invoice-percentage-label" className="bo-label" data-slot="split-invoice-percentage-label">Porcentaje (%)</label>
                              <div data-testid="splitInvoiceModal-inputGroup" className="bo-inputGroup" data-slot="splitInvoiceModal-inputGroup">
                                <input
                                  type="number"
                                  min="0"
                                  max="100"
                                  step="0.01"
                                  value={item.percentage || 0}
                                  onChange={(e) => handleUpdateItem(index, "percentage", parseFloat(e.target.value) || 0)}
                                  className="bo-input"
                                  required
                                  data-testid={`split-invoice-percentage-${index}-input`}
                                />
                                <span data-testid="splitInvoiceModal-inputGroupAddon" className="bo-inputGroupAddon" data-slot="splitInvoiceModal-inputGroupAddon">%</span>
                              </div>
                            </div>
                          </div>

                          <div data-testid="splitInvoiceModal-splitItemAmount" className="bo-splitItemAmount" data-slot="splitInvoiceModal-splitItemAmount">
                            <span data-testid="splitInvoiceModal-rte" data-slot="splitInvoiceModal-rte">Importe:</span>
                            <strong data-testid="SplitInvoiceModal-strong-4">{formatPrice((originalAmount * (item.percentage || 0)) / 100, currency)}</strong>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Preview */}
            <div data-testid="splitInvoiceModal-formSection-4" className="bo-formSection" data-slot="splitInvoiceModal-formSection">
              <h3 data-testid="splitInvoiceModal-formSectionTitle-4" className="bo-formSectionTitle" data-slot="splitInvoiceModal-formSectionTitle">Vista previa</h3>
              <div data-testid="splitInvoiceModal-splitPreview" className="bo-splitPreview" data-slot="splitInvoiceModal-splitPreview">
                {method === "equal" ? (
                  Array.from({ length: splitCount }).map((_, index) => (
                    <div data-testid="splitInvoiceModal-splitPreviewItem" key={index} className="bo-splitPreviewItem" data-slot="splitInvoiceModal-splitPreviewItem">
                      <div data-testid="splitInvoiceModal-splitPreviewItemHeader" className="bo-splitPreviewItemHeader" data-slot="splitInvoiceModal-splitPreviewItemHeader">
                        <span data-testid="splitInvoiceModal-dex" data-slot="splitInvoiceModal-dex">Factura {index + 1}</span>
                        <ArrowRight size={14} />
                      </div>
                      <div data-testid="splitInvoiceModal-splitPreviewItemAmount" className="bo-splitPreviewItemAmount" data-slot="splitInvoiceModal-splitPreviewItemAmount">
                        {formatPrice(originalAmount / splitCount, currency)}
                      </div>
                    </div>
                  ))
                ) : (
                  splitItems.map((item, index) => (
                    <div data-testid="splitInvoiceModal-splitPreviewItem-2" key={index} className="bo-splitPreviewItem" data-slot="splitInvoiceModal-splitPreviewItem">
                      <div data-testid="splitInvoiceModal-splitPreviewItemHeader-2" className="bo-splitPreviewItemHeader" data-slot="splitInvoiceModal-splitPreviewItemHeader">
                        <span data-testid="splitInvoiceModal-dex-2" data-slot="splitInvoiceModal-dex">{item.customer_name || `Cliente ${index + 1}`}</span>
                        <ArrowRight size={14} />
                      </div>
                      <div data-testid="splitInvoiceModal-splitPreviewItemDetails" className="bo-splitPreviewItemDetails" data-slot="splitInvoiceModal-splitPreviewItemDetails">
                        <span data-testid="splitInvoiceModal-splitPreviewItemPercentage" className="bo-splitPreviewItemPercentage" data-slot="splitInvoiceModal-splitPreviewItemPercentage">{item.percentage || 0}%</span>
                        <span data-testid="splitInvoiceModal-splitPreviewItemAmount-2" className="bo-splitPreviewItemAmount" data-slot="splitInvoiceModal-splitPreviewItemAmount">
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
              <div data-testid="splitInvoiceModal-alert-error" className="bo-alert bo-alert--error" data-slot="splitInvoiceModal-alert--error">
                <AlertCircle size={16} />
                <ul data-testid="splitInvoiceModal-alertList" className="bo-alertList" data-slot="splitInvoiceModal-alertList">
                  {validationErrors.map((error, index) => (
                    <li data-testid="splitInvoiceModal-ror" key={index} data-slot="splitInvoiceModal-ror">{error}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div data-testid="splitInvoiceModal-modalFooter" className="bo-modalFooter" data-slot="splitInvoiceModal-modalFooter">
            <button
              type="button"
              className="bo-btn bo-btn--secondary"
              onClick={onClose}
              disabled={isSubmitting}
              data-testid="split-invoice-cancel-btn"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="bo-btn bo-btn--primary"
              disabled={isSubmitting || validationErrors.length > 0}
              data-testid="split-invoice-split-btn"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className="bo-spinner" />
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
