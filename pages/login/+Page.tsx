import React, { useCallback, useMemo, useState } from "react";
import { useSetAtom } from "jotai";

import { createClient } from "../../api/client";
import { sessionAtom } from "../../state/atoms";
import { useErrorToast } from "../../ui/feedback/useErrorToast";

export default function Page() {
  const api = useMemo(() => createClient({ baseUrl: "" }), []);
  const setSession = useSetAtom(sessionAtom);

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useErrorToast(error);

  const onSubmit = useCallback(
    async (ev: React.FormEvent) => {
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
    },
    [api, identifier, password, setSession],
  );

  return (
    <div className="bo-stage">
      <div className="bo-window bo-window--auth">
        <div className="bo-authCard" role="main" aria-label="Login">
          <div className="bo-title">Backoffice</div>
          <div className="bo-authSub">Accede con tu cuenta</div>

          <form onSubmit={onSubmit} className="bo-form">
            <label className="bo-field">
              <div className="bo-label">Email o usuario</div>
              <input
                className="bo-input"
                type="text"
                autoComplete="username"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                required
              />
            </label>

            <label className="bo-field">
              <div className="bo-label">Password</div>
              <input
                className="bo-input"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </label>

            <button className="bo-btn bo-btn--primary" type="submit" disabled={busy}>
              {busy ? "Entrando..." : "Entrar"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
