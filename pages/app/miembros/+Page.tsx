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
  const { pushToast } = useToasts();
  const client = useMemo(() => createClient({ baseUrl: "" }), []);
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
      const res = await fetch("/api/admin/members/whatsapp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ member_id: selectedMember.id, message }),
      });
      const data = await res.json();
      if (data.success) {
        pushToast({ kind: "success", title: "Enviado", message: "Mensaje enviado correctamente" });
        setWhatsappModalOpen(false);
      }
    } catch (err: any) {
      if (err?.code === "NEEDS_SUBSCRIPTION") {
        setNeedsSubscription(true);
      } else {
        pushToast({ kind: "error", title: "Error", message: err instanceof Error ? err.message : "Error desconocido" });
      }
    } finally {
      setSending(false);
    }
  };

  const handleSubscribe = async () => {
    try {
      setSubscribing(true);
      const res = await fetch("/api/admin/members/whatsapp/subscribe", {
        method: "POST",
      });
      const data = await res.json();
      if (data.success) {
        pushToast({ kind: "success", title: "Suscrito", message: data.message || "Suscripcion activada" });
        setNeedsSubscription(false);
      }
    } catch (err) {
      pushToast({ kind: "error", title: "Error", message: err instanceof Error ? err.message : "Error al suscribirse" });
    } finally {
      setSubscribing(false);
    }
  };

  return (
    <section aria-label="Miembros y roles" className="bo-stack">
      <div className="bo-panel">
        <div className="bo-panelHead">
          <div>
            <div className="bo-panelTitle">Equipo y permisos</div>
            <div className="bo-panelMeta">Consulta miembros del restaurante y su rol operativo actual.</div>
          </div>
          <div className="bo-statLabel bo-inline-flex bo-items-center bo-gap-1">
            <ShieldUser size={16} strokeWidth={1.8} />
            {members.length} miembros
          </div>
        </div>
      </div>

      <div className="bo-grid bo-grid-auto-fill bo-grid-gap-3">
        {members.map((member) => {
          const roleMeta = memberRoleMeta(member);
          return (
            <button
              key={member.id}
              type="button"
              className="bo-card bo-card--clickable bo-card--p-3"
              onClick={() => window.location.assign(`/app/miembros/${member.id}`)}
            >
              <div className="bo-flex bo-items-start bo-gap-3">
                <Avatar className="bo-avatar bo-avatar--sm">
                  {member.photoUrl ? <AvatarImage src={member.photoUrl} alt={fullName(member)} /> : null}
                  <AvatarFallback className="rounded-xl text-xs font-semibold">{initials(member.firstName, member.lastName)}</AvatarFallback>
                </Avatar>
                <div className="bo-memberInfo">
                  <div className="bo-flex bo-items-center bo-gap-2">
                    <div className="bo-memberName">{fullName(member)}</div>
                    {isSelfMember(member) ? <span className="bo-badgeSelf">Tu</span> : null}
                  </div>
                  <div className="bo-memberEmail">{member.email ?? "Sin email"}</div>
                </div>
              </div>

              <div className="bo-memberRow">
                <span className="bo-statLabel">Rol</span>
                <RoleBadge
                  roleSlug={roleMeta.slug}
                  roleName={roleMeta.label}
                  importance={roleMeta.importance}
                  className={roleMeta.importance === null ? "opacity-50" : ""}
                />
              </div>

              <div className="bo-memberRow">
                <div className="bo-flex bo-items-center bo-gap-2">
                  <span className="bo-statLabel">Contrato semanal</span>
                  <span className="bo-hoursBadge">{member.weeklyContractHours.toFixed(2)} h</span>
                </div>
                <button
                  onClick={(e) => handleOpenWhatsApp(e, member)}
                  className="bo-actionBtn"
                  aria-label="Enviar WhatsApp"
                >
                  <MessageCircle size={18} />
                </button>
              </div>
            </button>
          );
        })}

        {members.length === 0 ? (
          <div className="bo-panel">
            <div className="bo-panelHead">
              <div className="bo-panelTitle">Sin miembros</div>
              <div className="bo-panelMeta">No hay miembros cargados todavía para este restaurante.</div>
            </div>
          </div>
        ) : null}
      </div>

      <Modal open={whatsappModalOpen} onClose={() => setWhatsappModalOpen(false)} title={`WhatsApp a ${selectedMember?.firstName || ""}`}>
        <div className="bo-whatsappModal">
          {needsSubscription ? (
            <div className="bo-whatsappModalCentered">
              <div className="bo-avatar bo-avatar--xl bo-whatsappAvatar">
                <MessageCircle size={32} />
              </div>
              <h2 className="bo-whatsappModalTitle">WhatsApp Premium Pack</h2>
              <p className="bo-whatsappModalDesc">
                Desbloquea la capacidad de enviar mensajes de WhatsApp directamente a tu personal.
                Ideal para avisos de turnos y comunicaciones importantes.
              </p>
              <div className="bo-whatsappPricingBox">
                <div className="bo-whatsappPrice">29.99 € <span className="bo-whatsappPricePeriod">/ mes</span></div>
                <ul className="bo-whatsappFeatures">
                  <li>✓ Mensajes ilimitados al staff</li>
                  <li>✓ Integración con cuenta de empresa central</li>
                  <li>✓ Sin necesidad de escanear QR</li>
                </ul>
              </div>
              <button type="button" className="bo-btn bo-btn--primary" onClick={handleSubscribe} disabled={subscribing}>
                {subscribing ? "Activando..." : "Suscribirse y Continuar"}
              </button>
            </div>
          ) : (
            <div className="bo-flex bo-flex-col bo-gap-4">
              <h2 className="bo-whatsappModalTitleSm">Mensaje para {selectedMember?.firstName}</h2>
              {!selectedMember?.whatsappNumber ? (
                <div className="bo-alertWarning">
                  Este miembro no tiene un número de WhatsApp configurado en su perfil.
                </div>
              ) : (
                <>
                  <div>
                    <label className="bo-fieldLabel">Mensaje</label>
                    <textarea
                      className="bo-textarea"
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                    />
                  </div>
                  <div className="bo-flex bo-justify-end bo-gap-3 bo-pt-2">
                    <button type="button" className="bo-btn" onClick={() => setWhatsappModalOpen(false)}>Cancelar</button>
                    <button type="button" className="bo-btn bo-btn--primary" onClick={handleSendWhatsApp} disabled={sending || !message.trim()}>
                      {sending ? "Enviando..." : "Enviar por WhatsApp"}
                    </button>
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
