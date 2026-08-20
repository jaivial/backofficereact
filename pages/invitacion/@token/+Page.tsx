import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BadgeCheck,
  CalendarClock,
  Camera,
  CircleAlert,
  KeyRound,
  Loader2,
  MailCheck,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { usePageContext } from "vike-react/usePageContext";

import { createClient } from "../../../api/client";
import type { MemberInvitationPreview } from "../../../api/types";
import type { Data } from "./+data";
import { Avatar, AvatarFallback, AvatarImage } from "../../../ui/shell/Avatar";

const ONBOARDING_STEPS = [
  { icon: UserRound, label: "Tu perfil" },
  { icon: Camera, label: "Tu foto" },
  { icon: KeyRound, label: "Tu contraseña" },
] as const;

function initialsOf(firstName: string, lastName: string): string {
  const a = firstName.trim()[0] ?? "";
  const b = lastName.trim()[0] ?? "";
  return (a + b).toUpperCase() || "MM";
}

function formatExpiry(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "long", year: "numeric" }).format(d);
}

export default function Page() {
  const pageContext = usePageContext();
  const data = (pageContext.data ?? {}) as Partial<Data>;
  const token = String(data.token ?? "").trim();
  const api = useMemo(() => createClient({ baseUrl: "" }), []);
  const reduceMotion = useReducedMotion();

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

  const fadeUp = (delay: number) =>
    reduceMotion
      ? {}
      : {
          initial: { opacity: 0, y: 10 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.35, delay, ease: "easeOut" as const },
        };

  const expiryLabel = useMemo(
    () => (invitation?.expiresAt ? formatExpiry(invitation.expiresAt) : ""),
    [invitation],
  );

  return (
    <div className="bo-stage" data-slot="invitacion-stage">
      <div className="bo-window bo-window--auth bo-inviteWindow" data-slot="invitacion-window">
        {loading ? (
          <div className="bo-inviteState" role="status" aria-live="polite" data-slot="invitacion-loading">
            <Loader2 size={22} className="bo-spin" data-slot="invitacion-loading-icon" />
            <span className="bo-inviteStateText" data-slot="invitacion-loading-text">Validando invitación...</span>
          </div>
        ) : error ? (
          <div className="bo-inviteState" role="alert" data-slot="invitacion-error">
            <div className="bo-inviteIcon bo-inviteIcon--error" data-slot="invitacion-error-icon">
              <CircleAlert size={30} strokeWidth={1.8} data-slot="invitacion-error-glyph" />
            </div>
            <div className="bo-inviteTitle" data-slot="invitacion-error-title">No se pudo validar la invitación</div>
            <div className="bo-authSub" data-slot="invitacion-error-sub">{error}</div>
            <button
              className="bo-btn bo-btn--ghost"
              type="button"
              data-testid="invitacion-page-login-link"
              data-slot="invitacion-login-link"
              onClick={() => (window.location.href = "/login")}
            >
              Ir a login
            </button>
          </div>
        ) : (
          <div className="bo-inviteCard" role="main" aria-label="Invitación" data-slot="invitacion-card">
            <motion.div className="bo-inviteHero" {...fadeUp(0)} data-slot="invitacion-hero">
              <div className="bo-inviteHeroGlow" aria-hidden="true" data-slot="invitacion-hero-glow" />
              <div className="bo-inviteAvatar" data-slot="invitacion-avatar">
                <Avatar className="bo-avatar--xl bo-inviteAvatarInner">
                  {invitation?.photoUrl ? (
                    <AvatarImage src={invitation.photoUrl} alt={invitation.firstName ? `Foto de ${invitation.firstName}` : "Foto"} />
                  ) : null}
                  <AvatarFallback>{initialsOf(invitation?.firstName ?? "", invitation?.lastName ?? "")}</AvatarFallback>
                </Avatar>
              </div>
            </motion.div>

            <div className="bo-inviteBody" data-slot="invitacion-body">
              <motion.div className="bo-inviteHead" {...fadeUp(0.05)} data-slot="invitacion-head">
                <p className="bo-inviteEyebrow" data-slot="invitacion-eyebrow">Invitación al equipo</p>
                <h1 className="bo-inviteTitle" data-slot="invitacion-title">
                  {invitation?.firstName ? `¡Bienvenido, ${invitation.firstName}!` : "¡Bienvenido!"}
                </h1>
                <p className="bo-inviteSub" data-slot="invitacion-sub">
                  Tu invitación está activa. Completa tu perfil en 3 pasos para activar tu cuenta y entrar al panel.
                </p>
              </motion.div>

              <motion.div className="bo-inviteDetails" {...fadeUp(0.1)} data-slot="invitacion-details">
                <div className="bo-inviteDetail" data-slot="invitacion-detail-role">
                  <BadgeCheck size={16} className="bo-inviteDetailIcon" data-slot="invitacion-detail-role-icon" />
                  <span className="bo-inviteDetailLabel" data-slot="invitacion-detail-role-label">Rol</span>
                  <span className="bo-inviteDetailValue bo-inviteRoleBadge" data-slot="invitacion-detail-role-value">
                    {invitation?.roleLabel || invitation?.roleSlug || "Miembro"}
                  </span>
                </div>
                {invitation?.email ? (
                  <div className="bo-inviteDetail" data-slot="invitacion-detail-email">
                    <MailCheck size={16} className="bo-inviteDetailIcon" data-slot="invitacion-detail-email-icon" />
                    <span className="bo-inviteDetailLabel" data-slot="invitacion-detail-email-label">Enviada a</span>
                    <span className="bo-inviteDetailValue" data-slot="invitacion-detail-email-value">{invitation.email}</span>
                  </div>
                ) : null}
                {expiryLabel ? (
                  <div className="bo-inviteDetail" data-slot="invitacion-detail-expiry">
                    <CalendarClock size={16} className="bo-inviteDetailIcon" data-slot="invitacion-detail-expiry-icon" />
                    <span className="bo-inviteDetailLabel" data-slot="invitacion-detail-expiry-label">Expira</span>
                    <span className="bo-inviteDetailValue" data-slot="invitacion-detail-expiry-value">{expiryLabel}</span>
                  </div>
                ) : null}
              </motion.div>

              <motion.div className="bo-inviteSteps" {...fadeUp(0.15)} data-slot="invitacion-steps">
                <p className="bo-inviteStepsTitle" data-slot="invitacion-steps-title">Al empezar completarás</p>
                <ol className="bo-inviteStepsList" data-slot="invitacion-steps-list">
                  {ONBOARDING_STEPS.map((step, index) => (
                    <li className="bo-inviteStep" key={step.label} data-slot={`invitacion-step-${index + 1}`}>
                      <span className="bo-inviteStepNum" data-slot={`invitacion-step-num-${index + 1}`}>{index + 1}</span>
                      <step.icon size={15} className="bo-inviteStepIcon" data-slot={`invitacion-step-icon-${index + 1}`} />
                      <span className="bo-inviteStepLabel" data-slot={`invitacion-step-label-${index + 1}`}>{step.label}</span>
                    </li>
                  ))}
                </ol>
              </motion.div>

              <motion.button
                className="bo-btn bo-btn--primary bo-inviteCta"
                type="button"
                data-testid="invitacion-page-empezar"
                data-slot="invitacion-cta"
                disabled={starting}
                onClick={onStart}
                {...fadeUp(0.2)}
              >
                {starting ? (
                  <Loader2 size={16} className="bo-spin" data-slot="invitacion-cta-spinner" />
                ) : (
                  <ArrowRight size={16} data-slot="invitacion-cta-icon" />
                )}
                <span className="bo-inviteCtaText" data-slot="invitacion-cta-text">{starting ? "Abriendo..." : "Empezar"}</span>
              </motion.button>

              <motion.p className="bo-inviteTrust" {...fadeUp(0.25)} data-slot="invitacion-trust">
                <ShieldCheck size={13} className="bo-inviteTrustIcon" data-slot="invitacion-trust-icon" />
                <span data-slot="invitacion-trust-text">
                  Invitación exclusiva{invitation?.email ? ` para ${invitation.email}` : ""}. Si no la esperabas, puedes ignorarla.
                </span>
              </motion.p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
