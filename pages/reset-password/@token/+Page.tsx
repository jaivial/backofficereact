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
    <div className="flex flex-col items-center text-center min-h-screen justify-center py-12 px-4">
      <div 
        className="w-full max-w-md rounded-lg bg-gradient-to-b from-white/[0.04] to-black/[0.10] border border-white/[0.06] shadow-soft p-[18px]"
        role="main" 
        aria-label="Restablecer password"
      >
        {loading ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 size={20} className="animate-spin" />
            Validando enlace...
          </div>
        ) : error && !preview ? (
          <>
            <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4 bg-red-500/10 border border-red-500/20 text-red-400">
              <CircleAlert size={30} />
            </div>
            <div className="text-xl font-semibold leading-tight tracking-tight">Enlace no válido</div>
            <div className="mt-1.5 text-xs text-muted-foreground">{error}</div>
            <button
              type="button"
              onClick={() => (window.location.href = "/login")}
              className="mt-4 h-10 rounded-xl border border-white/[0.06] bg-transparent font-semibold inline-flex items-center justify-center gap-2 transition-all hover:bg-white/[0.06]"
            >
              Ir a login
            </button>
          </>
        ) : done ? (
          <>
            <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4 bg-green-500/10 border border-green-500/20 text-green-400">
              <CheckCircle2 size={30} />
            </div>
            <div className="text-xl font-semibold leading-tight tracking-tight">Password actualizada</div>
            <div className="mt-1.5 text-xs text-muted-foreground">
              Ya puedes iniciar sesión con tu nueva password.
            </div>
            <button
              type="button"
              onClick={() => (window.location.href = "/login")}
              className="mx-auto mt-4 h-10 rounded-xl border border-primary/30 bg-primary/16 font-semibold inline-flex items-center justify-center gap-2 transition-all hover:-translate-y-0.5 disabled:opacity-55 disabled:cursor-not-allowed"
            >
              Ir a login
            </button>
          </>
        ) : (
          <>
            <div className="text-xl font-semibold leading-tight tracking-tight">Restablecer password</div>
            <div className="mt-1.5 text-xs text-muted-foreground">
              {preview?.firstName ? `${preview.firstName}, ` : ""}
              introduce tu nueva password dos veces para confirmar.
            </div>

            <div className="mt-3.5 grid gap-3">
              <div className="grid gap-1">
                <label htmlFor="password" className="text-xs text-muted-foreground block mb-1">
                  Nueva password
                </label>
                <input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={busy}
                  className="h-10 rounded-xl border border-white/[0.06] bg-white/[0.03] text-bo-text px-3 outline-none transition-colors hover:border-white/[0.09] focus:border-primary/38 focus:shadow-[0_0_0_3px_rgba(185,168,255,0.10)]"
                  placeholder="Nueva password"
                />
              </div>
              <div className="grid gap-1">
                <label htmlFor="confirmPassword" className="text-xs text-muted-foreground block mb-1">
                  Repetir password
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={busy}
                  className="h-10 rounded-xl border border-white/[0.06] bg-white/[0.03] text-bo-text px-3 outline-none transition-colors hover:border-white/[0.09] focus:border-primary/38 focus:shadow-[0_0_0_3px_rgba(185,168,255,0.10)]"
                  placeholder="Repetir password"
                />
              </div>
            </div>

            {error ? (
              <div className="mt-2 text-xs text-red-400">{error}</div>
            ) : null}

            <button
              type="button"
              onClick={onSubmit}
              disabled={busy}
              className="mt-4 h-10 rounded-xl border border-primary/30 bg-primary/16 font-semibold inline-flex items-center justify-center gap-2 transition-all hover:-translate-y-0.5 disabled:opacity-55 disabled:cursor-not-allowed"
            >
              {busy ? "Guardando..." : "Confirmar"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
