import React, { useCallback, useState } from "react";
import { usePageContext } from "vike-react/usePageContext";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import { MiembrosTabs } from "./_components/MiembrosTabs";

const TAB_FADE_DURATION_MS = 380;
const TAB_NAV_DELAY_MS = 440;
const TAB_NAVIGATION_WAIT_MS = Math.max(0, TAB_NAV_DELAY_MS - TAB_FADE_DURATION_MS);

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
  const [isNavigatingOut, setIsNavigatingOut] = useState(false);
  const [pendingHref, setPendingHref] = useState<string | null>(null);

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

  if (!showTabs) return <>{children}</>;

  return (
    <>
      <MiembrosTabs activeId={activeId} onNavigate={onNavigateTab} />
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
