import React from "react";
import { Calendar, Clock, Users } from "lucide-react";
import type { PublicBooking } from "../../../api/types";

interface BookingDetailsProps {
  booking: PublicBooking;
}

export function BookingDetails({ booking }: BookingDetailsProps) {
  return (
    <div className="bo-publicPageBooking" data-slot="details">
      <div className="bo-publicPageBookingHeader" data-slot="bookingDetails-publicPageBookingHeader">
        <div className="bo-publicPageBookingName" data-role="customer-name">{booking.customerName}</div>
        <div className="bo-publicPageBookingId" data-slot="bookingDetails-publicPageBookingId">Reserva #{booking.id}</div>
      </div>
      <div className="bo-publicPageDetailGrid" data-slot="bookingDetails-publicPageDetailGrid">
        <div className="bo-publicPageDetailItem" data-slot="bookingDetails-publicPageDetailItem">
          <Calendar size={16}>
          <div data-slot="bookingDetails-publicPageDetailLabel"><span className="bo-publicPageDetailLabel">Fecha</span><span className="bo-publicPageDetailValue">{booking.reservationDate}</span></div>
        </div>
        <div className="bo-publicPageDetailItem" data-slot="bookingDetails-publicPageDetailItem">
          <Clock size={16}>
          <div data-slot="bookingDetails-publicPageDetailLabel"><span className="bo-publicPageDetailLabel">Hora</span><span className="bo-publicPageDetailValue">{booking.reservationTime}</span></div>
        </div>
        <div className="bo-publicPageDetailItem" data-slot="bookingDetails-publicPageDetailItem">
          <Users size={16}>
          <div data-slot="bookingDetails-publicPageDetailLabel"><span className="bo-publicPageDetailLabel">Personas</span><span className="bo-publicPageDetailValue">{booking.partySize}</span></div>
        </div>
      </div>
    </div>
  );
}
