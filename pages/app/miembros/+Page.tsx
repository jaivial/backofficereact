import React, { useCallback, useEffect, useMemo, useState } from "react";
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

type WhatsAppSendInput = {
  memberId: number;
  message: string;
};

type WhatsAppSendResponse = {
  success: boolean;
  message?: string;
  code?: string;
};

type WhatsAppSubscribeResponse = {
  success: boolean;
  message?: string;
  code?: string;
};

type WhatsAppConnectionStatus = "connected" | "pending" | "disconnected";

type WhatsAppConnectionPayload = {
  status?: string;
  connected?: boolean;
  qr?: string | null;
  pair_code?: string | null;
  pairCode?: string | null;
  connection?: Record<string, unknown> | null;
  message?: string;
};

type WhatsAppConnectionResponse = {
  success: boolean;
  message?: string;
  code?: string;
} & WhatsAppConnectionPayload;

type WhatsAppConnectionState = {
  status: WhatsAppConnectionStatus;
  qr: string | null;
  pairCode: string | null;
};

type MembersWhatsAppMethods = {
  whatsappSend: (input: WhatsAppSendInput) => Promise<WhatsAppSendResponse>;
  whatsappSubscribe: () => Promise<WhatsAppSubscribeResponse>;
  whatsappConnect?: () => Promise<WhatsAppConnectionResponse>;
  whatsappConnection?: () => Promise<WhatsAppConnectionResponse>;
  whatsappDisconnect?: () => Promise<WhatsAppConnectionResponse>;
};

type PremiumWhatsAppMethods = {
  send?: (input: WhatsAppSendInput) => Promise<WhatsAppSendResponse>;
  subscribe?: () => Promise<WhatsAppSubscribeResponse>;
  whatsappSend?: (input: WhatsAppSendInput) => Promise<WhatsAppSendResponse>;
  whatsappSubscribe?: () => Promise<WhatsAppSubscribeResponse>;
  connect?: () => Promise<WhatsAppConnectionResponse>;
  connection?: () => Promise<WhatsAppConnectionResponse>;
  disconnect?: () => Promise<WhatsAppConnectionResponse>;
  whatsappConnect?: () => Promise<WhatsAppConnectionResponse>;
  whatsappConnection?: () => Promise<WhatsAppConnectionResponse>;
  whatsappDisconnect?: () => Promise<WhatsAppConnectionResponse>;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}

function getMembersWhatsAppMethods(client: unknown): MembersWhatsAppMethods | null {
  const root = asRecord(client);
  const members = asRecord(root?.members);
  const whatsappSend = members?.whatsappSend;
  const whatsappSubscribe = members?.whatsappSubscribe;
  const whatsappConnect = members?.whatsappConnect;
  const whatsappConnection = members?.whatsappConnection;
  const whatsappDisconnect = members?.whatsappDisconnect;
  if (typeof whatsappSend !== "function" || typeof whatsappSubscribe !== "function") return null;
  return {
    whatsappSend: whatsappSend as MembersWhatsAppMethods["whatsappSend"],
    whatsappSubscribe: whatsappSubscribe as MembersWhatsAppMethods["whatsappSubscribe"],
    whatsappConnect:
      typeof whatsappConnect === "function"
        ? (whatsappConnect as MembersWhatsAppMethods["whatsappConnect"])
        : undefined,
    whatsappConnection:
      typeof whatsappConnection === "function"
        ? (whatsappConnection as MembersWhatsAppMethods["whatsappConnection"])
        : undefined,
    whatsappDisconnect:
      typeof whatsappDisconnect === "function"
        ? (whatsappDisconnect as MembersWhatsAppMethods["whatsappDisconnect"])
        : undefined,
  };
}

