import type { PageContextServer } from "vike/types";
import { useConfig } from "vike-react/useConfig";

import { createClient } from "../../../../api/client";
import type { MenuSelectorItem, SpecialDateListEntry, SpecialDateSettings } from "../../../../api/types";

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
  let list: SpecialDateListEntry[] = [];
  let error: string | null = null;

  // Run all three calls in parallel — but DO NOT short-circuit on a single
  // failure. The list of existing special dates must ALWAYS load so the user
  // can recover from a bad/missing special-date row (issue: "la lista de
  // otras fechas especiales no carga a veces"). Only the *transport* error
  // on the single-date lookup blocks the page; everything else silently
  // falls back to an empty value so the rest of the UI still renders.
  const results = await Promise.allSettled([
    api.config.getSpecialDate(date),
    api.menus.getSelector(),
    api.config.listSpecialDates(),
  ]);

  const [sdSettled, menusSettled, listSettled] = results;

  if (sdSettled.status === "fulfilled" && sdSettled.value.success) {
    specialDate = (sdSettled.value as { special_date: SpecialDateSettings | null }).special_date ?? null;
  } else if (sdSettled.status === "rejected") {
    // Only block the page if the single-date lookup itself errored (network,
    // 5xx). success=false with special_date=null just means "no special date
    // for this day" — that is a normal state and must NOT hide the list.
    error = sdSettled.reason instanceof Error ? sdSettled.reason.message : String(sdSettled.reason);
  }

  if (menusSettled.status === "fulfilled" && menusSettled.value.success) {
    availableMenus = (menusSettled.value as { menus?: MenuSelectorItem[] }).menus || [];
  }

  if (listSettled.status === "fulfilled" && listSettled.value.success) {
    list = (listSettled.value as { special_dates?: SpecialDateListEntry[] }).special_dates || [];
  }

  return { date, specialDate, availableMenus, list, error };
}
