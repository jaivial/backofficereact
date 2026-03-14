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
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "var(--bo-bg)" }}>
      <div style={{ width: 380, maxWidth: "calc(100% - 32px)" }}>
        <div className="rounded-[var(--rounded-lg)] bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(0,0,0,0.10)),var(--bo-surface-2)] border border-[var(--border)] shadow-[var(--shadow-soft)] p-[18px]">
          <div className="text-xl font-semibold leading-tight tracking-tight">Actualizar password</div>
          <div className="text-xs text-[var(--text-muted)] mt-1.5">
            Debes establecer una nueva password para continuar.
          </div>

          <form onSubmit={onSubmit} className="mt-3.5 grid gap-3">
            <div className="grid gap-1.5">
              <label htmlFor="password" className="text-xs text-[var(--text-muted)] font-semibold">
                Nueva password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="h-10 rounded-[12px] border border-[var(--border)] bg-[rgba(255,255,255,0.03)] text-[var(--bo-text)] px-3 outline-none min-w-0 transition-colors duration-150"
                placeholder="Nueva password"
              />
            </div>

            <div className="grid gap-1.5">
              <label htmlFor="confirmPassword" className="text-xs text-[var(--text-muted)] font-semibold">
                Repetir password
              </label>
              <input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="h-10 rounded-[12px] border border-[var(--border)] bg-[rgba(255,255,255,0.03)] text-[var(--bo-text)] px-3 outline-none min-w-0 transition-colors duration-150"
                placeholder="Repetir password"
              />
            </div>

            <button
              type="submit"
              disabled={busy}
              className="h-10 w-full rounded-[12px] border border-[rgba(185,168,255,0.30)] bg-[rgba(185,168,255,0.16)] text-[var(--bo-text)] cursor-pointer font-bold inline-flex items-center justify-center"
            >
              {busy ? "Guardando..." : "Confirmar"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
