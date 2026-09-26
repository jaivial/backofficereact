import React from "react";

import { Modal } from "../../../../../ui/overlays/Modal";
import { ModalHeader } from "../../../../../ui/overlays/ModalHeader";
import type { Booking } from "../../../../../api/types";
import { SpecialBookingQrPanel } from "./SpecialBookingQrPanel";
import { useBookingQr } from "./useBookingQr";

/** "Ver qr/pdf" modal of the reservas table. Coordination id: special_booking_qr_v1 */
export function SpecialBookingQrModal({ booking, onClose }: { booking: Booking | null; onClose: () => void }) {
  const { info, error } = useBookingQr(booking?.id ?? null, booking ?? undefined);
  const title = booking ? `QR / comprobante · ${booking.customer_name}` : "QR / comprobante";
  return (
    <Modal open={Boolean(booking)} title={title} onClose={onClose} widthPx={640} className="bo-specialQrModal" hideClose>
      <ModalHeader title={title} onClose={onClose} />
      {booking ? <SpecialBookingQrPanel bookingId={booking.id} info={info} error={error} testId="reservas-qr-modal" /> : null}
    </Modal>
  );
}
