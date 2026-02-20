import React, { useCallback, useMemo, useState } from "react";
import { useAtomValue } from "jotai";
import { ShieldUser, MessageCircle } from "lucide-react";
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
import { Button } from "../../../ui/actions/Button";
import { Modal } from "../../../ui/overlays/Modal";

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
  const members = Array.isArray(raw.members) ? raw.members : [];
  const users = Array.isArray(raw.users) ? raw.users : [];
  const roles = Array.isArray(raw.roles) ? raw.roles : [];
  const initialError = typeof raw.error === "string" ? raw.error : null;
  useErrorToast(initialError);
  const { addToast } = useToasts();
  const { handleError } = useErrorToast();
  const client = createClient();
  const session = useAtomValue(sessionAtom);

  const [whatsappModalOpen, setWhatsappModalOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [needsSubscription, setNeedsSubscription] = useState(false);
  const [subscribing, setSubscribing] = useState(false);

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
    setSelectedMember(member);
    setNeedsSubscription(false);
    setMessage(`Hola ${member.firstName}, `);
    setWhatsappModalOpen(true);
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

  return (
    <section aria-label="Miembros y roles" className="bo-content-grid bo-membersPage">
      <div className="bo-panel">
        <div className="bo-panelHead bo-membersIntroHead">
          <div>
            <div className="bo-panelTitle">Equipo y permisos</div>
            <div className="bo-panelMeta">Consulta miembros del restaurante y su rol operativo actual.</div>
          </div>
          <div className="bo-membersIntroBadge">
            <ShieldUser size={16} strokeWidth={1.8} />
            {members.length} miembros
          </div>
        </div>
      </div>

      <div className="bo-membersGrid">
        {members.map((member) => {
          const roleMeta = memberRoleMeta(member);
          return (
            <button
              key={member.id}
              type="button"
              className="bo-memberCard"
              onClick={() => window.location.assign(`/app/miembros/${member.id}`)}
            >
              <div className="bo-memberCardTop">
                <Avatar className="bo-memberAvatar">
                  {member.photoUrl ? <AvatarImage src={member.photoUrl} alt={fullName(member)} /> : null}
                  <AvatarFallback className="bo-memberAvatarFallback">{initials(member.firstName, member.lastName)}</AvatarFallback>
                </Avatar>
                <div className="bo-memberMain">
                  <div className="bo-memberNameRow">
                    <div className="bo-memberName">{fullName(member)}</div>
                    {isSelfMember(member) ? <span className="bo-badge bo-badge--self">Tu</span> : null}
                  </div>
                  <div className="bo-memberSub">{member.email ?? "Sin email"}</div>
                </div>
              </div>

              <div className="bo-memberRoleRow">
                <span className="bo-memberMeta">Rol</span>
                <RoleBadge
                  roleSlug={roleMeta.slug}
                  roleName={roleMeta.label}
                  importance={roleMeta.importance}
                  className={roleMeta.importance === null ? "bo-roleBadge--ghost" : ""}
                />
              </div>

              <div className="bo-memberCardFoot" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="bo-memberMeta">Contrato semanal</span>
                  <span className="bo-badge bo-memberHours">{member.weeklyContractHours.toFixed(2)} h</span>
                </div>
                <button 
                  onClick={(e) => handleOpenWhatsApp(e, member)}
                  className="p-2 rounded-full hover:bg-green-500/20 text-slate-400 hover:text-green-400 transition-colors"
                  aria-label="Enviar WhatsApp"
                >
                  <MessageCircle size={18} />
                </button>
              </div>
            </button>
          );
        })}

        {members.length === 0 ? (
          <div className="bo-panel bo-panel--empty">
            <div className="bo-panelHead">
              <div className="bo-panelTitle">Sin miembros</div>
              <div className="bo-panelMeta">No hay miembros cargados todavía para este restaurante.</div>
            </div>
          </div>
        ) : null}
      </div>

      <Modal open={whatsappModalOpen} onOpenChange={setWhatsappModalOpen}>
        <div className="p-6 max-w-md w-full">
          {needsSubscription ? (
            <div className="text-center space-y-4">
              <div className="mx-auto w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center text-green-400 mb-4">
                <MessageCircle size={32} />
              </div>
              <h2 className="text-xl font-bold text-slate-100">WhatsApp Premium Pack</h2>
              <p className="text-slate-400 text-sm">
                Desbloquea la capacidad de enviar mensajes de WhatsApp directamente a tu personal. 
                Ideal para avisos de turnos y comunicaciones importantes.
              </p>
              <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700 my-4">
                <div className="text-2xl font-bold text-slate-100 mb-1">29.99 € <span className="text-sm text-slate-400 font-normal">/ mes</span></div>
                <ul className="text-sm text-left text-slate-300 space-y-2 mt-4">
                  <li>✓ Mensajes ilimitados al staff</li>
                  <li>✓ Integración con cuenta de empresa central</li>
                  <li>✓ Sin necesidad de escanear QR</li>
                </ul>
              </div>
              <Button variant="primary" className="w-full" onClick={handleSubscribe} disabled={subscribing}>
                {subscribing ? "Activando..." : "Suscribirse y Continuar"}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-slate-100">Mensaje para {selectedMember?.firstName}</h2>
              {!selectedMember?.whatsappNumber ? (
                <div className="bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 p-3 rounded text-sm">
                  Este miembro no tiene un número de WhatsApp configurado en su perfil.
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Mensaje</label>
                    <textarea 
                      className="w-full h-32 bg-slate-900 border border-slate-700 rounded-lg p-3 text-slate-200 text-sm focus:ring-1 focus:ring-indigo-500 outline-none resize-none"
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                    />
                  </div>
                  <div className="flex justify-end gap-3 pt-2">
                    <Button variant="secondary" onClick={() => setWhatsappModalOpen(false)}>Cancelar</Button>
                    <Button variant="primary" onClick={handleSendWhatsApp} disabled={sending || !message.trim()}>
                      {sending ? "Enviando..." : "Enviar por WhatsApp"}
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </Modal>
    </section>
  );
}
