import React, { useEffect, useMemo, useState } from "react";
import { Upload } from "lucide-react";

import type { RoleCatalogItem } from "../../../../api/types";
import { ImageDropInput } from "../../../../ui/inputs/ImageDropInput";
import { PhoneInput } from "../../../../ui/inputs/PhoneInput";
import { Select } from "../../../../ui/inputs/Select";
import { Modal } from "../../../../ui/overlays/Modal";
import { Avatar, AvatarFallback, AvatarImage } from "../../../../ui/shell/Avatar";

export type CreateMemberInput = {
  firstName: string;
  lastName: string;
  email: string | null;
  dni: string | null;
  phoneCountryCode: string;
  phoneNumber: string;
  roleSlug: string;
  username: string | null;
  temporaryPassword: string | null;
  avatarFile: File | null;
};

function initials(firstName: string, lastName: string): string {
  const a = firstName.trim()[0] ?? "";
  const b = lastName.trim()[0] ?? "";
  return (a + b).toUpperCase() || "MM";
}

function optional(v: string): string | null {
  const trimmed = v.trim();
  return trimmed ? trimmed : null;
}

export function MemberCreateModal({
  open,
  onClose,
  roles,
  busy,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  roles: RoleCatalogItem[];
  busy: boolean;
  onCreate: (input: CreateMemberInput) => Promise<void>;
}) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [dni, setDni] = useState("");
  const [phoneCountryCode, setPhoneCountryCode] = useState("34");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [roleSlug, setRoleSlug] = useState("");
  const [username, setUsername] = useState("");
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setFirstName("");
    setLastName("");
    setEmail("");
    setDni("");
    setPhoneCountryCode("34");
    setPhoneNumber("");
    setRoleSlug(roles[0]?.slug ?? "");
    setUsername("");
    setTemporaryPassword("");
    setAvatarFile(null);
    setAvatarPreview("");
    setError(null);
  }, [open, roles]);

  useEffect(() => {
    if (!avatarFile) {
      setAvatarPreview("");
      return;
    }
    const objectURL = URL.createObjectURL(avatarFile);
    setAvatarPreview(objectURL);
    return () => URL.revokeObjectURL(objectURL);
  }, [avatarFile]);

  const roleOptions = useMemo(
    () => roles.map((role) => ({ value: role.slug, label: role.label })),
    [roles],
  );

  const hasContact = email.trim() !== "" || phoneNumber.trim() !== "";

  const canSubmit = useMemo(() => {
    if (!firstName.trim() || !lastName.trim() || !roleSlug.trim()) return false;
    if (!hasContact && (!username.trim() || !temporaryPassword.trim())) return false;
    return true;
  }, [firstName, hasContact, lastName, roleSlug, temporaryPassword, username]);

  return (
    <Modal open={open} title="Añadir miembro" onClose={onClose} widthPx={760} className="bo-modal--memberCreate">
      <div className="bo-modalHead">
        <div className="bo-modalTitle">Añadir miembro</div>
        <button className="bo-modalX" type="button" onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>

      <div className="bo-modalOutline" style={{ marginTop: 10 }}>
        <div className="bo-panel bo-memberCreatePanel">
          <div className="bo-panelHead">
            <div>
              <div className="bo-panelTitle">Datos de acceso y perfil</div>
              <div className="bo-panelMeta">Si no añades email ni teléfono, debes definir username y password temporal.</div>
            </div>
          </div>
          <div className="bo-panelBody bo-memberCreateBody">
            <div className="bo-memberCreateAvatarBlock">
              <ImageDropInput
                className="bo-memberCreateAvatarDrop"
                ariaLabel="Subir avatar"
                disabled={busy}
                onSelectFile={(file) => {
                  setAvatarFile(file);
                }}
              >
                <Avatar className="bo-memberCreateAvatar">
                  {avatarPreview ? <AvatarImage src={avatarPreview} alt="Preview" /> : null}
                  <AvatarFallback className="bo-memberAvatarFallback">{initials(firstName, lastName)}</AvatarFallback>
                </Avatar>
                <span className="bo-memberCreateAvatarHint" aria-hidden="true">
                  <Upload size={16} />
                </span>
              </ImageDropInput>
              <div className="bo-mutedText bo-memberCreateAvatarText">Avatar opcional (WEBP recomendado).</div>
            </div>

            <div className="bo-memberCreateGrid">
              <label className="bo-field">
                <span className="bo-label">Nombre</span>
                <input className="bo-input" value={firstName} disabled={busy} onChange={(e) => setFirstName(e.target.value)} />
              </label>

              <label className="bo-field">
                <span className="bo-label">Apellidos</span>
                <input className="bo-input" value={lastName} disabled={busy} onChange={(e) => setLastName(e.target.value)} />
              </label>

              <label className="bo-field">
                <span className="bo-label">Email</span>
                <input className="bo-input" value={email} disabled={busy} onChange={(e) => setEmail(e.target.value)} />
              </label>

              <label className="bo-field">
                <span className="bo-label">DNI (opcional)</span>
                <input className="bo-input" value={dni} disabled={busy} onChange={(e) => setDni(e.target.value)} />
              </label>

              <label className="bo-field bo-field--wide">
                <span className="bo-label">Telefono (opcional)</span>
                <PhoneInput
                  countryCode={phoneCountryCode}
                  number={phoneNumber}
                  onCountryCodeChange={setPhoneCountryCode}
                  onNumberChange={setPhoneNumber}
                  disabled={busy}
                />
              </label>

              <label className="bo-field bo-field--wide">
                <span className="bo-label">Rol</span>
                <Select value={roleSlug} onChange={setRoleSlug} options={roleOptions} ariaLabel="Seleccionar rol" disabled={busy} />
              </label>

              {!hasContact ? (
                <>
                  <label className="bo-field bo-field--wide">
                    <span className="bo-label">Username</span>
                    <input
                      className="bo-input"
                      value={username}
                      disabled={busy}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Ejemplo: juan.perez"
                    />
                  </label>

                  <label className="bo-field bo-field--wide">
                    <span className="bo-label">Password temporal</span>
                    <input
                      className="bo-input"
                      type="password"
                      value={temporaryPassword}
                      disabled={busy}
                      onChange={(e) => setTemporaryPassword(e.target.value)}
                    />
                  </label>
                </>
              ) : null}
            </div>

            {error ? <div className="bo-inlineError">{error}</div> : null}
          </div>
        </div>
      </div>

      <div className="bo-modalActions">
        <button className="bo-btn bo-btn--ghost" type="button" onClick={onClose} disabled={busy}>
          Cancelar
        </button>
        <button
          className="bo-btn bo-btn--primary"
          type="button"
          disabled={busy || !canSubmit}
          onClick={() => {
            setError(null);
            if (!canSubmit) {
              setError("Completa los campos obligatorios");
              return;
            }
            void onCreate({
              firstName: firstName.trim(),
              lastName: lastName.trim(),
              email: optional(email),
              dni: optional(dni),
              phoneCountryCode,
              phoneNumber,
              roleSlug,
              username: optional(username),
              temporaryPassword: optional(temporaryPassword),
              avatarFile,
            });
          }}
        >
          {busy ? "Guardando..." : "Guardar miembro"}
        </button>
      </div>
    </Modal>
  );
}
