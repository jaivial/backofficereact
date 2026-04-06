import React, { useMemo, useState } from "react";
import { useSetAtom } from "jotai";

import { createClient } from "../../api/client";
import { sessionAtom } from "../../state/atoms";
import { useErrorToast } from "../../ui/feedback/useErrorToast";
import { createLoginHandler } from "./helpers/onSubmit";

export default function LoginPage() {
  const api = useMemo(() => createClient({ baseUrl: "" }), []);
  const setSession = useSetAtom(sessionAtom);

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useErrorToast(error);

  const onSubmit = createLoginHandler({
    api,
    identifier,
    password,
    setSession,
    setError,
    setBusy,
  });

  return (
    <div className="bo-stage" data-ui="login-stage">
      <div className="bo-window bo-window--auth" data-ui="login-window">
        <div className="bo-authCard" role="main" aria-label="Login" data-ui="login-card">
          <div className="bo-title" data-ui="login-title">Backoffice</div>
          <div className="bo-authSub" data-ui="login-subtitle">Accede con tu cuenta</div>

          <form onSubmit={onSubmit} className="bo-form" data-ui="login-form">
            <label className="bo-field" data-ui="login-field-identifier">
              <div className="bo-label" data-ui="login-label-identifier">Email o usuario</div>
              <input
                className="bo-input"
                type="text"
                autoComplete="username"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                required
                data-ui="login-input-identifier"
              />
            </label>

            <label className="bo-field" data-ui="login-field-password">
              <div className="bo-label" data-ui="login-label-password">Password</div>
              <input
                className="bo-input"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                data-ui="login-input-password"
              />
            </label>

            <button
              className="bo-btn bo-btn--primary"
              type="submit"
              disabled={busy}
              data-ui="login-submit"
            >
              {busy ? "Entrando..." : "Entrar"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
