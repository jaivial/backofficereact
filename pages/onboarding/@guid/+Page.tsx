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
import { Button } from "../../../ui/shadcn/button";
import { Input } from "../../../ui/shadcn/input";
import { Label } from "../../../ui/shadcn/label";

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
    <div className="flex flex-col items-center text-center max-w-[400px] p-6">
      <div
        className="rounded-lg bg-gradient-to-b from-white/[0.04] to-black/[0.10] border border-white/[0.06] shadow-soft p-[18px] w-[380px] max-w-[calc(100%-32px)]"
        style={{ width: 380, maxWidth: "calc(100% - 32px)" }}
        role="main"
        aria-label="Onboarding"
      >
        {loading ? (
          <div className="flex flex-col items-center gap-2 py-4 text-muted-foreground">
            <Loader2 size={20} className="animate-spin" />
            Cargando onboarding...
          </div>
        ) : error && !member ? (
          <>
            <div className="text-xl font-semibold leading-tight tracking-tight">No pudimos abrir tu onboarding</div>
            <div className="mt-1.5 text-xs text-muted-foreground">{error}</div>
            <Button type="button" variant="ghost" onClick={() => (window.location.href = "/login")} className="mt-4">
              Ir a login
            </Button>
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
                className="grid gap-3"
              >
                <div className="text-xl font-semibold leading-tight tracking-tight">Completa tu perfil</div>
                <div className="text-xs text-muted-foreground">
                  Puedes editar nombre, apellidos y avatar antes de continuar.
                </div>

                <div className="flex justify-center">
                  <ImageDropInput
                    className={`relative${avatarBusy ? " opacity-50" : ""}`}
                    ariaLabel="Subir avatar"
                    onSelectFile={onAvatarSelect}
                  >
                    <Avatar className="w-20 h-20">
                      {member?.photoUrl ? <AvatarImage src={member.photoUrl} alt="Avatar" /> : null}
                      <AvatarFallback className="text-lg">{initials(firstName, lastName)}</AvatarFallback>
                    </Avatar>
                    <span className="absolute bottom-0 right-0 flex h-6 w-6 items-center justify-center rounded-full bg-primary/80 text-primary-foreground">
                      <Upload size={14} />
                    </span>
                  </ImageDropInput>
                </div>

                <div className="grid grid-cols-2 grid-gap-3">
                  <div className="grid gap-1">
                    <Label htmlFor="firstName" className="text-xs text-muted-foreground">
                      Nombre
                    </Label>
                    <Input
                      id="firstName"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      disabled={busy || avatarBusy}
                      className="h-10 rounded-xl border border-white/[0.06] bg-white/[0.03] text-foreground px-3"
                    />
                  </div>
                  <div className="grid gap-1">
                    <Label htmlFor="lastName" className="text-xs text-muted-foreground">
                      Apellidos
                    </Label>
                    <Input
                      id="lastName"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      disabled={busy || avatarBusy}
                      className="h-10 rounded-xl border border-white/[0.06] bg-white/[0.03] text-foreground px-3"
                    />
                  </div>
                  <div className="grid gap-1">
                    <Label htmlFor="email" className="text-xs text-muted-foreground">
                      Email
                    </Label>
                    <Input
                      id="email"
                      value={member?.email || ""}
                      disabled
                      className="h-10 rounded-xl border border-white/[0.06] bg-white/[0.03] text-foreground px-3"
                    />
                  </div>
                  <div className="grid gap-1">
                    <Label htmlFor="dni" className="text-xs text-muted-foreground">
                      DNI
                    </Label>
                    <Input
                      id="dni"
                      value={member?.dni || ""}
                      disabled
                      className="h-10 rounded-xl border border-white/[0.06] bg-white/[0.03] text-foreground px-3"
                    />
                  </div>
                  <div className="col-span-2 grid gap-1">
                    <Label htmlFor="phone" className="text-xs text-muted-foreground">
                      Teléfono
                    </Label>
                    <Input
                      id="phone"
                      value={member?.phone || ""}
                      disabled
                      className="h-10 rounded-xl border border-white/[0.06] bg-white/[0.03] text-foreground px-3"
                    />
                  </div>
                  <div className="col-span-2 grid gap-1">
                    <Label htmlFor="role" className="text-xs text-muted-foreground">
                      Rol
                    </Label>
                    <Input
                      id="role"
                      value={member?.roleLabel || ""}
                      disabled
                      className="h-10 rounded-xl border border-white/[0.06] bg-white/[0.03] text-foreground px-3"
                    />
                  </div>
                </div>

                {error ? (
                  <div className="text-xs text-red-400">{error}</div>
                ) : null}

                <div className="flex justify-center">
                  <Button
                    type="button"
                    onClick={onConfirmProfile}
                    disabled={busy || avatarBusy}
                    className="h-10 rounded-xl border border-primary/30 bg-primary/16 font-semibold inline-flex items-center justify-center gap-2 px-4 transition-all hover:-translate-y-0.5 disabled:opacity-55 disabled:cursor-not-allowed"
                  >
                    {busy ? "Guardando..." : "Confirmar"}
                  </Button>
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
                className="grid gap-3"
              >
                <div className="text-xl font-semibold leading-tight tracking-tight">Establece tu password</div>
                <div className="text-xs text-muted-foreground">
                  Introduce la misma password dos veces para confirmar.
                </div>

                <div className="grid gap-3">
                  <div className="grid gap-1">
                    <Label htmlFor="password" className="text-xs text-muted-foreground">
                      Password
                    </Label>
                    <Input
                      id="password"
                      type="password"
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={busy}
                      className="h-10 rounded-xl border border-white/[0.06] bg-white/[0.03] text-foreground px-3"
                    />
                  </div>
                  <div className="grid gap-1">
                    <Label htmlFor="confirmPassword" className="text-xs text-muted-foreground">
                      Repetir password
                    </Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      disabled={busy}
                      className="h-10 rounded-xl border border-white/[0.06] bg-white/[0.03] text-foreground px-3"
                    />
                  </div>
                </div>

                {error ? (
                  <div className="text-xs text-red-400">{error}</div>
                ) : null}

                <div className="flex justify-center gap-3">
                  <Button type="button" variant="ghost" onClick={() => setStep(1)} disabled={busy}>
                    Volver
                  </Button>
                  <Button
                    type="button"
                    onClick={onSetPassword}
                    disabled={busy}
                    className="h-10 rounded-xl border border-primary/30 bg-primary/16 font-semibold inline-flex items-center justify-center gap-2 px-4 transition-all hover:-translate-y-0.5 disabled:opacity-55 disabled:cursor-not-allowed"
                  >
                    {busy ? "Guardando..." : "Siguiente"}
                  </Button>
                </div>
              </motion.div>
            ) : null}

            {step === 3 ? (
              <motion.div
                key="done"
                className="grid gap-3 text-center"
                initial={reduceMotion ? { opacity: 1 } : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={reduceMotion ? { opacity: 1 } : { opacity: 0 }}
                transition={reduceMotion ? { duration: 0 } : { duration: 0.5, ease: "easeInOut" }}
              >
                <div className="flex items-center justify-center w-12 h-12 rounded-full bg-green-500/10 text-green-500 mx-auto">
                  <CheckCircle2 size={34} />
                </div>
                <div className="text-xl font-semibold leading-tight tracking-tight">¡Todo listo!</div>
                <div className="text-xs text-muted-foreground">Tu cuenta está preparada. Ya puedes acceder al login.</div>

                <motion.button
                  type="button"
                  onClick={() => (window.location.href = "/login")}
                  initial={reduceMotion ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={reduceMotion ? { duration: 0 } : { delay: 0.15, duration: 0.35, ease: "easeOut" }}
                  className="mx-auto mt-2 h-10 rounded-xl border border-primary/30 bg-primary/16 font-semibold inline-flex items-center justify-center gap-2 px-4 transition-all hover:-translate-y-0.5"
                >
                  Empezar <ArrowRight size={16} />
                </motion.button>
              </motion.div>
            ) : null}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
