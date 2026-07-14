import React, { useMemo, useState } from "react";
import { useSetAtom } from "jotai";

import { createClient } from "../../../api/client";
import { sessionAtom } from "../../../state/atoms";
import { useErrorToast } from "../../../ui/feedback/useErrorToast";
import { createLoginHandler } from "../../login/helpers/onSubmit";
import { Loader2 } from "lucide-react";

export default function MobileLoginPage() {
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
    <div
      className="bo-mobile-login flex flex-col items-center justify-center px-6 bg-[hsl(var(--background))]"
      data-ui="mobile-login"
    >
      {/* Logo / Branding */}
      <div className="mb-8 flex flex-col items-center gap-3" data-ui="mobile-login-header">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center bg-[hsl(var(--primary))]"
          data-ui="mobile-login-logo"
          aria-hidden="true"
        >
          <span className="text-3xl text-white font-bold" aria-hidden="true" data-slot="login-font-bold">VC</span>
        </div>
        <h1
          className="text-2xl font-bold text-[hsl(var(--foreground))]"
          data-ui="mobile-login-title"
        >
          Villa Carmen
        </h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))]" data-ui="mobile-login-subtitle">
          Accede a tu cuenta
        </p>
      </div>

      {/* Form */}
      <form
        onSubmit={onSubmit}
        className="w-full max-w-xs flex flex-col gap-4"
        data-ui="mobile-login-form"
        noValidate
      >
        <div data-ui="mobile-login-field-identifier">
          <label
            htmlFor="m-identifier"
            className="block text-sm font-medium text-[hsl(var(--foreground))] mb-1.5"
            data-slot="mobile-login-identifier-label"
          >
            Email o usuario
          </label>
          <input
            id="m-identifier"
            className="bo-input w-full px-4 py-3 rounded-xl border border-[hsl(var(--input))] bg-[hsl(var(--background))] text-[hsl(var(--foreground))] text-base focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))] transition-shadow"
            type="text"
            autoComplete="username"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            required
            placeholder="tu@email.com"
            data-ui="mobile-login-input-identifier"
            disabled={busy}
          />
        </div>

        <div data-ui="mobile-login-field-password">
          <label
            htmlFor="m-password"
            className="block text-sm font-medium text-[hsl(var(--foreground))] mb-1.5"
            data-slot="mobile-login-password-label"
          >
            Contrasena
          </label>
          <input
            id="m-password"
            className="bo-input w-full px-4 py-3 rounded-xl border border-[hsl(var(--input))] bg-[hsl(var(--background))] text-[hsl(var(--foreground))] text-base focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))] transition-shadow"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            placeholder="********"
            data-ui="mobile-login-input-password"
            disabled={busy}
          />
        </div>

        <button
          className="bo-btn bo-btn--primary w-full py-3.5 rounded-xl font-semibold text-base flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed mt-2"
          type="submit"
          disabled={busy}
          data-ui="mobile-login-submit"
        >
          {busy ? (
            <>
              <Loader2 size={18} className="animate-spin" aria-hidden="true" />
              Entrando...
            </>
          ) : (
            "Entrar"
          )}
        </button>
      </form>

      {/* Footer */}
      <p className="mt-8 text-xs text-[hsl(var(--muted-foreground))] text-center" data-ui="mobile-login-footer">
        Villa Carmen &copy; {new Date().getFullYear()}
      </p>
    </div>
  );
}
