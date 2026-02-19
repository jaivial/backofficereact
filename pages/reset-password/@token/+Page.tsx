import React, { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, CircleAlert, Loader2 } from "lucide-react";
import { usePageContext } from "vike-react/usePageContext";

import { createClient } from "../../../api/client";
import type { PasswordResetPreview } from "../../../api/types";
import type { Data } from "./+data";

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

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await api.passwordResets.validate(token);
        if (cancelled) return;
        if (!res.success) {
          setError(res.message || "Token inválido o expirado");
          return;
        }
        setPreview(res.reset);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Token inválido o expirado");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    if (!token) {
      setError("Token inválido");
      setLoading(false);
      return;
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [api.passwordResets, token]);

  const onSubmit = useCallback(async () => {
    if (!password || !confirmPassword) {
      setError("Debes completar ambos campos");
      return;
    }
    if (password !== confirmPassword) {
      setError("Las passwords no coinciden");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const res = await api.passwordResets.confirm(token, password, confirmPassword);
      if (!res.success) {
        setError(res.message || "No se pudo restablecer");
        return;
      }
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo restablecer");
    } finally {
      setBusy(false);
    }
  }, [api.passwordResets, confirmPassword, password, token]);

  return (
    <div className="bo-stage">
      <div className="bo-window bo-window--auth bo-onboardingWindow">
        <div className="bo-authCard" role="main" aria-label="Reset password">
          {loading ? (
            <div className="bo-onboardingLoading">
              <Loader2 size={20} className="is-spinning" />
              Validando enlace...
            </div>
          ) : error && !preview ? (
            <>
              <div className="bo-onboardingIcon bo-onboardingIcon--error">
                <CircleAlert size={30} />
              </div>
              <div className="bo-title">Enlace no válido</div>
              <div className="bo-authSub">{error}</div>
              <button className="bo-btn bo-btn--ghost" type="button" onClick={() => (window.location.href = "/login")}>
                Ir a login
              </button>
            </>
          ) : done ? (
            <>
              <div className="bo-onboardingIcon bo-onboardingIcon--ok">
                <CheckCircle2 size={30} />
              </div>
              <div className="bo-title">Password actualizada</div>
              <div className="bo-authSub">Ya puedes iniciar sesión con tu nueva password.</div>
              <button className="bo-btn bo-btn--primary" type="button" onClick={() => (window.location.href = "/login")}>
                Ir a login
              </button>
            </>
          ) : (
            <>
              <div className="bo-title">Restablecer password</div>
              <div className="bo-authSub">
                {preview?.firstName ? `${preview.firstName}, ` : ""}introduce tu nueva password dos veces para confirmar.
              </div>

              <label className="bo-field bo-field--wide">
                <span className="bo-label">Nueva password</span>
                <input
                  className="bo-input"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={busy}
                />
              </label>
              <label className="bo-field bo-field--wide">
                <span className="bo-label">Repetir password</span>
                <input
                  className="bo-input"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={busy}
                />
              </label>

              {error ? <div className="bo-inlineError">{error}</div> : null}

              <button className="bo-btn bo-btn--primary" type="button" onClick={onSubmit} disabled={busy}>
                {busy ? "Guardando..." : "Confirmar"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
