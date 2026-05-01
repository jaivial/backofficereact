import React, { useMemo, useState } from "react";
import { CheckCircle2, CircleAlert, Loader2 } from "lucide-react";
import { usePageContext } from "vike-react/usePageContext";

import { createClient } from "../../../api/client";
import type { PasswordResetPreview } from "../../../api/types";
import type { Data } from "./+data";
import { usePasswordResetValidation, usePasswordResetSubmit } from "./helpers/reset-password";

export default function Page() {
  const pageContext = usePageContext();
  const data = (pageContext.data ?? {}) as Partial<Data>;
  const token = String(data.token ?? "").trim();
  const api = useMemo(() => createClient({ baseUrl: "" }), []);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<PasswordResetPreview | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  usePasswordResetValidation(
    api,
    token,
    setPreview,
    setError,
    () => setLoading(false),
  );

  const submitReset = usePasswordResetSubmit(api, token, setError, () => setDone(true));
  const onSubmit = () => {
    if (!password || !confirmPassword) {
      setError("Debes completar ambos campos");
      return;
    }
    if (password !== confirmPassword) {
      setError("Las passwords no coinciden");
      return;
    }
    setBusy(true);
    void submitReset(password, confirmPassword).finally(() => setBusy(false));
  };

  return (
    <div className="bo-stage" data-slot="reset-password-stage">
      <div className="bo-window bo-window--auth bo-onboardingWindow" data-slot="reset-password-onboardingWindow">
        <div className="bo-authCard" role="main" aria-label="Reset password" data-slot="reset-password-reset-password">
          {loading ? (
            <div className="bo-onboardingLoading" data-slot="reset-password-onboardingLoading">
              <Loader2 size={20} className="is-spinning" />
              Validando enlace...
            </div>
          ) : error && !preview ? (
            <>
              <div className="bo-onboardingIcon bo-onboardingIcon--error" data-slot="reset-password-onboardingIcon--error">
                <CircleAlert size={30} />
              </div>
              <div className="bo-title" data-slot="reset-password-title">Enlace no válido</div>
              <div className="bo-authSub" data-slot="reset-password-authSub">{error}</div>
              <button className="bo-btn bo-btn--ghost" type="button" data-testid="reset-password-login-link" onClick={() => (window.location.href = "/login")}>
                Ir a login
              </button>
            </>
          ) : done ? (
            <>
              <div className="bo-onboardingIcon bo-onboardingIcon--ok" data-slot="reset-password-onboardingIcon--ok">
                <CheckCircle2 size={30} />
              </div>
              <div className="bo-title" data-slot="reset-password-title">Password actualizada</div>
              <div className="bo-authSub" data-slot="reset-password-authSub">Ya puedes iniciar sesión con tu nueva password.</div>
              <button className="bo-btn bo-btn--primary" type="button" data-testid="reset-password-done-login-link" onClick={() => (window.location.href = "/login")}>
                Ir a login
              </button>
            </>
          ) : (
            <>
              <div className="bo-title" data-slot="reset-password-title">Restablecer password</div>
              <div className="bo-authSub" data-slot="reset-password-authSub">
                {preview?.firstName ? `${preview.firstName}, ` : ""}introduce tu nueva password dos veces para confirmar.
              </div>

              <label className="bo-field bo-field--wide" data-slot="reset-password-field--wide">
                <span className="bo-label" data-slot="reset-password-label">Nueva password</span>
                <input
                  className="bo-input"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  data-testid="reset-password-new-password"
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={busy}
                />
              </label>
              <label className="bo-field bo-field--wide" data-slot="reset-password-field--wide">
                <span className="bo-label" data-slot="reset-password-label">Repetir password</span>
                <input
                  className="bo-input"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  data-testid="reset-password-confirm-password"
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={busy}
                />
              </label>

              {error ? <div className="bo-inlineError">{error}</div> : null}

              <button className="bo-btn bo-btn--primary" type="button" data-testid="reset-password-submit" onClick={onSubmit} disabled={busy}>
                {busy ? "Guardando..." : "Confirmar"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
