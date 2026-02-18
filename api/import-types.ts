import type { InvoiceStatus, PaymentMethod, InvoiceCategory, CurrencyCode } from "./types";

// Import column mapping types
export type ImportColumnMapping = Record<string, string>;

export type ImportFieldType =
  | "customer_name"
  | "customer_surname"
  | "customer_email"
  | "customer_dni_cif"
  | "customer_phone"
  | "customer_address_street"
  | "customer_address_number"
  | "customer_address_postal_code"
  | "customer_address_city"
  | "customer_address_province"
  | "customer_address_country"
  | "amount"
  | "iva_rate"
  | "iva_amount"
  | "total"
  | "currency"
  | "invoice_number"
  | "invoice_date"
  | "payment_method"
  | "payment_date"
  | "status"
  | "is_reservation"
  | "reservation_date"
  | "reservation_customer_name"
  | "reservation_party_size"
  | "internal_notes"
  | "category"
  | "tags"
  | "ignore";

// Available fields that can be mapped
export const IMPORT_FIELD_OPTIONS: { value: ImportFieldType; label: string; required: boolean }[] = [
  { value: "customer_name", label: "Nombre del cliente", required: true },
  { value: "customer_surname", label: "Apellidos del cliente", required: false },
  { value: "customer_email", label: "Email del cliente", required: true },
  { value: "customer_dni_cif", label: "DNI/CIF", required: false },
  { value: "customer_phone", label: "Telefono", required: false },
  { value: "customer_address_street", label: "Calle", required: false },
  { value: "customer_address_number", label: "Numero", required: false },
  { value: "customer_address_postal_code", label: "Codigo postal", required: false },
  { value: "customer_address_city", label: "Ciudad", required: false },
  { value: "customer_address_province", label: "Provincia", required: false },
  { value: "customer_address_country", label: "Pais", required: false },
  { value: "amount", label: "Importe", required: true },
  { value: "iva_rate", label: "Tasa IVA (%)", required: false },
  { value: "iva_amount", label: "Importe IVA", required: false },
  { value: "total", label: "Total", required: false },
  { value: "currency", label: "Moneda", required: false },
  { value: "invoice_number", label: "Numero de factura", required: false },
  { value: "invoice_date", label: "Fecha de factura", required: true },
  { value: "payment_method", label: "Metodo de pago", required: false },
  { value: "payment_date", label: "Fecha de pago", required: false },
  { value: "status", label: "Estado", required: false },
  { value: "is_reservation", label: "Es reserva", required: false },
  { value: "reservation_date", label: "Fecha de reserva", required: false },
  { value: "reservation_customer_name", label: "Nombre en reserva", required: false },
  { value: "reservation_party_size", label: "Numero de personas", required: false },
  { value: "internal_notes", label: "Notas internas", required: false },
  { value: "category", label: "Categoria", required: false },
  { value: "tags", label: "Etiquetas", required: false },
  { value: "ignore", label: "Ignorar columna", required: false },
];

// Default column mappings suggestions based on common CSV headers
export const COLUMN_SUGGESTIONS: Record<string, ImportFieldType> = {
  "nombre": "customer_name",
  "nombre cliente": "customer_name",
  "cliente": "customer_name",
  "customer name": "customer_name",
  "name": "customer_name",
  "apellidos": "customer_surname",
  "surname": "customer_surname",
  "apellido": "customer_surname",
  "email": "customer_email",
  "e-mail": "customer_email",
  "correo": "customer_email",
  "dni": "customer_dni_cif",
  "cif": "customer_dni_cif",
  "nif": "customer_dni_cif",
  "telefono": "customer_phone",
  "phone": "customer_phone",
  "telephone": "customer_phone",
  "movil": "customer_phone",
  "mobile": "customer_phone",
  "direccion": "customer_address_street",
  "address": "customer_address_street",
  "street": "customer_address_street",
  "calle": "customer_address_street",
  "numero": "customer_address_number",
  "number": "customer_address_number",
  "cp": "customer_address_postal_code",
  "codigo postal": "customer_address_postal_code",
  "postal code": "customer_address_postal_code",
  "zip": "customer_address_postal_code",
  "ciudad": "customer_address_city",
  "city": "customer_address_city",
  "poblacion": "customer_address_city",
  "provincia": "customer_address_province",
  "province": "customer_address_province",
  "pais": "customer_address_country",
  "country": "customer_address_country",
  "importe": "amount",
  "amount": "amount",
  "total": "amount",
  "price": "amount",
  "precio": "amount",
  "iva": "iva_rate",
  "tax": "iva_rate",
  "iva_rate": "iva_rate",
  "tasa iva": "iva_rate",
  "iva amount": "iva_amount",
  "impuesto": "iva_amount",
  "tax amount": "iva_amount",
  "total": "total",
  "total amount": "total",
  "moneda": "currency",
  "currency": "currency",
  "factura": "invoice_number",
  "invoice": "invoice_number",
  "invoice number": "invoice_number",
  "numero factura": "invoice_number",
  "nº factura": "invoice_number",
  "fecha": "invoice_date",
  "date": "invoice_date",
  "fecha factura": "invoice_date",
  "invoice date": "invoice_date",
  "metodo pago": "payment_method",
  "payment method": "payment_method",
  "forma pago": "payment_method",
  "pago": "payment_method",
  "fecha pago": "payment_date",
  "payment date": "payment_date",
  "estado": "status",
  "status": "status",
  "estado factura": "status",
  "es reserva": "is_reservation",
  "is reservation": "is_reservation",
  "reserva": "is_reservation",
  "reservation": "is_reservation",
  "fecha reserva": "reservation_date",
  "reservation date": "reservation_date",
  "personas": "reservation_party_size",
  "party size": "reservation_party_size",
  "comensales": "reservation_party_size",
  "notas": "internal_notes",
  "notes": "internal_notes",
  "observaciones": "internal_notes",
  "comments": "internal_notes",
  "categoria": "category",
  "category": "category",
  "etiquetas": "tags",
  "tags": "tags",
  "label": "tags",
};

