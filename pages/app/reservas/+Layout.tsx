import React, { useCallback, useEffect, useMemo, useState } from "react";
import { usePageContext } from "vike-react/usePageContext";
import { navigate } from "vike/client/router";
import { CalendarDays, PlusCircle, SlidersHorizontal, Map } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import { Tabs, type TabItem } from "../../../ui/nav/Tabs";

const TAB_FADE_DURATION_MS = 500;

function todayISO(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function activeTabId(pathname: string): string {
  if (pathname.startsWith("/app/reservas/config")) return "config";
  if (pathname.startsWith("/app/reservas/anadir")) return "anadir";
  if (pathname.startsWith("/app/reservas/tables")) return "tables";
  return "reservas";
}

function getCurrentUrlDate(): string | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const d = params.get("date");
  if (d && /^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
  return null;
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const pageContext = usePageContext();
  const pathname = pageContext.urlPathname ?? "/app/reservas";
  const dateFromSearch = typeof pageContext.urlParsed?.search?.date === "string" ? pageContext.urlParsed.search.date : "";
  const dateFromData = typeof (pageContext.data as any)?.date === "string" ? String((pageContext.data as any).date) : "";
  const initialDate = dateFromSearch || dateFromData || todayISO();

  // Track the current date from URL to keep tabs in sync when date changes via replaceState
  const [currentDate, setCurrentDate] = useState(initialDate);

  // Sync currentDate with URL on mount and on popstate
  useEffect(() => {
    if (typeof window === "undefined") return;

    const syncDate = () => {
      const urlDate = getCurrentUrlDate();
      if (urlDate) setCurrentDate(urlDate);
    };

    syncDate();
    window.addEventListener("popstate", syncDate);
    return () => window.removeEventListener("popstate", syncDate);
  }, []);

  // Also poll for URL changes (replaceState doesn't trigger events)
  useEffect(() => {
    if (typeof window === "undefined") return;

    const interval = setInterval(() => {
      const urlDate = getCurrentUrlDate();
      if (urlDate && urlDate !== currentDate) {
        setCurrentDate(urlDate);
      }
    }, 200);

    return () => clearInterval(interval);
  }, [currentDate]);

  const qs = useMemo(() => `?date=${encodeURIComponent(currentDate)}`, [currentDate]);
  const reduceMotion = useReducedMotion();
  const activeId = activeTabId(pathname);
  const isTablesRoute = pathname.startsWith("/app/reservas/tables");
  const [isNavigatingOut, setIsNavigatingOut] = useState(false);
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    const cur = url.searchParams.get("date");
    if (cur && /^\d{4}-\d{2}-\d{2}$/.test(cur)) return;
    url.searchParams.set("date", currentDate);
    window.history.replaceState(null, "", url.toString());
  }, [currentDate]);

  const tabs = useMemo<TabItem[]>(
    () => [
      { id: "reservas", label: "Reservas", href: `/app/reservas${qs}`, icon: <CalendarDays className="bo-ico" /> },
      { id: "tables", label: "Mapas", href: `/app/reservas/tables${qs}`, icon: <Map className="bo-ico" /> },
      { id: "config", label: "Configuración", href: `/app/reservas/config${qs}`, icon: <SlidersHorizontal className="bo-ico" /> },
      { id: "anadir", label: "Añadir", href: `/app/reservas/anadir${qs}`, icon: <PlusCircle className="bo-ico" /> },
    ],
    [qs],
  );

  const onNavigateTab = useCallback(
    (_href: string, id: string) => {
      if (id === activeId) return;
      // SPA nav: Vike client routing fetches .pageContext.json for the new route;
      // no full reload. Keeps the shared app shell mounted.
      void navigate(_href);
    },
    [activeId],
  );

  const transition = reduceMotion ? { duration: 0 } : { duration: TAB_FADE_DURATION_MS / 1000, ease: "easeInOut" as const };

  if (isTablesRoute) {
    return <>{children}</>;
  }

  return (
    <>
      <Tabs tabs={tabs} activeId={activeId} ariaLabel="Pestañas reservas" className="bo-tabs--reservas flex flex-row rounded-xl w-fit my-0 mx-auto" onNavigate={onNavigateTab} />
      <AnimatePresence mode="wait">
        <motion.div
          key={pathname}
          initial={reduceMotion ? { opacity: 1 } : { opacity: 0 }}
          animate={reduceMotion ? { opacity: 1 } : { opacity: 1 }}
          exit={reduceMotion ? { opacity: 1 } : { opacity: 0 }}
          transition={transition}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </>
  );
}
