import React, { useCallback, useMemo, useState } from "react";
import { useSetAtom } from "jotai";

import { createClient } from "../../api/client";
import { sessionAtom } from "../../state/atoms";
import { InlineAlert } from "../../ui/feedback/InlineAlert";

export default function Page() {
  const api = useMemo(() => createClient({ baseUrl: "" }), []);
  const setSession = useSetAtom(sessionAtom);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = useCallback(
    async (ev: React.FormEvent) => {
      ev.preventDefault();
      setError(null);
      setBusy(true);
      try {
        const res = await api.auth.login(email, password);
        if (!res.success) {
          setError(res.message || "Login failed");
          return;
        }
        setSession(res.session);
        window.location.href = "/app/dashboard";
      } catch (e) {
        setError(e instanceof Error ? e.message : "Login failed");
      } finally {
        setBusy(false);
      }
    },
    [api, email, password, setSession],
  );

  return (
    <div className="bo-stage">
      <div className="bo-window bo-window--auth">
        <div className="bo-authCard" role="main" aria-label="Login">
          <div className="bo-title">Backoffice</div>
          <div className="bo-authSub">Accede con tu cuenta</div>

          {error ? <InlineAlert kind="error" title="Error" message={error} /> : null}

          <form onSubmit={onSubmit} className="bo-form">
            <label className="bo-field">
              <div className="bo-label">Email</div>
              <input
                className="bo-input"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
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

