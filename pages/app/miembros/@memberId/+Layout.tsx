import React, { useCallback, useMemo, useState } from "react";
import { usePageContext } from "vike-react/usePageContext";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { BarChart3, FileSpreadsheet, UserRound } from "lucide-react";

import { Tabs, type TabItem } from "../../../../ui/nav/Tabs";

const TAB_FADE_DURATION_MS = 800;
const TAB_NAV_DELAY_MS = 860;
const TAB_NAVIGATION_WAIT_MS = Math.max(0, TAB_NAV_DELAY_MS - TAB_FADE_DURATION_MS);

type MemberTabId = "informacion" | "contrato" | "estadisticas";

function baseMemberPath(pathname: string): string {
  const m = pathname.match(/^\/app\/miembros\/\d+/);
  return m ? m[0] : "/app/miembros";
}

function activeTabId(pathname: string): MemberTabId {
  if (pathname.startsWith("/app/miembros/") && pathname.includes("/contrato")) return "contrato";
  if (pathname.startsWith("/app/miembros/") && pathname.includes("/estadisticas")) return "estadisticas";
  return "informacion";
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const pageContext = usePageContext();
  const pathname = pageContext.urlPathname ?? "/app/miembros";
  const reduceMotion = useReducedMotion();
  const activeId = activeTabId(pathname);
  const basePath = baseMemberPath(pathname);

  const [isNavigatingOut, setIsNavigatingOut] = useState(false);
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  const tabs = useMemo<TabItem[]>(
    () => [
      { id: "informacion", label: "Informacion", href: `${basePath}`, icon: <UserRound className="bo-ico" /> },
      { id: "contrato", label: "Contrato", href: `${basePath}/contrato`, icon: <FileSpreadsheet className="bo-ico" /> },
      { id: "estadisticas", label: "Estadisticas", href: `${basePath}/estadisticas`, icon: <BarChart3 className="bo-ico" /> },
    ],
    [basePath],
  );

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
    <div className="bo-memberDetailRoute">
      <Tabs tabs={tabs} activeId={activeId} ariaLabel="Secciones de miembro" className="bo-tabs--memberDetail" onNavigate={onNavigateTab} />
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
    </div>
  );
}
