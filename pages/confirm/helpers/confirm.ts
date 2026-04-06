import { createClient } from "../../../api/client";
import type { PublicBooking, PublicBookingResponse } from "../../../api/types";

type ApiClient = ReturnType<typeof createClient>;

export function useBookingConfirmation(
  api: ApiClient,
  onSuccess: (message: string, booking?: PublicBooking) => void,
  onError: (message: string) => void,
) {
  const confirm = async (bookingId: number) => {
    onError("");
    try {
      const res = (await api.publicBookings.confirm(bookingId)) as PublicBookingResponse;
      if (res.success) {
        onSuccess(res.message || "¡Reserva confirmada!", res.booking);
      } else {
        if (res.alreadyConfirmed) {
          onSuccess(res.message || "Esta reserva ya estaba confirmada.");
        } else {
          onError(res.message || "Error al confirmar la reserva.");
        }
      }
    } catch {
      onError("Error de conexión. Por favor, inténtelo de nuevo.");
    }
  };

  return confirm;
}
