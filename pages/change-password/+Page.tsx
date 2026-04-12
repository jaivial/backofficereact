import React, { useCallback, useMemo, useState } from "react";
import { useAtomValue, useSetAtom } from "jotai";

import { createClient } from "../../api/client";
import { sessionAtom } from "../../state/atoms";
import { useErrorToast } from "../../ui/feedback/useErrorToast";

export default function Page() {
  const api = useMemo(() => createClient({ baseUrl: "" }), []);
  const session = useAtomValue(sessionAtom);
  const setSession = useSetAtom(sessionAtom);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useErrorToast(error);

  const onSubmit = useCallback(
    async (ev: React.FormEvent) => {
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
    },
    [api.auth, confirmPassword, password, session, setSession],
  );

  return (
    <div className="bo-stage" data-slot="change-password-stage">
      <div className="bo-window bo-window--auth" data-slot="change-password-window--auth">
        <div className="bo-authCard" role="main" aria-label="Cambiar password" data-slot="change-password-cambiar-password">
          <div className="bo-title" data-slot="change-password-title">Actualizar password</div>
          <div className="bo-authSub" data-slot="change-password-authSub">Debes establecer una nueva password para continuar.</div>

          <form onSubmit={onSubmit} className="bo-form" data-testid="change-password-form">
            <label className="bo-field" data-slot="change-password-field">
              <div className="bo-label" data-slot="change-password-label">Nueva password</div>
              <input
                className="bo-input"
                type="password"
                autoComplete="new-password"
                value={password}
                data-testid="change-password-new-password"
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </label>

            <label className="bo-field" data-slot="change-password-field">
              <div className="bo-label" data-slot="change-password-label">Repetir password</div>
              <input
                className="bo-input"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                data-testid="change-password-confirm-password"
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </label>

            <button className="bo-btn bo-btn--primary" type="submit" data-testid="change-password-submit" disabled={busy}>
              {busy ? "Guardando..." : "Confirmar"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
