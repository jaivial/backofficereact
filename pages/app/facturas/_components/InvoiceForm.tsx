import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Save, Send, Upload, X, Search } from "lucide-react";
import { useToasts } from "../../../../ui/feedback/useToasts";
import { Select } from "../../../../ui/inputs/Select";
import { DatePicker } from "../../../../ui/inputs/DatePicker";
import { Switch } from "../../../../ui/shadcn/Switch";
import { FillFromReservationModal } from "./FillFromReservationModal";
import type { Invoice, InvoiceInput, InvoiceStatus, PaymentMethod, ReservationSearchResult } from "../../../../api/types";

type InvoiceFormProps = {
  invoice: Invoice | null;
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
};

const PAYMENT_METHOD_OPTIONS: { value: PaymentMethod | ""; label: string }[] = [
  { value: "", label: "Seleccionar..." },
  { value: "efectivo", label: "Efectivo" },
  { value: "tarjeta", label: "Tarjeta" },
  { value: "transferencia", label: "Transferencia" },
  { value: "bizum", label: "Bizum" },
  { value: "cheque", label: "Cheque" },
];

const STATUS_OPTIONS: { value: InvoiceStatus; label: string }[] = [
  { value: "borrador", label: "Borrador" },
  { value: "solicitada", label: "Solicitada" },
  { value: "pendiente", label: "Pendiente" },
  { value: "enviada", label: "Enviada" },
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

export function InvoiceForm({ invoice, onSave, onCancel, searchReservations }: InvoiceFormProps) {
  const { pushToast } = useToasts();
  const [showReservationModal, setShowReservationModal] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

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
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | "">(invoice?.payment_method || "");
  const [accountImageUrl, setAccountImageUrl] = useState(invoice?.account_image_url || "");
  const [invoiceDate, setInvoiceDate] = useState(invoice?.invoice_date || new Date().toISOString().split("T")[0]);
  const [paymentDate, setPaymentDate] = useState(invoice?.payment_date || "");
  const [status, setStatus] = useState<InvoiceStatus>(invoice?.status || "borrador");
  const [isReservation, setIsReservation] = useState(invoice?.is_reservation || false);
  const [reservationId, setReservationId] = useState<number | undefined>(invoice?.reservation_id);
  const [reservationDate, setReservationDate] = useState(invoice?.reservation_date || "");
  const [reservationCustomerName, setReservationCustomerName] = useState(invoice?.reservation_customer_name || "");
  const [reservationPartySize, setReservationPartySize] = useState<number | undefined>(invoice?.reservation_party_size);

  // Auto-save debounce
  const formData = useMemo(
    () => ({
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
      amount: parseFloat(amount) || 0,
      payment_method: paymentMethod || undefined,
      account_image_url: accountImageUrl || undefined,
      invoice_date: invoiceDate,
      payment_date: paymentDate || undefined,
      status,
      is_reservation: isReservation,
      reservation_id: reservationId,
      reservation_date: reservationDate || undefined,
      reservation_customer_name: reservationCustomerName || undefined,
      reservation_party_size: reservationPartySize,
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
    ],
  );

  const debouncedFormData = useDebounce(formData, 2000);

  // Auto-save effect
  useEffect(() => {
    if (!invoice) return; // Only auto-save for existing invoices
    // TODO: Implement auto-save by calling API periodically
  }, [debouncedFormData, invoice]);

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
    setPaymentDate(new Date().toISOString().split("T")[0]);
    setShowReservationModal(false);
    pushToast({ kind: "info", title: "Datos filled", message: "Datos filled desde la reserva" });
  }, [pushToast]);

  // Handle image upload
  const handleImageUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      // Check file size (max 50KB)
      if (file.size > 50 * 1024) {
        pushToast({ kind: "error", title: "Error", message: "La imagen es demasiado grande (max 50KB)" });
        return;
      }

      setUploadingImage(true);
      try {
        // In a real implementation, we'd compress the image and upload it
        // For now, just create a local URL
        const url = URL.createObjectURL(file);
        setAccountImageUrl(url);
        pushToast({ kind: "success", title: "Imagen cargada", message: "La imagen se ha cargado correctamente" });
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

  // Validate required fields
  const isValid = useMemo(() => {
    return customerName.trim() && customerEmail.trim() && invoiceDate && amount;
  }, [customerName, customerEmail, invoiceDate, amount]);

  return (
    <div className="bo-invoiceForm">
      <div className="bo-invoiceFormHeader">
        <h2 className="bo-invoiceFormTitle">{invoice ? "Editar Factura" : "Nueva Factura"}</h2>
        <button
          type="button"
          className="bo-btn bo-btn--ghost bo-btn--sm"
          onClick={() => setShowReservationModal(true)}
        >
          <Search size={16} />
          Rellenar desde reserva
        </button>
      </div>

      <div className="bo-invoiceFormGrid">
        {/* Customer info section */}
        <div className="bo-invoiceFormSection">
          <h3 className="bo-invoiceFormSectionTitle">Datos del cliente</h3>

          <div className="bo-invoiceFormRow">
            <label className="bo-field">
              <span className="bo-label">Nombre *</span>
              <input
                className="bo-input"
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                required
              />
            </label>

            <label className="bo-field">
              <span className="bo-label">Apellidos</span>
              <input
                className="bo-input"
                type="text"
                value={customerSurname}
                onChange={(e) => setCustomerSurname(e.target.value)}
              />
            </label>
          </div>

          <div className="bo-invoiceFormRow">
            <label className="bo-field">
              <span className="bo-label">Email *</span>
              <input
                className="bo-input"
                type="email"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                required
              />
            </label>

            <label className="bo-field">
              <span className="bo-label">Teléfono</span>
              <input
                className="bo-input"
                type="tel"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
              />
            </label>
          </div>

          <div className="bo-invoiceFormRow bo-invoiceFormRow--dni">
            <div className="bo-field bo-field--switch">
              <Switch checked={useDni} onCheckedChange={setUseDni} />
              <span className="bo-label">{useDni ? "DNI" : "CIF"}</span>
            </div>

            {useDni && (
              <label className="bo-field">
                <span className="bo-label">{useDni ? "DNI" : "CIF"}</span>
                <input
                  className="bo-input"
                  type="text"
                  value={customerDniCif}
                  onChange={(e) => setCustomerDniCif(e.target.value)}
                />
              </label>
            )}
          </div>

          <div className="bo-invoiceFormRow">
            <label className="bo-field">
              <span className="bo-label">Calle</span>
              <input
                className="bo-input"
                type="text"
                value={customerAddressStreet}
                onChange={(e) => setCustomerAddressStreet(e.target.value)}
              />
            </label>

            <label className="bo-field bo-field--number">
              <span className="bo-label">Número</span>
              <input
                className="bo-input"
                type="text"
                value={customerAddressNumber}
                onChange={(e) => setCustomerAddressNumber(e.target.value)}
              />
            </label>
          </div>

          <div className="bo-invoiceFormRow">
            <label className="bo-field">
              <span className="bo-label">Código Postal</span>
              <input
                className="bo-input"
                type="text"
                value={customerAddressPostalCode}
                onChange={(e) => setCustomerAddressPostalCode(e.target.value)}
              />
            </label>

            <label className="bo-field">
              <span className="bo-label">Localidad</span>
              <input
                className="bo-input"
                type="text"
                value={customerAddressCity}
                onChange={(e) => setCustomerAddressCity(e.target.value)}
              />
            </label>
          </div>

          <div className="bo-invoiceFormRow">
            <label className="bo-field">
              <span className="bo-label">Provincia</span>
              <input
                className="bo-input"
                type="text"
                value={customerAddressProvince}
                onChange={(e) => setCustomerAddressProvince(e.target.value)}
              />
            </label>

            <label className="bo-field">
              <span className="bo-label">País</span>
              <input
                className="bo-input"
                type="text"
                value={customerAddressCountry}
                onChange={(e) => setCustomerAddressCountry(e.target.value)}
              />
            </label>
          </div>
        </div>

        {/* Invoice info section */}
        <div className="bo-invoiceFormSection">
          <h3 className="bo-invoiceFormSectionTitle">Datos de la factura</h3>

          <div className="bo-invoiceFormRow">
            <label className="bo-field">
              <span className="bo-label">Importe *</span>
              <input
                className="bo-input"
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </label>

            <label className="bo-field">
              <span className="bo-label">Método de pago</span>
              <Select
                value={paymentMethod}
                onChange={(value) => setPaymentMethod(value as PaymentMethod | "")}
                options={PAYMENT_METHOD_OPTIONS}
                ariaLabel="Método de pago"
              />
            </label>
          </div>

          <div className="bo-invoiceFormRow">
            <label className="bo-field">
              <span className="bo-label">Fecha de factura *</span>
              <DatePicker value={invoiceDate} onChange={setInvoiceDate} />
            </label>

            <label className="bo-field">
              <span className="bo-label">Fecha de pago</span>
              <DatePicker value={paymentDate} onChange={setPaymentDate} />
            </label>
          </div>

          <div className="bo-invoiceFormRow">
            <label className="bo-field">
              <span className="bo-label">Estado</span>
              <Select
                value={status}
                onChange={(value) => setStatus(value as InvoiceStatus)}
                options={STATUS_OPTIONS}
                ariaLabel="Estado"
              />
            </label>
          </div>

          <div className="bo-invoiceFormRow">
            <label className="bo-field bo-field--switch">
              <Switch checked={isReservation} onCheckedChange={setIsReservation} />
              <span className="bo-label">Es reserva</span>
            </label>
          </div>

          {isReservation && (
            <div className="bo-invoiceFormRow bo-invoiceFormRow--reservation">
              <label className="bo-field">
                <span className="bo-label">ID Reserva</span>
                <input className="bo-input" type="text" value={reservationId || ""} readOnly />
              </label>

              <label className="bo-field">
                <span className="bo-label">Fecha reserva</span>
                <DatePicker value={reservationDate} onChange={setReservationDate} />
              </label>

              <label className="bo-field">
                <span className="bo-label">Personas</span>
                <input
                  className="bo-input"
                  type="number"
                  min="1"
                  value={reservationPartySize || ""}
                  onChange={(e) => setReservationPartySize(parseInt(e.target.value) || undefined)}
                />
              </label>
            </div>
          )}

          {/* Image upload */}
          <div className="bo-invoiceFormRow bo-invoiceFormRow--image">
            <label className="bo-field">
              <span className="bo-label">Imagen de la cuenta</span>
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
                    <span>Subir imagen (max 50KB)</span>
                    <input type="file" accept="image/*" onChange={handleImageUpload} hidden />
                  </label>
                )}
              </div>
            </label>
          </div>
        </div>
      </div>

      {/* Form actions */}
      <div className="bo-invoiceFormActions">
        <button type="button" className="bo-btn bo-btn--secondary" onClick={onCancel}>
          Cancelar
        </button>
        <button type="button" className="bo-btn bo-btn--secondary" onClick={handleSaveDraft} disabled={!isValid}>
          <Save size={16} />
          Guardar borrador
        </button>
        <button type="button" className="bo-btn bo-btn--secondary" onClick={handleSavePending} disabled={!isValid}>
          <Save size={16} />
          Guardar como pendiente
        </button>
        <button type="button" className="bo-btn bo-btn--primary" onClick={handleSend} disabled={!isValid}>
          <Send size={16} />
          Enviar
        </button>
      </div>

      {/* Reservation modal */}
      {showReservationModal && (
        <FillFromReservationModal
          onClose={() => setShowReservationModal(false)}
          onSelect={handleFillFromReservation}
          searchReservations={searchReservations}
        />
      )}
    </div>
  );
}
