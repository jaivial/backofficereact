import React, { useCallback, useEffect, useMemo, useState } from "react";
import { usePageContext } from "vike-react/usePageContext";
import { CalendarDays, PlusCircle, SlidersHorizontal } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import { Tabs, type TabItem } from "../../../ui/nav/Tabs";

const TAB_FADE_DURATION_MS = 500;
const TAB_NAV_DELAY_MS = 600;
const TAB_NAVIGATION_WAIT_MS = Math.max(0, TAB_NAV_DELAY_MS - TAB_FADE_DURATION_MS);

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
  return "reservas";
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const pageContext = usePageContext();
  const pathname = pageContext.urlPathname ?? "/app/reservas";
  const dateFromSearch = typeof pageContext.urlParsed?.search?.date === "string" ? pageContext.urlParsed.search.date : "";
  const dateFromData = typeof (pageContext.data as any)?.date === "string" ? String((pageContext.data as any).date) : "";
  const date = dateFromSearch || dateFromData || todayISO();
  const qs = `?date=${encodeURIComponent(date)}`;
  const reduceMotion = useReducedMotion();
  const activeId = activeTabId(pathname);
  const [isNavigatingOut, setIsNavigatingOut] = useState(false);
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    const cur = url.searchParams.get("date");
    if (cur && /^\d{4}-\d{2}-\d{2}$/.test(cur)) return;
    url.searchParams.set("date", date);
    window.history.replaceState(null, "", url.toString());
  }, [date]);

  const tabs = useMemo<TabItem[]>(
    () => [
      { id: "reservas", label: "Reservas", href: `/app/reservas${qs}`, icon: <CalendarDays className="bo-ico" /> },
      { id: "config", label: "Configuración", href: `/app/reservas/config${qs}`, icon: <SlidersHorizontal className="bo-ico" /> },
      { id: "anadir", label: "Añadir", href: `/app/reservas/anadir${qs}`, icon: <PlusCircle className="bo-ico" /> },
    ],
    [qs],
  );

  const onNavigateTab = useCallback(
    (_href: string, id: string) => {
      if (isNavigatingOut) return;
      if (id === activeId) return;
      if (reduceMotion) {
        window.location.assign(_href);
        return;
      }
      if (typeof window === "undefined") return;
      if (!_href) return;
      setIsNavigatingOut(true);
      setPendingHref(_href);
    },
    [activeId, isNavigatingOut, reduceMotion],
  );

  const transition = reduceMotion ? { duration: 0 } : { duration: TAB_FADE_DURATION_MS / 1000, ease: "easeInOut" as const };

  const handleExitComplete = useCallback(() => {
    if (!isNavigatingOut || reduceMotion || !pendingHref) return;
    const href = pendingHref;
    window.setTimeout(() => {
      window.location.assign(href);
    }, TAB_NAVIGATION_WAIT_MS);
  }, [isNavigatingOut, pendingHref, reduceMotion]);

  return (
    <>
      <Tabs tabs={tabs} activeId={activeId} ariaLabel="Pestañas reservas" className="bo-tabs--reservas" onNavigate={onNavigateTab} />
      <AnimatePresence mode="wait" onExitComplete={handleExitComplete}>
        {!isNavigatingOut ? (
          <motion.div
            key={pathname}
            initial={reduceMotion ? { opacity: 1 } : { opacity: 0 }}
            animate={reduceMotion ? { opacity: 1 } : { opacity: 1 }}
            exit={reduceMotion ? { opacity: 1 } : { opacity: 0 }}
            transition={transition}
          >
            {children}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
