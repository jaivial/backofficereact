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
    <section aria-label="Miembros y roles" className="grid gap-4">
      <div className="rounded-[var(--bo-radius-lg)] bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(0,0,0,0.10)),var(--bo-surface-2)] border border-[var(--bo-border)] p-4">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-base font-semibold text-[var(--bo-text)] leading-tight">Equipo y permisos</div>
            <div className="text-xs text-[var(--bo-muted)] mt-0.5">Consulta miembros del restaurante y su rol operativo actual.</div>
          </div>
          <div className="text-xs text-[var(--bo-muted)] inline-flex items-center gap-1">
            <ShieldUser size={16} strokeWidth={1.8} />
            {members.length} miembros
          </div>
        </div>
      </div>

      <div className="grid grid-auto-fill grid-gap-3">
        {members.map((member) => {
          const roleMeta = memberRoleMeta(member);
          return (
            <button
              key={member.id}
              type="button"
              className="rounded-[var(--bo-radius-md)] bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(0,0,0,0.10)),var(--bo-surface-2)] border border-[var(--bo-border)] shadow-[var(--bo-shadow-soft)] p-3 text-left cursor-pointer transition-transform hover:-translate-y-0.5 hover:shadow-lg"
              onClick={() => window.location.assign(`/app/miembros/${member.id}`)}
            >
              <div className="flex items-start gap-3">
                <Avatar className="w-7 h-7 rounded-xl border border-[var(--bo-border)] bg-gradient-to-br from-[rgba(185,168,255,0.28)] to-[rgba(147,239,231,0.18)]">
                  {member.photoUrl ? <AvatarImage src={member.photoUrl} alt={fullName(member)} /> : null}
                  <AvatarFallback className="rounded-xl text-xs font-semibold">{initials(member.firstName, member.lastName)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-semibold text-[var(--bo-text)] truncate">{fullName(member)}</div>
                    {isSelfMember(member) ? <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--bo-accent)] text-[var(--bo-bg)] font-semibold">Tu</span> : null}
                  </div>
                  <div className="text-xs text-[var(--bo-muted)] truncate">{member.email ?? "Sin email"}</div>
                </div>
              </div>

              <div className="flex items-center justify-between mt-3 pt-3 border-t border-[var(--bo-border)]">
                <span className="text-xs text-[var(--bo-muted)]">Rol</span>
                <RoleBadge
                  roleSlug={roleMeta.slug}
                  roleName={roleMeta.label}
                  importance={roleMeta.importance}
                  className={roleMeta.importance === null ? "opacity-50" : ""}
                />
              </div>

              <div className="flex items-center justify-between mt-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[var(--bo-muted)]">Contrato semanal</span>
                  <span className="text-xs px-1.5 py-0.5 rounded bg-[var(--bo-surface-3)] text-[var(--bo-text)] font-medium">{member.weeklyContractHours.toFixed(2)} h</span>
                </div>
                <button
                  onClick={(e) => handleOpenWhatsApp(e, member)}
                  className="w-9 h-9 rounded-xl border border-[var(--bo-border)] bg-white/[0.02] text-[var(--bo-muted)] grid place-items-center cursor-pointer transition-colors hover:bg-white/[0.04] hover:text-[var(--bo-text)]"
                  aria-label="Enviar WhatsApp"
                >
                  <MessageCircle size={18} />
                </button>
              </div>
            </button>
          );
        })}

        {members.length === 0 ? (
          <div className="rounded-[var(--bo-radius-lg)] bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(0,0,0,0.10)),var(--bo-surface-2)] border border-[var(--bo-border)] p-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-base font-semibold text-[var(--bo-text)] leading-tight">Sin miembros</div>
                <div className="text-xs text-[var(--bo-muted)] mt-0.5">No hay miembros cargados todavía para este restaurante.</div>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <Modal open={whatsappModalOpen} onClose={() => setWhatsappModalOpen(false)} title={`WhatsApp a ${selectedMember?.firstName || ""}`}>
        <div className="flex flex-col gap-4">
          {needsSubscription ? (
            <div className="flex flex-col items-center text-center gap-4 py-4">
              <div className="w-16 h-16 rounded-xl border border-[var(--bo-border)] bg-gradient-to-br from-[rgba(185,168,255,0.28)] to-[rgba(147,239,231,0.18)] grid place-items-center text-[var(--bo-accent)]">
                <MessageCircle size={32} />
              </div>
              <h2 className="text-lg font-semibold text-[var(--bo-text)]">WhatsApp Premium Pack</h2>
              <p className="text-sm text-[var(--bo-muted)] max-w-xs">
                Desbloquea la capacidad de enviar mensajes de WhatsApp directamente a tu personal.
                Ideal para avisos de turnos y comunicaciones importantes.
              </p>
              <div className="rounded-lg border border-[var(--bo-border)] bg-[var(--bo-surface-2)] p-4 w-full max-w-xs">
                <div className="text-2xl font-bold text-[var(--bo-text)]">29.99 € <span className="text-sm font-normal text-[var(--bo-muted)]">/ mes</span></div>
                <ul className="mt-3 text-sm text-[var(--bo-muted)] space-y-1.5">
                  <li>✓ Mensajes ilimitados al staff</li>
                  <li>✓ Integración con cuenta de empresa central</li>
                  <li>✓ Sin necesidad de escanear QR</li>
                </ul>
              </div>
              <button type="button" className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[rgba(185,168,255,0.30)] bg-[rgba(185,168,255,0.16)] text-bo-text text-sm font-bold transition-all hover:border-[rgba(185,168,255,0.40)] hover:bg-[rgba(185,168,255,0.24)] disabled:opacity-55 disabled:cursor-not-allowed mx-auto" onClick={handleSubscribe} disabled={subscribing}>
                {subscribing ? "Activando..." : "Suscribirse y Continuar"}
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <h2 className="text-base font-semibold text-[var(--bo-text)]">Mensaje para {selectedMember?.firstName}</h2>
              {!selectedMember?.whatsappNumber ? (
                <div className="rounded-lg border border-[var(--bo-color-warning)] bg-[var(--bo-warning-bg)] p-3 text-sm text-[var(--bo-color-warning)]">
                  Este miembro no tiene un número de WhatsApp configurado en su perfil.
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-sm font-medium text-[var(--bo-text)] mb-1.5">Mensaje</label>
                    <textarea
                      className="w-full min-h-[100px] rounded-lg border border-[var(--bo-border)] bg-[var(--bo-surface-2)] p-3 text-sm text-[var(--bo-text)] placeholder:text-[var(--bo-muted)] focus:outline-none focus:border-[var(--bo-accent)] focus:ring-1 focus:ring-[var(--bo-accent)]"
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                    />
                  </div>
                  <div className="flex justify-end gap-3 pt-2">
                    <button type="button" className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.03] text-bo-text text-sm font-bold transition-all hover:border-white/[0.09] hover:bg-white/[0.06] disabled:opacity-55 disabled:cursor-not-allowed" onClick={() => setWhatsappModalOpen(false)}>Cancelar</button>
                    <button type="button" className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[rgba(185,168,255,0.30)] bg-[rgba(185,168,255,0.16)] text-bo-text text-sm font-bold transition-all hover:border-[rgba(185,168,255,0.40)] hover:bg-[rgba(185,168,255,0.24)] disabled:opacity-55 disabled:cursor-not-allowed mx-auto" onClick={handleSendWhatsApp} disabled={sending || !message.trim()}>
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
