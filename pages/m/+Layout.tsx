import React from "react";
import { Provider as JotaiProvider, createStore } from "jotai";
import { usePageContext } from "vike-react/usePageContext";

import "../../ui/styles/shadcn.css";
import "../../components/bo.css";
import type { BOSession } from "../../api/types";
import { ToastStack } from "../../ui/feedback/ToastStack";
import { SessionExpiryGuard } from "../../ui/session/SessionExpiryGuard";
import { ThemeSync } from "../../ui/theme/ThemeSync";
import { sessionAtom, sessionMovingExpirationAtom, themeAtom, type ThemeMode } from "../../state/atoms";
import { MobileNav } from "../../ui/nav/MobileNav";
import { useAtomValue } from "jotai";

function initStore(theme: ThemeMode, session: BOSession | null, movingExpirationDate: string | null) {
  const store = createStore();
  store.set(themeAtom, theme);
  store.set(sessionAtom, session);
  store.set(sessionMovingExpirationAtom, movingExpirationDate);
  return store;
}

function MobileLayoutInner({ children }: { children: React.ReactNode }) {
  const pathname = usePageContext().urlPathname ?? "/";
  return (
    <div className="bo-mobile-shell flex flex-col h-screen bg-[hsl(var(--background))] text-[hsl(var(--foreground))]" data-slot="Layout-text-[hsl(var(-">
      {/* Content area with bottom nav padding */}
      <main className="flex-1 overflow-y-auto pb-20" data-testid="mobile-layout-main">
        {children}
      </main>
      {/* Bottom navigation bar */}
      <MobileNav pathname={pathname}>
    </div>
  );
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const pageContext = usePageContext();
  const initialTheme: ThemeMode = pageContext.bo?.theme === "light" ? "light" : "dark";
  const initialSession = pageContext.bo?.session ?? null;
  const initialMovingExpirationDate = pageContext.bo?.movingExpirationDate ?? null;

  const store = React.useMemo(
    () => initStore(initialTheme, initialSession, initialMovingExpirationDate),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  return (
    <JotaiProvider store={store}>
      <ThemeSync />
      <SessionExpiryGuard />
      <ToastStack />
      <MobileLayoutInner>{children}</MobileLayoutInner>
    </JotaiProvider>
  );
}
