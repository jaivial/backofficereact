import type { BOSession } from "../../../api/types";
import { createClient } from "../../../api/client";

export function createLoginHandler({
  api,
  identifier,
  password,
  setSession,
  setError,
  setBusy,
}: {
  api: ReturnType<typeof createClient>;
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
