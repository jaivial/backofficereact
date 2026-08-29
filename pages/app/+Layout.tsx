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
  const isPosPage = pathname.startsWith("/app/pos");
  const posFullscreen = useAtomValue(posFullscreenAtom) && isPosPage;
  const immersive = isReservasTables || posFullscreen;
  const prevRestaurant = useRef<number | null>(null);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  useEffect(() => {
    if (session) setSession(session);
  }, [session, setSession]);

  // [AD-DEBUG] A/B app versioning: log the resolved session version so
  // agent-browser (lightpanda) console captures can verify the gating.
  useEffect(() => {
    console.log("[AD-DEBUG] session appVersion:", session?.user?.appVersion ?? "(none)", "role:", session?.user?.role, "sections:", session?.user?.sectionAccess);
  }, [session]);

  useEffect(() => {
    const current = session?.activeRestaurantId || null;
    if (!current) return;
    if (prevRestaurant.current === null) {
      prevRestaurant.current = current;
      return;
    }
    if (prevRestaurant.current !== current) {
      window.location.reload();
    }
  }, [session?.activeRestaurantId]);

  // ponytail: never unmount during CSR, children handle missing session
  if (!session) {
    return <main className="bo-main">{children}</main>;
  }

  return (
    <div className="bo-app bo-app--page" data-slot="Layout-app--page">
      {posFullscreen ? null : (
        <Sidebar
          pathname={pathname}
          role={session.user.role}
          sectionAccess={session.user.sectionAccess}
          roleImportance={session.user.roleImportance}
          appVersion={session.user.appVersion}
        />
      )}
      <main className={`bo-main${immersive ? " bo-main--immersive" : ""}${posFullscreen ? " bo-main--pos-fullscreen" : ""}${isPosPage ? " bo-main--pos" : ""}`} data-testid="app-layout-main">
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
