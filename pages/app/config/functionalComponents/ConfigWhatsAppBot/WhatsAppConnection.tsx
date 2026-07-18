import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, QrCode, Smartphone, Unplug, Wifi, WifiOff } from "lucide-react";

import { createClient } from "../../../../../api/client";
import type { WhatsAppConnection as WAConnection } from "../../../../../api/types";
import { Button } from "../../../../../ui/actions/Button";
import { useToasts } from "../../../../../ui/feedback/useToasts";

const POLL_INTERVAL_MS = 3000;
// While connected, poll slowly so an unlink (phone drops) is detected without
// hammering the backend.
const CONNECTED_POLL_INTERVAL_MS = 30000;

// qrToSrc accepts either a full data URL or a raw base64 string and returns an
// <img> src. UAZAPI may return either depending on version.
export function qrToSrc(qr: string): string {
  const value = qr.trim();
  if (value.startsWith("data:")) return value;
  return `data:image/png;base64,${value}`;
}

export type ConnState = "unknown" | "not_subscribed" | "disconnected" | "pending" | "connected";

export function deriveState(res: {
  success?: boolean;
  connected?: boolean;
  code?: string;
  connection?: WAConnection | null;
}): ConnState {
  if (res.code === "NEEDS_SUBSCRIPTION") return "not_subscribed";
  if (res.connected) return "connected";
  const status = (res.connection?.status || "").toLowerCase();
  if (res.connection?.qr || res.connection?.pair_code || status === "pending" || status === "connecting") {
    return "pending";
  }
  if (res.connection) return "disconnected";
  return "disconnected";
}

