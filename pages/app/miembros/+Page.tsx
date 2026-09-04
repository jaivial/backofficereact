import React, { useCallback, useMemo, useState } from "react";
import { useAtomValue } from "jotai";
import { CircleAlert, Loader2, MessageCircle, Phone, Send, ShieldUser } from "lucide-react";
import { usePageContext } from "vike-react/usePageContext";

import type { Member, RoleCatalogItem, RoleUserItem } from "../../../api/types";
import { roleLabel } from "../../../lib/rbac";
import { sessionAtom } from "../../../state/atoms";
import { Avatar, AvatarFallback, AvatarImage } from "../../../ui/shell/Avatar";
import { RoleBadge } from "../../../ui/widgets/roles/RoleBadge";
import type { Data } from "./+data";
import { useErrorToast } from "../../../ui/feedback/useErrorToast";
import { useToasts } from "../../../ui/feedback/useToasts";
import { createClient } from "../../../api/client";
import { Button } from "../../../ui/shadcn/button";
import { PhoneInput } from "../../../ui/inputs/PhoneInput";
import { composePhoneE164, splitStoredPhone } from "../../../ui/lib/phone";
import { Modal } from "../../../ui/overlays/Modal";
import { MemberCreateModal, type CreateMemberInput } from "./functionalComponents/MemberCreateModal/MemberCreateModal";

function initials(firstName: string, lastName: string) {
  const a = firstName.trim()[0] ?? "";
  const b = lastName.trim()[0] ?? "";
  return (a + b).toUpperCase() || "MM";
}

function fullName(member: Member): string {
  const name = `${member.firstName || ""} ${member.lastName || ""}`.trim();
  return name || `Miembro #${member.id}`;
}

function normalizeEmail(v: string | null | undefined): string {
  return String(v ?? "").trim().toLowerCase();
}

