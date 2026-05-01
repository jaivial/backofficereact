import React, { useCallback, useState } from "react";
import { usePageContext } from "vike-react/usePageContext";
import { CheckCircle, AlertCircle, Calendar, Clock, Users, Utensils, ArrowLeft, Loader2 } from "lucide-react";
import type { Data } from "./+data";
import type { PublicBooking } from "../../api/types";
import { createClient } from "../../api/client";
import { useBookingConfirmation } from "./helpers/confirm";

export default function Page() {
  const pageContext = usePageContext();
  const { booking, error, backendOrigin } = pageContext.data as Data;
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirmedBooking, setConfirmedBooking] = useState<PublicBooking | null>(null);

  const displayBooking = confirmedBooking || booking;

  const confirmBooking = useBookingConfirmation(
    createClient({ baseUrl: backendOrigin }),
    (message, updated) => {
      setActionSuccess(message);
      if (updated) setConfirmedBooking(updated);
    },
    setActionError,
  );

  const handleConfirm = useCallback(async () => {
    if (!booking) return;
    setLoading(true);
    try {
      await confirmBooking(booking.id);
    } finally {
      setLoading(false);
    }
  }, [booking, confirmBooking]);

  if (error || !booking) {
    return (
      <div className="bo-publicPage" data-ui="confirm-reservation">
        <div className="bo-publicPageCard" data-slot="confirm-publicPageCard">
          <div className="bo-publicPageAlert bo-publicPageAlert--danger" data-slot="confirm-publicPageAlert--danger">
            <AlertCircle size={20} />
            <span data-slot="confirm-ada">{error || "Reserva no encontrada."}</span>
          </div>
          <a href="/" className="bo-publicPageBtn bo-publicPageBtn--accent" data-testid="confirm-back-home-error">
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
        <div className="bo-publicPageCard" data-slot="confirm-publicPageCard">
          <div className="bo-publicPageIcon bo-publicPageIcon--success" data-slot="confirm-publicPageIcon--success">
            <CheckCircle size={24} />
          </div>
          <h1 className="bo-publicPageTitle" data-slot="confirm-publicPageTitle">Reserva Confirmada</h1>
          <p className="bo-publicPageSub" data-slot="confirm-publicPageSub">{actionSuccess}</p>
          <div className="bo-publicPageBooking" data-slot="confirm-publicPageBooking">
            <div className="bo-publicPageBookingHeader" data-slot="confirm-publicPageBookingHeader">
              <div className="bo-publicPageBookingName" data-role="customer-name">{displayBooking!.customerName}</div>
              <div className="bo-publicPageBookingId" data-slot="confirm-publicPageBookingId">Reserva #{displayBooking!.id}</div>
            </div>
            <div className="bo-publicPageDetailGrid" data-slot="confirm-publicPageDetailGrid">
              <div className="bo-publicPageDetailItem" data-slot="confirm-publicPageDetailItem">
                <Calendar size={16} />
                <div data-slot="confirm-publicPageDetailLabel"><span className="bo-publicPageDetailLabel">Fecha</span><span className="bo-publicPageDetailValue">{displayBooking!.reservationDate}</span></div>
              </div>
              <div className="bo-publicPageDetailItem" data-slot="confirm-publicPageDetailItem">
                <Clock size={16} />
                <div data-slot="confirm-publicPageDetailLabel"><span className="bo-publicPageDetailLabel">Hora</span><span className="bo-publicPageDetailValue">{displayBooking!.reservationTime}</span></div>
              </div>
              <div className="bo-publicPageDetailItem" data-slot="confirm-publicPageDetailItem">
                <Users size={16} />
                <div data-slot="confirm-publicPageDetailLabel"><span className="bo-publicPageDetailLabel">Personas</span><span className="bo-publicPageDetailValue">{displayBooking!.partySize}</span></div>
              </div>
              {displayBooking!.arrozDisplay && (
                <div className="bo-publicPageDetailItem" data-slot="confirm-publicPageDetailItem">
                  <Utensils size={16} />
                  <div data-slot="confirm-publicPageDetailLabel"><span className="bo-publicPageDetailLabel">Arroz</span><span className="bo-publicPageDetailValue">{displayBooking!.arrozDisplay}</span></div>
                </div>
              )}
            </div>
          </div>
          <a href="/" className="bo-publicPageBtn bo-publicPageBtn--accent" data-testid="confirm-back-home-success">Volver al inicio</a>
        </div>
      </div>
    );
  }

  return (
    <div className="bo-publicPage" data-ui="confirm-reservation">
      <div className="bo-publicPageCard" data-slot="confirm-publicPageCard">
        <h1 className="bo-publicPageTitle" data-slot="title">Confirmar Reserva</h1>
        <p className="bo-publicPageSub" data-slot="confirm-publicPageSub">Revise los datos y confirme su asistencia</p>

        {actionError && (
          <div className="bo-publicPageAlert bo-publicPageAlert--danger" data-slot="confirm-publicPageAlert--danger">
            <AlertCircle size={20} />
            <span data-slot="confirm-ror">{actionError}</span>
          </div>
        )}

        <div className="bo-publicPageBooking" data-slot="details">
          <div className="bo-publicPageBookingHeader" data-slot="confirm-publicPageBookingHeader">
            <div className="bo-publicPageBookingName" data-role="customer-name">{displayBooking!.customerName}</div>
            <div className="bo-publicPageBookingId" data-slot="confirm-publicPageBookingId">Reserva #{displayBooking!.id}</div>
          </div>
          <div className="bo-publicPageDetailGrid" data-slot="confirm-publicPageDetailGrid">
            <div className="bo-publicPageDetailItem" data-slot="confirm-publicPageDetailItem">
              <Calendar size={16} />
              <div data-slot="confirm-publicPageDetailLabel"><span className="bo-publicPageDetailLabel">Fecha</span><span className="bo-publicPageDetailValue">{displayBooking!.reservationDate}</span></div>
            </div>
            <div className="bo-publicPageDetailItem" data-slot="confirm-publicPageDetailItem">
              <Clock size={16} />
              <div data-slot="confirm-publicPageDetailLabel"><span className="bo-publicPageDetailLabel">Hora</span><span className="bo-publicPageDetailValue">{displayBooking!.reservationTime}</span></div>
            </div>
            <div className="bo-publicPageDetailItem" data-slot="confirm-publicPageDetailItem">
              <Users size={16} />
              <div data-slot="confirm-publicPageDetailLabel"><span className="bo-publicPageDetailLabel">Personas</span><span className="bo-publicPageDetailValue">{displayBooking!.partySize}</span></div>
            </div>
            {displayBooking!.arrozDisplay && (
              <div className="bo-publicPageDetailItem" data-slot="confirm-publicPageDetailItem">
                <Utensils size={16} />
                <div data-slot="confirm-publicPageDetailLabel"><span className="bo-publicPageDetailLabel">Arroz</span><span className="bo-publicPageDetailValue">{displayBooking!.arrozDisplay}</span></div>
              </div>
            )}
          </div>
        </div>

        {booking.isConfirmed ? (
          <div className="bo-publicPageAlert bo-publicPageAlert--success" data-slot="confirm-publicPageAlert--success">
            <CheckCircle size={20} />
            <span data-slot="confirm-ada">Esta reserva ya está confirmada.</span>
          </div>
        ) : (
          <button
            className="bo-publicPageBtn bo-publicPageBtn--success"
            data-testid="confirm-submit"
            onClick={handleConfirm}
            disabled={loading}
          >
            {loading ? <Loader2 size={18} className="bo-spin" /> : <CheckCircle size={18} />}
            Confirmar Reserva
          </button>
        )}
        <a href="/" className="bo-publicPageBtn bo-publicPageBtn--accent" data-testid="confirm-back-home">Volver al inicio</a>
      </div>
    </div>
  );
}
