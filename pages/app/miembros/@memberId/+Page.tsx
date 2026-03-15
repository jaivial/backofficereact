import React, { useCallback, useMemo, useState } from "react";
import { useAtomValue } from "jotai";
import { Check, Loader2, Mail, Pencil, RefreshCcw, Upload } from "lucide-react";
import { usePageContext } from "vike-react/usePageContext";

import { createClient } from "../../../../api/client";
import type { Member } from "../../../../api/types";
import { sessionAtom } from "../../../../state/atoms";
import type { Data } from "./+data";
import { useErrorToast } from "../../../../ui/feedback/useErrorToast";
import { useToasts } from "../../../../ui/feedback/useToasts";
import { ImageDropInput } from "../../../../ui/inputs/ImageDropInput";
import { PhoneInput } from "../../../../ui/inputs/PhoneInput";
import { ConfirmDialog } from "../../../../ui/overlays/ConfirmDialog";
import { imageToWebpMax200KB } from "../../../../ui/lib/imageFile";
import { composePhoneE164, splitStoredPhone } from "../../../../ui/lib/phone";
import { Avatar, AvatarFallback, AvatarImage } from "../../../../ui/shell/Avatar";
import { formatElapsedHHMMSS, useMemberLive } from "./_shared/realtime";

function initials(member: Member | null): string {
  if (!member) return "MM";
  const a = member.firstName?.trim()?.[0] ?? "";
  const b = member.lastName?.trim()?.[0] ?? "";
  return (a + b).toUpperCase() || "MM";
}

function toInputValue(v: string | null | undefined): string {
  return v ?? "";
}

function optionalOrNull(v: string): string | null {
  const t = v.trim();
  return t === "" ? null : t;
}

function normalizeEmail(v: string | null | undefined): string {
  return String(v ?? "").trim().toLowerCase();
}

