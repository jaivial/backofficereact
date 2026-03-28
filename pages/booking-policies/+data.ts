import type { PageContextServer } from "vike/types";
import { useConfig } from "vike-react/useConfig";
import { createClient } from "../../api/client";
import type { PublicBookingPoliciesResponse } from "../../api/types";

export type Data = Awaited<ReturnType<typeof data>>;

export async function data(pageContext: PageContextServer) {
  const config = useConfig();
  config({ title: "Condiciones de Reserva" });

  const backendOrigin = pageContext.boRequest?.backendOrigin ?? "http://127.0.0.1:8080";

  try {
    const api = createClient({ baseUrl: backendOrigin });
    const res = (await api.publicBookings.policies()) as PublicBookingPoliciesResponse;

    if (!res.success) {
      return { policies: "", brandName: "Restaurante", updatedDate: "", error: "Error al cargar las políticas.", backendOrigin };
    }

    return { policies: res.policies, brandName: res.brandName, updatedDate: res.updatedDate, error: null, backendOrigin };
  } catch (e) {
    return { policies: "", brandName: "Restaurante", updatedDate: "", error: "Error de conexión.", backendOrigin };
  }
}
