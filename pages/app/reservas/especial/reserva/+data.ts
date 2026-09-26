import type { PageContextServer } from "vike/types";
import { useConfig } from "vike-react/useConfig";

export type Data = Awaited<ReturnType<typeof data>>;

// Booking QR landing page: only echoes the QR params, the booking itself is
// fetched client-side and kept live over the global socket.
// Coordination id: special_booking_qr_v1
export async function data(pageContext: PageContextServer) {
  const config = useConfig();
  config({ title: "Reserva fecha especial" });
  const search = pageContext.urlParsed?.search ?? {};
  return {
    bookingId: Number(search.booking_id) || 0,
    restaurantId: Number(search.restaurant_id) || 0,
    date: typeof search.date === "string" ? search.date : "",
  };
}
