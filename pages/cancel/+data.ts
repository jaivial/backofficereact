import type { PageContextServer } from "vike/types";
import { useConfig } from "vike-react/useConfig";
import { createClient } from "../../api/client";
import type { PublicBookingResponse } from "../../api/types";

export type Data = Awaited<ReturnType<typeof data>>;

export async function data(pageContext: PageContextServer) {
  const config = useConfig();
  config({ title: "Cancelar Reserva" });

  const backendOrigin = pageContext.boRequest?.backendOrigin ?? "http://127.0.0.1:8080";

  const url = new URL(pageContext.urlOriginal, "http://localhost");
  const idStr = url.searchParams.get("id");
  const id = idStr ? parseInt(idStr, 10) : 0;

  if (!id || isNaN(id)) {
    return { booking: null, error: "ID de reserva inválido. Por favor, inténtelo de nuevo.", backendOrigin };
  }

  try {
    const api = createClient({ baseUrl: backendOrigin });
    const res = (await api.publicBookings.get(id)) as PublicBookingResponse;

    if (!res.success || !res.booking) {
      return { booking: null, error: res.message || "Reserva no encontrada.", backendOrigin };
    }

    return { booking: res.booking, error: null, backendOrigin };
  } catch (e) {
    return { booking: null, error: "Error al cargar la reserva. Por favor, inténtelo de nuevo.", backendOrigin };
  }
}