export default function Page() {
  const pageContext = usePageContext();
  const data = pageContext.data as Data;
  const session = useAtomValue(sessionAtom);
  const api = useMemo(() => createClient({ baseUrl: "" }), []);
  const { pushToast } = useToasts();

  const initialPhone = useMemo(() => splitStoredPhone(data.member?.phone), [data.member?.phone]);

  const [member, setMember] = useState<Member | null>(data.member);
  const [error, setError] = useState<string | null>(data.error);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [resendBusy, setResendBusy] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);
  const [confirmResendOpen, setConfirmResendOpen] = useState(false);
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  useErrorToast(error);

  const [firstName, setFirstName] = useState(data.member?.firstName ?? "");
  const [lastName, setLastName] = useState(data.member?.lastName ?? "");
  const [email, setEmail] = useState(toInputValue(data.member?.email));
  const [dni, setDni] = useState(toInputValue(data.member?.dni));
  const [bankAccount, setBankAccount] = useState(toInputValue(data.member?.bankAccount));
  const [phoneCountryCode, setPhoneCountryCode] = useState(initialPhone.countryCode);
  const [phoneNumber, setPhoneNumber] = useState(initialPhone.national);

  const { liveEntry, tick } = useMemberLive(member?.id);

  const onSave = useCallback(async () => {
    if (!member) return;

    const digits = phoneNumber.replace(/[^0-9]/g, "");
    const phoneE164 = composePhoneE164(phoneCountryCode, phoneNumber);
    if (digits !== "" && phoneE164 === null) {
      setError("Telefono invalido");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const res = await api.members.patch(member.id, {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: optionalOrNull(email),
        dni: optionalOrNull(dni),
        bankAccount: optionalOrNull(bankAccount),
        phone: phoneE164,
      });
      if (!res.success) {
        setError(res.message || "No se pudo guardar");
        return;
      }
      setMember(res.member);
      setFirstName(res.member.firstName);
      setLastName(res.member.lastName);
      setEmail(toInputValue(res.member.email));
      setDni(toInputValue(res.member.dni));
      setBankAccount(toInputValue(res.member.bankAccount));
      const split = splitStoredPhone(res.member.phone);
      setPhoneCountryCode(split.countryCode);
      setPhoneNumber(split.national);
      setEditing(false);
      pushToast({ kind: "success", title: "Guardado" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }, [api.members, bankAccount, dni, email, firstName, lastName, member, phoneCountryCode, phoneNumber, pushToast]);

  const onAvatarSelect = useCallback(
    async (rawFile: File) => {
      if (!member) return;
      setAvatarBusy(true);
      setError(null);
      try {
        const webpFile = await imageToWebpMax200KB(rawFile);
        const res = await api.members.uploadAvatar(member.id, webpFile);
        if (!res.success) {
          setError(res.message || "No se pudo subir el avatar");
          return;
        }
        setMember(res.member);
        pushToast({ kind: "success", title: "Avatar actualizado" });
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudo subir el avatar");
      } finally {
        setAvatarBusy(false);
      }
    },
    [api.members, member, pushToast],
  );

  const onResendInvitation = useCallback(async () => {
    if (!member) return;
    setResendBusy(true);
    setError(null);
    try {
      const res = await api.members.resendInvitation(member.id);
      if (!res.success) {
        setError(res.message || "No se pudo reenviar la invitación");
        return;
      }
      const sentChannels = (res.invitation?.delivery || []).filter((item) => item.sent).map((item) => item.channel);
      pushToast({
        kind: "success",
        title: "Invitación reenviada",
        message: sentChannels.length ? `Enviada por ${sentChannels.join(" y ")}.` : undefined,
      });
      setConfirmResendOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo reenviar la invitación");
    } finally {
      setResendBusy(false);
    }
  }, [api.members, member, pushToast]);

  const onSendPasswordReset = useCallback(async () => {
    if (!member) return;
    setResetBusy(true);
    setError(null);
    try {
      const res = await api.members.sendPasswordReset(member.id);
      if (!res.success) {
        setError(res.message || "No se pudo enviar el reset");
        return;
      }
      const sentChannels = (res.reset?.delivery || []).filter((item) => item.sent).map((item) => item.channel);
      pushToast({
        kind: "success",
        title: "Enlace de reset enviado",
        message: sentChannels.length ? `Enviado por ${sentChannels.join(" y ")}.` : undefined,
      });
      setConfirmResetOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo enviar el reset");
    } finally {
      setResetBusy(false);
    }
  }, [api.members, member, pushToast]);

  const memberName = member ? `${member.firstName} ${member.lastName}`.trim() : "";
  const currentEmail = normalizeEmail(session?.user?.email);
  const isSelfMember = !!member && (member.isCurrentUser || (currentEmail !== "" && normalizeEmail(member.email) === currentEmail));

  return (
    <section aria-label="Informacion del miembro" className="flex flex-col gap-bo-4 p-4">
      {!member ? (
        <div className="rounded-bo-lg bg-bo-surface shadow-bo-soft">
          <div className="flex items-end justify-between pb-2 px-4 pt-4">
            <div className="text-bo-sm font-bold text-bo-text">Miembro no disponible</div>
            <div className="text-bo-xs text-bo-faint">No se pudo cargar el detalle del miembro solicitado.</div>
          </div>
        </div>
      ) : (
        <>
          <div className="rounded-bo-lg bg-bo-surface shadow-bo-soft">
            <div className="flex items-end justify-between pb-2 px-4 pt-4">
              <div className="flex items-start gap-4">
                <ImageDropInput
                  className={`bo-avatarUpload ${avatarBusy ? "opacity-50" : ""}`}
                  disabled={avatarBusy}
                  ariaLabel="Subir avatar"
                  onSelectFile={onAvatarSelect}
                >
                  <Avatar className="bo-avatar bo-avatar--xl">
                    {member.photoUrl ? <AvatarImage src={member.photoUrl} alt={memberName || `Miembro #${member.id}`} /> : null}
                    <AvatarFallback className="bo-avatarFallback">{initials(member)}</AvatarFallback>
                  </Avatar>
                  <span className="bo-avatarOverlay" aria-hidden="true">
                    {avatarBusy ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
                  </span>
                </ImageDropInput>
                <div>
                  <div className="flex items-center gap-2">
                    <div className="bo-memberName">{memberName || `Miembro #${member.id}`}</div>
                    {isSelfMember ? <span className="bo-memberBadge">Tu</span> : null}
                  </div>
                  <div className="bo-memberHint">Haz clic o arrastra una imagen sobre el avatar para actualizar la foto de perfil.</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.03] text-bo-text text-sm font-bold transition-all hover:border-white/[0.09] hover:bg-white/[0.06] disabled:opacity-55 disabled:cursor-not-allowed"
                  type="button"
                  onClick={() => setConfirmResendOpen(true)}
                  disabled={saving || avatarBusy || resendBusy || resetBusy}
                >
                  <RefreshCcw size={14} strokeWidth={1.8} />
                  Reenviar invitación
                </button>
                <button
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.03] text-bo-text text-sm font-bold transition-all hover:border-white/[0.09] hover:bg-white/[0.06] disabled:opacity-55 disabled:cursor-not-allowed"
                  type="button"
                  onClick={() => setConfirmResetOpen(true)}
                  disabled={saving || avatarBusy || resendBusy || resetBusy}
                >
                  <Mail size={14} strokeWidth={1.8} />
                  Recuperar contraseña
                </button>
                <button className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.03] text-bo-text text-sm font-bold transition-all hover:border-white/[0.09] hover:bg-white/[0.06] disabled:opacity-55 disabled:cursor-not-allowed" type="button" onClick={() => setEditing((v) => !v)} disabled={saving || avatarBusy}>
                  <Pencil size={14} strokeWidth={1.8} />
                  {editing ? "Cancelar" : "Editar"}
                </button>
                {editing ? (
                  <button className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[rgba(185,168,255,0.30)] bg-[rgba(185,168,255,0.16)] text-bo-text text-sm font-bold transition-all hover:border-[rgba(185,168,255,0.40)] hover:bg-[rgba(185,168,255,0.24)] disabled:opacity-55 disabled:cursor-not-allowed mx-auto" type="button" onClick={onSave} disabled={saving || avatarBusy}>
                    <Check size={14} strokeWidth={1.8} />
                    {saving ? "Guardando..." : "Guardar cambios"}
                  </button>
                ) : null}
              </div>
            </div>
            <div className="p-4">
              <div className="bo-memberSection">
                <div className="flex flex-col gap-1">
                  <div className="text-bo-xs text-bo-muted">Contrato semanal</div>
                  <div className="text-bo-sm text-bo-text">{member.weeklyContractHours.toFixed(2)} h</div>
                </div>
                <div className="flex flex-col gap-1">
                  <div className="text-bo-xs text-bo-muted">DNI</div>
                  <div className="text-bo-sm text-bo-text">{member.dni || "No definido"}</div>
                </div>
                <div className="flex flex-col gap-1">
                  <div className="text-bo-xs text-bo-muted">Email</div>
                  <div className="text-bo-sm text-bo-text">{member.email || "No definido"}</div>
                </div>
                {liveEntry ? (
                  <div className="flex flex-col gap-1">
                    <div className="text-bo-xs text-bo-muted">Fichando ahora</div>
                    <div className="text-bo-sm text-bo-text">{formatElapsedHHMMSS(liveEntry, tick)}</div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <div className="rounded-bo-lg bg-bo-surface shadow-bo-soft">
            <div className="flex items-end justify-between pb-2 px-4 pt-4">
              <div className="text-bo-sm font-bold text-bo-text">Informacion de usuario</div>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-auto-fit gap-4">
                <label className="grid gap-bo-2">
                  <span className="text-bo-sm font-semibold text-bo-muted">Nombre</span>
                  <input id="firstName" className="h-10 rounded-bo-md border border-bo-border bg-white/5 text-bo-text px-3 outline-none min-w-0 transition-colors" value={firstName} disabled={!editing || saving || avatarBusy} onChange={(e) => setFirstName(e.target.value)} />
                </label>
                <label className="grid gap-bo-2">
                  <span className="text-bo-sm font-semibold text-bo-muted">Apellidos</span>
                  <input id="lastName" className="h-10 rounded-bo-md border border-bo-border bg-white/5 text-bo-text px-3 outline-none min-w-0 transition-colors" value={lastName} disabled={!editing || saving || avatarBusy} onChange={(e) => setLastName(e.target.value)} />
                </label>
                <label className="grid gap-bo-2">
                  <span className="text-bo-sm font-semibold text-bo-muted">Email</span>
                  <input id="email" className="h-10 rounded-bo-md border border-bo-border bg-white/5 text-bo-text px-3 outline-none min-w-0 transition-colors" value={email} disabled={!editing || saving || avatarBusy} onChange={(e) => setEmail(e.target.value)} />
                </label>
                <label className="grid gap-bo-2">
                  <span className="text-bo-sm font-semibold text-bo-muted">DNI (opcional)</span>
                  <input id="dni" className="h-10 rounded-bo-md border border-bo-border bg-white/5 text-bo-text px-3 outline-none min-w-0 transition-colors" value={dni} disabled={!editing || saving || avatarBusy} onChange={(e) => setDni(e.target.value)} />
                </label>
                <label className="grid gap-bo-2 bo-col-span-2">
                  <span className="text-bo-sm font-semibold text-bo-muted">Numero de cuenta (opcional)</span>
                  <input id="bankAccount" className="h-10 rounded-bo-md border border-bo-border bg-white/5 text-bo-text px-3 outline-none min-w-0 transition-colors" value={bankAccount} disabled={!editing || saving || avatarBusy} onChange={(e) => setBankAccount(e.target.value)} />
                </label>
                <label className="grid gap-bo-2 bo-col-span-2">
                  <span className="text-bo-sm font-semibold text-bo-muted">Telefono (opcional)</span>
                  <PhoneInput
                    countryCode={phoneCountryCode}
                    number={phoneNumber}
                    onCountryCodeChange={setPhoneCountryCode}
                    onNumberChange={setPhoneNumber}
                    disabled={!editing || saving || avatarBusy}
                  />
                </label>
              </div>
            </div>
          </div>
        </>
      )}

      <ConfirmDialog
        open={confirmResendOpen}
        title="Reenviar invitación"
        message="Se generará un nuevo enlace de invitación y se invalidarán los enlaces anteriores activos."
        confirmText="Reenviar"
        onClose={() => setConfirmResendOpen(false)}
        onConfirm={onResendInvitation}
        busy={resendBusy}
      />

      <ConfirmDialog
        open={confirmResetOpen}
        title="Enviar recuperación de contraseña"
        message="Se enviará un enlace para restablecer contraseña al email y/o teléfono del miembro."
        confirmText="Enviar enlace"
        onClose={() => setConfirmResetOpen(false)}
        onConfirm={onSendPasswordReset}
        busy={resetBusy}
      />
    </section>
  );
}
