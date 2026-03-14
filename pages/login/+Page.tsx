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
    <div className="flex flex-col items-center text-center" style={{ maxWidth: 400, padding: "var(--bo-space-6)" }}>
      <div 
        className="rounded-lg bg-gradient-to-b from-white/[0.04] to-black/[0.10] border border-white/[0.06] shadow-soft p-[18px] w-[380px] max-w-[calc(100%-32px)]"
        style={{ width: 380, maxWidth: "calc(100% - 32px)" }}
      >
        <div className="text-xl font-semibold leading-tight tracking-tight">Backoffice</div>
        <div className="mt-1.5 text-xs text-text-muted">Accede con tu cuenta</div>

        <form onSubmit={onSubmit} className="mt-3.5 grid gap-3">
          <div className="grid gap-1">
            <label htmlFor="identifier" className="text-xs text-text-muted block mb-1">
              Email o usuario
            </label>
            <input
              id="identifier"
              type="text"
              autoComplete="username"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              required
              className="h-10 rounded-xl border border-white/[0.06] bg-white/[0.03] text-bo-text px-3 outline-none transition-colors hover:border-white/[0.09] focus:border-primary/38 focus:shadow-[0_0_0_3px_rgba(185,168,255,0.10)]"
              placeholder="Email o usuario"
            />
          </div>

          <div className="grid gap-1">
            <label htmlFor="password" className="text-xs text-text-muted block mb-1">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="h-10 rounded-xl border border-white/[0.06] bg-white/[0.03] text-bo-text px-3 outline-none transition-colors hover:border-white/[0.09] focus:border-primary/38 focus:shadow-[0_0_0_3px_rgba(185,168,255,0.10)]"
              placeholder="Password"
            />
          </div>

          <button
            type="submit"
            disabled={busy}
            className="h-10 rounded-xl border border-primary/30 bg-primary/16 font-semibold inline-flex items-center justify-center gap-2 transition-all hover:-translate-y-0.5 disabled:opacity-55 disabled:cursor-not-allowed"
          >
            {busy ? "Entrando..." : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
