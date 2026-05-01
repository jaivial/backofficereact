import React, { useCallback, useEffect, useState } from "react";
import { usePageContext } from "vike-react/usePageContext";
import { navigate } from "vike/client/router";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import { MiembrosTabs } from "./functionalComponents/MiembrosTabs/MiembrosTabs";

const TAB_FADE_DURATION_MS = 380;

function activeTabId(pathname: string): "miembros" | "roles" {
  if (pathname.startsWith("/app/miembros/roles")) return "roles";
  return "miembros";
}

function isMembersTabRoute(pathname: string): boolean {
  if (pathname === "/app/miembros") return true;
  if (pathname.startsWith("/app/miembros/roles")) return true;
  return false;
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const pageContext = usePageContext();
  const pathname = pageContext.urlPathname ?? "/app/miembros";
  const reduceMotion = useReducedMotion();
  const showTabs = isMembersTabRoute(pathname);
  const activeId = activeTabId(pathname);
  const [isTransitioning, setIsTransitioning] = useState(false);

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

  if (!showTabs) return <>{children}</>;

  return (
    <>
      <MiembrosTabs activeId={activeId} onNavigate={onNavigateTab} />
      <AnimatePresence mode="wait">
        <motion.div
          key={pathname}
          initial={{ opacity: reduceMotion ? 1 : 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: reduceMotion ? 1 : 0 }}
          transition={transition}
          data-ui="page-content"
          data-role="miembros-content"
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </>
  );
}
