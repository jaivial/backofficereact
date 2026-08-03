import React, { useEffect, useRef } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { usePageContext } from "vike-react/usePageContext";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import { posFullscreenAtom, sessionAtom } from "../../state/atoms";
import { ForkyButton } from "../../ui/forky/ForkyButton";
import { ForkyModal } from "../../ui/forky/ForkyModal";
import { Sidebar } from "../../ui/shell/Sidebar";
import { Topbar } from "../../ui/shell/Topbar";

export default function Layout({ children }: { children: React.ReactNode }) {
  const pageContext = usePageContext();
  const setSession = useSetAtom(sessionAtom);
  const session = pageContext.bo?.session ?? null;
  const reduceMotion = useReducedMotion();
  const pathname = pageContext.urlPathname ?? "/";
  const isReservasTables = pathname.startsWith("/app/reservas/tables");
  const posFullscreen = useAtomValue(posFullscreenAtom) && pathname.startsWith("/app/pos");
  const immersive = isReservasTables || posFullscreen;
  const prevRestaurant = useRef<number | null>(null);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  useEffect(() => {
    if (session) setSession(session);
  }, [session, setSession]);

  // ponytail: never unmount during CSR, children handle missing session
  if (!session) {
    return <main className="bo-main">{children}</main>;
  }

  useEffect(() => {
    const current = session.activeRestaurantId || null;
    if (!current) return;
    if (prevRestaurant.current === null) {
      prevRestaurant.current = current;
      return;
    }
    if (prevRestaurant.current !== current) {
      window.location.reload();
    }
  }, [session.activeRestaurantId]);

  return (
    <div className="bo-app bo-app--page" data-slot="Layout-app--page">
      {posFullscreen ? null : (
        <Sidebar
          pathname={pathname}
          role={session.user.role}
          sectionAccess={session.user.sectionAccess}
          roleImportance={session.user.roleImportance}
        />
      )}
      <main className={`bo-main${immersive ? " bo-main--immersive" : ""}${posFullscreen ? " bo-main--pos-fullscreen" : ""}`} data-testid="app-layout-main">
        {immersive ? null : <Topbar />}
        <AnimatePresence mode="wait">
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
      {posFullscreen ? null : (
        <>
          <ForkyButton />
          <ForkyModal />
        </>
      )}
    </div>
  );
}