// Validation error types
export type ValidationError = {
  row: number;
  field: string;
  message: string;
  value: string;
};

export type ImportRowStatus = "pending" | "valid" | "error" | "imported";

export type ParsedInvoiceRow = {
  rowNumber: number;
  data: Record<string, string>;
  mappedData: Partial<import("./types").InvoiceInput>;
  status: ImportRowStatus;
  errors: ValidationError[];
};

// Import result types
export type ImportResult = {
  success: boolean;
  totalRows: number;
  successCount: number;
  errorCount: number;
  errors: ValidationError[];
  importedIds: number[];
  timestamp: string;
};

// Import history types
export type ImportHistoryEntry = {
  id: number;
  filename: string;
  total_rows: number;
  success_count: number;
  error_count: number;
  status: "completed" | "partial" | "failed";
  errors: ImportErrorDetail[];
  created_at: string;
  created_by?: string;
};

export type ImportErrorDetail = {
  row: number;
  field: string;
  message: string;
  value: string;
};

// Import settings
export type ImportSettings = {
  defaultStatus: InvoiceStatus;
  defaultCategory: InvoiceCategory;
  defaultCurrency: CurrencyCode;
  defaultPaymentMethod: PaymentMethod;
  defaultIvaRate: number;
  skipHeaderRow: boolean;
  dateFormat: string;
};

export const DEFAULT_IMPORT_SETTINGS: ImportSettings = {
  defaultStatus: "borrador",
  defaultCategory: "otros",
  defaultCurrency: "EUR",
  defaultPaymentMethod: "",
  defaultIvaRate: 21,
  skipHeaderRow: true,
  dateFormat: "YYYY-MM-DD",
};

// Status mapping for import
export const STATUS_MAPPING: Record<string, InvoiceStatus> = {
  "borrador": "borrador",
  "draft": "borrador",
  "borrador": "borrador",
  "solicitada": "solicitada",
  "requested": "solicitada",
  "pendiente": "pendiente",
  "pending": "pendiente",
  "pagada": "pagada",
  "paid": "pagada",
  "pagado": "pagada",
  "enviada": "enviada",
  "sent": "enviada",
  "enviado": "enviada",
};

// Payment method mapping
export const PAYMENT_METHOD_MAPPING: Record<string, PaymentMethod> = {
  "efectivo": "efectivo",
  "cash": "efectivo",
  "tarjeta": "tarjeta",
  "card": "tarjeta",
  "credit card": "tarjeta",
  "debito": "tarjeta",
  "debit": "tarjeta",
  "transferencia": "transferencia",
  "transfer": "transferencia",
  "wire": "transferencia",
  "bizum": "bizum",
  "cheque": "cheque",
  "check": "cheque",
};

// Category mapping
export const CATEGORY_MAPPING: Record<string, InvoiceCategory> = {
  "reserva": "reserva",
  "reservation": "reserva",
  "productos": "productos",
  "products": "productos",
  "producto": "productos",
  "servicios": "servicios",
  "services": "servicios",
  "servicio": "servicios",
  "otros": "otros",
  "others": "otros",
  "other": "otros",
};

// Currency mapping
export const CURRENCY_MAPPING: Record<string, CurrencyCode> = {
  "eur": "EUR",
  "euro": "EUR",
  "euros": "EUR",
  "usd": "USD",
  "dollar": "USD",
  "dollars": "USD",
  "gbp": "GBP",
  "pound": "GBP",
  "pounds": "GBP",
};

// Boolean mapping
export const BOOLEAN_MAPPING: Record<string, boolean> = {
  "si": true,
  "yes": true,
  "y": true,
  "true": true,
  "1": true,
  "si": true,
  "no": false,
  "n": false,
  "false": true,
  "0": false,
};
