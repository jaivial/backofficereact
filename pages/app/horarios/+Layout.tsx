import React, { useCallback, useEffect, useMemo, useState } from "react";
import { usePageContext } from "vike-react/usePageContext";
import { navigate } from "vike/client/router";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { CalendarClock, Eye, Clock3 } from "lucide-react";
import { useAtomValue } from "jotai";

import { Tabs, type TabItem } from "../../../ui/nav/Tabs";
import { sessionAtom } from "../../../state/atoms";
import { canManageHorarios } from "../../../lib/rbac";

const TAB_FADE_DURATION_MS = 420;

type HorariosTabId = "horarios" | "preview" | "turnos" | "mis-horarios";

function todayISO(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function activeTabId(pathname: string, isAdmin: boolean): HorariosTabId {
  if (!isAdmin) return "mis-horarios";
  if (pathname.startsWith("/app/horarios/preview")) return "preview";
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

  const [isTransitioning, setIsTransitioning] = useState(false);

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
      { id: "preview", label: "Preview", href: `/app/horarios/preview${qs}`, icon: <Eye className="bo-ico" /> },
      { id: "turnos", label: "Turnos", href: `/app/horarios/turnos${qs}`, icon: <Clock3 className="bo-ico" /> },
    ];
  }, [isAdmin, qs]);

  const onNavigateTab = useCallback(
    async (href: string, id: string) => {
      if (id === activeId) return;
      if (!href) return;

      // Start transition animation
      setIsTransitioning(true);

      // Small delay to let exit animation start before navigation
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Use vike's navigate() for smooth client-side navigation
      await navigate(href);
    },
    [activeId],
  );

  // Reset transitioning state when pathname changes
  useEffect(() => {
    setIsTransitioning(false);
  }, [pathname]);

  const transition = reduceMotion
    ? { duration: 0 }
    : { duration: TAB_FADE_DURATION_MS / 1000, ease: "easeInOut" as const };

  return (
    <>
      <Tabs tabs={tabs} activeId={activeId} ariaLabel="Pestanas de horarios" className="bo-tabs--horarios flex flex-row rounded-xl !w-fit my-0 mx-auto" onNavigate={onNavigateTab} />
      <AnimatePresence mode="wait">
        <motion.div
          key={pathname}
          initial={{ opacity: reduceMotion ? 1 : 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: reduceMotion ? 1 : 0 }}
          transition={transition}
          data-ui="page-content"
          data-role="horarios-content"
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </>
  );
}
