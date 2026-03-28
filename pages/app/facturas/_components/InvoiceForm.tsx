import React, { useCallback, useEffect, useMemo, useRef, useState, forwardRef, useImperativeHandle } from "react";
import { Save, Send, Upload, X, Search, Loader2, Check, AlertCircle, FileText, Tag, Plus, XCircle, List, MessageSquare, Eye } from "lucide-react";
import { useToasts } from "../../../../ui/feedback/useToasts";
import { Select } from "../../../../ui/inputs/Select";
import { DatePicker } from "../../../../ui/inputs/DatePicker";
import { Switch } from "../../../../ui/shadcn/Switch";
import { FillFromReservationModal } from "./FillFromReservationModal";
import { SelectTemplateModal } from "./SelectTemplateModal";
import { InvoicePdfPreviewModal } from "./InvoicePdfPreviewModal";
import { LineItems, type LineItemsRef } from "./LineItems";
import { CommentsPanel } from "./CommentsPanel";
import type { Invoice, InvoiceInput, InvoiceStatus, PaymentMethod, ReservationSearchResult, InvoiceTemplate, CurrencyCode, InvoiceCategory, PdfTemplateType, InvoiceLineItem, InvoiceLineItemInput, InvoiceDepositType } from "../../../../api/types";
import { CURRENCY_OPTIONS, CURRENCY_SYMBOLS, DEFAULT_CURRENCY_RATES, convertCurrency, INVOICE_CATEGORY_OPTIONS, PDF_TEMPLATE_OPTIONS, INVOICE_DEPOSIT_TYPE_OPTIONS } from "../../../../api/types";
import { createClient } from "../../../../api/client";
import { compressImageToWebP } from "../../../../lib/imageCompressor";

export interface InvoiceFormRef {
  save: (shouldSend?: boolean) => void;
}

type InvoiceFormProps = {
  invoice: Invoice | null;
  isDuplicate?: boolean;
  isSubmitting?: boolean;
  onSave: (input: InvoiceInput, shouldSend: boolean) => void;
  onCancel: () => void;
  searchReservations: (params: {
    date_from?: string;
    date_to?: string;
    name?: string;
    phone?: string;
    party_size?: number;
    time?: string;
  }) => Promise<ReservationSearchResult[]>;
  api?: ReturnType<typeof createClient>;
  currentUserId?: number;
};

type AutoSaveStatus = "idle" | "saving" | "saved" | "error";

function formatPrice(amount: number, currency: CurrencyCode = "EUR"): string {
  const symbol = CURRENCY_SYMBOLS[currency] || "€";
  return `${symbol}${amount.toFixed(2)}`;
}

// Validation functions for Spanish formats

// Validate email format
function validateEmail(email: string): string | null {
  if (!email.trim()) {
    return "El email es obligatorio";
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return "El formato del email no es válido";
  }
  return null;
}

// Validate Spanish CIF (Código de Identificación Fiscal)
// Format: 1 letter + 8 digits + 1 letter/digit, or special formats
function validateCIF(cif: string): string | null {
  if (!cif.trim()) {
    return null; // CIF is optional
  }
  const cifRegex = /^[A-HJNP-SW][0-9]{7}[A-JNP-Z0-9]$/i;
  if (!cifRegex.test(cif)) {
    return "El CIF debe tener 9 caracteres (1 letra + 8 dígitos/caracteres)";
  }
  return null;
}

// Validate Spanish DNI (Documento Nacional de Identidad)
// Format: 8 digits + 1 letter
function validateDNI(dni: string): string | null {
  if (!dni.trim()) {
    return null; // DNI is optional
  }
  const dniRegex = /^[0-9]{8}[A-Z]$/i;
  if (!dniRegex.test(dni)) {
    return "El DNI debe tener 8 dígitos y 1 letra";
  }
  // Validate letter
  const letterMap = "TRWAGMYFPDXBNJZSQVHLCKE";
  const numbers = dni.substring(0, 8);
  const letter = dni.charAt(8).toUpperCase();
  const expectedLetter = letterMap[parseInt(numbers) % 23];
  if (letter !== expectedLetter) {
    return "La letra del DNI no corresponde a los dígitos";
  }
  return null;
}

// Validate Spanish NIE (Número de Identificación de Extranjero)
// Format: 1 letter (X, Y, Z) + 7 digits + 1 letter
function validateNIE(nie: string): string | null {
  if (!nie.trim()) {
    return null; // NIE is optional
  }
  const nieRegex = /^[XYZ][0-9]{7}[A-Z]$/i;
  if (!nieRegex.test(nie)) {
    return "El NIE debe tener formato válido (X/Y/Z + 7 dígitos + letra)";
  }
  // Validate letter
  const letterMap = "TRWAGMYFPDXBNJZSQVHLCKE";
  let numbers = nie.substring(1, 8);
  const firstLetter = nie.charAt(0).toUpperCase();
  // Convert first letter to number for validation
  if (firstLetter === "X") {
    numbers = "0" + numbers;
  } else if (firstLetter === "Y") {
    numbers = "1" + numbers;
  } else if (firstLetter === "Z") {
    numbers = "2" + numbers;
  }
  const letter = nie.charAt(8).toUpperCase();
  const expectedLetter = letterMap[parseInt(numbers) % 23];
  if (letter !== expectedLetter) {
    return "La letra del NIE no corresponde a los dígitos";
  }
  return null;
}

// Unified DNI/CIF/NIE validation
function validateDniCif(value: string, isDniMode: boolean): string | null {
  if (!value.trim()) {
    return null; // Optional field
  }
  if (isDniMode) {
    // Try DNI first, then NIE
    const dniError = validateDNI(value);
    if (dniError) {
      const nieError = validateNIE(value);
      if (nieError) {
        return "El DNI/NIE no es válido";
      }
    }
  } else {
    return validateCIF(value);
  }
  return null;
}

// Validate Spanish phone number
// Accepts: +34 followed by 9 digits, or 9 digits starting with 6, 7, 8, 9
function validatePhone(phone: string): string | null {
  if (!phone.trim()) {
    return null; // Phone is optional
  }
  // Remove spaces, dots, dashes, and country code prefix
  const cleanPhone = phone.replace(/[\s.\-]/g, "").replace(/^\+34/, "");
  const phoneRegex = /^[6789][0-9]{8}$/;
  if (!phoneRegex.test(cleanPhone)) {
    return "El teléfono debe tener 9 dígitos y empezar por 6, 7, 8 o 9";
  }
  return null;
}

// Validate Spanish postal code (5 digits, first two between 01-52)
function validatePostalCode(postalCode: string): string | null {
  if (!postalCode.trim()) {
    return null; // Postal code is optional
  }
  const postalCodeRegex = /^[0-9]{5}$/;
  if (!postalCodeRegex.test(postalCode)) {
    return "El código postal debe tener 5 dígitos";
  }
  const provinceCode = parseInt(postalCode.substring(0, 2));
  if (provinceCode < 1 || provinceCode > 52) {
    return "El código postal debe empezar entre 01 y 52";
  }
  return null;
}

// Validate amount
function validateAmount(amount: string): string | null {
  if (!amount.trim()) {
    return "El importe es obligatorio";
  }
  const numAmount = parseFloat(amount);
  if (isNaN(numAmount) || numAmount <= 0) {
    return "El importe debe ser un número positivo";
  }
  return null;
}

// Validate required field
function validateRequired(value: string, fieldName: string): string | null {
  if (!value.trim()) {
    return `${fieldName} es obligatorio`;
  }
  return null;
}

const PAYMENT_METHOD_OPTIONS: { value: PaymentMethod | ""; label: string }[] = [
  { value: "", label: "Seleccionar..." },
  { value: "efectivo", label: "Efectivo" },
  { value: "tarjeta", label: "Tarjeta" },
  { value: "transferencia", label: "Transferencia" },
  { value: "bizum", label: "Bizum" },
  { value: "cheque", label: "Cheque" },
];

const PAYMENT_TERMS_OPTIONS: { value: string; label: string }[] = [
  { value: "0", label: "Contado" },
  { value: "15", label: "Net 15 (15 dias)" },
  { value: "30", label: "Net 30 (30 dias)" },
  { value: "45", label: "Net 45 (45 dias)" },
  { value: "60", label: "Net 60 (60 dias)" },
  { value: "90", label: "Net 90 (90 dias)" },
];

const STATUS_OPTIONS: { value: InvoiceStatus; label: string }[] = [
  { value: "borrador", label: "Borrador" },
  { value: "solicitada", label: "Solicitada" },
  { value: "pendiente", label: "Pendiente" },
  { value: "enviada", label: "Enviada" },
  { value: "pagada", label: "Pagada" },
];

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

