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

  // Track if this is the first render after navigation (for entrance animation)
  const isFirstRender = pageContext.previousPageContext === undefined;

  // Track the current date from URL to keep tabs in sync when date changes via replaceState
  const [currentDate, setCurrentDate] = useState(initialDate);

  // Track if we're in a tab transition (to coordinate animations)
  const [isTransitioning, setIsTransitioning] = useState(false);

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
    async (_href: string, id: string) => {
      if (id === activeId) return;
      if (!_href) return;

      // Start transition animation
      setIsTransitioning(true);

      // Small delay to let exit animation start before navigation
      // This prevents visual gaps during client-side navigation
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Use vike's navigate() for smooth client-side navigation
      // This avoids full page reload and prevents flash
      await navigate(_href);

      // Transition state will reset on next render (when pathname changes)
    },
    [activeId],
  );

  // Reset transitioning state when pathname changes (new page rendered)
  useEffect(() => {
    setIsTransitioning(false);
  }, [pathname]);

  const transition = reduceMotion
    ? { duration: 0 }
    : { duration: TAB_FADE_DURATION_MS / 1000, ease: "easeInOut" as const };

  if (isTablesRoute) {
    return <>{children}</>;
  }

  return (
    <>
      <Tabs
        tabs={tabs}
        activeId={activeId}
        ariaLabel="Pestañas reservas"
        className="bo-tabs--reservas flex flex-row rounded-xl w-fit my-0 mx-auto"
        onNavigate={onNavigateTab}
      />
      <AnimatePresence mode="wait">
        <motion.div
          key={pathname}
          initial={{
            opacity: isFirstRender || reduceMotion ? 1 : 0,
          }}
          animate={{
            opacity: 1,
          }}
          exit={{
            opacity: reduceMotion ? 1 : 0,
          }}
          transition={transition}
          data-ui="page-content"
          data-role="reservas-content"
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </>
  );
}
