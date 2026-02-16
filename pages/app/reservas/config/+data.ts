import type { PageContextServer } from "vike/types";
import { useConfig } from "vike-react/useConfig";

import { createClient } from "../../../../api/client";
import type {
  ConfigDailyLimit,
  ConfigDayStatus,
  ConfigFloor,
  ConfigMesasDeDos,
  ConfigMesasDeTres,
  ConfigOpeningHours,
} from "../../../../api/types";

export type Data = Awaited<ReturnType<typeof data>>;

function todayISO(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export async function data(pageContext: PageContextServer) {
  const config = useConfig();
  config({ title: "Configuración reservas" });

  const date = typeof pageContext.urlParsed?.search?.date === "string" ? pageContext.urlParsed.search.date : todayISO();
  const backendOrigin = pageContext.boRequest?.backendOrigin ?? "http://127.0.0.1:8080";
  const cookieHeader = pageContext.boRequest?.cookieHeader ?? "";
  const api = createClient({ baseUrl: backendOrigin, cookieHeader });

  let error: string | null = null;
  let day: ConfigDayStatus | null = null;
  let dailyLimit: ConfigDailyLimit | null = null;
  let openingHours: ConfigOpeningHours | null = null;
  let mesasDeDos: ConfigMesasDeDos | null = null;
  let mesasDeTres: ConfigMesasDeTres | null = null;
  let floors: ConfigFloor[] = [];

  try {
    const [d0, d1, d2, d3, d4, d5] = await Promise.all([
      api.config.getDay(date),
      api.config.getDailyLimit(date),
      api.config.getOpeningHours(date),
      api.config.getMesasDeDos(date),
      api.config.getMesasDeTres(date),
      api.config.getFloors(date),
    ]);

    if (d0.success) day = d0;
    else error = d0.message || "Error cargando estado del día";

    if (d1.success) dailyLimit = d1;
    else if (!error) error = d1.message || "Error cargando límite diario";

    if (d2.success) openingHours = d2;
    else if (!error) error = d2.message || "Error cargando horarios";

    if (d3.success) mesasDeDos = d3;
    else if (!error) error = d3.message || "Error cargando mesas de 2";

    if (d4.success) mesasDeTres = d4;
    else if (!error) error = d4.message || "Error cargando mesas de 3";

    if (d5.success) floors = d5.floors || [];
    else if (!error) error = d5.message || "Error cargando plantas";
  } catch (e) {
    error = e instanceof Error ? e.message : "Error cargando configuración";
  }

  return { date, day, dailyLimit, openingHours, mesasDeDos, mesasDeTres, floors, error };
}
