import React, { useMemo, useEffect } from "react";
import { Provider as JotaiProvider, createStore } from "jotai";
import { usePageContext } from "vike-react/usePageContext";

function registerServiceWorker() {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;

  // In development the cache-first service worker serves stale JS/CSS and HTML,
  // which hides source changes (Vite HMR already handles freshness). Unregister
  // any previously-installed worker and clear its caches instead of registering.
  if (import.meta.env.DEV) {
    navigator.serviceWorker.getRegistrations().then((regs) => {
      regs.forEach((reg) => reg.unregister());
    });
    if ("caches" in window) {
      caches.keys().then((keys) => keys.forEach((k) => caches.delete(k)));
    }
    return;
  }

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => console.log("[SW] registered:", reg.scope))
      .catch((err) => console.warn("[SW] registration failed:", err));
  });
}

import "../ui/styles/shadcn.css";
import "../components/bo.css";
import type { BOSession } from "../api/types";
import { ToastStack } from "../ui/feedback/ToastStack";
import { FichajeRealtimeBridge } from "../ui/fichaje/FichajeRealtimeBridge";
import { SessionExpiryGuard } from "../ui/session/SessionExpiryGuard";
import { ThemeSync } from "../ui/theme/ThemeSync";
import { sessionAtom, sessionMovingExpirationAtom, themeAtom, forkyHiddenAtom, type ThemeMode } from "../state/atoms";
import { readForkyHiddenFromStorage } from "../ui/forky/ForkyButton";

function initStore(theme: ThemeMode, session: BOSession | null, movingExpirationDate: string | null) {
  const store = createStore();
  store.set(themeAtom, theme);
  store.set(sessionAtom, session);
  store.set(sessionMovingExpirationAtom, movingExpirationDate);
  // Initialize Forky hidden state from localStorage
  if (typeof window !== "undefined") {
    store.set(forkyHiddenAtom, readForkyHiddenFromStorage());
  }
  return store;
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const pageContext = usePageContext();
  const initialTheme: ThemeMode = pageContext.bo?.theme === "light" ? "light" : "dark";

  useEffect(() => {
    registerServiceWorker();
  }, []);
  const initialSession = pageContext.bo?.session ?? null;
  const initialMovingExpirationDate = pageContext.bo?.movingExpirationDate ?? null;

  const store = useMemo(
    () => initStore(initialTheme, initialSession, initialMovingExpirationDate),
    [],
  );

  return (
    <>
      <style>{`input.bo-input, textarea.bo-input { font-size: 16px !important; }`}</style>
      <JotaiProvider store={store}>
      <ThemeSync />
      <SessionExpiryGuard />
      <FichajeRealtimeBridge />
      <ToastStack />
      <div id="bo-portal" data-slot="portal-target" />
      {children}
    </JotaiProvider>
    </>
  );
}
