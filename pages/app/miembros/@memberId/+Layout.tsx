import React, { useCallback, useEffect, useMemo, useState } from "react";
import { usePageContext } from "vike-react/usePageContext";
import { navigate } from "vike/client/router";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { BarChart3, FileSpreadsheet, UserRound } from "lucide-react";

import { Tabs, type TabItem } from "../../../../ui/nav/Tabs";

const TAB_FADE_DURATION_MS = 800;

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

  const [isTransitioning, setIsTransitioning] = useState(false);

  const tabs = useMemo<TabItem[]>(
    () => [
      { id: "informacion", label: "Informacion", href: `${basePath}`, icon: <UserRound className="bo-ico" /> },
      { id: "contrato", label: "Contrato", href: `${basePath}/contrato`, icon: <FileSpreadsheet className="bo-ico" /> },
      { id: "estadisticas", label: "Estadisticas", href: `${basePath}/estadisticas`, icon: <BarChart3 className="bo-ico" /> },
    ],
    [basePath],
  );

  const onNavigateTab = useCallback(
    async (href: string, id: string) => {
      if (id === activeId) return;
      if (!href) return;

      setIsTransitioning(true);
      await new Promise((resolve) => setTimeout(resolve, 50));
      await navigate(href);
    },
    [activeId],
  );

  useEffect(() => {
    setIsTransitioning(false);
  }, [pathname]);

  const transition = reduceMotion
    ? { duration: 0 }
    : { duration: TAB_FADE_DURATION_MS / 1000, ease: "easeInOut" as const };

  return (
    <div className="bo-memberDetailRoute" data-slot="Layout-memberDetailRoute">
      <Tabs tabs={tabs} activeId={activeId} ariaLabel="Secciones de miembro" className="bo-tabs--memberDetail" onNavigate={onNavigateTab} />
      <AnimatePresence mode="wait">
        <motion.div
          key={pathname}
          initial={{ opacity: reduceMotion ? 1 : 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: reduceMotion ? 1 : 0 }}
          transition={transition}
          data-ui="page-content"
          data-role="member-content"
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
