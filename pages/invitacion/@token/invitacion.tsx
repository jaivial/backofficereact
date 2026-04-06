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
    <div className="bo-stage">
      <div className="bo-window bo-window--auth bo-onboardingWindow">
        <div className="bo-authCard" role="main" aria-label="Invitación">
          {loading ? (
            <div className="bo-onboardingLoading">
              <Loader2 size={20} className="is-spinning" />
              Validando invitación...
            </div>
          ) : error ? (
            <>
              <div className="bo-onboardingIcon bo-onboardingIcon--error">
                <CircleAlert size={30} />
              </div>
              <div className="bo-title">No se pudo validar la invitación</div>
              <div className="bo-authSub">{error}</div>
              <button className="bo-btn bo-btn--ghost" type="button" onClick={() => (window.location.href = "/login")}>
                Ir a login
              </button>
            </>
          ) : (
            <>
              <div className="bo-onboardingIcon bo-onboardingIcon--ok">
                <CheckCircle2 size={30} />
              </div>
              <div className="bo-title">Bienvenido{invitation?.firstName ? `, ${invitation.firstName}` : ""}</div>
              <div className="bo-authSub">Tu invitación está activa. Pulsa empezar para completar tu onboarding.</div>

              <button className="bo-btn bo-btn--primary" type="button" disabled={starting} onClick={onStart}>
                {starting ? "Abriendo..." : "Empezar"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
