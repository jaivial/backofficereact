import React, { useEffect, useMemo, useRef } from "react";
import { useAtomValue } from "jotai";
import { usePageContext } from "vike-react/usePageContext";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import { sessionAtom } from "../../../state/atoms";
import { Sidebar } from "../../../ui/shell/Sidebar";
import { Topbar } from "../../../ui/shell/Topbar";
import { titleForPath } from "./helpers/titleForPath";

export default function Layout({ children }: { children: React.ReactNode }) {
  const pageContext = usePageContext();
  const session = useAtomValue(sessionAtom);
  const reduceMotion = useReducedMotion();
  const pathname = pageContext.urlPathname ?? "/";
  const isReservasTables = pathname.startsWith("/app/reservas/tables");
  const title = useMemo(() => titleForPath(pathname), [pathname]);
  const prevRestaurant = useRef<number | null>(null);

  // `session` is guaranteed by server middleware, but keep render stable.
  useEffect(() => {
    const current = session?.activeRestaurantId || null;
    if (!current) return;
    if (prevRestaurant.current === null) {
      prevRestaurant.current = current;
      return;
    }
    if (prevRestaurant.current !== current) {
      // Force a full reload so SSR data + local state are consistent for the new tenant.
      window.location.reload();
    }
  }, [session?.activeRestaurantId]);

  if (!session) return null;

  return (
    <div className="bo-app bo-app--page" data-ui="app-shell">
      <Sidebar
        pathname={pathname}
        role={session.user.role}
        sectionAccess={session.user.sectionAccess}
        roleImportance={session.user.roleImportance}
      />
      <main className={`bo-main${isReservasTables ? " bo-main--immersive" : ""}`} data-ui="app-main">
        {isReservasTables ? null : <Topbar title={title} />}
        <AnimatePresence mode="wait">
          <motion.div
            key={pathname}
            data-ui="app-content"
            initial={reduceMotion ? { opacity: 1 } : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={reduceMotion ? { opacity: 1 } : { opacity: 0 }}
            transition={reduceMotion ? { duration: 0 } : { duration: 0.18, ease: "easeOut" }}
            style={{ display: "contents" }}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