function getPremiumWhatsAppMethods(client: unknown): PremiumWhatsAppMethods | null {
  const root = asRecord(client);
  const premium = asRecord(root?.premium);
  const whatsapp = asRecord(premium?.whatsapp);
  if (!whatsapp) return null;

  const send = whatsapp.send;
  const subscribe = whatsapp.subscribe;
  const connect = whatsapp.connect;
  const connection = whatsapp.connection;
  const disconnect = whatsapp.disconnect;
  const whatsappSend = whatsapp.whatsappSend;
  const whatsappSubscribe = whatsapp.whatsappSubscribe;
  const whatsappConnect = whatsapp.whatsappConnect;
  const whatsappConnection = whatsapp.whatsappConnection;
  const whatsappDisconnect = whatsapp.whatsappDisconnect;

  const hasSendMethod = typeof send === "function" || typeof whatsappSend === "function";
  const hasSubscribeMethod = typeof subscribe === "function" || typeof whatsappSubscribe === "function";
  if (!hasSendMethod || !hasSubscribeMethod) return null;

  return {
    send: typeof send === "function" ? (send as PremiumWhatsAppMethods["send"]) : undefined,
    subscribe: typeof subscribe === "function" ? (subscribe as PremiumWhatsAppMethods["subscribe"]) : undefined,
    connect: typeof connect === "function" ? (connect as PremiumWhatsAppMethods["connect"]) : undefined,
    connection: typeof connection === "function" ? (connection as PremiumWhatsAppMethods["connection"]) : undefined,
    disconnect: typeof disconnect === "function" ? (disconnect as PremiumWhatsAppMethods["disconnect"]) : undefined,
    whatsappSend: typeof whatsappSend === "function" ? (whatsappSend as PremiumWhatsAppMethods["whatsappSend"]) : undefined,
    whatsappSubscribe:
      typeof whatsappSubscribe === "function"
        ? (whatsappSubscribe as PremiumWhatsAppMethods["whatsappSubscribe"])
        : undefined,
    whatsappConnect:
      typeof whatsappConnect === "function"
        ? (whatsappConnect as PremiumWhatsAppMethods["whatsappConnect"])
        : undefined,
    whatsappConnection:
      typeof whatsappConnection === "function"
        ? (whatsappConnection as PremiumWhatsAppMethods["whatsappConnection"])
        : undefined,
    whatsappDisconnect:
      typeof whatsappDisconnect === "function"
        ? (whatsappDisconnect as PremiumWhatsAppMethods["whatsappDisconnect"])
        : undefined,
  };
}

function toErrorMessage(error: unknown): string {
  if (typeof error === "string") {
    const msg = error.trim();
    return msg || "Ha ocurrido un error inesperado.";
  }
  if (error instanceof Error) {
    const msg = error.message.trim();
    return msg || "Ha ocurrido un error inesperado.";
  }
  const errObj = asRecord(error);
  const msg = errObj?.message;
  if (typeof msg === "string") {
    const clean = msg.trim();
    return clean || "Ha ocurrido un error inesperado.";
  }
  return "Ha ocurrido un error inesperado.";
}

function toErrorCode(error: unknown): string | null {
  const errObj = asRecord(error);
  const code = errObj?.code;
  if (typeof code !== "string") return null;
  const clean = code.trim();
  return clean || null;
}

function normalizeConnectionStatus(status: unknown, connected: unknown): WhatsAppConnectionStatus {
  const clean = typeof status === "string" ? status.trim().toLowerCase() : "";
  if (clean === "connected") return "connected";
  if (clean === "pending" || clean === "connecting") return "pending";
  if (clean === "disconnected") return "disconnected";
  if (connected === true) return "connected";
  return "disconnected";
}

function normalizeConnectionState(input: WhatsAppConnectionResponse): WhatsAppConnectionState {
  const nested = asRecord(input.connection);
  const qrValue = nested?.qr ?? input.qr;
  const pairCodeValue = nested?.pair_code ?? nested?.pairCode ?? input.pair_code ?? input.pairCode;
  return {
    status: normalizeConnectionStatus(nested?.status ?? input.status, nested?.connected ?? input.connected),
    qr: typeof qrValue === "string" && qrValue.trim() ? qrValue : null,
    pairCode: typeof pairCodeValue === "string" && pairCodeValue.trim() ? pairCodeValue.trim() : null,
  };
}

function connectionStatusLabel(status: WhatsAppConnectionStatus): string {
  if (status === "connected") return "Conectado";
  if (status === "pending") return "Pendiente";
  return "Desconectado";
}

const DEFAULT_WHATSAPP_CONNECTION: WhatsAppConnectionState = {
  status: "disconnected",
  qr: null,
  pairCode: null,
};

