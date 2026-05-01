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
import { Panel } from "../../../../ui/shell/Panel";
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
    <section aria-label="Informacion del miembro" className="bo-content-grid bo-memberDetailPage" data-slot="miembro-detail-section">
      {!member ? (
        <Panel data-slot="@memberId-panel" title="Miembro no disponible" meta="No se pudo cargar el detalle del miembro solicitado." />
      ) : (
        <>
          <div className="bo-panel bo-memberHero" data-slot="@memberId-memberHero">
            <div className="bo-panelHead bo-memberHeroHead" data-slot="@memberId-memberHeroHead">
              <div className="bo-memberHeroIdentity" data-slot="@memberId-memberHeroIdentity">
                <ImageDropInput
                  className={`bo-memberHeroAvatarDropzone${avatarBusy ? " is-busy" : ""}`}
                  disabled={avatarBusy}
                  ariaLabel="Subir avatar"
                  onSelectFile={onAvatarSelect}
                >
                  <Avatar className="bo-memberHeroAvatar">
                    {member.photoUrl ? <AvatarImage src={member.photoUrl} alt={memberName || `Miembro #${member.id}`} /> : null}
                    <AvatarFallback className="bo-memberAvatarFallback">{initials(member)}</AvatarFallback>
                  </Avatar>
                  <span className="bo-memberAvatarUploadOverlay" aria-hidden="true" data-slot="@memberId-memberAvatarUploadOverlay">
                    {avatarBusy ? <Loader2 size={18} className="bo-memberAvatarUploadIcon is-spinning" /> : <Upload size={18} className="bo-memberAvatarUploadIcon" />}
                  </span>
                </ImageDropInput>
                <div className="bo-memberHeroTexts" data-slot="@memberId-memberHeroTexts">
                  <div className="bo-memberHeroTitleRow" data-slot="@memberId-memberHeroTitleRow">
                    <div className="bo-panelTitle bo-memberHeroTitle" data-slot="@memberId-memberHeroTitle">{memberName || `Miembro #${member.id}`}</div>
                    {isSelfMember ? <span className="bo-badge bo-badge--self">Tu</span> : null}
                  </div>
                  <div className="bo-panelMeta" data-slot="@memberId-panelMeta">Haz clic o arrastra una imagen sobre el avatar para actualizar la foto de perfil.</div>
                </div>
              </div>
              <div className="bo-memberHeroActions" data-slot="@memberId-memberHeroActions">
                <button
                  className="bo-btn bo-btn--ghost flex-wrap !text-wrap !h-fit !py-4"
                  type="button"
                  data-testid="miembro-detail-resend-invitation-button"
                  onClick={() => setConfirmResendOpen(true)}
                  disabled={saving || avatarBusy || resendBusy || resetBusy}
                >
                  <RefreshCcw size={14} strokeWidth={1.8} />
                  Reenviar invitación
                </button>
                <button
                  className="bo-btn bo-btn--ghost flex-wrap !text-wrap !h-fit !py-4"
                  type="button"
                  data-testid="miembro-detail-reset-password-button"
                  onClick={() => setConfirmResetOpen(true)}
                  disabled={saving || avatarBusy || resendBusy || resetBusy}
                >
                  <Mail size={14} strokeWidth={1.8} />
                  Recuperar contraseña
                </button>
                <button className="bo-btn bo-btn--ghost" type="button" data-testid="miembro-detail-edit-button" onClick={() => setEditing((v) => !v)} disabled={saving || avatarBusy}>
                  <Pencil size={14} strokeWidth={1.8} />
                  {editing ? "Cancelar" : "Editar"}
                </button>
                {editing ? (
                  <button className="bo-btn bo-btn--primary flex-wrap !text-wrap !h-fit !py-4" type="button" data-testid="miembro-detail-save-button" onClick={onSave} disabled={saving || avatarBusy}>
                    <Check size={14} strokeWidth={1.8} />
                    {saving ? "Guardando..." : "Guardar cambios"}
                  </button>
                ) : null}
              </div>
            </div>
            <div className="bo-panelBody" data-slot="@memberId-panelBody">
              <div className="bo-memberHeroStats" data-slot="@memberId-memberHeroStats">
                <div className="bo-kv" data-slot="@memberId-kv">
                  <div className="bo-kvLabel" data-slot="@memberId-kvLabel">Contrato semanal</div>
                  <div className="bo-kvValue" data-slot="@memberId-kvValue">{member.weeklyContractHours.toFixed(2)} h</div>
                </div>
                <div className="bo-kv" data-slot="@memberId-kv">
                  <div className="bo-kvLabel" data-slot="@memberId-kvLabel">DNI</div>
                  <div className="bo-kvValue" data-slot="@memberId-kvValue">{member.dni || "No definido"}</div>
                </div>
                <div className="bo-kv" data-slot="@memberId-kv">
                  <div className="bo-kvLabel" data-slot="@memberId-kvLabel">Email</div>
                  <div className="bo-kvValue" data-slot="@memberId-kvValue">{member.email || "No definido"}</div>
                </div>
                {liveEntry ? (
                  <div className="bo-kv" data-slot="@memberId-kv">
                    <div className="bo-kvLabel" data-slot="@memberId-kvLabel">Fichando ahora</div>
                    <div className="bo-kvValue" data-slot="@memberId-kvValue">{formatElapsedHHMMSS(liveEntry, tick)}</div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <Panel data-slot="@memberId-panel" title="Informacion de usuario">
            <div className="bo-memberFormGrid" data-slot="@memberId-memberFormGrid">
                <label className="bo-field" data-slot="@memberId-field">
                  <span className="bo-label" data-slot="@memberId-label">Nombre</span>
                  <input id="firstName" className="bo-input" data-testid="miembro-detail-firstname-input" value={firstName} disabled={!editing || saving || avatarBusy} onChange={(e) => setFirstName(e.target.value)} />
                </label>
                <label className="bo-field" data-slot="@memberId-field">
                  <span className="bo-label" data-slot="@memberId-label">Apellidos</span>
                  <input id="lastName" className="bo-input" data-testid="miembro-detail-lastname-input" value={lastName} disabled={!editing || saving || avatarBusy} onChange={(e) => setLastName(e.target.value)} />
                </label>
                <label className="bo-field" data-slot="@memberId-field">
                  <span className="bo-label" data-slot="@memberId-label">Email</span>
                  <input id="email" className="bo-input" data-testid="miembro-detail-email-input" value={email} disabled={!editing || saving || avatarBusy} onChange={(e) => setEmail(e.target.value)} />
                </label>
                <label className="bo-field" data-slot="@memberId-field">
                  <span className="bo-label" data-slot="@memberId-label">DNI (opcional)</span>
                  <input id="dni" className="bo-input" data-testid="miembro-detail-dni-input" value={dni} disabled={!editing || saving || avatarBusy} onChange={(e) => setDni(e.target.value)} />
                </label>
                <label className="bo-field bo-field--wide" data-slot="@memberId-field--wide">
                  <span className="bo-label" data-slot="@memberId-label">Numero de cuenta (opcional)</span>
                  <input id="bankAccount" className="bo-input" data-testid="miembro-detail-bankaccount-input" value={bankAccount} disabled={!editing || saving || avatarBusy} onChange={(e) => setBankAccount(e.target.value)} />
                </label>
                <label className="bo-field bo-field--wide" data-slot="@memberId-field--wide">
                  <span className="bo-label" data-slot="@memberId-label">Telefono (opcional)</span>
                  <PhoneInput
                    countryCode={phoneCountryCode}
                    number={phoneNumber}
                    onCountryCodeChange={setPhoneCountryCode}
                    onNumberChange={setPhoneNumber}
                    disabled={!editing || saving || avatarBusy}
                  />
                </label>
              </div>
            </Panel>
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
