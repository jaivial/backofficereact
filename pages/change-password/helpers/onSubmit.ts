import type { BOSession } from "../../../api/types";
import { createClient } from "../../../api/client";

export function createChangePasswordHandler({
  api,
  password,
  confirmPassword,
  session,
  setSession,
  setError,
  setBusy,
}: {
  api: ReturnType<typeof createClient>;
  password: string;
  confirmPassword: string;
  session: BOSession | null;
  setSession: (session: BOSession) => void;
  setError: (error: string | null) => void;
  setBusy: (busy: boolean) => void;
}) {
  return async (ev: React.FormEvent) => {
    ev.preventDefault();
    setError(null);
    if (!session) {
      window.location.href = "/login";
      return;
    }
    if (!password || !confirmPassword) {
      setError("Debes completar ambos campos");
      return;
    }
    if (password !== confirmPassword) {
      setError("Las passwords no coinciden");
      return;
    }

    setBusy(true);
    try {
      const res = await api.auth.setPassword(password, confirmPassword);
      if (!res.success) {
        setError(res.message || "No se pudo actualizar");
        return;
      }
      setSession(
        session
          ? {
              ...session,
              user: { ...session.user, mustChangePassword: false },
            }
          : session,
      );
      window.location.href = "/app/backoffice";
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo actualizar");
    } finally {
      setBusy(false);
    }
  };
}