export default function Page() {
  const pageContext = usePageContext();
  const raw = (pageContext.data ?? {}) as Partial<Data>;
  const members = Array.isArray(raw.members) ? raw.members : [];
  const users = Array.isArray(raw.users) ? raw.users : [];
  const roles = Array.isArray(raw.roles) ? raw.roles : [];
  const initialError = typeof raw.error === "string" ? raw.error : null;
  const [error, setError] = useState<string | null>(initialError);
  useErrorToast(error);
  const { pushToast } = useToasts();
  const client = useMemo(() => createClient({ baseUrl: "" }), []);
  const session = useAtomValue(sessionAtom);

  const [whatsappModalOpen, setWhatsappModalOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [needsSubscription, setNeedsSubscription] = useState(false);
  const [subscribing, setSubscribing] = useState(false);
  const [connectionState, setConnectionState] = useState<WhatsAppConnectionState>(DEFAULT_WHATSAPP_CONNECTION);
  const [connectionLoading, setConnectionLoading] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

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
    setConnectionState(DEFAULT_WHATSAPP_CONNECTION);
    setError(null);
    setWhatsappModalOpen(true);
  };

  const sendWhatsAppMessage = useCallback(
    async (input: WhatsAppSendInput): Promise<WhatsAppSendResponse> => {
      const memberMethods = getMembersWhatsAppMethods(client);
      if (memberMethods) return memberMethods.whatsappSend(input);

      const premiumMethods = getPremiumWhatsAppMethods(client);
      if (premiumMethods?.send) return premiumMethods.send(input);
      if (premiumMethods?.whatsappSend) return premiumMethods.whatsappSend(input);

      throw new Error("WhatsApp no esta disponible para esta cuenta.");
    },
    [client],
  );

  const subscribeWhatsApp = useCallback(async (): Promise<WhatsAppSubscribeResponse> => {
    const memberMethods = getMembersWhatsAppMethods(client);
    if (memberMethods) return memberMethods.whatsappSubscribe();

    const premiumMethods = getPremiumWhatsAppMethods(client);
    if (premiumMethods?.subscribe) return premiumMethods.subscribe();
    if (premiumMethods?.whatsappSubscribe) return premiumMethods.whatsappSubscribe();

    throw new Error("No se pudo iniciar la suscripcion de WhatsApp Premium.");
  }, [client]);

  const connectWhatsApp = useCallback(async (): Promise<WhatsAppConnectionResponse> => {
    const memberMethods = getMembersWhatsAppMethods(client);
    if (memberMethods?.whatsappConnect) return memberMethods.whatsappConnect();

    const premiumMethods = getPremiumWhatsAppMethods(client);
    if (premiumMethods?.connect) return premiumMethods.connect();
    if (premiumMethods?.whatsappConnect) return premiumMethods.whatsappConnect();

    throw new Error("No se pudo iniciar la conexion de WhatsApp.");
  }, [client]);

  const getWhatsAppConnection = useCallback(async (): Promise<WhatsAppConnectionResponse> => {
    const memberMethods = getMembersWhatsAppMethods(client);
    if (memberMethods?.whatsappConnection) return memberMethods.whatsappConnection();

    const premiumMethods = getPremiumWhatsAppMethods(client);
    if (premiumMethods?.connection) return premiumMethods.connection();
    if (premiumMethods?.whatsappConnection) return premiumMethods.whatsappConnection();

    throw new Error("No se pudo consultar la conexion de WhatsApp.");
  }, [client]);

  const disconnectWhatsApp = useCallback(async (): Promise<WhatsAppConnectionResponse> => {
    const memberMethods = getMembersWhatsAppMethods(client);
    if (memberMethods?.whatsappDisconnect) return memberMethods.whatsappDisconnect();

    const premiumMethods = getPremiumWhatsAppMethods(client);
    if (premiumMethods?.disconnect) return premiumMethods.disconnect();
    if (premiumMethods?.whatsappDisconnect) return premiumMethods.whatsappDisconnect();

    throw new Error("No se pudo desconectar WhatsApp.");
  }, [client]);

  const refreshConnectionStatus = useCallback(
    async (opts?: { silent?: boolean; showLoading?: boolean }) => {
      const shouldShowLoading = opts?.showLoading === true;
      try {
        if (shouldShowLoading) setConnectionLoading(true);
        const res = await getWhatsAppConnection();
        if (res.success) {
          setConnectionState(normalizeConnectionState(res));
          return;
        }
        if (!opts?.silent) {
          setError(res.message?.trim() || "No se pudo consultar la conexion de WhatsApp.");
        }
      } catch (err: unknown) {
        if (!opts?.silent) {
          setError(toErrorMessage(err));
        }
      } finally {
        if (shouldShowLoading) setConnectionLoading(false);
      }
    },
    [getWhatsAppConnection],
  );

  useEffect(() => {
    if (!whatsappModalOpen || needsSubscription) return;
    void refreshConnectionStatus({ showLoading: true });
    const intervalId = window.setInterval(() => {
      void refreshConnectionStatus({ silent: true });
    }, 5000);
    return () => {
      window.clearInterval(intervalId);
    };
  }, [needsSubscription, refreshConnectionStatus, whatsappModalOpen]);

  const handleConnect = async () => {
    try {
      setError(null);
      setConnecting(true);
      const res = await connectWhatsApp();
      if (res.success) {
        setConnectionState(normalizeConnectionState(res));
        pushToast({
          kind: "success",
          title: "Conexion iniciada",
          message: res.message ?? "Sigue los pasos de vinculacion en esta ventana.",
        });
        void refreshConnectionStatus({ silent: true });
      } else {
        setError(res.message?.trim() || "No se pudo iniciar la conexion de WhatsApp.");
      }
    } catch (err: unknown) {
      setError(toErrorMessage(err));
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      setError(null);
      setDisconnecting(true);
      const res = await disconnectWhatsApp();
      if (res.success) {
        setConnectionState(DEFAULT_WHATSAPP_CONNECTION);
        pushToast({
          kind: "success",
          title: "WhatsApp desconectado",
          message: res.message ?? "La conexion se ha cerrado correctamente.",
        });
        void refreshConnectionStatus({ silent: true });
      } else {
        setError(res.message?.trim() || "No se pudo desconectar WhatsApp.");
      }
    } catch (err: unknown) {
      setError(toErrorMessage(err));
    } finally {
      setDisconnecting(false);
    }
  };

  const handleSendWhatsApp = async () => {
    if (!selectedMember) return;

    const trimmedMessage = message.trim();
    if (!trimmedMessage) {
      pushToast({
        kind: "info",
        title: "Mensaje vacio",
        message: "Escribe un mensaje antes de enviar.",
      });
      return;
    }
    if (!selectedMember.whatsappNumber) {
      pushToast({
        kind: "info",
        title: "WhatsApp no disponible",
        message: "Este miembro no tiene un numero de WhatsApp configurado.",
      });
      return;
    }

    try {
      setError(null);
      setSending(true);
      const res = await sendWhatsAppMessage({ memberId: selectedMember.id, message: trimmedMessage });
      if (res.success) {
        pushToast({
          kind: "success",
          title: "Enviado",
          message: res.message ?? "Mensaje enviado correctamente.",
        });
        setWhatsappModalOpen(false);
      } else if (res.code === "NEEDS_SUBSCRIPTION") {
        setNeedsSubscription(true);
      } else if (res.code === "NEEDS_CONNECTION") {
        setConnectionState((prev) => ({ ...prev, status: "disconnected" }));
        void refreshConnectionStatus({ showLoading: true, silent: true });
      } else {
        setError(res.message?.trim() || "No se pudo enviar el mensaje de WhatsApp.");
      }
    } catch (err: unknown) {
      if (toErrorCode(err) === "NEEDS_SUBSCRIPTION") {
        setNeedsSubscription(true);
      } else if (toErrorCode(err) === "NEEDS_CONNECTION") {
        setConnectionState((prev) => ({ ...prev, status: "disconnected" }));
        void refreshConnectionStatus({ showLoading: true, silent: true });
      } else {
        setError(toErrorMessage(err));
      }
    } finally {
      setSending(false);
    }
  };

  const handleSubscribe = async () => {
    try {
      setError(null);
      setSubscribing(true);
      const res = await subscribeWhatsApp();
      if (res.success) {
        pushToast({
          kind: "success",
          title: "Suscrito",
          message: res.message ?? "Suscripcion activada correctamente.",
        });
        setNeedsSubscription(false);
        void refreshConnectionStatus({ showLoading: true, silent: true });
      } else {
        setError(res.message?.trim() || "No se pudo activar WhatsApp Premium.");
      }
    } catch (err: unknown) {
      setError(toErrorMessage(err));
    } finally {
      setSubscribing(false);
    }
  };

  const whatsappModalTitle = needsSubscription
    ? "WhatsApp Premium Pack"
    : selectedMember
      ? `Mensaje para ${selectedMember.firstName}`
      : "Enviar WhatsApp";

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
                  type="button"
                  onClick={(e) => handleOpenWhatsApp(e, member)}
                  className="bo-btn bo-btn--ghost bo-btn--sm"
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

      <Modal open={whatsappModalOpen} title={whatsappModalTitle} onClose={() => setWhatsappModalOpen(false)}>
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
              <button
                type="button"
                className="bo-btn bo-btn--primary bo-btn--block"
                onClick={() => void handleSubscribe()}
                disabled={subscribing}
              >
                {subscribing ? "Activando..." : "Suscribirse y Continuar"}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {!selectedMember?.whatsappNumber ? (
                <div className="bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 p-3 rounded text-sm">
                  Este miembro no tiene un número de WhatsApp configurado en su perfil.
                </div>
              ) : (
                <>
                  <div className="bg-slate-800/50 border border-slate-700 p-3 rounded-lg">
                    <div className="text-xs text-slate-400 mb-1">Estado de conexión</div>
                    <div className="flex items-center justify-between gap-4">
                      <div className="text-sm text-slate-100">{connectionStatusLabel(connectionState.status)}</div>
                      {connectionLoading ? <span className="text-xs text-slate-400">Actualizando...</span> : null}
                    </div>
                  </div>

                  {connectionState.status !== "connected" ? (
                    <div className="space-y-3">
                      <p className="text-sm text-slate-300">
                        Conecta WhatsApp Premium para enviar mensajes desde esta cuenta.
                      </p>
                      {connectionState.status === "pending" && (connectionState.qr || connectionState.pairCode) ? (
                        <div className="bg-slate-800/50 border border-slate-700 p-3 rounded-lg space-y-3">
                          {connectionState.pairCode ? (
                            <div>
                              <div className="text-xs text-slate-400 mb-1">Código de vinculación</div>
                              <div className="font-mono text-base text-slate-100 tracking-wide">{connectionState.pairCode}</div>
                            </div>
                          ) : null}
                          {connectionState.qr ? (
                            <div>
                              <div className="text-xs text-slate-400 mb-1">QR (payload)</div>
                              <pre className="bg-slate-900 border border-slate-700 rounded p-2 text-[11px] leading-4 text-slate-200 whitespace-pre-wrap break-all">
                                {connectionState.qr}
                              </pre>
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                      <div className="flex justify-end gap-3 pt-2">
                        <button
                          type="button"
                          className="bo-btn bo-btn--secondary"
                          onClick={() => void refreshConnectionStatus({ showLoading: true })}
                          disabled={connecting || connectionLoading}
                        >
                          {connectionLoading ? "Actualizando..." : "Actualizar estado"}
                        </button>
                        <button
                          type="button"
                          className="bo-btn bo-btn--primary"
                          onClick={() => void handleConnect()}
                          disabled={connecting}
                        >
                          {connecting ? "Conectando..." : "Conectar WhatsApp"}
                        </button>
                      </div>
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
                        <button
                          type="button"
                          className="bo-btn bo-btn--ghost"
                          onClick={() => void handleDisconnect()}
                          disabled={disconnecting}
                        >
                          {disconnecting ? "Desconectando..." : "Desconectar"}
                        </button>
                        <button type="button" className="bo-btn bo-btn--secondary" onClick={() => setWhatsappModalOpen(false)}>
                          Cancelar
                        </button>
                        <button
                          type="button"
                          className="bo-btn bo-btn--primary"
                          onClick={() => void handleSendWhatsApp()}
                          disabled={sending || !message.trim() || !selectedMember?.whatsappNumber}
                        >
                          {sending ? "Enviando..." : "Enviar por WhatsApp"}
                        </button>
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </Modal>
    </section>
  );
}
