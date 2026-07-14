import React, { useEffect, useMemo, useState } from "react";
import { useSetAtom } from "jotai";
import { Loader2 } from "lucide-react";

import { createClient } from "../../api/client";
import { sessionAtom } from "../../state/atoms";
import { useErrorToast } from "../../ui/feedback/useErrorToast";
import { createLoginHandler } from "./helpers/onSubmit";

const LOGIN_IMAGES = [
  "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=1600&q=85",
  "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1600&q=85",
  "https://images.unsplash.com/photo-1550966871-3ed3cdb5ed0c?auto=format&fit=crop&w=1600&q=85",
];

export default function Page() {
  const api = useMemo(() => createClient({ baseUrl: "" }), []);
  const setSession = useSetAtom(sessionAtom);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageIndex, setImageIndex] = useState(0);
  useErrorToast(error);

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 769px)");
    let timer: ReturnType<typeof setInterval> | undefined;

    const syncTimer = () => {
      if (timer) clearInterval(timer);
      timer = desktop.matches
        ? setInterval(() => setImageIndex((index) => (index + 1) % LOGIN_IMAGES.length), 2_000)
        : undefined;
    };

    syncTimer();
    desktop.addEventListener("change", syncTimer);
    return () => {
      if (timer) clearInterval(timer);
      desktop.removeEventListener("change", syncTimer);
    };
  }, []);

  const onSubmit = createLoginHandler({
    api,
    identifier,
    password,
    setSession,
    setError,
    setBusy,
  });

  return (
    <main
      className="grid min-h-screen min-h-[100dvh] bg-[hsl(var(--background))] min-[769px]:grid-cols-2"
      data-testid="login-stage"
      data-ui="login-stage"
    >
      <section
        className="flex min-h-screen min-h-[100dvh] flex-col items-center justify-center px-6 py-8"
        data-testid="login-form-pane"
        data-ui="login-form-pane"
      >
        <div className="mb-8 flex flex-col items-center gap-3" data-ui="login-header">
          <div
            className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[hsl(var(--primary))]"
            data-ui="login-logo"
            aria-hidden="true"
          >
            <span className="text-3xl font-bold text-white" data-slot="login-font-bold">VC</span>
          </div>
          <h1 className="text-2xl font-bold text-[hsl(var(--foreground))]" data-ui="login-title">
            Villa Carmen
          </h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))]" data-ui="login-subtitle">
            Accede a tu cuenta
          </p>
        </div>

        <form
          onSubmit={onSubmit}
          className="flex w-full max-w-xs flex-col gap-4"
          data-testid="login-form"
          data-ui="login-form"
        >
          <div data-ui="login-field-identifier">
            <label
              htmlFor="identifier"
              className="mb-1.5 block text-sm font-medium text-[hsl(var(--foreground))]"
              data-slot="login-identifier-label"
            >
              Email o usuario
            </label>
            <input
              id="identifier"
              className="bo-input w-full rounded-xl border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-4 py-3 text-base text-[hsl(var(--foreground))] transition-shadow focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
              type="text"
              autoComplete="username"
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
              required
              placeholder="tu@email.com"
              data-testid="login-identifier-input"
              data-ui="login-input-identifier"
              disabled={busy}
            />
          </div>

          <div data-ui="login-field-password">
            <label
              htmlFor="password"
              className="mb-1.5 block text-sm font-medium text-[hsl(var(--foreground))]"
              data-slot="login-password-label"
            >
              Contraseña
            </label>
            <input
              id="password"
              className="bo-input w-full rounded-xl border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-4 py-3 text-base text-[hsl(var(--foreground))] transition-shadow focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              placeholder="********"
              data-testid="login-password-input"
              data-ui="login-input-password"
              disabled={busy}
            />
          </div>

          <button
            className="bo-btn bo-btn--primary mt-2 flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-base font-semibold disabled:cursor-not-allowed disabled:opacity-60"
            type="submit"
            disabled={busy}
            data-testid="login-submit-btn"
            data-ui="login-submit"
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

        <p className="mt-8 text-center text-xs text-[hsl(var(--muted-foreground))]" data-ui="login-footer">
          Villa Carmen &copy; {new Date().getFullYear()}
        </p>
      </section>

      <section
        className="relative hidden min-h-screen min-h-[100dvh] overflow-hidden min-[769px]:block"
        data-testid="login-image-pane"
        data-ui="login-image-pane"
        data-image-index={imageIndex}
        aria-hidden="true"
      >
        {LOGIN_IMAGES.map((src, index) => (
          <img
            key={src}
            src={src}
            alt=""
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${
              index === imageIndex ? "opacity-100" : "opacity-0"
            }`}
          />
        ))}
      </section>
    </main>
  );
}
