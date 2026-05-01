import React, { useCallback, useState } from "react";
import { usePageContext } from "vike-react/usePageContext";
import { XCircle, AlertCircle, Calendar, Clock, Users, Phone, ArrowLeft, Loader2, AlertTriangle } from "lucide-react";
import type { Data } from "./+data";
import type { PublicBooking, PublicBookingResponse } from "../../api/types";
import { createClient } from "../../api/client";

export default function Page() {
  const pageContext = usePageContext();
  const { booking, error, backendOrigin } = pageContext.data as Data;
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [cancelledBooking, setCancelledBooking] = useState<PublicBooking | null>(null);

  const displayBooking = cancelledBooking || booking;

  const handleCancel = useCallback(async () => {
    if (!booking) return;
    setLoading(true);
    setActionError(null);
    try {
      const api = createClient({ baseUrl: backendOrigin });
      const res = (await api.publicBookings.cancel(booking.id)) as PublicBookingResponse;
      if (res.success) {
        setActionSuccess(res.message || "Reserva cancelada correctamente.");
        if (res.booking) setCancelledBooking(res.booking);
      } else {
        if (res.isSameDay) {
          setActionError(res.message || "No se puede cancelar una reserva para el mismo día online.");
        } else {
          setActionError(res.message || "Error al cancelar la reserva.");
        }
      }
    } catch {
      setActionError("Error de conexión. Por favor, inténtelo de nuevo.");
    } finally {
      setLoading(false);
    }
  }, [booking, backendOrigin]);

  if (error || !booking) {
    return (
      <div className="bo-publicPage" data-ui="cancel-reservation">
        <div className="bo-publicPageCard" data-slot="cancel-publicPageCard">
          <div className="bo-publicPageAlert bo-publicPageAlert--danger" data-slot="cancel-publicPageAlert--danger">
            <AlertCircle size={20}>
            <span data-slot="cancel-ada">{error || "Reserva no encontrada."}</span>
          </div>
          <a href="/" className="bo-publicPageBtn bo-publicPageBtn--accent" data-testid="cancel-page-back-home-error">
            <ArrowLeft size={18}>
            Volver al inicio
          </a>
        </div>
      </div>
    );
  }

  if (booking.isSameDay && !actionSuccess) {
    return (
      <div className="bo-publicPage" data-ui="cancel-reservation">
        <div className="bo-publicPageCard" data-slot="cancel-publicPageCard">
          <div className="bo-publicPageIcon bo-publicPageIcon--warning" data-slot="cancel-publicPageIcon--warning">
            <AlertTriangle size={24}>
          </div>
          <h1 className="bo-publicPageTitle" data-slot="cancel-publicPageTitle">Cancelación No Disponible</h1>
          <p className="bo-publicPageSub" data-slot="cancel-publicPageSub">Reserva para hoy</p>
          <div className="bo-publicPageAlert bo-publicPageAlert--warning" data-slot="cancel-publicPageAlert--warning">
            <AlertTriangle size={20}>
            <span data-slot="cancel-nte">Las reservas para el mismo día no se pueden cancelar online. Por favor, llame al restaurante.</span>
          </div>
          <BookingDetails booking={displayBooking!}>
          <a href="tel:+34638857294" className="bo-publicPageBtn bo-publicPageBtn--success" data-testid="cancel-page-call-restaurant">
            <Phone size={18}>
            Llamar ahora
          </a>
          <a href="/" className="bo-publicPageBtn bo-publicPageBtn--accent" data-testid="cancel-page-back-home-sameday">Volver al inicio</a>
        </div>
      </div>
    );
  }

  if (actionSuccess) {
    return (
      <div className="bo-publicPage" data-ui="cancel-reservation">
        <div className="bo-publicPageCard" data-slot="cancel-publicPageCard">
          <div className="bo-publicPageIcon bo-publicPageIcon--success" data-slot="cancel-publicPageIcon--success">
            <XCircle size={24}>
          </div>
          <h1 className="bo-publicPageTitle" data-slot="cancel-publicPageTitle">Reserva Cancelada</h1>
          <p className="bo-publicPageSub" data-slot="cancel-publicPageSub">Su reserva ha sido cancelada correctamente</p>
          <div className="bo-publicPageAlert bo-publicPageAlert--success" data-slot="cancel-publicPageAlert--success">
            <span data-slot="cancel-ess">{actionSuccess}</span>
          </div>
          <BookingDetails booking={displayBooking!}>
          <a href="/" className="bo-publicPageBtn bo-publicPageBtn--accent" data-testid="cancel-page-back-home-cancelled">Volver al inicio</a>
        </div>
      </div>
    );
  }

  return (
    <div className="bo-publicPage" data-ui="cancel-reservation">
      <div className="bo-publicPageCard" data-slot="cancel-publicPageCard">
        <h1 className="bo-publicPageTitle" data-slot="title">Cancelar Reserva</h1>
        <p className="bo-publicPageSub" data-slot="cancel-publicPageSub">Revise los detalles antes de confirmar</p>

        {actionError && (
          <div className="bo-publicPageAlert bo-publicPageAlert--danger" data-slot="cancel-publicPageAlert--danger">
            <AlertCircle size={20}>
            <span data-slot="cancel-ror">{actionError}</span>
          </div>
        )}

        <BookingDetails booking={displayBooking!}>

        <button
          className="bo-publicPageBtn bo-publicPageBtn--danger"
          data-testid="cancel-page-submit"
          onClick={handleCancel}
          disabled={loading}
        >
          {loading ? <Loader2 size={18} className="bo-spin" /> : <XCircle size={18}>}
          Cancelar Reserva
        </button>
        <a href="/" className="bo-publicPageBtn bo-publicPageBtn--accent" data-testid="cancel-page-back-home">Volver sin cancelar</a>
        <p className="bo-publicPageNote" data-slot="cancel-publicPageNote">Esta acción no se puede deshacer. Se notificará al restaurante de la cancelación.</p>
      </div>
    </div>
  );
}

function BookingDetails({ booking }: { booking: PublicBooking }) {
  return (
    <div className="bo-publicPageBooking" data-slot="details">
      <div className="bo-publicPageBookingHeader" data-slot="cancel-publicPageBookingHeader">
        <div className="bo-publicPageBookingName" data-role="customer-name">{booking.customerName}</div>
        <div className="bo-publicPageBookingId" data-slot="cancel-publicPageBookingId">Reserva #{booking.id}</div>
      </div>
      <div className="bo-publicPageDetailGrid" data-slot="cancel-publicPageDetailGrid">
        <div className="bo-publicPageDetailItem" data-slot="cancel-publicPageDetailItem">
          <Calendar size={16}>
          <div data-slot="cancel-publicPageDetailLabel"><span className="bo-publicPageDetailLabel">Fecha</span><span className="bo-publicPageDetailValue">{booking.reservationDate}</span></div>
        </div>
        <div className="bo-publicPageDetailItem" data-slot="cancel-publicPageDetailItem">
          <Clock size={16}>
          <div data-slot="cancel-publicPageDetailLabel"><span className="bo-publicPageDetailLabel">Hora</span><span className="bo-publicPageDetailValue">{booking.reservationTime}</span></div>
        </div>
        <div className="bo-publicPageDetailItem" data-slot="cancel-publicPageDetailItem">
          <Users size={16}>
          <div data-slot="cancel-publicPageDetailLabel"><span className="bo-publicPageDetailLabel">Personas</span><span className="bo-publicPageDetailValue">{booking.partySize}</span></div>
        </div>
      </div>
    </div>
  );
}
