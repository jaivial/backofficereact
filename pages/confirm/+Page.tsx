import React, { useCallback, useState } from "react";
import { usePageContext } from "vike-react/usePageContext";
import { CheckCircle, AlertCircle, Calendar, Clock, Users, Utensils, ArrowLeft, Loader2 } from "lucide-react";
import type { Data } from "./+data";
import type { PublicBooking, PublicBookingResponse } from "../../api/types";
import { createClient } from "../../api/client";

export default function Page() {
  const pageContext = usePageContext();
  const { booking, error, backendOrigin } = pageContext.data as Data;
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirmedBooking, setConfirmedBooking] = useState<PublicBooking | null>(null);

  const displayBooking = confirmedBooking || booking;

  const handleConfirm = useCallback(async () => {
    if (!booking) return;
    setLoading(true);
    setActionError(null);
    try {
      const api = createClient({ baseUrl: backendOrigin });
      const res = (await api.publicBookings.confirm(booking.id)) as PublicBookingResponse;
      if (res.success) {
        setActionSuccess(res.message || "¡Reserva confirmada!");
        if (res.booking) setConfirmedBooking(res.booking);
      } else {
        if (res.alreadyConfirmed) {
          setActionSuccess(res.message || "Esta reserva ya estaba confirmada.");
        } else {
          setActionError(res.message || "Error al confirmar la reserva.");
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
      <div className="bo-publicPage" data-ui="confirm-reservation">
        <div className="bo-publicPageCard">
          <div className="bo-publicPageAlert bo-publicPageAlert--danger">
            <AlertCircle size={20} />
            <span>{error || "Reserva no encontrada."}</span>
          </div>
          <a href="/" className="bo-publicPageBtn bo-publicPageBtn--accent" data-testid="confirm-page-back-home-error">
            <ArrowLeft size={18} />
            Volver al inicio
          </a>
        </div>
      </div>
    );
  }

  if (actionSuccess) {
    return (
      <div className="bo-publicPage" data-ui="confirm-reservation">
        <div className="bo-publicPageCard">
          <div className="bo-publicPageIcon bo-publicPageIcon--success">
            <CheckCircle size={24} />
          </div>
          <h1 className="bo-publicPageTitle">Reserva Confirmada</h1>
          <p className="bo-publicPageSub">{actionSuccess}</p>
          <div className="bo-publicPageBooking">
            <div className="bo-publicPageBookingHeader">
              <div className="bo-publicPageBookingName" data-role="customer-name">{displayBooking!.customerName}</div>
              <div className="bo-publicPageBookingId">Reserva #{displayBooking!.id}</div>
            </div>
            <div className="bo-publicPageDetailGrid">
              <div className="bo-publicPageDetailItem">
                <Calendar size={16} />
                <div><span className="bo-publicPageDetailLabel">Fecha</span><span className="bo-publicPageDetailValue">{displayBooking!.reservationDate}</span></div>
              </div>
              <div className="bo-publicPageDetailItem">
                <Clock size={16} />
                <div><span className="bo-publicPageDetailLabel">Hora</span><span className="bo-publicPageDetailValue">{displayBooking!.reservationTime}</span></div>
              </div>
              <div className="bo-publicPageDetailItem">
                <Users size={16} />
                <div><span className="bo-publicPageDetailLabel">Personas</span><span className="bo-publicPageDetailValue">{displayBooking!.partySize}</span></div>
              </div>
              {displayBooking!.arrozDisplay && (
                <div className="bo-publicPageDetailItem">
                  <Utensils size={16} />
                  <div><span className="bo-publicPageDetailLabel">Arroz</span><span className="bo-publicPageDetailValue">{displayBooking!.arrozDisplay}</span></div>
                </div>
              )}
            </div>
          </div>
          <a href="/" className="bo-publicPageBtn bo-publicPageBtn--accent" data-testid="confirm-page-back-home-success">Volver al inicio</a>
        </div>
      </div>
    );
  }

  return (
    <div className="bo-publicPage" data-ui="confirm-reservation">
      <div className="bo-publicPageCard">
        <h1 className="bo-publicPageTitle" data-slot="title">Confirmar Reserva</h1>
        <p className="bo-publicPageSub">Revise los datos y confirme su asistencia</p>

        {actionError && (
          <div className="bo-publicPageAlert bo-publicPageAlert--danger">
            <AlertCircle size={20} />
            <span>{actionError}</span>
          </div>
        )}

        <div className="bo-publicPageBooking" data-slot="details">
          <div className="bo-publicPageBookingHeader">
            <div className="bo-publicPageBookingName" data-role="customer-name">{displayBooking!.customerName}</div>
            <div className="bo-publicPageBookingId">Reserva #{displayBooking!.id}</div>
          </div>
          <div className="bo-publicPageDetailGrid">
            <div className="bo-publicPageDetailItem">
              <Calendar size={16} />
              <div><span className="bo-publicPageDetailLabel">Fecha</span><span className="bo-publicPageDetailValue">{displayBooking!.reservationDate}</span></div>
            </div>
            <div className="bo-publicPageDetailItem">
              <Clock size={16} />
              <div><span className="bo-publicPageDetailLabel">Hora</span><span className="bo-publicPageDetailValue">{displayBooking!.reservationTime}</span></div>
            </div>
            <div className="bo-publicPageDetailItem">
              <Users size={16} />
              <div><span className="bo-publicPageDetailLabel">Personas</span><span className="bo-publicPageDetailValue">{displayBooking!.partySize}</span></div>
            </div>
            {displayBooking!.arrozDisplay && (
              <div className="bo-publicPageDetailItem">
                <Utensils size={16} />
                <div><span className="bo-publicPageDetailLabel">Arroz</span><span className="bo-publicPageDetailValue">{displayBooking!.arrozDisplay}</span></div>
              </div>
            )}
          </div>
        </div>

        {booking.isConfirmed ? (
          <div className="bo-publicPageAlert bo-publicPageAlert--success">
            <CheckCircle size={20} />
            <span>Esta reserva ya está confirmada.</span>
          </div>
        ) : (
          <button
            className="bo-publicPageBtn bo-publicPageBtn--success"
            data-testid="confirm-page-submit"
            onClick={handleConfirm}
            disabled={loading}
          >
            {loading ? <Loader2 size={18} className="bo-spin" /> : <CheckCircle size={18} />}
            Confirmar Reserva
          </button>
        )}
        <a href="/" className="bo-publicPageBtn bo-publicPageBtn--accent" data-testid="confirm-page-back-home">Volver al inicio</a>
      </div>
    </div>
  );
}
