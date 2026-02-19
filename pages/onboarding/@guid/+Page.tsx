import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, Loader2, Upload } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { usePageContext } from "vike-react/usePageContext";

import { createClient } from "../../../api/client";
import type { InvitationOnboardingMember } from "../../../api/types";
import type { Data } from "./+data";
import { ImageDropInput } from "../../../ui/inputs/ImageDropInput";
import { imageToWebpMax200KB } from "../../../ui/lib/imageFile";
import { Avatar, AvatarFallback, AvatarImage } from "../../../ui/shell/Avatar";

function initials(firstName: string, lastName: string): string {
  const a = firstName.trim()[0] ?? "";
  const b = lastName.trim()[0] ?? "";
  return (a + b).toUpperCase() || "MM";
}

export default function Page() {
  const pageContext = usePageContext();
  const data = (pageContext.data ?? {}) as Partial<Data>;
  const guid = String(data.guid ?? "").trim();
  const api = useMemo(() => createClient({ baseUrl: "" }), []);
  const reduceMotion = useReducedMotion();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [member, setMember] = useState<InvitationOnboardingMember | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [busy, setBusy] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [step, setStep] = useState<1 | 2 | 3>(1);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await api.invitations.onboarding.get(guid);
        if (cancelled) return;
        if (!res.success) {
          setError(res.message || "Onboarding inválido o expirado");
          return;
        }
        setMember(res.member);
        setFirstName(res.member.firstName || "");
        setLastName(res.member.lastName || "");
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Onboarding inválido o expirado");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    if (!guid) {
      setError("Onboarding inválido");
      setLoading(false);
      return;
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [api.invitations.onboarding, guid]);

  const onAvatarSelect = useCallback(
    async (file: File) => {
      setAvatarBusy(true);
      setError(null);
      try {
        const webpFile = await imageToWebpMax200KB(file);
        const res = await api.invitations.onboarding.uploadAvatar(guid, webpFile);
        if (!res.success) {
          setError(res.message || "No se pudo actualizar el avatar");
          return;
        }
        setMember((prev) => (prev ? { ...prev, photoUrl: res.avatarUrl || res.member.photoUrl || prev.photoUrl } : prev));
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudo actualizar el avatar");
      } finally {
        setAvatarBusy(false);
      }
    },
    [api.invitations.onboarding, guid],
  );

  const onConfirmProfile = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await api.invitations.onboarding.saveProfile(guid, { firstName, lastName });
      if (!res.success) {
        setError(res.message || "No se pudo guardar");
        return;
      }
      setMember((prev) =>
        prev
          ? {
              ...prev,
              firstName: res.member.firstName,
              lastName: res.member.lastName,
              photoUrl: res.member.photoUrl,
            }
          : prev,
      );
      setStep(2);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar");
    } finally {
      setBusy(false);
    }
  }, [api.invitations.onboarding, firstName, guid, lastName]);

  const onSetPassword = useCallback(async () => {
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
      const res = await api.invitations.onboarding.setPassword(guid, password, confirmPassword);
      if (!res.success) {
        setError(res.message || "No se pudo guardar la password");
        return;
      }
      setStep(3);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar la password");
    } finally {
      setBusy(false);
    }
  }, [api.invitations.onboarding, confirmPassword, guid, password]);

  return (
    <div className="bo-stage bo-stage--onboarding">
      <div className="bo-window bo-window--auth bo-onboardingWindow bo-onboardingWindow--lg">
        <div className="bo-authCard bo-onboardingCard" role="main" aria-label="Onboarding">
          {loading ? (
            <div className="bo-onboardingLoading">
              <Loader2 size={20} className="is-spinning" />
              Cargando onboarding...
            </div>
          ) : error && !member ? (
            <>
              <div className="bo-title">No pudimos abrir tu onboarding</div>
              <div className="bo-authSub">{error}</div>
              <button className="bo-btn bo-btn--ghost" type="button" onClick={() => (window.location.href = "/login")}>
                Ir a login
              </button>
            </>
          ) : (
            <AnimatePresence mode="wait">
              {step === 1 ? (
                <motion.div
                  key="profile"
                  initial={reduceMotion ? { opacity: 1 } : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduceMotion ? { opacity: 1 } : { opacity: 0, y: -8 }}
                  transition={reduceMotion ? { duration: 0 } : { duration: 0.28, ease: "easeOut" }}
                  className="bo-onboardingStep"
                >
                  <div className="bo-title">Completa tu perfil</div>
                  <div className="bo-authSub">Puedes editar nombre, apellidos y avatar antes de continuar.</div>

                  <div className="bo-onboardingAvatarRow">
                    <ImageDropInput className={`bo-memberCreateAvatarDrop${avatarBusy ? " is-busy" : ""}`} ariaLabel="Subir avatar" onSelectFile={onAvatarSelect}>
                      <Avatar className="bo-memberCreateAvatar">
                        {member?.photoUrl ? <AvatarImage src={member.photoUrl} alt="Avatar" /> : null}
                        <AvatarFallback className="bo-memberAvatarFallback">{initials(firstName, lastName)}</AvatarFallback>
                      </Avatar>
                      <span className="bo-memberCreateAvatarHint" aria-hidden="true">
                        <Upload size={16} />
                      </span>
                    </ImageDropInput>
                  </div>

                  <div className="bo-memberCreateGrid">
                    <label className="bo-field">
                      <span className="bo-label">Nombre</span>
                      <input className="bo-input" value={firstName} onChange={(e) => setFirstName(e.target.value)} disabled={busy || avatarBusy} />
                    </label>
                    <label className="bo-field">
                      <span className="bo-label">Apellidos</span>
                      <input className="bo-input" value={lastName} onChange={(e) => setLastName(e.target.value)} disabled={busy || avatarBusy} />
                    </label>
                    <label className="bo-field">
                      <span className="bo-label">Email</span>
                      <input className="bo-input" value={member?.email || ""} disabled />
                    </label>
                    <label className="bo-field">
                      <span className="bo-label">DNI</span>
                      <input className="bo-input" value={member?.dni || ""} disabled />
                    </label>
                    <label className="bo-field bo-field--wide">
                      <span className="bo-label">Teléfono</span>
                      <input className="bo-input" value={member?.phone || ""} disabled />
                    </label>
                    <label className="bo-field bo-field--wide">
                      <span className="bo-label">Rol</span>
                      <input className="bo-input" value={member?.roleLabel || ""} disabled />
                    </label>
                  </div>

                  {error ? <div className="bo-inlineError">{error}</div> : null}

                  <div className="bo-onboardingActions">
                    <button className="bo-btn bo-btn--primary" type="button" onClick={onConfirmProfile} disabled={busy || avatarBusy}>
                      {busy ? "Guardando..." : "Confirmar"}
                    </button>
                  </div>
                </motion.div>
              ) : null}

              {step === 2 ? (
                <motion.div
                  key="password"
                  initial={reduceMotion ? { opacity: 1 } : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduceMotion ? { opacity: 1 } : { opacity: 0, y: -8 }}
                  transition={reduceMotion ? { duration: 0 } : { duration: 0.28, ease: "easeOut" }}
                  className="bo-onboardingStep"
                >
                  <div className="bo-title">Establece tu password</div>
                  <div className="bo-authSub">Introduce la misma password dos veces para confirmar.</div>

                  <div className="bo-memberCreateGrid">
                    <label className="bo-field bo-field--wide">
                      <span className="bo-label">Password</span>
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
                  </div>

                  {error ? <div className="bo-inlineError">{error}</div> : null}

                  <div className="bo-onboardingActions">
                    <button className="bo-btn bo-btn--ghost" type="button" onClick={() => setStep(1)} disabled={busy}>
                      Volver
                    </button>
                    <button className="bo-btn bo-btn--primary" type="button" onClick={onSetPassword} disabled={busy}>
                      {busy ? "Guardando..." : "Siguiente"}
                    </button>
                  </div>
                </motion.div>
              ) : null}

              {step === 3 ? (
                <motion.div
                  key="done"
                  className="bo-onboardingDone"
                  initial={reduceMotion ? { opacity: 1 } : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={reduceMotion ? { opacity: 1 } : { opacity: 0 }}
                  transition={reduceMotion ? { duration: 0 } : { duration: 0.5, ease: "easeInOut" }}
                >
                  <div className="bo-onboardingDoneIcon" aria-hidden="true">
                    <CheckCircle2 size={34} />
                  </div>
                  <div className="bo-title">¡Todo listo!</div>
                  <div className="bo-authSub">Tu cuenta está preparada. Ya puedes acceder al login.</div>

                  <motion.button
                    className="bo-btn bo-btn--glass bo-onboardingStartBtn"
                    type="button"
                    onClick={() => (window.location.href = "/login")}
                    initial={reduceMotion ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={reduceMotion ? { duration: 0 } : { delay: 0.15, duration: 0.35, ease: "easeOut" }}
                  >
                    Empezar <ArrowRight size={16} />
                  </motion.button>
                </motion.div>
              ) : null}
            </AnimatePresence>
          )}
        </div>
      </div>
    </div>
  );
}
