import React from "react";
import { Calendar, Clock, Users } from "lucide-react";
import type { PublicBooking } from "../../../api/types";

interface BookingDetailsProps {
  booking: PublicBooking;
}

export function BookingDetails({ booking }: BookingDetailsProps) {
  return (
    <div className="bo-publicPageBooking" data-slot="details">
      <div className="bo-publicPageBookingHeader">
        <div className="bo-publicPageBookingName" data-role="customer-name">{booking.customerName}</div>
        <div className="bo-publicPageBookingId">Reserva #{booking.id}</div>
      </div>
      <div className="bo-publicPageDetailGrid">
        <div className="bo-publicPageDetailItem">
          <Calendar size={16} />
          <div><span className="bo-publicPageDetailLabel">Fecha</span><span className="bo-publicPageDetailValue">{booking.reservationDate}</span></div>
        </div>
        <div className="bo-publicPageDetailItem">
          <Clock size={16} />
          <div><span className="bo-publicPageDetailLabel">Hora</span><span className="bo-publicPageDetailValue">{booking.reservationTime}</span></div>
        </div>
        <div className="bo-publicPageDetailItem">
          <Users size={16} />
          <div><span className="bo-publicPageDetailLabel">Personas</span><span className="bo-publicPageDetailValue">{booking.partySize}</span></div>
        </div>
      </div>
    </div>
  );
}
