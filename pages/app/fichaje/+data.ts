import type { PageContextServer } from "vike/types";
import { useConfig } from "vike-react/useConfig";

import { createClient } from "../../../api/client";
import type { FichajeState } from "../../../api/types";

export type Data = Awaited<ReturnType<typeof data>>;

export async function data(pageContext: PageContextServer) {
  const config = useConfig();
  config({ title: "Fichaje" });

  const backendOrigin = pageContext.boRequest?.backendOrigin ?? "http://127.0.0.1:8080";
  const cookieHeader = pageContext.boRequest?.cookieHeader ?? "";
  const api = createClient({ baseUrl: backendOrigin, cookieHeader });

  let state: FichajeState | null = null;
  let error: string | null = null;

  try {
    const res = await api.fichaje.getState();
    if (res.success) state = res.state;
    else error = res.message || "No se pudo cargar el estado de fichaje";
  } catch (err) {
    error = err instanceof Error ? err.message : "No se pudo cargar el estado de fichaje";
  }

  return { state, error };
}
