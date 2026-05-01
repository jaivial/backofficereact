import React, { useMemo, useState } from "react";
import { CheckCircle2, CircleAlert, Loader2 } from "lucide-react";
import { usePageContext } from "vike-react/usePageContext";

import { createClient } from "../../../api/client";
import type { MemberInvitationPreview } from "../../../api/types";
import type { Data } from "./+data";
import { useInvitationValidation, useOnboardingStart } from "./helpers/invitacion";

export default function Page() {
  const pageContext = usePageContext();
  const data = (pageContext.data ?? {}) as Partial<Data>;
  const token = String(data.token ?? "").trim();
  const api = useMemo(() => createClient({ baseUrl: "" }), []);

  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invitation, setInvitation] = useState<MemberInvitationPreview | null>(null);

  useInvitationValidation(
    api,
    token,
    setInvitation,
    setError,
    () => setLoading(false),
  );

  const startOnboarding = useOnboardingStart(api, token, setError);
  const onStart = async () => {
    setStarting(true);
    try {
      await startOnboarding();
    } finally {
      setStarting(false);
    }
  };

  return (
    <div className="bo-stage" data-slot="invitacion-stage">
      <div className="bo-window bo-window--auth bo-onboardingWindow" data-slot="invitacion-onboardingWindow">
        <div className="bo-authCard" role="main" aria-label="Invitación" data-slot="invitacion-invitaci-n">
          {loading ? (
            <div className="bo-onboardingLoading" data-slot="invitacion-onboardingLoading">
              <Loader2 size={20} className="is-spinning" />
              Validando invitación...
            </div>
          ) : error ? (
            <>
              <div className="bo-onboardingIcon bo-onboardingIcon--error" data-slot="invitacion-onboardingIcon--error">
                <CircleAlert size={30}>
              </div>
              <div className="bo-title" data-slot="invitacion-title">No se pudo validar la invitación</div>
              <div className="bo-authSub" data-slot="invitacion-authSub">{error}</div>
              <button className="bo-btn bo-btn--ghost" type="button" data-testid="invitacion-login-link" onClick={() => (window.location.href = "/login")}>
                Ir a login
              </button>
            </>
          ) : (
            <>
              <div className="bo-onboardingIcon bo-onboardingIcon--ok" data-slot="invitacion-onboardingIcon--ok">
                <CheckCircle2 size={30}>
              </div>
              <div className="bo-title" data-slot="invitacion-title">Bienvenido{invitation?.firstName ? `, ${invitation.firstName}` : ""}</div>
              <div className="bo-authSub" data-slot="invitacion-authSub">Tu invitación está activa. Pulsa empezar para completar tu onboarding.</div>

              <button className="bo-btn bo-btn--primary" type="button" data-testid="invitacion-empezar" disabled={starting} onClick={onStart}>
                {starting ? "Abriendo..." : "Empezar"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
