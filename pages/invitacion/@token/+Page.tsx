import React, { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, CircleAlert, Loader2 } from "lucide-react";
import { usePageContext } from "vike-react/usePageContext";

import { createClient } from "../../../api/client";
import type { MemberInvitationPreview } from "../../../api/types";
import type { Data } from "./+data";

export default function Page() {
  const pageContext = usePageContext();
  const data = (pageContext.data ?? {}) as Partial<Data>;
  const token = String(data.token ?? "").trim();
  const api = useMemo(() => createClient({ baseUrl: "" }), []);

  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invitation, setInvitation] = useState<MemberInvitationPreview | null>(null);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await api.invitations.validate(token);
        if (cancelled) return;
        if (!res.success) {
          setError(res.message || "Invitación inválida o expirada");
          return;
        }
        setInvitation(res.invitation);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Invitación inválida o expirada");
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
  }, [api.invitations, token]);

  const onStart = useCallback(async () => {
    setStarting(true);
    setError(null);
    try {
      const res = await api.invitations.onboarding.start(token);
      if (!res.success) {
        setError(res.message || "No se pudo iniciar onboarding");
        return;
      }
      window.location.href = `/onboarding/${encodeURIComponent(res.onboardingGuid)}`;
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo iniciar onboarding");
    } finally {
      setStarting(false);
    }
  }, [api.invitations.onboarding, token]);

  return (
    <div className="flex flex-col items-center text-center max-w-[400px] p-6">
      <div 
        className="rounded-lg bg-gradient-to-b from-white/[0.04] to-black/[0.10] border border-white/[0.06] shadow-soft p-[18px] w-[380px] max-w-[calc(100%-32px)]"
        style={{ width: 380, maxWidth: "calc(100% - 32px)" }} 
        role="main" 
        aria-label="Invitacion"
      >
        {loading ? (
          <div className="flex flex-col items-center gap-2 py-4 text-muted-foreground">
            <Loader2 size={20} className="animate-spin" />
            Validando invitación...
          </div>
        ) : error ? (
          <>
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-500/10 text-red-500 mx-auto mb-4">
              <CircleAlert size={30} />
            </div>
            <div className="text-xl font-semibold leading-tight tracking-tight">
              No se pudo validar la invitación
            </div>
            <div className="mt-1.5 text-xs text-muted-foreground">{error}</div>
            <button
              type="button"
              onClick={() => (window.location.href = "/login")}
              className="mt-4 h-10 rounded-xl border border-white/[0.06] bg-transparent font-semibold inline-flex items-center justify-center gap-2 transition-all hover:bg-white/[0.06]"
            >
              Ir a login
            </button>
          </>
        ) : (
          <>
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-green-500/10 text-green-500 mx-auto mb-4">
              <CheckCircle2 size={30} />
            </div>
            <div className="text-xl font-semibold leading-tight tracking-tight">
              Bienvenido{invitation?.firstName ? `, ${invitation.firstName}` : ""}
            </div>
            <div className="mt-1.5 text-xs text-muted-foreground">
              Tu invitación está activa. Pulsa empezar para completar tu onboarding.
            </div>

            <button
              type="button"
              disabled={starting}
              onClick={onStart}
              className="mt-4 h-10 rounded-xl border border-primary/30 bg-primary/16 font-semibold inline-flex items-center justify-center gap-2 transition-all hover:-translate-y-0.5 disabled:opacity-55 disabled:cursor-not-allowed"
            >
              {starting ? "Abriendo..." : "Empezar"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