export const InvoiceForm = forwardRef<InvoiceFormRef, InvoiceFormProps>(function InvoiceForm({ invoice, isDuplicate, isSubmitting = false, onSave, onCancel, searchReservations, api, currentUserId }: InvoiceFormProps, ref) {
  const { pushToast } = useToasts();
  const [showReservationModal, setShowReservationModal] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [reservationSelectionMode, setReservationSelectionMode] = useState<"full" | "booking">("full");
  const [pendingReservationSelection, setPendingReservationSelection] = useState(false);

  // Backend origin for PDF preview - use relative URL for API proxy
  const backendOrigin = typeof window !== "undefined" ? window.location.origin : "";

  // Show toast when opening in duplicate mode
  useEffect(() => {
    if (isDuplicate) {
      pushToast({ kind: "info", title: "Factura duplicada", message: "Se ha creado una copia de la factura original" });
    }
  }, [isDuplicate, pushToast]);

  // Auto-save state
  const [autoSaveStatus, setAutoSaveStatus] = useState<AutoSaveStatus>("idle");
  const [isDirty, setIsDirty] = useState(false);
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedDataRef = useRef<InvoiceInput | null>(null);

  // Form state
  const [customerName, setCustomerName] = useState(invoice?.customer_name || "");
  const [customerSurname, setCustomerSurname] = useState(invoice?.customer_surname || "");
  const [customerEmail, setCustomerEmail] = useState(invoice?.customer_email || "");
  const [useDni, setUseDni] = useState(!!invoice?.customer_dni_cif);
  const [customerDniCif, setCustomerDniCif] = useState(invoice?.customer_dni_cif || "");
  const [customerPhone, setCustomerPhone] = useState(invoice?.customer_phone || "");
  const [customerAddressStreet, setCustomerAddressStreet] = useState(invoice?.customer_address_street || "");
  const [customerAddressNumber, setCustomerAddressNumber] = useState(invoice?.customer_address_number || "");
  const [customerAddressPostalCode, setCustomerAddressPostalCode] = useState(invoice?.customer_address_postal_code || "");
  const [customerAddressCity, setCustomerAddressCity] = useState(invoice?.customer_address_city || "");
  const [customerAddressProvince, setCustomerAddressProvince] = useState(invoice?.customer_address_province || "");
  const [customerAddressCountry, setCustomerAddressCountry] = useState(invoice?.customer_address_country || "España");
  const [amount, setAmount] = useState(invoice?.amount?.toString() || "");
  const [currency, setCurrency] = useState<CurrencyCode>(invoice?.currency || "EUR");
  const [ivaRate, setIvaRate] = useState(invoice?.iva_rate?.toString() || "10");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | "">(invoice?.payment_method || "");
  const [accountImageUrl, setAccountImageUrl] = useState(invoice?.account_image_url || "");
  const [invoiceDate, setInvoiceDate] = useState(invoice?.invoice_date || new Date().toISOString().split("T")[0]);
  const [dueDate, setDueDate] = useState(invoice?.due_date || "");
  const [paymentTerms, setPaymentTerms] = useState(() => {
    if (invoice?.due_date && invoice?.invoice_date) {
      const invoiceDateObj = new Date(invoice.invoice_date);
      const dueDateObj = new Date(invoice.due_date);
      const diffTime = dueDateObj.getTime() - invoiceDateObj.getTime();
      const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
      return diffDays >= 0 ? diffDays.toString() : "30";
    }
    return "30";
  });
  const [paymentDate, setPaymentDate] = useState(invoice?.payment_date || "");
  const [status, setStatus] = useState<InvoiceStatus>(invoice?.status || "borrador");
  const [isReservation, setIsReservation] = useState(invoice?.is_reservation || false);
  const [reservationId, setReservationId] = useState<number | undefined>(invoice?.reservation_id);
  const [reservationDate, setReservationDate] = useState(invoice?.reservation_date || "");
  const [reservationCustomerName, setReservationCustomerName] = useState(invoice?.reservation_customer_name || "");
  const [reservationPartySize, setReservationPartySize] = useState<number | undefined>(invoice?.reservation_party_size);
  const [invoiceNumber, setInvoiceNumber] = useState(invoice?.invoice_number || "");
  const [overrideInvoiceNumber, setOverrideInvoiceNumber] = useState(!!invoice?.invoice_number);
  const [internalNotes, setInternalNotes] = useState(invoice?.internal_notes || "");
  const [pdfTemplate, setPdfTemplate] = useState<PdfTemplateType | "">(invoice?.pdf_template || "");
  const [category, setCategory] = useState<InvoiceCategory | "">(invoice?.category || "");
  const [tags, setTags] = useState<string[]>(invoice?.tags || []);
  const [newTag, setNewTag] = useState("");
  // Discount state
  const [discountType, setDiscountType] = useState<"percentage" | "fixed" | "">(invoice?.discount_type || "");
  const [discountValue, setDiscountValue] = useState(invoice?.discount_value?.toString() || "");
  const [discountReason, setDiscountReason] = useState(invoice?.discount_reason || "");
  // Deposit tracking state
  const [depositType, setDepositType] = useState<InvoiceDepositType | "">(invoice?.deposit_type || "");
  const [depositAmount, setDepositAmount] = useState(invoice?.deposit_amount?.toString() || "");
  const [finalInvoiceId, setFinalInvoiceId] = useState<number | undefined>(invoice?.final_invoice_id ?? undefined);

  // Line items state
  const [useLineItems, setUseLineItems] = useState(!!invoice?.line_items?.length || false);
  const [lineItems, setLineItems] = useState<InvoiceLineItem[]>(invoice?.line_items || []);
  const lineItemsRef = useRef<LineItemsRef>(null);

  // Track if fields have been touched (for showing errors)
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  // Validation errors for each field
  const errors = useMemo(() => ({
    customerName: validateRequired(customerName, "El nombre"),
    customerEmail: validateEmail(customerEmail),
    customerDniCif: validateDniCif(customerDniCif, useDni),
    customerPhone: validatePhone(customerPhone),
    customerAddressPostalCode: validatePostalCode(customerAddressPostalCode),
    amount: useLineItems ? null : validateAmount(amount),
    lineItems: useLineItems && lineItems.length === 0 ? "Añade al menos una linea de factura" : null,
  }), [customerName, customerEmail, customerDniCif, useDni, customerPhone, customerAddressPostalCode, amount, useLineItems, lineItems]);

  // Check if field has an error (only after being touched)
  const hasError = useCallback((fieldName: string): boolean => {
    const error = errors[fieldName as keyof typeof errors];
    return touched[fieldName] && error !== null && error !== undefined;
  }, [errors, touched]);

  // Get error message for field
  const getError = useCallback((fieldName: string): string | null => {
    return errors[fieldName as keyof typeof errors] || null;
  }, [errors]);

  // Handle field blur (mark as touched)
  const handleBlur = useCallback((fieldName: string) => {
    setTouched(prev => ({ ...prev, [fieldName]: true }));
  }, []);

  // Calculate totals from line items or single amount
  const calculatedTotals = useMemo(() => {
    // Calculate discount amount
    const discountTypeValue = discountType || null;
    const discountValueNum = parseFloat(discountValue) || 0;
    let discountAmountValue = 0;

    if (useLineItems && lineItems.length > 0) {
      let subtotal = 0;
      let totalIva = 0;
      let total = 0;
      let weightedIvaRate = 0;

      lineItems.forEach((item) => {
        const itemBase = item.quantity * item.unit_price;
        subtotal += itemBase;
        totalIva += item.iva_amount;
        total += item.total;
        // Calculate weighted IVA rate
        if (itemBase > 0) {
          weightedIvaRate += (item.iva_rate * itemBase);
        }
      });

      // Apply discount
      if (discountTypeValue === "percentage") {
        discountAmountValue = subtotal * (discountValueNum / 100);
      } else if (discountTypeValue === "fixed") {
        discountAmountValue = Math.min(discountValueNum, subtotal);
      }

      const baseAfterDiscount = subtotal - discountAmountValue;
      // Recalculate IVA based on discounted amount
      const ivaRateForDiscounted = subtotal > 0 ? weightedIvaRate / subtotal : 0;
      const ivaAmountValue = baseAfterDiscount * ivaRateForDiscounted;
      const totalAfterDiscount = baseAfterDiscount + ivaAmountValue;

      return {
        baseAmount: subtotal,
        discountAmount: discountAmountValue,
        ivaAmount: ivaAmountValue,
        totalAmount: totalAfterDiscount,
        ivaRate: subtotal > 0 ? weightedIvaRate / subtotal : 0,
      };
    } else {
      const baseAmountValue = parseFloat(amount) || 0;
      const ivaRateValue = parseFloat(ivaRate) || 0;

      // Apply discount
      if (discountTypeValue === "percentage") {
        discountAmountValue = baseAmountValue * (discountValueNum / 100);
      } else if (discountTypeValue === "fixed") {
        discountAmountValue = Math.min(discountValueNum, baseAmountValue);
      }

      const baseAfterDiscount = baseAmountValue - discountAmountValue;
      const ivaAmountValue = baseAfterDiscount * (ivaRateValue / 100);
      const totalAfterDiscount = baseAfterDiscount + ivaAmountValue;

      return {
        baseAmount: baseAmountValue,
        discountAmount: discountAmountValue,
        ivaAmount: ivaAmountValue,
        totalAmount: totalAfterDiscount,
        ivaRate: ivaRateValue,
      };
    }
  }, [useLineItems, lineItems, amount, ivaRate, discountType, discountValue]);

  const baseAmount = calculatedTotals.baseAmount;
  const discountAmount = calculatedTotals.discountAmount || 0;
  const ivaRateValue = calculatedTotals.ivaRate;
  const ivaAmount = calculatedTotals.ivaAmount;
  const totalAmount = calculatedTotals.totalAmount;

  // Get currency symbol
  const currencySymbol = CURRENCY_SYMBOLS[currency] || "€";

  // Calculate exchange rate and converted amount (to EUR for storage)
  const exchangeRate = currency === "EUR" ? 1 : DEFAULT_CURRENCY_RATES[currency];
  const amountInEUR = currency === "EUR" ? baseAmount : convertCurrency(baseAmount, currency, "EUR");

  // Auto-save debounce
  const formData = useMemo(
    () => ({
      invoice_number: overrideInvoiceNumber ? invoiceNumber || undefined : undefined,
      customer_name: customerName,
      customer_surname: customerSurname || undefined,
      customer_email: customerEmail,
      customer_dni_cif: useDni ? customerDniCif || undefined : undefined,
      customer_phone: customerPhone || undefined,
      customer_address_street: customerAddressStreet || undefined,
      customer_address_number: customerAddressNumber || undefined,
      customer_address_postal_code: customerAddressPostalCode || undefined,
      customer_address_city: customerAddressCity || undefined,
      customer_address_province: customerAddressProvince || undefined,
      customer_address_country: customerAddressCountry || undefined,
      amount: amountInEUR,
      currency: currency,
      original_amount: baseAmount,
      original_currency: currency,
      exchange_rate: exchangeRate,
      iva_rate: ivaRateValue,
      iva_amount: ivaAmount,
      total: totalAmount,
      payment_method: paymentMethod || undefined,
      account_image_url: accountImageUrl || undefined,
      invoice_date: invoiceDate,
      due_date: dueDate || undefined,
      payment_date: paymentDate || undefined,
      status,
      is_reservation: isReservation,
      reservation_id: reservationId,
      reservation_date: reservationDate || undefined,
      reservation_customer_name: reservationCustomerName || undefined,
      reservation_party_size: reservationPartySize,
      internal_notes: internalNotes || undefined,
      pdf_template: pdfTemplate || undefined,
      category: category || undefined,
      tags: tags.length > 0 ? tags : undefined,
      // Line items - only include if using line items mode
      line_items: useLineItems && lineItems.length > 0
        ? lineItems.map(item => ({
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          iva_rate: item.iva_rate,
        }))
        : undefined,
      // Discount fields
      discount_type: discountType || undefined,
      discount_value: discountType && discountValue ? parseFloat(discountValue) : undefined,
      discount_amount: discountAmount > 0 ? discountAmount : undefined,
      discount_reason: discountReason || undefined,
      // Deposit tracking fields
      deposit_type: depositType || undefined,
      deposit_amount: depositType && depositAmount ? parseFloat(depositAmount) : undefined,
      remaining_balance: depositType && depositAmount && totalAmount ? totalAmount - parseFloat(depositAmount) : undefined,
      final_invoice_id: finalInvoiceId,
    }),
    [
      customerName,
      customerSurname,
      customerEmail,
      useDni,
      customerDniCif,
      customerPhone,
      customerAddressStreet,
      customerAddressNumber,
      customerAddressPostalCode,
      customerAddressCity,
      customerAddressProvince,
      customerAddressCountry,
      amount,
      currency,
      ivaRate,
      ivaRateValue,
      ivaAmount,
      totalAmount,
      paymentMethod,
      accountImageUrl,
      invoiceDate,
      dueDate,
      paymentTerms,
      paymentDate,
      status,
      isReservation,
      reservationId,
      reservationDate,
      reservationCustomerName,
      reservationPartySize,
      invoiceNumber,
      overrideInvoiceNumber,
      pdfTemplate,
      useLineItems,
      lineItems,
      discountType,
      discountValue,
      discountReason,
      discountAmount,
      depositType,
      depositAmount,
      finalInvoiceId,
      totalAmount,
    ],
  );

  const debouncedFormData = useDebounce(formData, 2000);

  // Track dirty state - compare current form data with initial invoice data
  useEffect(() => {
    if (!invoice) {
      setIsDirty(false);
      return;
    }

    // Check if form has been modified from initial values
    const hasChanges =
      customerName !== (invoice.customer_name || "") ||
      customerSurname !== (invoice.customer_surname || "") ||
      customerEmail !== (invoice.customer_email || "") ||
      (useDni ? customerDniCif : "") !== (invoice.customer_dni_cif || "") ||
      customerPhone !== (invoice.customer_phone || "") ||
      customerAddressStreet !== (invoice.customer_address_street || "") ||
      customerAddressNumber !== (invoice.customer_address_number || "") ||
      customerAddressPostalCode !== (invoice.customer_address_postal_code || "") ||
      customerAddressCity !== (invoice.customer_address_city || "") ||
      customerAddressProvince !== (invoice.customer_address_province || "") ||
      customerAddressCountry !== (invoice.customer_address_country || "España") ||
      amount !== (invoice.amount?.toString() || "") ||
      ivaRate !== (invoice.iva_rate?.toString() || "10") ||
      paymentMethod !== (invoice.payment_method || "") ||
      accountImageUrl !== (invoice.account_image_url || "") ||
      invoiceDate !== (invoice.invoice_date || "") ||
      paymentDate !== (invoice.payment_date || "") ||
      status !== (invoice.status || "borrador") ||
      isReservation !== (invoice.is_reservation || false) ||
      reservationId !== invoice.reservation_id ||
      reservationDate !== (invoice.reservation_date || "") ||
      reservationCustomerName !== (invoice.reservation_customer_name || "") ||
      reservationPartySize !== invoice.reservation_party_size ||
      invoiceNumber !== (invoice.invoice_number || "") ||
      overrideInvoiceNumber !== !!invoice.invoice_number ||
      internalNotes !== (invoice.internal_notes || "") ||
      pdfTemplate !== (invoice?.pdf_template || "") ||
      category !== (invoice?.category || "") ||
      JSON.stringify(tags) !== JSON.stringify(invoice?.tags || []) ||
      discountType !== (invoice?.discount_type || "") ||
      discountValue !== (invoice?.discount_value?.toString() || "") ||
      discountReason !== (invoice?.discount_reason || "") ||
      depositType !== (invoice?.deposit_type || "") ||
      depositAmount !== (invoice?.deposit_amount?.toString() || "") ||
      finalInvoiceId !== invoice?.final_invoice_id;

    setIsDirty(hasChanges);
    if (hasChanges) {
      setAutoSaveStatus("idle");
    }
  }, [
    invoice,
    customerName,
    customerSurname,
    customerEmail,
    useDni,
    customerDniCif,
    customerPhone,
    customerAddressStreet,
    customerAddressNumber,
    customerAddressPostalCode,
    customerAddressCity,
    customerAddressProvince,
    customerAddressCountry,
    amount,
    ivaRate,
    paymentMethod,
    accountImageUrl,
    invoiceDate,
    paymentDate,
    status,
    isReservation,
    reservationId,
    reservationDate,
    reservationCustomerName,
    reservationPartySize,
    invoiceNumber,
    overrideInvoiceNumber,
    internalNotes,
    pdfTemplate,
    category,
    tags,
    discountType,
    discountValue,
    discountReason,
    depositType,
    depositAmount,
    finalInvoiceId,
  ]);

  // Auto-save effect - save every 30 seconds when form is dirty and we have an API
  useEffect(() => {
    // Only auto-save for existing invoices (not new ones)
    if (!invoice || !api || !invoice.id) return;

    // Clear any existing timer
    if (autoSaveTimerRef.current) {
      clearInterval(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }

    // Don't set up auto-save if not dirty
    if (!isDirty) return;

    // Set up interval to auto-save every 30 seconds
    autoSaveTimerRef.current = setInterval(async () => {
      // Check if still dirty and has API
      if (!api || !invoice?.id || !isDirty) return;

      // Skip if already saving
      if (autoSaveStatus === "saving") return;

      // Skip if data hasn't changed since last save
      if (JSON.stringify(debouncedFormData) === JSON.stringify(lastSavedDataRef.current)) return;

      setAutoSaveStatus("saving");

      try {
        const input: InvoiceInput = {
          ...debouncedFormData,
          status: invoice.status || "borrador",
        };

        const res = await api.invoices.update(invoice.id, input);

        if (res.success) {
          setAutoSaveStatus("saved");
          lastSavedDataRef.current = debouncedFormData;

          // Reset to idle after 3 seconds
          setTimeout(() => {
            setAutoSaveStatus((prev) => (prev === "saved" ? "idle" : prev));
          }, 3000);
        } else {
          setAutoSaveStatus("error");
          pushToast({
            kind: "error",
            title: "Error de auto-guardado",
            message: res.message || "No se pudo guardar automaticamente",
          });
        }
      } catch (err) {
        setAutoSaveStatus("error");
        pushToast({
          kind: "error",
          title: "Error de auto-guardado",
          message: err instanceof Error ? err.message : "Error al guardar automaticamente",
        });
      }
    }, 30000); // 30 seconds

    // Cleanup on unmount or when dependencies change
    return () => {
      if (autoSaveTimerRef.current) {
        clearInterval(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }
    };
  }, [invoice, api, isDirty, debouncedFormData, autoSaveStatus, pushToast]);

  // Handle fill from reservation
  const handleFillFromReservation = useCallback((reservation: ReservationSearchResult) => {
    setCustomerName(reservation.customer_name.split(" ")[0] || "");
    setCustomerSurname(reservation.customer_name.split(" ").slice(1).join(" ") || "");
    setCustomerEmail(reservation.contact_email);
    setCustomerPhone(reservation.contact_phone);
    setReservationId(reservation.id);
    setReservationDate(reservation.reservation_date);
    setReservationCustomerName(reservation.customer_name);
    setReservationPartySize(reservation.party_size);
    setIsReservation(true);
    setInvoiceDate(reservation.reservation_date);
    // Auto-calculate due date based on payment terms
    const invoiceDateObj = new Date(reservation.reservation_date);
    const dueDateObj = new Date(invoiceDateObj);
    dueDateObj.setDate(dueDateObj.getDate() + parseInt(paymentTerms || "30"));
    setDueDate(dueDateObj.toISOString().split("T")[0]);
    setPaymentDate(new Date().toISOString().split("T")[0]);
    setShowReservationModal(false);
    setReservationSelectionMode("full");
    setPendingReservationSelection(false);
    pushToast({ kind: "info", title: "Datos filled", message: "Datos filled desde la reserva" });
  }, [pushToast, paymentTerms]);

  const handleFillFromReservationOnlyBooking = useCallback((reservation: ReservationSearchResult) => {
    setReservationId(reservation.id);
    setReservationDate(reservation.reservation_date);
    setReservationCustomerName(reservation.customer_name);
    setReservationPartySize(reservation.party_size);
    setIsReservation(true);
    setPendingReservationSelection(false);
    setReservationSelectionMode("full");
    setShowReservationModal(false);
    pushToast({ kind: "info", title: "Reserva asignada", message: "Reserva seleccionada para esta factura" });
  }, [pushToast]);

  const handleCloseReservationModal = useCallback(() => {
    setShowReservationModal(false);
    if (reservationSelectionMode === "booking" && pendingReservationSelection) {
      setIsReservation(false);
      setReservationId(undefined);
      setReservationDate("");
      setReservationCustomerName("");
      setReservationPartySize(undefined);
      setPendingReservationSelection(false);
      setReservationSelectionMode("full");
    }
  }, [pendingReservationSelection, reservationSelectionMode]);

  const handleReservationToggle = useCallback((checked: boolean) => {
    if (checked) {
      setReservationSelectionMode("booking");
      setPendingReservationSelection(true);
      setIsReservation(true);
      setShowReservationModal(true);
      return;
    }

    setIsReservation(false);
    setReservationId(undefined);
    setReservationDate("");
    setReservationCustomerName("");
    setReservationPartySize(undefined);
    setReservationSelectionMode("full");
    setPendingReservationSelection(false);
  }, []);

  const handleOpenReservationFromTemplate = useCallback(() => {
    setReservationSelectionMode("full");
    setPendingReservationSelection(false);
    setShowReservationModal(true);
  }, []);

  // Effect to auto-calculate due date when invoice date or payment terms change
  useEffect(() => {
    if (invoiceDate && paymentTerms) {
      const date = new Date(invoiceDate);
      date.setDate(date.getDate() + parseInt(paymentTerms));
      setDueDate(date.toISOString().split("T")[0]);
    }
  }, [invoiceDate, paymentTerms]);

  // Handle fill from template
  const handleFillFromTemplate = useCallback((template: InvoiceTemplate) => {
    setCustomerName(template.customer_name || "");
    setCustomerSurname(template.customer_surname || "");
    setCustomerEmail(template.customer_email || "");
    setCustomerDniCif(template.customer_dni_cif || "");
    setCustomerPhone(template.customer_phone || "");
    setCustomerAddressStreet(template.customer_address_street || "");
    setCustomerAddressNumber(template.customer_address_number || "");
    setCustomerAddressPostalCode(template.customer_address_postal_code || "");
    setCustomerAddressCity(template.customer_address_city || "");
    setCustomerAddressProvince(template.customer_address_province || "");
    setCustomerAddressCountry(template.customer_address_country || "España");
    setAmount(template.default_amount?.toString() || "");
    setIvaRate(template.default_iva_rate?.toString() || "10");
    setPaymentMethod(template.default_payment_method || "");
    setShowTemplateModal(false);
    pushToast({ kind: "info", title: "Plantilla aplicada", message: `Datos cargados desde "${template.name}"` });
  }, [pushToast]);

  // Handle image upload
  const handleImageUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setUploadingImage(true);
      try {
        let url: string;

        // If image is larger than 30KB, compress to WebP at 30KB
        if (file.size > 30 * 1024) {
          url = await compressImageToWebP(file, 30);
        } else {
          // For smaller images, just use the original as a data URL
          url = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(file);
          });
        }

        setAccountImageUrl(url);
        pushToast({ kind: "success", title: "Imagen cargada", message: "La imagen se ha procesado y cargado correctamente" });
      } catch (err) {
        pushToast({ kind: "error", title: "Error", message: "Error al cargar la imagen" });
      } finally {
        setUploadingImage(false);
      }
    },
    [pushToast],
  );

  // Handle remove image
  const handleRemoveImage = useCallback(() => {
    setAccountImageUrl("");
  }, []);

  // Handle save draft
  const handleSaveDraft = useCallback(() => {
    const input: InvoiceInput = {
      ...formData,
      status: "borrador",
    };
    onSave(input, false);
  }, [formData, onSave]);

  // Handle save pending
  const handleSavePending = useCallback(() => {
    const input: InvoiceInput = {
      ...formData,
      status: "pendiente",
    };
    onSave(input, false);
  }, [formData, onSave]);

  // Handle send
  const handleSend = useCallback(() => {
    const input: InvoiceInput = {
      ...formData,
      status: "enviada",
    };
    onSave(input, true);
  }, [formData, onSave]);

  // Expose save function via ref
  useImperativeHandle(ref, () => ({
    save: (shouldSend: boolean = false) => {
      const input: InvoiceInput = {
        ...formData,
        status: shouldSend ? "enviada" : "borrador",
      };
      onSave(input, shouldSend);
    },
  }), [formData, onSave]);

  // Handle preview - first save as draft, then show preview
  const handlePreview = useCallback(() => {
    // First save as draft to get an ID for the PDF
    const input: InvoiceInput = {
      ...formData,
      status: "borrador",
    };
    // Save without sending, then show preview
    onSave(input, false);
    // Show a toast to inform the user
    pushToast({ kind: "info", title: "Guardando factura", message: "La factura se esta guardando para generar la vista previa" });
    // Show preview modal - it will handle the case where the invoice hasn't been saved yet
    setShowPreviewModal(true);
  }, [formData, onSave, pushToast]);

  // Validate all required fields - form is valid only if all validation errors are null
  const isValid = useMemo(() => {
    const hasLineItems = useLineItems && lineItems.length > 0 && lineItems.every(item => item.description.trim());
    return (
      !errors.customerName &&
      !errors.customerEmail &&
      !errors.amount &&
      !errors.lineItems &&
      invoiceDate &&
      (useLineItems ? hasLineItems : amount)
    );
  }, [errors, invoiceDate, amount, useLineItems, lineItems]);

  return (
    <div className="bo-invoiceForm" style={{ position: "relative" }}>
      {/* Loading overlay for form submission */}
      {isSubmitting && (
        <div className="bo-formLoadingOverlay" role="status" aria-live="polite">
          <div className="bo-spinner bo-spinner--glow" />
          <span className="bo-formLoadingOverlayText">Guardando factura...</span>
          <span className="sr-only">Por favor, espere mientras se guarda la factura</span>
        </div>
      )}
      <div className="bo-invoiceFormHeader">
        <div className="bo-invoiceFormHeaderMain">
          <h2 className="bo-invoiceFormTitle">{invoice ? "Editar Factura" : "Nueva Factura"}</h2>

          {/* Auto-save status indicator - only show for existing invoices */}
          {invoice && invoice.id && (
            <div className="bo-invoiceFormAutoSave">
              {autoSaveStatus === "saving" && (
                <span className="bo-invoiceFormAutoSave--saving">
                  <Loader2 size={14} className="bo-invoiceFormAutoSaveIcon bo-invoiceFormAutoSaveIcon--spinning" />
                  Guardando...
                </span>
              )}
              {autoSaveStatus === "saved" && (
                <span className="bo-invoiceFormAutoSave--saved">
                  <Check size={14} className="bo-invoiceFormAutoSaveIcon" />
                  Guardado
                </span>
              )}
              {autoSaveStatus === "error" && (
                <span className="bo-invoiceFormAutoSave--error">
                  <AlertCircle size={14} className="bo-invoiceFormAutoSaveIcon" />
                  Error al guardar
                </span>
              )}
              {autoSaveStatus === "idle" && isDirty && (
                <span className="bo-invoiceFormAutoSave--pending">
                  Pendiente de guardar
                </span>
              )}
            </div>
          )}
        </div>

        <div className="bo-invoiceFormHeaderActions">
          <button
            type="button"
            className="inline-flex h-8 items-center justify-center gap-2 rounded-lg border border-white/[0.06] bg-transparent text-foreground text-xs font-bold transition-all hover:bg-white/[0.04]"
            onClick={handleOpenReservationFromTemplate}
          >
            <Search size={16} />
            Rellenar desde reserva
          </button>
          <button
            type="button"
            className="inline-flex h-8 items-center justify-center gap-2 rounded-lg border border-white/[0.06] bg-transparent text-foreground text-xs font-bold transition-all hover:bg-white/[0.04]"
            onClick={() => setShowTemplateModal(true)}
          >
            <FileText size={16} />
            Crear desde plantilla
          </button>
        </div>
      </div>

      <div className="bo-invoiceFormGrid">
        <div className="bo-invoiceFormTopGrid">
          {/* Customer info section */}
          <div className="mb-4">
            <h3 className="text-base font-semibold text-foreground mb-3">Datos del cliente</h3>

            <div className="grid gap-4">
              <label className={`flex flex-col gap-1 ${hasError("customerName") ? "border-red-400 rounded-xl border p-1" : ""}`}>
                <span className="text-sm font-semibold text-muted-foreground">Nombre *</span>
                <input
                  className={`h-10 px-3 rounded-xl border border-white/[0.06] bg-white/[0.03] text-foreground outline-none transition-colors hover:border-white/[0.09] hover:bg-white/[0.05] focus:border-accent focus:bg-white/[0.05] ${hasError("customerName") ? "border-red-400" : ""}`}
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  onBlur={() => handleBlur("customerName")}
                  required
                  aria-describedby={hasError("customerName") ? "customerName-error" : undefined}
                  aria-invalid={hasError("customerName")}
                />
                {hasError("customerName") && (
                  <span className="text-xs text-destructive mt-2" id="customerName-error" role="alert">
                    {getError("customerName")}
                  </span>
                )}
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-semibold text-muted-foreground">Apellidos</span>
                <input
                  className="h-10 rounded-md border border bg-white/5 text-foreground px-3 outline-none min-w-0 transition-colors"
                  type="text"
                  value={customerSurname}
                  onChange={(e) => setCustomerSurname(e.target.value)}
                />
              </label>
            </div>

            <div className="grid gap-4">
              <label className={`flex flex-col gap-1 ${hasError("customerEmail") ? "border-red-400 rounded-xl border p-1" : ""}`}>
                <span className="text-sm font-semibold text-muted-foreground">Email *</span>
                <input
                  className={`h-10 px-3 rounded-xl border border-white/[0.06] bg-white/[0.03] text-foreground outline-none transition-colors hover:border-white/[0.09] hover:bg-white/[0.05] focus:border-accent focus:bg-white/[0.05] ${hasError("customerEmail") ? "border-red-400" : ""}`}
                  type="email"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  onBlur={() => handleBlur("customerEmail")}
                  required
                  aria-describedby={hasError("customerEmail") ? "customerEmail-error" : undefined}
                  aria-invalid={hasError("customerEmail")}
                />
                {hasError("customerEmail") && (
                  <span className="text-xs text-destructive mt-2" id="customerEmail-error" role="alert">
                    {getError("customerEmail")}
                  </span>
                )}
              </label>

              <label className={`flex flex-col gap-1 ${hasError("customerPhone") ? "border-red-400 rounded-xl border p-1" : ""}`}>
                <span className="text-sm font-semibold text-muted-foreground">Teléfono</span>
                <input
                  className={`h-10 px-3 rounded-xl border border-white/[0.06] bg-white/[0.03] text-foreground outline-none transition-colors hover:border-white/[0.09] hover:bg-white/[0.05] focus:border-accent focus:bg-white/[0.05] ${hasError("customerPhone") ? "border-red-400" : ""}`}
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  onBlur={() => handleBlur("customerPhone")}
                  aria-describedby={hasError("customerPhone") ? "customerPhone-error" : undefined}
                  aria-invalid={hasError("customerPhone")}
                />
                {hasError("customerPhone") && (
                  <span className="text-xs text-destructive mt-2" id="customerPhone-error" role="alert">
                    {getError("customerPhone")}
                  </span>
                )}
              </label>
            </div>

            <div className="grid gap-4 bo-invoiceFormRow--dni">
              <div className="flex flex-row items-center gap-3">
                <span className="text-sm font-semibold text-muted-foreground">CIF</span>
                <Switch checked={useDni} onCheckedChange={setUseDni} />
                <span className="text-sm font-semibold text-muted-foreground">DNI</span>
              </div>

              <label className={`flex flex-col gap-1 ${hasError("customerDniCif") ? "border-red-400 rounded-xl border p-1" : ""}`}>
                <span className="text-sm font-semibold text-muted-foreground">{useDni ? "DNI" : "CIF"}</span>
                <input
                  className={`h-10 px-3 rounded-xl border border-white/[0.06] bg-white/[0.03] text-foreground outline-none transition-colors hover:border-white/[0.09] hover:bg-white/[0.05] focus:border-accent focus:bg-white/[0.05] ${hasError("customerDniCif") ? "border-red-400" : ""}`}
                  type="text"
                  value={customerDniCif}
                  onChange={(e) => setCustomerDniCif(e.target.value)}
                  onBlur={() => handleBlur("customerDniCif")}
                  aria-describedby={hasError("customerDniCif") ? "customerDniCif-error" : undefined}
                  aria-invalid={hasError("customerDniCif")}
                />
                {hasError("customerDniCif") && (
                  <span className="text-xs text-destructive mt-2" id="customerDniCif-error" role="alert">
                    {getError("customerDniCif")}
                  </span>
                )}
              </label>
            </div>

            <div className="grid gap-4">
              <label className="grid gap-2">
                <span className="text-sm font-semibold text-muted-foreground">Calle</span>
                <input
                  className="h-10 rounded-md border border bg-white/5 text-foreground px-3 outline-none min-w-0 transition-colors"
                  type="text"
                  value={customerAddressStreet}
                  onChange={(e) => setCustomerAddressStreet(e.target.value)}
                />
              </label>

              <label className="grid gap-2 max-w-[100px]">
                <span className="text-sm font-semibold text-muted-foreground">Número</span>
                <input
                  className="h-10 rounded-md border border bg-white/5 text-foreground px-3 outline-none min-w-0 transition-colors"
                  type="text"
                  value={customerAddressNumber}
                  onChange={(e) => setCustomerAddressNumber(e.target.value)}
                />
              </label>
            </div>

            <div className="grid gap-4">
              <label className={`flex flex-col gap-1 ${hasError("customerAddressPostalCode") ? "border-red-400 rounded-xl border p-1" : ""}`}>
                <span className="text-sm font-semibold text-muted-foreground">Código Postal</span>
                <input
                  className={`h-10 px-3 rounded-xl border border-white/[0.06] bg-white/[0.03] text-foreground outline-none transition-colors hover:border-white/[0.09] hover:bg-white/[0.05] focus:border-accent focus:bg-white/[0.05] ${hasError("customerAddressPostalCode") ? "border-red-400" : ""}`}
                  type="text"
                  value={customerAddressPostalCode}
                  onChange={(e) => setCustomerAddressPostalCode(e.target.value)}
                  onBlur={() => handleBlur("customerAddressPostalCode")}
                  aria-describedby={hasError("customerAddressPostalCode") ? "customerAddressPostalCode-error" : undefined}
                  aria-invalid={hasError("customerAddressPostalCode")}
                />
                {hasError("customerAddressPostalCode") && (
                  <span className="text-xs text-destructive mt-2" id="customerAddressPostalCode-error" role="alert">
                    {getError("customerAddressPostalCode")}
                  </span>
                )}
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-semibold text-muted-foreground">Localidad</span>
                <input
                  className="h-10 rounded-md border border bg-white/5 text-foreground px-3 outline-none min-w-0 transition-colors"
                  type="text"
                  value={customerAddressCity}
                  onChange={(e) => setCustomerAddressCity(e.target.value)}
                />
              </label>
            </div>

            <div className="grid gap-4">
              <label className="grid gap-2">
                <span className="text-sm font-semibold text-muted-foreground">Provincia</span>
                <input
                  className="h-10 rounded-md border border bg-white/5 text-foreground px-3 outline-none min-w-0 transition-colors"
                  type="text"
                  value={customerAddressProvince}
                  onChange={(e) => setCustomerAddressProvince(e.target.value)}
                />
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-semibold text-muted-foreground">País</span>
                <input
                  className="h-10 rounded-md border border bg-white/5 text-foreground px-3 outline-none min-w-0 transition-colors"
                  type="text"
                  value={customerAddressCountry}
                  onChange={(e) => setCustomerAddressCountry(e.target.value)}
                />
              </label>
            </div>
          </div>

          {/* Invoice info section */}
          <div className="mb-4">
            <h3 className="text-base font-semibold text-foreground mb-3">Datos de la factura</h3>

            {/* Invoice Number Override */}
            <div className="grid gap-4 bo-invoiceFormRow--invoiceNumber">
              <div className="flex flex-row items-center gap-3">
                <Switch checked={overrideInvoiceNumber} onCheckedChange={setOverrideInvoiceNumber} />
                <span className="text-sm font-semibold text-muted-foreground">Personalizar numero de factura</span>
              </div>

              {overrideInvoiceNumber && (
                <label className="grid gap-2">
                  <span className="text-sm font-semibold text-muted-foreground">Numero de factura</span>
                  <input
                    className="h-10 rounded-md border border bg-white/5 text-foreground px-3 outline-none min-w-0 transition-colors"
                    type="text"
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                    placeholder="F-2024-0001"
                  />
                  <div className="text-mutedText">Deja este campo vacio para usar el numero automatico</div>
                </label>
              )}

              {!overrideInvoiceNumber && invoice && invoice.invoice_number && (
                <div className="grid gap-2">
                  <span className="text-sm font-semibold text-muted-foreground">Numero de factura (automatico)</span>
                  <div className="h-10 rounded-md border border bg-white/5 text-foreground px-3 outline-none min-w-0 transition-colors" style={{ backgroundColor: "var(--background-muted)", fontFamily: "monospace", fontWeight: 600 }}>
                    {invoice.invoice_number}
                  </div>
                </div>
              )}
            </div>

            <div className="grid gap-4">
              <div className="flex flex-row items-center gap-3">
                <Switch checked={useLineItems} onCheckedChange={setUseLineItems} />
                <span className="text-sm font-semibold text-muted-foreground"><List size={16} style={{ marginRight: 4, verticalAlign: 'middle' }} />Usar lineas de factura</span>
              </div>
            </div>

            {useLineItems ? (
              <div className="grid gap-4 bo-invoiceFormRow--lineItems">
                <LineItems
                  ref={lineItemsRef}
                  items={lineItems}
                  onChange={setLineItems}
                  currency={currency}
                  defaultIvaRate={parseFloat(ivaRate) || 10}
                  disabled={isSubmitting}
                />
                {errors.lineItems && (
                  <span className="text-xs text-destructive mt-2" role="alert">
                    {errors.lineItems}
                  </span>
                )}
              </div>
            ) : (
              <div className="grid gap-4">
                <label className={`flex flex-col gap-1 ${hasError("amount") ? "border-red-400 rounded-xl border p-1" : ""}`}>
                  <span className="text-sm font-semibold text-muted-foreground">Importe *</span>
                  <input
                    className={`h-10 px-3 rounded-xl border border-white/[0.06] bg-white/[0.03] text-foreground outline-none transition-colors hover:border-white/[0.09] hover:bg-white/[0.05] focus:border-accent focus:bg-white/[0.05] ${hasError("amount") ? "border-red-400" : ""}`}
                    type="number"
                    step="0.01"
                    min="0"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    onBlur={() => handleBlur("amount")}
                    required
                    aria-describedby={`iva-help${hasError("amount") ? " amount-error" : ""}`}
                    aria-invalid={hasError("amount")}
                  />
                  {hasError("amount") && (
                    <span className="text-xs text-destructive mt-2" id="amount-error" role="alert">
                      {getError("amount")}
                    </span>
                  )}
                </label>

                <label className="grid gap-2">
                  <span className="text-sm font-semibold text-muted-foreground">Moneda</span>
                  <Select
                    value={currency}
                    onChange={(value) => setCurrency(value as CurrencyCode)}
                    options={CURRENCY_OPTIONS}
                    ariaLabel="Moneda"
                  />
                </label>

                <label className="grid gap-2">
                  <span className="text-sm font-semibold text-muted-foreground">IVA (%)</span>
                  <input
                    className="h-10 rounded-md border border bg-white/5 text-foreground px-3 outline-none min-w-0 transition-colors"
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={ivaRate}
                    onChange={(e) => setIvaRate(e.target.value)}
                    aria-describedby="iva-help"
                  />
                </label>

                <label className="grid gap-2">
                  <span className="text-sm font-semibold text-muted-foreground">Método de pago</span>
                  <Select
                    value={paymentMethod}
                    onChange={(value) => setPaymentMethod(value as PaymentMethod | "")}
                    options={PAYMENT_METHOD_OPTIONS}
                    ariaLabel="Método de pago"
                  />
                </label>
              </div>
            )}

            {/* Discount Section */}
            <div className="grid gap-4">
              <label className="grid gap-2">
                <span className="text-sm font-semibold text-muted-foreground">Tipo de descuento</span>
                <Select
                  value={discountType}
                  onChange={(value) => setDiscountType(value as "percentage" | "fixed" | "")}
                  options={[
                    { value: "", label: "Sin descuento" },
                    { value: "percentage", label: "Porcentaje (%)" },
                    { value: "fixed", label: "Importe fijo" },
                  ]}
                  ariaLabel="Tipo de descuento"
                />
              </label>

              {discountType && (
                <>
                  <label className="grid gap-2">
                    <span className="text-sm font-semibold text-muted-foreground">{discountType === "percentage" ? "Porcentaje (%)" : "Importe"}</span>
                    <input
                      className="h-10 rounded-md border border bg-white/5 text-foreground px-3 outline-none min-w-0 transition-colors"
                      type="number"
                      step="0.01"
                      min="0"
                      value={discountValue}
                      onChange={(e) => setDiscountValue(e.target.value)}
                      placeholder={discountType === "percentage" ? "10" : "50.00"}
                    />
                  </label>

                  <label className="grid gap-2">
                    <span className="text-sm font-semibold text-muted-foreground">Razon del descuento</span>
                    <input
                      className="h-10 rounded-md border border bg-white/5 text-foreground px-3 outline-none min-w-0 transition-colors"
                      type="text"
                      value={discountReason}
                      onChange={(e) => setDiscountReason(e.target.value)}
                      placeholder="Descuento por..."
                    />
                  </label>
                </>
              )}
            </div>

            {/* IVA Summary */}
            <div className="grid gap-4 bo-invoiceFormRow--iva" id="iva-help">
              <div className="bo-ivaSummary">
                {discountAmount > 0 && (
                  <div className="flex justify-between items-center py-1">
                    <span className="text-xs text-muted-foreground">Descuento</span>
                    <span className="text-base font-semibold text-foreground" style={{ color: "var(--text-success)" }}>-{discountAmount.toFixed(2)} {currencySymbol}</span>
                  </div>
                )}
                <div className="flex justify-between items-center py-1">
                  <span className="text-xs text-muted-foreground">Base imponible</span>
                  <span className="text-base font-semibold text-foreground">{baseAmount.toFixed(2)} {currencySymbol}</span>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-xs text-muted-foreground">IVA ({ivaRateValue}%)</span>
                  <span className="text-base font-semibold text-foreground">{ivaAmount.toFixed(2)} {currencySymbol}</span>
                </div>
                <div className="bo-ivaSummaryItem bo-ivaSummaryItem--total">
                  <span className="text-xs text-muted-foreground">Total</span>
                  <span className="text-base font-semibold text-foreground">{totalAmount.toFixed(2)} {currencySymbol}</span>
                </div>
              </div>
            </div>

            {/* Payment Summary - Show only for existing invoices with payments */}
            {invoice && invoice.id && (invoice.paid_amount !== undefined || invoice.payments) && (
              <div className="grid gap-4 bo-invoiceFormRow--iva" id="payment-help">
                <div className="bo-ivaSummary">
                  <div className="flex justify-between items-center py-1">
                    <span className="text-xs text-muted-foreground">Importe total</span>
                    <span className="text-base font-semibold text-foreground">{(invoice.total || invoice.amount).toFixed(2)} {currencySymbol}</span>
                  </div>
                  <div className="flex justify-between items-center py-1">
                    <span className="text-xs text-muted-foreground">Pagado</span>
                    <span className="text-base font-semibold text-foreground" style={{ color: 'var(--text-success)' }}>{(invoice.paid_amount || 0).toFixed(2)} {currencySymbol}</span>
                  </div>
                  <div className="bo-ivaSummaryItem bo-ivaSummaryItem--total">
                    <span className="text-xs text-muted-foreground">Pendiente</span>
                    <span className="text-base font-semibold text-foreground" style={{ color: ((invoice.total || invoice.amount) - (invoice.paid_amount || 0) <= 0) ? 'var(--text-success)' : 'var(--text-warning)' }}>
                      {Math.max(0, ((invoice.total || invoice.amount) - (invoice.paid_amount || 0))).toFixed(2)} {currencySymbol}
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div className="grid gap-4 bo-invoiceFormRow--invoiceDates">
              <label className="grid gap-2">
                <span className="text-sm font-semibold text-muted-foreground">Fecha de factura *</span>
                <DatePicker value={invoiceDate} onChange={setInvoiceDate} />
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-semibold text-muted-foreground">Plazo de pago</span>
                <Select
                  value={paymentTerms}
                  onChange={(value) => setPaymentTerms(value)}
                  options={PAYMENT_TERMS_OPTIONS}
                  ariaLabel="Plazo de pago"
                />
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-semibold text-muted-foreground">Fecha de vencimiento</span>
                <DatePicker value={dueDate} onChange={setDueDate} />
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-semibold text-muted-foreground">Fecha de pago</span>
                <DatePicker value={paymentDate} onChange={setPaymentDate} />
              </label>
            </div>

          </div>

        </div>

        {/* Invoice state and settings */}
        <div className="mb-4">
          <h3 className="text-base font-semibold text-foreground mb-3">Estado y configuración</h3>

          <div className="grid gap-4">
            <label className="grid gap-2">
              <span className="text-sm font-semibold text-muted-foreground">Estado</span>
              <Select
                value={status}
                onChange={(value) => setStatus(value as InvoiceStatus)}
                options={STATUS_OPTIONS}
                ariaLabel="Estado"
              />
            </label>
          </div>

          <div className="grid gap-4">
            <label className="flex flex-row items-center gap-3">
              <Switch checked={isReservation} onCheckedChange={handleReservationToggle} />
              <span className="text-sm font-semibold text-muted-foreground">Es reserva</span>
            </label>
          </div>

          {isReservation && (
            <div className="grid gap-4 bo-invoiceFormRow--reservation">
              <label className="grid gap-2">
                <span className="text-sm font-semibold text-muted-foreground">Nombre reserva</span>
                <input className="h-10 rounded-md border border bg-white/5 text-foreground px-3 outline-none min-w-0 transition-colors" type="text" value={reservationCustomerName || ""} readOnly />
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-semibold text-muted-foreground">Fecha reserva</span>
                <DatePicker value={reservationDate} onChange={setReservationDate} />
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-semibold text-muted-foreground">Personas</span>
                <input
                  className="h-10 rounded-md border border bg-white/5 text-foreground px-3 outline-none min-w-0 transition-colors"
                  type="number"
                  min="1"
                  value={reservationPartySize || ""}
                  onChange={(e) => setReservationPartySize(parseInt(e.target.value) || undefined)}
                />
              </label>
            </div>
          )}

          {/* Image upload */}
          <div className="grid gap-4 bo-invoiceFormRow--image">
            <label className="grid gap-2">
              <span className="text-sm font-semibold text-muted-foreground">Imagen de la cuenta</span>
              <div className="bo-invoiceImageUpload">
                {accountImageUrl ? (
                  <div className="bo-invoiceImagePreview">
                    <img src={accountImageUrl} alt="Imagen de cuenta" />
                    <button
                      type="button"
                      className="bo-invoiceImageRemove"
                      onClick={handleRemoveImage}
                      aria-label="Eliminar imagen"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ) : (
                  <label className="bo-invoiceImageDrop">
                    <Upload size={24} />
                    <span>Subir imagen (se comprime a 30KB)</span>
                    <input type="file" accept="image/*" onChange={handleImageUpload} hidden />
                  </label>
                )}
              </div>
            </label>
          </div>

          {/* Internal notes */}
          <div className="grid gap-4 bo-invoiceFormRow--notes">
            <label className="grid gap-2">
              <span className="text-sm font-semibold text-muted-foreground">Notas internas</span>
              <span className="text-mutedText" style={{ marginBottom: "4px", display: "block" }}>
                Estas notas solo son visibles en el backoffice y no se incluyen en el PDF
              </span>
              <textarea
                className="min-h-[80px] rounded-md border border bg-white/5 text-foreground p-3 outline-none"
                value={internalNotes}
                onChange={(e) => setInternalNotes(e.target.value)}
                placeholder="Añade notas internas sobre esta factura..."
                rows={3}
              />
            </label>
          </div>

          {/* PDF Template Selector */}
          <div className="grid gap-4 bo-invoiceFormRow--pdfTemplate">
            <label className="grid gap-2">
              <span className="text-sm font-semibold text-muted-foreground">Plantilla PDF</span>
              <div className="bo-pdfTemplateOptions bo-pdfTemplateOptions--inline">
                {PDF_TEMPLATE_OPTIONS.map((template) => (
                  <label
                    key={template.value}
                    className={`bo-pdfTemplateCard bo-pdfTemplateCard--inline ${pdfTemplate === template.value ? "bo-pdfTemplateCard--selected" : ""}`}
                  >
                    <input
                      type="radio"
                      name="pdfTemplate"
                      value={template.value}
                      checked={pdfTemplate === template.value}
                      onChange={(e) => setPdfTemplate(e.target.value as PdfTemplateType)}
                      className="bo-pdfTemplateRadio"
                    />
                    <div className="bo-pdfTemplateCardContent">
                      <div className="bo-pdfTemplateCardTitle">{template.label}</div>
                    </div>
                  </label>
                ))}
              </div>
              <div className="text-mutedText" style={{ marginTop: "4px" }}>
                Selecciona el diseno del PDF. Si no se selecciona, se usara el diseno predeterminado del restaurante.
              </div>
            </label>
          </div>

          {/* Category and Tags */}
          <div className="grid gap-4 bo-invoiceFormRow--category">
            <label className="grid gap-2">
              <span className="text-sm font-semibold text-muted-foreground">Categoría</span>
              <Select
                value={category}
                onChange={(value) => setCategory(value as InvoiceCategory | "")}
                options={[
                  { value: "", label: "Seleccionar..." },
                  ...INVOICE_CATEGORY_OPTIONS,
                ]}
                ariaLabel="Categoría"
              />
            </label>
          </div>

          {/* Tags */}
          <div className="grid gap-4 bo-invoiceFormRow--tags">
            <label className="grid gap-2">
              <span className="text-sm font-semibold text-muted-foreground">Etiquetas</span>
              <div className="bo-tagsInput">
                <div className="bo-tagsList">
                  {tags.map((tag, index) => (
                    <span key={index} className="bo-tagItem">
                      {tag}
                      <button
                        type="button"
                        className="bo-tagRemove"
                        onClick={() => setTags(tags.filter((_, i) => i !== index))}
                        aria-label={`Eliminar etiqueta ${tag}`}
                      >
                        <XCircle size={14} />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="bo-tagInputWrapper">
                  <input
                    className="h-10 rounded-md border border bg-white/5 text-foreground px-3 outline-none min-w-0 transition-colors"
                    type="text"
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === ",") {
                        e.preventDefault();
                        if (newTag.trim()) {
                          if (!tags.includes(newTag.trim())) {
                            setTags([...tags, newTag.trim()]);
                          }
                          setNewTag("");
                        }
                      }
                    }}
                    placeholder="Añadir etiqueta..."
                  />
                  <button
                    type="button"
                    className="inline-flex h-8 items-center justify-center gap-2 rounded-lg border border-white/[0.06] bg-transparent text-foreground text-xs font-bold transition-all hover:bg-white/[0.04]"
                    onClick={() => {
                      if (newTag.trim() && !tags.includes(newTag.trim())) {
                        setTags([...tags, newTag.trim()]);
                        setNewTag("");
                      }
                    }}
                    disabled={!newTag.trim()}
                    title="Añadir etiqueta"
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </div>
            </label>
          </div>

          {/* Deposit Tracking Section */}
          <div className="grid gap-4 bo-invoiceFormRow--deposit">
            <label className="grid gap-2">
              <span className="text-sm font-semibold text-muted-foreground">Tipo de anticipo/seña</span>
              <Select
                value={depositType}
                onChange={(value) => setDepositType(value as InvoiceDepositType | "")}
                options={[
                  { value: "", label: "No es anticipo ni seña" },
                  ...INVOICE_DEPOSIT_TYPE_OPTIONS,
                ]}
                ariaLabel="Tipo de anticipo/seña"
              />
            </label>
          </div>

          {depositType && (
            <>
              <div className="grid gap-4 bo-invoiceFormRow--deposit">
                <label className="grid gap-2">
                  <span className="text-sm font-semibold text-muted-foreground">Importe del anticipo/seña</span>
                  <input
                    className="h-10 rounded-md border border bg-white/5 text-foreground px-3 outline-none min-w-0 transition-colors"
                    type="number"
                    step="0.01"
                    min="0"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                    placeholder="0.00"
                  />
                </label>

                {depositAmount && totalAmount > 0 && (
                  <label className="grid gap-2">
                    <span className="text-sm font-semibold text-muted-foreground">Pendiente</span>
                    <div className="h-10 rounded-md border border bg-white/5 text-foreground px-3 outline-none min-w-0 transition-colors" style={{ backgroundColor: "var(--background-muted)", fontWeight: 600 }}>
                      {formatPrice(Math.max(0, totalAmount - parseFloat(depositAmount || "0")), currency)}
                    </div>
                  </label>
                )}
              </div>

              <div className="grid gap-4 bo-invoiceFormRow--deposit">
                <div className="bo-ivaSummary">
                  <div className="flex justify-between items-center py-1">
                    <span className="text-xs text-muted-foreground">Importe total</span>
                    <span className="text-base font-semibold text-foreground">{formatPrice(totalAmount, currency)}</span>
                  </div>
                  {depositAmount && parseFloat(depositAmount) > 0 && (
                    <div className="flex justify-between items-center py-1">
                      <span className="text-xs text-muted-foreground">
                        {depositType === "advance" ? "Anticipo" : "Seña"}
                      </span>
                      <span className="text-base font-semibold text-foreground" style={{ color: "var(--text-success)" }}>
                        -{formatPrice(parseFloat(depositAmount), currency)}
                      </span>
                    </div>
                  )}
                  {depositAmount && parseFloat(depositAmount) > 0 && (
                    <div className="bo-ivaSummaryItem bo-ivaSummaryItem--total">
                      <span className="text-xs text-muted-foreground">Pendiente</span>
                      <span className="text-base font-semibold text-foreground">
                        {formatPrice(Math.max(0, totalAmount - parseFloat(depositAmount)), currency)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Comments section - only show for existing invoices */}
        {invoice && invoice.id && (
          <div className="bo-invoiceFormSection bo-invoiceFormSection--comments">
            <h3 className="text-base font-semibold text-foreground mb-3">
              <MessageSquare size={18} />
              Comentarios
            </h3>
            <CommentsPanel
              invoiceId={invoice.id}
              currentUserId={currentUserId || 0}
              api={api}
            />
          </div>
        )}
      </div>

      {/* Form actions */}
      <div className="bo-invoiceFormActions">
        <button type="button" className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-white/[0.09] bg-card-2 text-foreground text-sm font-bold transition-all hover:border-primary hover:bg-card-2/80 disabled:opacity-55 disabled:cursor-not-allowed" onClick={onCancel} disabled={isSubmitting} title="Cancelar (Esc)">
          Cancelar
        </button>
        <button type="button" className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-white/[0.09] bg-card-2 text-foreground text-sm font-bold transition-all hover:border-primary hover:bg-card-2/80 disabled:opacity-55 disabled:cursor-not-allowed" onClick={handleSaveDraft} disabled={!isValid || isSubmitting} title="Guardar borrador (Ctrl+S)">
          <Save size={16} />
          Guardar borrador
        </button>
        <button type="button" className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-white/[0.09] bg-card-2 text-foreground text-sm font-bold transition-all hover:border-primary hover:bg-card-2/80 disabled:opacity-55 disabled:cursor-not-allowed" onClick={handleSavePending} disabled={!isValid || isSubmitting} title="Guardar como pendiente (Ctrl+S)">
          <Save size={16} />
          Guardar como pendiente
        </button>
        <button type="button" className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-white/[0.09] bg-card-2 text-foreground text-sm font-bold transition-all hover:border-primary hover:bg-card-2/80 disabled:opacity-55 disabled:cursor-not-allowed" onClick={handlePreview} disabled={!isValid || isSubmitting} title="Ver vista previa del PDF">
          <Eye size={16} />
          Vista previa
        </button>
        <button type="button" className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[rgba(185,168,255,0.30)] bg-[rgba(185,168,255,0.16)] text-foreground text-sm font-bold transition-all hover:border-[rgba(185,168,255,0.40)] hover:bg-[rgba(185,168,255,0.24)] disabled:opacity-55 disabled:cursor-not-allowed mx-auto" onClick={handleSend} disabled={!isValid || isSubmitting} title="Enviar factura (Ctrl+S)">
          <Send size={16} />
          Enviar
        </button>
      </div>

      {/* Reservation modal */}
      {showReservationModal && (
        <FillFromReservationModal
          onClose={handleCloseReservationModal}
          onSelect={reservationSelectionMode === "booking" ? handleFillFromReservationOnlyBooking : handleFillFromReservation}
          searchReservations={searchReservations}
        />
      )}

      {/* Template modal */}
      {showTemplateModal && (
        <SelectTemplateModal
          open={showTemplateModal}
          onClose={() => setShowTemplateModal(false)}
          onSelect={handleFillFromTemplate}
        />
      )}

      {/* PDF Preview modal */}
      {showPreviewModal && (
        <InvoicePdfPreviewModal
          invoiceData={{
            id: invoice?.id,
            invoice_number: invoice?.invoice_number,
            customer_name: customerName,
            customer_surname: customerSurname,
            customer_email: customerEmail,
            customer_dni_cif: customerDniCif,
            customer_phone: customerPhone,
            customer_address_street: customerAddressStreet,
            customer_address_number: customerAddressNumber,
            customer_address_postal_code: customerAddressPostalCode,
            customer_address_city: customerAddressCity,
            customer_address_province: customerAddressProvince,
            customer_address_country: customerAddressCountry,
            amount: baseAmount,
            currency: currency,
            iva_rate: ivaRateValue,
            iva_amount: ivaAmount,
            total: totalAmount,
            payment_method: paymentMethod,
            invoice_date: invoiceDate,
            due_date: dueDate,
            payment_date: paymentDate,
            status: invoice?.status || "borrador",
            pdf_template: pdfTemplate,
            category: category,
            tags: tags,
            internal_notes: internalNotes,
            is_reservation: isReservation,
            reservation_id: reservationId,
            reservation_date: reservationDate,
            reservation_customer_name: reservationCustomerName,
            reservation_party_size: reservationPartySize,
          }}
          onClose={() => setShowPreviewModal(false)}
          onEdit={() => setShowPreviewModal(false)}
          onConfirmSend={() => {
            setShowPreviewModal(false);
            handleSend();
          }}
          isSending={isSubmitting}
          backendOrigin={backendOrigin}
        />
      )}
    </div>
  );
});
