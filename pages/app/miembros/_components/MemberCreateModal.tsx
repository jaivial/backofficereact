import React, { useEffect, useMemo, useState } from "react";
import { Upload } from "lucide-react";

import type { RoleCatalogItem } from "../../../../api/types";
import { ImageDropInput } from "../../../../ui/inputs/ImageDropInput";
import { PhoneInput } from "../../../../ui/inputs/PhoneInput";
import { Select } from "../../../../ui/inputs/Select";
import { Modal } from "../../../../ui/overlays/Modal";
import { Avatar, AvatarFallback, AvatarImage } from "../../../../ui/shell/Avatar";
import { RoleIcon } from "../../../../ui/widgets/roles/RoleIcon";

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
    () =>
      roles.map((role) => ({
        value: role.slug,
        label: role.label,
        icon: <RoleIcon roleSlug={role.slug} iconKey={role.iconKey} size={15} strokeWidth={1.8} />,
      })),
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
      <div className="flex items-center justify-between p-4 border-b border">
        <div className="text-lg font-semibold text-foreground">Añadir miembro</div>
        <button className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded hover:bg-white/10 cursor-pointer" type="button" onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>

      <div className="bo-modalOutline" style={{ marginTop: 10 }}>
        <div className="rounded-lg bg-card shadow-soft bo-memberCreatePanel">
          <div className="flex items-end justify-between pb-2 px-4 pt-4">
            <div>
              <div className="text-sm font-bold text-foreground">Datos de acceso y perfil</div>
            </div>
          </div>
          <div className="p-4 bo-memberCreateBody">
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
                <span className="bo-memberCreateAvatarOverlay" aria-hidden="true">
                  <Upload size={18} strokeWidth={1.8} />
                </span>
              </ImageDropInput>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1">
                <span className="text-sm font-medium text-foreground">Nombre</span>
                <input className="h-10 rounded-xl border border bg-white/[0.03] text-foreground px-3 outline-none min-w-0 transition-colors focus:border-[rgba(185,168,255,0.38)] focus:shadow-[0_0_0_3px_rgba(185,168,255,0.10)]" value={firstName} disabled={busy} onChange={(e) => setFirstName(e.target.value)} />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-sm font-medium text-foreground">Apellidos</span>
                <input className="h-10 rounded-xl border border bg-white/[0.03] text-foreground px-3 outline-none min-w-0 transition-colors focus:border-[rgba(185,168,255,0.38)] focus:shadow-[0_0_0_3px_rgba(185,168,255,0.10)]" value={lastName} disabled={busy} onChange={(e) => setLastName(e.target.value)} />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-sm font-medium text-foreground">Email</span>
                <input className="h-10 rounded-xl border border bg-white/[0.03] text-foreground px-3 outline-none min-w-0 transition-colors focus:border-[rgba(185,168,255,0.38)] focus:shadow-[0_0_0_3px_rgba(185,168,255,0.10)]" value={email} disabled={busy} onChange={(e) => setEmail(e.target.value)} />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-sm font-medium text-foreground">DNI (opcional)</span>
                <input className="h-10 rounded-xl border border bg-white/[0.03] text-foreground px-3 outline-none min-w-0 transition-colors focus:border-[rgba(185,168,255,0.38)] focus:shadow-[0_0_0_3px_rgba(185,168,255,0.10)]" value={dni} disabled={busy} onChange={(e) => setDni(e.target.value)} />
              </label>

              <label className="col-span-2 flex flex-col gap-1">
                <span className="text-sm font-medium text-foreground">Telefono (opcional)</span>
                <PhoneInput
                  countryCode={phoneCountryCode}
                  number={phoneNumber}
                  onCountryCodeChange={setPhoneCountryCode}
                  onNumberChange={setPhoneNumber}
                  disabled={busy}
                />
              </label>

              <label className="col-span-2 flex flex-col gap-1">
                <span className="text-sm font-medium text-foreground">Rol</span>
                <Select
                  value={roleSlug}
                  onChange={setRoleSlug}
                  options={roleOptions}
                  ariaLabel="Seleccionar rol"
                  disabled={busy}
                  listMaxHeightPx={200}
                />
              </label>

              {!hasContact ? (
                <>
                  <label className="col-span-2 flex flex-col gap-1">
                    <span className="text-sm font-medium text-foreground">Username</span>
                    <input
                      className="h-10 rounded-xl border border bg-white/[0.03] text-foreground px-3 outline-none min-w-0 transition-colors focus:border-[rgba(185,168,255,0.38)] focus:shadow-[0_0_0_3px_rgba(185,168,255,0.10)]"
                      value={username}
                      disabled={busy}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Ejemplo: juan.perez"
                    />
                  </label>

                  <label className="col-span-2 flex flex-col gap-1">
                    <span className="text-sm font-medium text-foreground">Password temporal</span>
                    <input
                      className="h-10 rounded-xl border border bg-white/[0.03] text-foreground px-3 outline-none min-w-0 transition-colors focus:border-[rgba(185,168,255,0.38)] focus:shadow-[0_0_0_3px_rgba(185,168,255,0.10)]"
                      type="password"
                      value={temporaryPassword}
                      disabled={busy}
                      onChange={(e) => setTemporaryPassword(e.target.value)}
                    />
                  </label>
                </>
              ) : null}
            </div>

            {error ? <div className="text-sm text-red-500 mt-2">{error}</div> : null}
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-2 p-4 border-t border">
        <button className="h-10 rounded-xl border border bg-transparent text-foreground cursor-pointer px-[14px] font-bold inline-flex items-center justify-center gap-2" type="button" onClick={onClose} disabled={busy}>
          Cancelar
        </button>
        <button
          className="h-10 rounded-xl border border-[rgba(185,168,255,0.30)] bg-[rgba(185,168,255,0.16)] text-foreground cursor-pointer px-[14px] font-bold inline-flex items-center justify-center gap-2"
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