export function WhatsAppConnection() {
  const api = useMemo(() => createClient({ baseUrl: "" }), []);
  const { pushToast } = useToasts();

  const [state, setState] = useState<ConnState>("unknown");
  const [connection, setConnection] = useState<WAConnection | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [phone, setPhone] = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const applyResult = useCallback(
    (res: { success?: boolean; connected?: boolean; code?: string; connection?: WAConnection | null }) => {
      const next = deriveState(res);
      setState(next);
      setConnection(res.connection ?? null);
    },
    [],
  );

  const refresh = useCallback(async () => {
    try {
      const res = await api.members.whatsappConnection();
      if ("success" in res) applyResult(res);
    } catch {
      /* transient; keep last state */
    }
  }, [api.members, applyResult]);

  const startPolling = useCallback(
    (intervalMs: number) => {
      stopPolling();
      pollRef.current = setInterval(() => {
        void refresh();
      }, intervalMs);
    },
    [refresh, stopPolling],
  );

  useEffect(() => {
    let alive = true;
    void (async () => {
      setLoading(true);
      const res = await api.members.whatsappConnection().catch(() => null);
      if (alive && res && "success" in res) applyResult(res);
      if (alive) setLoading(false);
    })();
    return () => {
      alive = false;
      stopPolling();
    };
  }, [api.members, applyResult, stopPolling]);

  // Poll while pending (fast, waiting for scan/pairing) and while connected
  // (slow, so an unlink is detected).
  useEffect(() => {
    if (state === "pending") startPolling(POLL_INTERVAL_MS);
    else if (state === "connected") startPolling(CONNECTED_POLL_INTERVAL_MS);
    else stopPolling();
    return stopPolling;
  }, [state, startPolling, stopPolling]);

  const handleSubscribe = useCallback(async () => {
    setBusy(true);
    try {
      const res = await api.members.whatsappSubscribe();
      if ("success" in res && res.success) {
        pushToast({ kind: "success", title: "WhatsApp Pack", message: "Suscripción activada" });
        applyResult(res);
      } else {
        pushToast({ kind: "error", title: "Error", message: ("message" in res && res.message) || "No se pudo activar la suscripción" });
      }
    } finally {
      setBusy(false);
    }
  }, [api.members, applyResult, pushToast]);

  const handleConnect = useCallback(async (pairingPhone?: string) => {
    setBusy(true);
    try {
      const trimmed = (pairingPhone ?? "").replace(/[^\d]/g, "");
      const res = await api.members.whatsappConnect(trimmed ? { phone: trimmed } : {});
      if ("success" in res && res.success) {
        applyResult(res);
        if (!res.connected) {
          pushToast(
            trimmed
              ? { kind: "info", title: "Código de vinculación", message: "Introduce el código en WhatsApp → Dispositivos vinculados" }
              : { kind: "info", title: "Escanea el QR", message: "Abre WhatsApp → Dispositivos vinculados → Vincular dispositivo" },
          );
        }
      } else if ("code" in res && res.code === "NEEDS_SUBSCRIPTION") {
        setState("not_subscribed");
        pushToast({ kind: "error", title: "Suscripción requerida", message: "Activa el WhatsApp Pack primero" });
      } else if ("code" in res && res.code === "WHATSAPP_POOL_FULL") {
        pushToast({ kind: "error", title: "Sin servidores disponibles", message: ("message" in res && res.message) || "Inténtalo de nuevo más tarde" });
      } else {
        pushToast({ kind: "error", title: "Error", message: ("message" in res && res.message) || "No se pudo iniciar la conexión" });
      }
    } finally {
      setBusy(false);
    }
  }, [api.members, applyResult, pushToast]);

  const handleCancel = useCallback(async () => {
    if (!window.confirm("Esto cancela el WhatsApp Pack y suspende la conexión. El bot dejará de responder. ¿Continuar?")) {
      return;
    }
    setBusy(true);
    try {
      const res = await api.members.whatsappCancel();
      if ("success" in res && res.success) {
        pushToast({ kind: "success", title: "WhatsApp Pack", message: "Suscripción cancelada" });
        setState("not_subscribed");
        setConnection(null);
      } else {
        pushToast({ kind: "error", title: "Error", message: ("message" in res && res.message) || "No se pudo cancelar la suscripción" });
      }
    } finally {
      setBusy(false);
    }
  }, [api.members, pushToast]);

  const handleDisconnect = useCallback(
    async (deleteInstance: boolean) => {
      if (deleteInstance && !window.confirm("Esto eliminará la instancia y tendrás que volver a escanear el QR. ¿Continuar?")) {
        return;
      }
      setBusy(true);
      try {
        const res = await api.members.whatsappDisconnect({ delete_instance: deleteInstance });
        if ("success" in res && res.success) {
          pushToast({ kind: "success", title: "WhatsApp", message: deleteInstance ? "Instancia eliminada" : "Desconectado" });
          setState("disconnected");
          setConnection(null);
        } else {
          pushToast({ kind: "error", title: "Error", message: ("message" in res && res.message) || "No se pudo desconectar" });
        }
      } finally {
        setBusy(false);
      }
    },
    [api.members, pushToast],
  );

  if (loading) {
    return (
      <div className="bo-panel" data-ui="whatsapp-connection">
        <div className="bo-panelHeader">
          <h3><Smartphone size={18} aria-hidden="true" /> Conexión de WhatsApp</h3>
        </div>
        <p className="bo-muted"><Loader2 className="bo-spin" size={16} aria-hidden="true" /> Cargando estado…</p>
      </div>
    );
  }

  return (
    <div className="bo-panel" data-ui="whatsapp-connection" data-state={state}>
      <div className="bo-panelHeader">
        <h3><Smartphone size={18} aria-hidden="true" /> Conexión de WhatsApp</h3>
        <span className={`bo-badge ${state === "connected" ? "bo-badge--ok" : "bo-badge--muted"}`}>
          {state === "connected" ? <><Wifi size={14} aria-hidden="true" /> Conectado</> : <><WifiOff size={14} aria-hidden="true" /> Sin conectar</>}
        </span>
      </div>

      <div aria-live="polite">
      {state === "not_subscribed" ? (
        <div className="bo-stack">
          <p className="bo-muted">El bot de WhatsApp requiere el <strong>WhatsApp Pack</strong> activo para este restaurante.</p>
          <div className="bo-row">
            <Button variant="primary" onClick={handleSubscribe} disabled={busy} aria-label="Activar WhatsApp Pack">
              {busy ? <Loader2 className="bo-spin" size={16} aria-hidden="true" /> : null} Activar WhatsApp Pack
            </Button>
          </div>
        </div>
      ) : state === "connected" ? (
        <div className="bo-stack">
          <p className="bo-muted">
            Conectado{connection?.phone ? <> como <strong>+{connection.phone}</strong></> : null}. El bot ya responde a los mensajes entrantes.
          </p>
          <div className="bo-row">
            <Button variant="secondary" onClick={() => handleDisconnect(false)} disabled={busy} aria-label="Desconectar WhatsApp">
              <Unplug size={16} aria-hidden="true" /> Desconectar
            </Button>
            <Button variant="danger" onClick={() => handleDisconnect(true)} disabled={busy} aria-label="Eliminar instancia de WhatsApp">
              Eliminar instancia
            </Button>
            <Button variant="ghost" onClick={handleCancel} disabled={busy} aria-label="Cancelar suscripción de WhatsApp Pack">
              Cancelar suscripción
            </Button>
          </div>
        </div>
      ) : state === "pending" ? (
        <div className="bo-stack">
          {connection?.qr ? (
            <div className="bo-qrWrap">
              <img className="bo-qr" src={qrToSrc(connection.qr)} alt="Código QR para vincular WhatsApp" width={240} height={240} />
              <p className="bo-muted">Abre WhatsApp → <strong>Dispositivos vinculados</strong> → <strong>Vincular dispositivo</strong> y escanea el código.</p>
            </div>
          ) : connection?.pair_code ? (
            <div className="bo-stack">
              <p className="bo-muted">Introduce este código de vinculación en WhatsApp:</p>
              <div className="bo-pairCode" aria-label="Código de vinculación">{connection.pair_code}</div>
            </div>
          ) : (
            <p className="bo-muted"><Loader2 className="bo-spin" size={16} aria-hidden="true" /> Esperando vinculación del dispositivo…</p>
          )}
          <div className="bo-row">
            <Button variant="secondary" onClick={() => handleConnect()} disabled={busy} aria-label="Regenerar código QR">
              <QrCode size={16} aria-hidden="true" /> Regenerar QR
            </Button>
          </div>
        </div>
      ) : (
        <div className="bo-stack">
          <p className="bo-muted">Conecta el número de WhatsApp del restaurante para activar el bot de reservas.</p>
          <div className="bo-row">
            <Button variant="primary" onClick={() => handleConnect()} disabled={busy} aria-label="Conectar WhatsApp">
              {busy ? <Loader2 className="bo-spin" size={16} aria-hidden="true" /> : <QrCode size={16} aria-hidden="true" />} Conectar con QR
            </Button>
          </div>
          <div className="bo-row">
            <input
              type="tel"
              inputMode="tel"
              className="bo-input"
              placeholder="Número con prefijo (ej. 34612345678)"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              aria-label="Número de teléfono para vinculación por código"
            />
            <Button
              variant="secondary"
              onClick={() => handleConnect(phone)}
              disabled={busy || phone.replace(/[^\d]/g, "").length < 8}
              aria-label="Vincular con código en vez de QR"
            >
              <Smartphone size={16} aria-hidden="true" /> Vincular con código
            </Button>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
