import type { BOSession } from "../../../api/types";
import { createAuthClient } from "../../../api/auth-client";
import { confirmLoginSession } from "./session-confirmation";

export function createLoginHandler({
  api,
  identifier,
  password,
  setSession,
  setError,
  setBusy,
}: {
  api: ReturnType<typeof createAuthClient>;
  identifier: string;
  password: string;
  setSession: (session: BOSession) => void;
  setError: (error: string | null) => void;
  setBusy: (busy: boolean) => void;
}) {
  return async (ev: React.FormEvent) => {
    ev.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await api.auth.login(identifier, password);
      if (!res.success) {
        setError(res.message || "Login failed");
        return;
      }
      await confirmLoginSession(async () => {
        const sessionCheck = await fetch("/api/admin/me", { credentials: "include" });
        if (!sessionCheck.ok) throw new Error(`Session confirmation failed (HTTP ${sessionCheck.status})`);
        return (await sessionCheck.json()) as { success?: boolean; session?: { user?: unknown } };
      });
      setSession(res.session);
      if (res.session.user.mustChangePassword) {
        window.location.href = "/change-password";
        return;
      }
      window.location.href = "/app/backoffice";
    } catch (e) {
      setError(e instanceof Error ? e.message : "Login failed");
    } finally {
      setBusy(false);
    }
  };
}
