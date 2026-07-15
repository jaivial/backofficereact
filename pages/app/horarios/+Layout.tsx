import React, { useCallback, useEffect, useMemo, useState } from "react";
import { usePageContext } from "vike-react/usePageContext";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { CalendarClock, Clock3 } from "lucide-react";
import { useAtomValue } from "jotai";

import { Tabs, type TabItem } from "../../../ui/nav/Tabs";
import { sessionAtom } from "../../../state/atoms";
import { canManageHorarios } from "../../../lib/rbac";

const TAB_FADE_DURATION_MS = 420;
const TAB_NAV_DELAY_MS = 500;
const TAB_NAVIGATION_WAIT_MS = Math.max(0, TAB_NAV_DELAY_MS - TAB_FADE_DURATION_MS);

type HorariosTabId = "horarios" | "turnos" | "mis-horarios";

function todayISO(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function activeTabId(pathname: string, isAdmin: boolean): HorariosTabId {
  if (!isAdmin) return "mis-horarios";
  if (pathname.startsWith("/app/horarios/turnos")) return "turnos";
  return "horarios";
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const pageContext = usePageContext();
  const session = useAtomValue(sessionAtom);
  const isAdmin = canManageHorarios(session?.user?.role ?? null, session?.user?.roleImportance ?? 0);
  const pathname = pageContext.urlPathname ?? "/app/horarios";
  const reduceMotion = useReducedMotion();
  const activeId = activeTabId(pathname, isAdmin);

  const dateFromSearch = typeof pageContext.urlParsed?.search?.date === "string" ? pageContext.urlParsed.search.date : "";
  const dateFromData = typeof (pageContext.data as any)?.date === "string" ? String((pageContext.data as any).date) : "";
  const date = dateFromSearch || dateFromData || todayISO();
  const qs = `?date=${encodeURIComponent(date)}`;

  const [isNavigatingOut, setIsNavigatingOut] = useState(false);
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    const current = url.searchParams.get("date");
    if (current && /^\d{4}-\d{2}-\d{2}$/.test(current)) return;
    url.searchParams.set("date", date);
    window.history.replaceState(null, "", url.toString());
  }, [date]);

  const tabs = useMemo<TabItem[]>(() => {
    if (!isAdmin) {
      return [{ id: "mis-horarios", label: "Mis horarios", href: `/app/horarios${qs}`, icon: <Clock3 className="bo-ico" /> }];
    }
    return [
      { id: "horarios", label: "Horarios", href: `/app/horarios${qs}`, icon: <CalendarClock className="bo-ico" /> },
      { id: "turnos", label: "Turnos", href: `/app/horarios/turnos${qs}`, icon: <Clock3 className="bo-ico" /> },
    ];
  }, [isAdmin, qs]);

  const onNavigateTab = useCallback(
    (href: string, id: string) => {
      if (isNavigatingOut) return;
      if (id === activeId) return;
      if (reduceMotion) {
        window.location.assign(href);
        return;
      }
      if (typeof window === "undefined") return;
      if (!href) return;
      setIsNavigatingOut(true);
      setPendingHref(href);
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
      <Tabs tabs={tabs} activeId={activeId} ariaLabel="Pestanas de horarios" className="bo-tabs--horarios flex flex-row rounded-xl !w-fit my-0 mx-auto" onNavigate={onNavigateTab} layoutId="boHorariosNavTabIndicator" />
      <AnimatePresence mode="wait" onExitComplete={handleExitComplete}>
        {!isNavigatingOut ? (
          <motion.div
            key={pathname}
            initial={reduceMotion ? { opacity: 1 } : { opacity: 0 }}
            animate={{ opacity: 1 }}
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
