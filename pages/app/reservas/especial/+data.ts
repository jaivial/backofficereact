import type { PageContextServer } from "vike/types";
import { useConfig } from "vike-react/useConfig";

import { createClient } from "../../../../api/client";
import type { MenuSelectorItem, SpecialDateSettings } from "../../../../api/types";

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
  config({ title: "Reservas especiales" });

  const date = typeof pageContext.urlParsed?.search?.date === "string" ? pageContext.urlParsed.search.date : todayISO();
  const backendOrigin = pageContext.boRequest?.backendOrigin ?? "http://127.0.0.1:8080";
  const cookieHeader = pageContext.boRequest?.cookieHeader ?? "";
  const api = createClient({ baseUrl: backendOrigin, cookieHeader });

  let specialDate: SpecialDateSettings | null = null;
  let availableMenus: MenuSelectorItem[] = [];
  let error: string | null = null;

  try {
    const [sdRes, menusRes] = await Promise.all([
      api.config.getSpecialDate(date),
      api.menus.getSelector(),
    ]);

    if (sdRes.success) {
      specialDate = (sdRes as { special_date: SpecialDateSettings | null }).special_date ?? null;
    } else {
      error = sdRes.message || "Error cargando reservas especiales";
    }

    if (menusRes.success) {
      availableMenus = (menusRes as { menus?: MenuSelectorItem[] }).menus || [];
    }
  } catch (e) {
    error = e instanceof Error ? e.message : "Error cargando reservas especiales";
  }

  return { date, specialDate, availableMenus, error };
}