export default function Page() {
  const pageContext = usePageContext();
  const raw = (pageContext.data ?? {}) as Partial<Data>;
  const initialMembers = Array.isArray(raw.members) ? raw.members : [];
  const users = Array.isArray(raw.users) ? raw.users : [];
  const roles = Array.isArray(raw.roles) ? raw.roles : [];
  const initialError = typeof raw.error === "string" ? raw.error : null;
  useErrorToast(initialError);
  const { addToast } = useToasts();
  const { handleError } = useErrorToast();
  const client = useMemo(() => createClient({ baseUrl: "" }), []);
  const session = useAtomValue(sessionAtom);

  const [members, setMembers] = useState<Member[]>(initialMembers);
  const [whatsappModalOpen, setWhatsappModalOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [phoneCountryCode, setPhoneCountryCode] = useState("34");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [phoneSaving, setPhoneSaving] = useState(false);
  const [needsSubscription, setNeedsSubscription] = useState(false);
  const [subscribing, setSubscribing] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [localMembers, setLocalMembers] = useState<Member[]>([]);

  const currentEmail = useMemo(() => normalizeEmail(session?.user?.email), [session?.user?.email]);
  const rolesBySlug = useMemo(() => {
    const out = new Map<string, RoleCatalogItem>();
    for (const role of roles) out.set(role.slug, role);
    return out;
  }, [roles]);
  const usersById = useMemo(() => {
    const out = new Map<number, RoleUserItem>();
    for (const user of users) out.set(user.id, user);
    return out;
  }, [users]);
  const usersByEmail = useMemo(() => {
    const out = new Map<string, RoleUserItem>();
    for (const user of users) out.set(normalizeEmail(user.email), user);
    return out;
  }, [users]);

  const isSelfMember = useCallback(
    (member: Member): boolean => {
      if (member.isCurrentUser) return true;
      if (!currentEmail) return false;
      return normalizeEmail(member.email) === currentEmail;
    },
    [currentEmail],
  );

  const memberRoleMeta = useCallback(
    (member: Member): { slug: string; label: string; importance: number | null } => {
      const byId = typeof member.boUserId === "number" ? usersById.get(member.boUserId) : undefined;
      const email = normalizeEmail(member.email);
      const byEmail = email ? usersByEmail.get(email) : undefined;
      const user = byId ?? byEmail;
      if (!user) {
        if (!member.boUserId) return { slug: "sin_usuario", label: "Sin usuario", importance: null };
        return { slug: "sin_rol", label: "Sin rol", importance: null };
      }
      const catalog = rolesBySlug.get(user.role);
      return {
        slug: user.role,
        label: catalog?.label || roleLabel(user.role),
        importance: catalog?.importance ?? user.roleImportance ?? null,
      };
    },
    [rolesBySlug, usersByEmail, usersById],
  );

  const handleOpenWhatsApp = (e: React.MouseEvent, member: Member) => {
    e.stopPropagation();
    const phone = splitStoredPhone(member.whatsappNumber || member.phone);
    setSelectedMember(member);
    setPhoneCountryCode(phone.countryCode);
    setPhoneNumber(phone.national);
    setPhoneError(null);
    setNeedsSubscription(false);
    setMessage(`Hola ${member.firstName}, `);
    setWhatsappModalOpen(true);
  };

  const handleAddPhone = async () => {
    if (!selectedMember) return;
    const phone = composePhoneE164(phoneCountryCode, phoneNumber);
    if (!phone) {
      setPhoneError("Introduce un número de teléfono válido.");
      return;
    }

    setPhoneSaving(true);
    setPhoneError(null);
    try {
      const res = await client.members.setPhone(selectedMember.id, phone);
      if (!res.success) {
        setPhoneError(res.message || "No se pudo guardar el teléfono.");
        return;
      }
      setSelectedMember(res.member);
      setMembers((current) => current.map((member) => member.id === res.member.id ? res.member : member));
      setLocalMembers((current) => current.map((member) => member.id === res.member.id ? res.member : member));
      addToast({ title: "Teléfono guardado", description: "Ya puedes enviar el mensaje por WhatsApp." });
    } catch (err) {
      setPhoneError(err instanceof Error ? err.message : "No se pudo guardar el teléfono.");
    } finally {
      setPhoneSaving(false);
    }
  };

  const handleSendWhatsApp = async () => {
    if (!selectedMember || !message.trim()) return;
    try {
      setSending(true);
      const res = await client.request<{ success: boolean; message?: string; code?: string }>("/admin/members/whatsapp/send", {
        method: "POST",
        body: JSON.stringify({ member_id: selectedMember.id, message }),
      });
      if (res.success) {
        addToast({ title: "Enviado", description: "Mensaje enviado correctamente" });
        setWhatsappModalOpen(false);
      }
    } catch (err: any) {
      if (err?.code === "NEEDS_SUBSCRIPTION") {
        setNeedsSubscription(true);
      } else {
        handleError(err);
      }
    } finally {
      setSending(false);
    }
  };

  const handleSubscribe = async () => {
    try {
      setSubscribing(true);
      const res = await client.request<{ success: boolean; message: string }>("/admin/members/whatsapp/subscribe", {
        method: "POST",
      });
      if (res.success) {
        addToast({ title: "Suscrito", description: res.message });
        setNeedsSubscription(false);
      }
    } catch (err) {
      handleError(err);
    } finally {
      setSubscribing(false);
    }
  };

  const handleCreateMember = async (input: CreateMemberInput) => {
    try {
      setCreating(true);
      const phone = input.phoneNumber ? `+${input.phoneCountryCode}${input.phoneNumber}` : null;
      const res = await client.members.create({
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email,
        dni: input.dni,
        phone,
        roleSlug: input.roleSlug,
        username: input.username,
        temporaryPassword: input.temporaryPassword,
      });
      if (!res.success) {
        throw new Error(res.message || "Error creando miembro");
      }
      if (input.avatarFile && res.member) {
        await client.members.uploadAvatar(res.member.id, input.avatarFile);
      }
      if (res.member) {
        setLocalMembers((prev) => [...prev, res.member!]);
      }
      addToast({ title: "Creado", description: `Miembro ${input.firstName} ${input.lastName} creado correctamente` });
      setCreateModalOpen(false);
    } catch (err) {
      handleError(err);
    } finally {
      setCreating(false);
    }
  };

  return (
    <section data-testid="miembros-y-roles" aria-label="Miembros y roles" className="bo-content-grid bo-membersPage">
      <div data-slot="miembros-panel" className="bo-panel">
        <div data-slot="miembros-membersIntroHead" className="bo-panelHead bo-membersIntroHead">
          <div data-slot="miembros-div">
            <div data-slot="miembros-panelTitle" className="bo-panelTitle">Equipo y permisos</div>
            <div data-slot="miembros-panelMeta" className="bo-panelMeta">Consulta miembros del restaurante y su rol operativo actual.</div>
          </div>
          <div data-slot="miembros-gap-3" className="flex items-center gap-3">
            <div className="bo-membersIntroBadge" data-testid="member-count">
              <ShieldUser size={16} strokeWidth={1.8} />
              {members.length + localMembers.length} miembros
            </div>
            <button type="button" className="pos-rail__btn" style={{ padding: "0.5rem 1rem", aspectRatio: "auto" }} data-testid="add-member-button" onClick={() => setCreateModalOpen(true)}>
              + Añadir miembro
            </button>
          </div>
        </div>
      </div>

      <div data-slot="miembros-membersGrid" className="bo-membersGrid">
        {[...members, ...localMembers].map((member) => {
          const roleMeta = memberRoleMeta(member);
          return (
            <div data-slot="miembros-memberCard"
              key={member.id}
              role="link"
              tabIndex={0}
              className="bo-memberCard"
              onClick={() => window.location.assign(`/app/miembros/${member.id}`)}
              onKeyDown={(event) => {
                if (event.key !== "Enter" && event.key !== " ") return;
                event.preventDefault();
                window.location.assign(`/app/miembros/${member.id}`);
              }}
            >
              <div data-slot="miembros-memberCardTop" className="bo-memberCardTop">
                <Avatar className="bo-memberAvatar">
                  {member.photoUrl ? <AvatarImage src={member.photoUrl} alt={fullName(member)} /> : null}
                  <AvatarFallback className="bo-memberAvatarFallback">{initials(member.firstName, member.lastName)}</AvatarFallback>
                </Avatar>
                <div data-slot="miembros-memberMain" className="bo-memberMain">
                  <div data-slot="miembros-memberNameRow" className="bo-memberNameRow">
                    <div data-slot="miembros-memberName" className="bo-memberName">{fullName(member)}</div>
                    {isSelfMember(member) ? <span className="bo-badge bo-badge--self">Tu</span> : null}
                  </div>
                  <div data-slot="miembros-memberSub" className="bo-memberSub">{member.email ?? "Sin email"}</div>
                </div>
              </div>

              <div data-slot="miembros-memberRoleRow" className="bo-memberRoleRow">
                <span data-slot="miembros-memberMeta" className="bo-memberMeta">Rol</span>
                <RoleBadge
                  roleSlug={roleMeta.slug}
                  roleName={roleMeta.label}
                  importance={roleMeta.importance}
                  className={roleMeta.importance === null ? "bo-roleBadge--ghost" : ""}
                />
              </div>

              <div data-slot="miembros-memberCardFoot" className="bo-memberCardFoot" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div data-slot="miembros-div" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span data-slot="miembros-memberMeta" className="bo-memberMeta">Contrato semanal</span>
                  <span data-slot="miembros-memberHours" className="bo-badge bo-memberHours">{member.weeklyContractHours.toFixed(2)} h</span>
                </div>
                <button data-testid="memberwhatsappbutton"
                  type="button"
                  onClick={(e) => handleOpenWhatsApp(e, member)}
                  className="bo-memberWhatsAppButton"
                  aria-label={`Enviar WhatsApp a ${fullName(member)}`}
                  data-member-id={member.id}
                  data-user-id={member.boUserId ?? undefined}
                  data-has-phone={Boolean(member.whatsappNumber || member.phone)}
                >
                  <MessageCircle size={18} strokeWidth={1.8} />
                </button>
              </div>
            </div>
          );
        })}

        {members.length === 0 && localMembers.length === 0 ? (
          <div data-slot="miembros-panel-empty" className="bo-panel bo-panel--empty">
            <div data-slot="miembros-panelHead" className="bo-panelHead">
              <div data-slot="miembros-panelTitle" className="bo-panelTitle">Sin miembros</div>
              <div data-slot="miembros-panelMeta" className="bo-panelMeta">No hay miembros cargados todavía para este restaurante.</div>
            </div>
          </div>
        ) : null}
      </div>

      <Modal open={whatsappModalOpen} title="WhatsApp" onClose={() => setWhatsappModalOpen(false)}>
        <div data-slot="miembros-memberWhatsAppModal" className="bo-memberWhatsAppModal" data-member-id={selectedMember?.id} data-user-id={selectedMember?.boUserId ?? undefined}>
          {needsSubscription ? (
            <div data-slot="miembros-memberWhatsAppPremium" className="bo-memberWhatsAppPremium">
              <div data-slot="miembros-memberWhatsAppHeroIcon" className="bo-memberWhatsAppHeroIcon" aria-hidden="true">
                <MessageCircle size={28} strokeWidth={1.8} />
              </div>
              <h2 data-slot="miembros-h2">WhatsApp Premium Pack</h2>
              <p data-slot="miembros-p">Envía avisos de turnos y comunicaciones directamente a tu equipo.</p>
              <div data-slot="miembros-memberWhatsAppPrice" className="bo-memberWhatsAppPrice">
                <div data-slot="miembros-div">29.99 € <span>/ mes</span></div>
                <ul data-slot="miembros-ul">
                  <li data-slot="miembros-li">Mensajes ilimitados al staff</li>
                  <li data-slot="miembros-li">Cuenta de empresa central</li>
                  <li data-slot="miembros-li">Sin escanear QR</li>
                </ul>
              </div>
              <Button variant="default" className="bo-memberWhatsAppFullButton" onClick={handleSubscribe} disabled={subscribing}>
                {subscribing ? <Loader2 size={16} className="bo-spin" /> : <MessageCircle size={16} />}
                {subscribing ? "Activando..." : "Suscribirse y continuar"}
              </Button>
            </div>
          ) : (
            <div data-slot="miembros-memberWhatsAppContent" className="bo-memberWhatsAppContent">
              <div data-slot="miembros-memberWhatsAppHeading" className="bo-memberWhatsAppHeading">
                <div data-slot="miembros-memberWhatsAppHeroIcon" className="bo-memberWhatsAppHeroIcon" aria-hidden="true">
                  <MessageCircle size={22} strokeWidth={1.8} />
                </div>
                <div data-slot="miembros-div">
                  <h2 data-slot="miembros-h2">Mensaje para {selectedMember?.firstName}</h2>
                  <p data-slot="miembros-p">{selectedMember ? fullName(selectedMember) : "Miembro"}</p>
                </div>
              </div>
              {!selectedMember?.whatsappNumber ? (
                <div data-slot="miembros-memberPhoneSetup" className="bo-memberPhoneSetup">
                  <div data-slot="miembros-memberPhoneNotice" className="bo-memberPhoneNotice" role="status">
                    <CircleAlert size={18} strokeWidth={1.8} aria-hidden="true" />
                    <span data-slot="miembros-span">Este miembro no tiene un número de WhatsApp configurado en su perfil.</span>
                  </div>
                  <label data-slot="miembros-memberWhatsAppLabel" className="bo-memberWhatsAppLabel">Añadir teléfono</label>
                  <PhoneInput
                    countryCode={phoneCountryCode}
                    number={phoneNumber}
                    onCountryCodeChange={setPhoneCountryCode}
                    onNumberChange={setPhoneNumber}
                    disabled={phoneSaving}
                    numberAriaLabel={`Teléfono de ${selectedMember?.firstName || "miembro"}`}
                  />
                  {phoneError ? <div className="bo-memberPhoneError" role="alert">{phoneError}</div> : null}
                  <div data-slot="miembros-memberWhatsAppActions" className="bo-memberWhatsAppActions">
                    <Button variant="secondary" onClick={() => setWhatsappModalOpen(false)} disabled={phoneSaving}>Cancelar</Button>
                    <Button variant="default" onClick={handleAddPhone} disabled={phoneSaving || !phoneNumber.trim()} data-member-id={selectedMember?.id} data-user-id={selectedMember?.boUserId ?? undefined}>
                      {phoneSaving ? <Loader2 size={16} className="bo-spin" /> : <Phone size={16} strokeWidth={1.8} />}
                      {phoneSaving ? "Guardando..." : "Guardar teléfono"}
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <label data-slot="miembros-memberWhatsAppLabel" className="bo-memberWhatsAppLabel" htmlFor="member-whatsapp-message">Mensaje</label>
                  <textarea data-testid="memberwhatsapptextarea"
                    id="member-whatsapp-message"
                    className="bo-textarea bo-memberWhatsAppTextarea"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                  />
                  <div data-slot="miembros-memberWhatsAppActions" className="bo-memberWhatsAppActions">
                    <Button variant="secondary" onClick={() => setWhatsappModalOpen(false)}>Cancelar</Button>
                    <Button variant="default" onClick={handleSendWhatsApp} disabled={sending || !message.trim()}>
                      {sending ? <Loader2 size={16} className="bo-spin" /> : <Send size={16} strokeWidth={1.8} />}
                      {sending ? "Enviando..." : "Enviar"}
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </Modal>

      <MemberCreateModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        roles={roles}
        busy={creating}
        onCreate={handleCreateMember}
      />
    </section>
  );
}
