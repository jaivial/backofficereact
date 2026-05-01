import React, { useCallback, useMemo, useState } from "react";
import { usePageContext } from "vike-react/usePageContext";
import { Utensils, AlertCircle, Phone, ArrowLeft, Loader2, CheckCircle, AlertTriangle } from "lucide-react";
import type { Data } from "./+data";
import type { PublicBookingResponse } from "../../api/types";
import { createClient } from "../../api/client";

export default function Page() {
  const pageContext = usePageContext();
  const { booking, riceOptions, error, backendOrigin } = pageContext.data as Data;
  const [selectedRice, setSelectedRice] = useState("");
  const [servings, setServings] = useState(1);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const showForm = useMemo(() => {
    if (!booking) return false;
    return !booking.arrozType || booking.arrozType === "" || booking.arrozType === "null";
  }, [booking]);

  const handleSubmit = useCallback(async () => {
    if (!booking || !selectedRice || servings <= 0) return;
    setLoading(true);
    setActionError(null);
    try {
      const api = createClient({ baseUrl: backendOrigin });
      const res = (await api.publicBookings.rice(booking.id, selectedRice, servings)) as PublicBookingResponse;
      if (res.success) {
        setActionSuccess(res.message || "¡Arroz reservado correctamente!");
      } else {
        if (res.isSameDay) {
          setActionError(res.message || "Las reservas de arroz para el mismo día deben hacerse por teléfono.");
        } else {
          setActionError(res.message || "Error al reservar el arroz.");
        }
      }
    } catch {
      setActionError("Error de conexión. Por favor, inténtelo de nuevo.");
    } finally {
      setLoading(false);
    }
  }, [booking, selectedRice, servings, backendOrigin]);

  if (error || !booking) {
    return (
      <div className="bo-publicPage" data-ui="book-rice">
        <div className="bo-publicPageCard" data-slot="update-rice-publicPageCard">
          <div className="bo-publicPageAlert bo-publicPageAlert--danger" data-slot="update-rice-publicPageAlert--danger">
            <AlertCircle size={20}>
            <span data-slot="update-rice-ada">{error || "Reserva no encontrada."}</span>
          </div>
          <a href="/" className="bo-publicPageBtn bo-publicPageBtn--accent" data-testid="update-rice-back-home-link">
            <ArrowLeft size={18}>
            Volver al inicio
          </a>
        </div>
      </div>
    );
  }

  if (booking.isSameDay && !actionSuccess) {
    return (
      <div className="bo-publicPage" data-ui="book-rice">
        <div className="bo-publicPageCard" data-slot="update-rice-publicPageCard">
          <div className="bo-publicPageIcon bo-publicPageIcon--warning" data-slot="update-rice-publicPageIcon--warning">
            <AlertTriangle size={24}>
          </div>
          <h1 className="bo-publicPageTitle" data-slot="update-rice-publicPageTitle">No Disponible</h1>
          <p className="bo-publicPageSub" data-slot="update-rice-publicPageSub">Reserva para hoy</p>
          <div className="bo-publicPageAlert bo-publicPageAlert--warning" data-slot="update-rice-publicPageAlert--warning">
            <AlertTriangle size={20}>
            <span data-slot="update-rice-ono">Las reservas de arroz para el mismo día deben hacerse por teléfono.</span>
          </div>
          <a href="tel:+34638857294" className="bo-publicPageBtn bo-publicPageBtn--success" data-testid="update-rice-call-link">
            <Phone size={18}>
            Llamar ahora
          </a>
          <a href="/" className="bo-publicPageBtn bo-publicPageBtn--accent" data-testid="update-rice-back-home-link-2">Volver al inicio</a>
        </div>
      </div>
    );
  }

  if (actionSuccess) {
    return (
      <div className="bo-publicPage" data-ui="book-rice">
        <div className="bo-publicPageCard" data-slot="update-rice-publicPageCard">
          <div className="bo-publicPageIcon bo-publicPageIcon--success" data-slot="update-rice-publicPageIcon--success">
            <CheckCircle size={24}>
          </div>
          <h1 className="bo-publicPageTitle" data-slot="update-rice-publicPageTitle">Arroz Reservado</h1>
          <p className="bo-publicPageSub" data-slot="update-rice-publicPageSub">{actionSuccess}</p>
          <div className="bo-publicPageBooking" data-slot="update-rice-publicPageBooking">
            <div className="bo-publicPageBookingHeader" data-slot="update-rice-publicPageBookingHeader">
              <div className="bo-publicPageBookingName" data-role="customer-name">{booking.customerName}</div>
              <div className="bo-publicPageBookingId" data-slot="update-rice-publicPageBookingId">{booking.reservationDate} · {booking.reservationTime} · {booking.partySize} personas</div>
            </div>
          </div>
          <a href="/" className="bo-publicPageBtn bo-publicPageBtn--accent" data-testid="update-rice-success-back-link">Volver al inicio</a>
        </div>
      </div>
    );
  }

  if (!showForm) {
    return (
      <div className="bo-publicPage" data-ui="book-rice">
        <div className="bo-publicPageCard" data-slot="update-rice-publicPageCard">
          <h1 className="bo-publicPageTitle" data-slot="update-rice-publicPageTitle">Tu Arroz</h1>
          <p className="bo-publicPageSub" data-slot="update-rice-publicPageSub">Arroz actual de tu reserva</p>
          <div className="bo-publicPageBooking" data-slot="update-rice-publicPageBooking">
            <div className="bo-publicPageBookingHeader" data-slot="update-rice-publicPageBookingHeader">
              <div className="bo-publicPageBookingName" data-role="customer-name">{booking.customerName}</div>
              <div className="bo-publicPageBookingId" data-slot="update-rice-publicPageBookingId">{booking.reservationDate} · {booking.reservationTime}</div>
            </div>
            <div className="bo-publicPageDetailGrid" data-slot="update-rice-publicPageDetailGrid">
              <div className="bo-publicPageDetailItem" data-slot="update-rice-publicPageDetailItem">
                <Utensils size={16}>
                <div data-slot="update-rice-publicPageDetailLabel"><span className="bo-publicPageDetailLabel">Arroz</span><span className="bo-publicPageDetailValue">{booking.arrozDisplay || "No Arroz"}</span></div>
              </div>
            </div>
          </div>
          <a href="/" className="bo-publicPageBtn bo-publicPageBtn--accent" data-testid="update-rice-no-form-back-link">Volver al inicio</a>
        </div>
      </div>
    );
  }

  return (
    <div className="bo-publicPage" data-ui="book-rice">
      <div className="bo-publicPageCard" data-slot="update-rice-publicPageCard">
        <h1 className="bo-publicPageTitle" data-slot="title">Reservar Arroz</h1>
        <p className="bo-publicPageSub" data-slot="update-rice-publicPageSub">Seleccione el tipo de arroz para su reserva</p>

        {actionError && (
          <div className="bo-publicPageAlert bo-publicPageAlert--danger" data-slot="update-rice-publicPageAlert--danger">
            <AlertCircle size={20}>
            <span data-slot="update-rice-ror">{actionError}</span>
          </div>
        )}

        <div className="bo-publicPageBooking" data-slot="update-rice-publicPageBooking">
          <div className="bo-publicPageBookingHeader" data-slot="update-rice-publicPageBookingHeader">
            <div className="bo-publicPageBookingName" data-role="customer-name">{booking.customerName}</div>
            <div className="bo-publicPageBookingId" data-slot="update-rice-publicPageBookingId">{booking.reservationDate} · {booking.reservationTime} · {booking.partySize} personas</div>
          </div>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }} className="bo-publicPageForm" data-testid="update-rice-form">
          <div className="bo-publicPageFormGroup" data-slot="update-rice-publicPageFormGroup">
            <label className="bo-publicPageFormLabel" htmlFor="rice_type" data-slot="update-rice-publicPageFormLabel">Tipo de arroz</label>
            <select
              className="bo-publicPageFormControl"
              id="rice_type"
              value={selectedRice}
              onChange={(e) => setSelectedRice(e.target.value)}
              required
              data-testid="update-rice-select"
            >
              <option value="">Seleccione una opción</option>
              {riceOptions.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>
          <div className="bo-publicPageFormGroup" data-slot="update-rice-publicPageFormGroup">
            <label className="bo-publicPageFormLabel" htmlFor="rice_servings" data-slot="update-rice-publicPageFormLabel">Raciones (máximo {booking.partySize})</label>
            <input
              className="bo-publicPageFormControl"
              id="rice_servings"
              type="number"
              min={1}
              max={booking.partySize}
              value={servings}
              onChange={(e) => setServings(parseInt(e.target.value, 10) || 1)}
              required
              data-testid="update-rice-servings-input"
            />
          </div>
          <button
            className="bo-publicPageBtn bo-publicPageBtn--primary"
            type="submit"
            disabled={loading || !selectedRice}
            data-testid="update-rice-submit-button"
          >
            {loading ? <Loader2 size={18} className="bo-spin" /> : <Utensils size={18}>}
            Reservar Arroz
          </button>
        </form>
        <a href="/" className="bo-publicPageBtn bo-publicPageBtn--accent" data-testid="update-rice-back-link">Volver sin reservar</a>
      </div>
    </div>
  );
}
