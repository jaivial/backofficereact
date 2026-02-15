import React, { useEffect, useMemo, useRef } from "react";
import { useAtomValue } from "jotai";
import { usePageContext } from "vike-react/usePageContext";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import { sessionAtom } from "../../state/atoms";
import { Sidebar } from "../../ui/shell/Sidebar";
import { Topbar } from "../../ui/shell/Topbar";

function titleForPath(pathname: string): string {
  if (pathname.startsWith("/app/reservas")) return "Reservas";
  if (pathname.startsWith("/app/menus")) return "Menus";
  if (pathname.startsWith("/app/config")) return "Configuracion";
  if (pathname.startsWith("/app/settings")) return "Ajustes";
  return "Dashboard";
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const pageContext = usePageContext();
  const session = useAtomValue(sessionAtom);
  const reduceMotion = useReducedMotion();
  const pathname = pageContext.urlPathname ?? "/";
  const title = useMemo(() => titleForPath(pathname), [pathname]);
  const prevRestaurant = useRef<number | null>(null);

  // `session` is guaranteed by server middleware, but keep render stable.
  if (!session) return null;

  useEffect(() => {
    const current = session.activeRestaurantId || null;
    if (!current) return;
    if (prevRestaurant.current === null) {
      prevRestaurant.current = current;
      return;
    }
    if (prevRestaurant.current !== current) {
      // Force a full reload so SSR data + local state are consistent for the new tenant.
      window.location.reload();
    }
  }, [session.activeRestaurantId]);

  return (
    <div className="bo-app bo-app--page">
      <Sidebar pathname={pathname} />
      <main className="bo-main">
        <Topbar title={title} />
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={pathname}
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
