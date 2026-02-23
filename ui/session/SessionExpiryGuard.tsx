import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { useAtom } from "jotai";

import { SESSION_EXPIRED_EVENT, SESSION_EXPIRATION_UPDATED_EVENT, normalizeExpirationDate } from "../../lib/session-expiration";
import { sessionAtom, sessionMovingExpirationAtom } from "../../state/atoms";

function redirectToLogin(): void {
  if (typeof window === "undefined") return;
  if (window.location.pathname === "/login") return;
  const next = window.location.pathname + window.location.search;
  window.location.href = `/login?reason=session-expired&next=${encodeURIComponent(next)}`;
}

export function SessionExpiryGuard() {
  const [session, setSession] = useAtom(sessionAtom);
  const [movingExpirationDate, setMovingExpirationDate] = useAtom(sessionMovingExpirationAtom);
  const logoutInProgressRef = useRef(false);

  const normalizedMovingExpiration = useMemo(
    () => normalizeExpirationDate(movingExpirationDate),
    [movingExpirationDate],
  );

  const expireSession = useCallback(() => {
    if (logoutInProgressRef.current) return;
    logoutInProgressRef.current = true;
    setSession(null);
    setMovingExpirationDate(null);
    if (typeof window !== "undefined") {
      void fetch("/api/admin/logout", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: "{}",
      }).catch(() => undefined);
    }
    redirectToLogin();
  }, [setMovingExpirationDate, setSession]);

  useEffect(() => {
    if (session) {
      logoutInProgressRef.current = false;
      return;
    }
    setMovingExpirationDate(null);
  }, [session, setMovingExpirationDate]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const onExpirationUpdated = (event: Event) => {
      const customEvent = event as CustomEvent<string>;
      const normalized = normalizeExpirationDate(customEvent.detail);
      if (!normalized) return;
      setMovingExpirationDate(normalized);
    };
    const onExpired = () => expireSession();

    window.addEventListener(SESSION_EXPIRATION_UPDATED_EVENT, onExpirationUpdated);
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    return () => {
      window.removeEventListener(SESSION_EXPIRATION_UPDATED_EVENT, onExpirationUpdated);
      window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
    };
  }, [expireSession, setMovingExpirationDate]);

  useEffect(() => {
    if (!session || !normalizedMovingExpiration) return;
    const deadline = Date.parse(normalizedMovingExpiration);
    if (!Number.isFinite(deadline)) return;
    const remainingMs = deadline - Date.now();
    if (remainingMs <= 0) {
      expireSession();
      return;
    }
    const timer = window.setTimeout(() => {
      expireSession();
    }, remainingMs + 150);
    return () => window.clearTimeout(timer);
  }, [expireSession, normalizedMovingExpiration, session]);

  return null;
}
