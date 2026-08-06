import React, { useEffect } from "react";
import { usePageContext } from "vike-react/usePageContext";

function todayISO(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const pageContext = usePageContext();

  const dateFromSearch = typeof pageContext.urlParsed?.search?.date === "string" ? pageContext.urlParsed.search.date : "";
  const dateFromData = typeof (pageContext.data as any)?.date === "string" ? String((pageContext.data as any).date) : "";
  const date = dateFromSearch || dateFromData || todayISO();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    const current = url.searchParams.get("date");
    if (current && /^\d{4}-\d{2}-\d{2}$/.test(current)) return;
    url.searchParams.set("date", date);
    window.history.replaceState(null, "", url.toString());
  }, [date]);

  return <>{children}</>;
}
