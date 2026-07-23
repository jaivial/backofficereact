import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bot, Loader2, QrCode, Smartphone, Unplug, Wifi, WifiOff, X } from "lucide-react";

import { createClient } from "../../../../../api/client";
import type { WhatsAppConnection as WAConnection, WhatsAppConnectionResponse } from "../../../../../api/types";
import { Button } from "../../../../../ui/actions/Button";
import { useToasts } from "../../../../../ui/feedback/useToasts";
import { ConfirmDialog } from "../../../../../ui/overlays/ConfirmDialog";

export type ConnState = "loading" | "locked" | "disconnected" | "provisioning" | "qr_ready" | "connected" | "error";

export function qrToSrc(qr: string): string {
  const value = qr.trim();
  return value.startsWith("data:") ? value : `data:image/png;base64,${value}`;
}

export function deriveState(res: Partial<WhatsAppConnectionResponse>): ConnState {
  if (res.entitled === false || res.code === "NEEDS_SUBSCRIPTION") return "locked";
  if (res.connected || res.connection?.connected) return "connected";
  const status = (res.connection?.status || "").toLowerCase();
  if (res.connection?.qr || res.connection?.pair_code) return "qr_ready";
  if (status === "pending" || status === "connecting" || status === "provisioned") return "provisioning";
  return "disconnected";
}

function wsURL(): string {
  const url = new URL("/api/admin/members/whatsapp/ws", window.location.href);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return url.toString();
}

export function WhatsAppConnection() {
  const api = useMemo(() => createClient({ baseUrl: "" }), []);
  const { pushToast } = useToasts();
  const [state, setState] = useState<ConnState>("loading");
  const [entitled, setEntitled] = useState<boolean | null>(null);
  const [connection, setConnection] = useState<WAConnection | null>(null);
  const [busy, setBusy] = useState(false);
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);
  const realtimeVersion = useRef(0);

  const applyResult = useCallback((res: Partial<WhatsAppConnectionResponse>, realtime = false) => {
    if (realtime) realtimeVersion.current += 1;
    if (typeof res.entitled === "boolean") setEntitled(res.entitled);
    setState(deriveState(res));
    setConnection(res.connection ?? null);
  }, []);

  useEffect(() => {
    let alive = true;
    const version = realtimeVersion.current;
    void api.members.whatsappConnection()
      .then((res) => {
        if (alive && "success" in res && realtimeVersion.current === version) applyResult(res);
      })
      .catch(() => {
        if (alive && realtimeVersion.current === version) setState("error");
      });
    return () => {
      alive = false;
    };
  }, [api.members, applyResult]);

  useEffect(() => {
    if (entitled !== true) return;
    let alive = true;
    let socket: WebSocket | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let retry = 0;
    const delays = [1000, 2000, 5000, 10000];

    const open = () => {
      if (!alive) return;
      socket = new WebSocket(wsURL());
      socket.onopen = () => {
        retry = 0;
      };
      socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data) as WhatsAppConnectionResponse & { type?: string };
          if (payload.type === "whatsapp.connection" && payload.success) applyResult(payload, true);
        } catch {
          // Ignore malformed provider/proxy frames. Next snapshot repairs state.
        }
      };
      socket.onclose = () => {
        if (!alive) return;
        const delay = delays[Math.min(retry, delays.length - 1)];
        retry += 1;
        retryTimer = setTimeout(open, delay);
      };
      socket.onerror = () => socket?.close();
    };

    open();
    return () => {
      alive = false;
      if (retryTimer) clearTimeout(retryTimer);
      socket?.close();
    };
  }, [applyResult, entitled]);

  const connect = useCallback(async () => {
    setBusy(true);
    setState("provisioning");
    try {
      const res = await api.members.whatsappConnect({});
      if ("success" in res && res.success) {
        applyResult(res);
        if (!res.connected) {
          pushToast({ kind: "info", title: "Escanea el QR", message: "WhatsApp → Dispositivos vinculados → Vincular dispositivo" });
        }
      } else {
        if ("code" in res && res.code === "NEEDS_SUBSCRIPTION") applyResult({ entitled: false, code: res.code });
        else setState("error");
        pushToast({ kind: "error", title: "WhatsApp", message: ("message" in res && res.message) || "No se pudo iniciar la conexión" });
      }
    } catch {
      setState("error");
      pushToast({ kind: "error", title: "WhatsApp", message: "No se pudo iniciar la conexión" });
    } finally {
      setBusy(false);
    }
  }, [api.members, applyResult, pushToast]);

  const disconnect = useCallback(async (successMessage = "Dispositivo desconectado") => {
    setBusy(true);
    try {
      const res = await api.members.whatsappDisconnect({ delete_instance: false });
      if ("success" in res && res.success) {
        applyResult({ ...res, entitled: true, connected: false, connection: null });
        setShowDisconnectConfirm(false);
        pushToast({ kind: "success", title: "WhatsApp", message: successMessage });
      } else {
        pushToast({ kind: "error", title: "WhatsApp", message: ("message" in res && res.message) || "No se pudo desconectar" });
      }
    } catch {
      pushToast({ kind: "error", title: "WhatsApp", message: "No se pudo desconectar" });
    } finally {
      setBusy(false);
    }
  }, [api.members, applyResult, pushToast]);

  if (entitled !== true) return null;

  return (
    <section className="bo-panel" style={{ padding: "1rem" }} data-ui="whatsapp-connection" data-state={state} aria-label="Bot de WhatsApp">
      <div className="bo-panelHeader">
        <h3><Bot size={18} aria-hidden="true" /> Bot de WhatsApp</h3>
        <span className={`bo-badge ${state === "connected" ? "bo-badge--ok" : "bo-badge--muted"}`}>
          {state === "connected"
            ? <><Wifi size={14} aria-hidden="true" /> Conectado</>
            : <><WifiOff size={14} aria-hidden="true" /> Sin conectar</>}
        </span>
      </div>

      <div className="bo-stack" style={{ alignItems: "center", textAlign: "center" }} aria-live="polite">
        {state === "loading" ? (
          <p className="bo-muted"><Loader2 className="bo-spin" size={16} aria-hidden="true" /> Cargando estado…</p>
        ) : state === "connected" ? (
          <>
            <p className="bo-muted">
              WhatsApp conectado{connection?.phone ? <> como <strong>+{connection.phone}</strong></> : null}. El bot ya puede responder mensajes.
            </p>
            <div className="bo-row">
              <Button variant="secondary" onClick={() => setShowDisconnectConfirm(true)} disabled={busy} aria-label="Desconectar WhatsApp">
                <Unplug size={16} aria-hidden="true" /> Desconectar
              </Button>
            </div>
          </>
        ) : state === "qr_ready" ? (
          <>
            {connection?.qr ? (
              <div className="bo-qrWrap">
                <img className="bo-qr" src={qrToSrc(connection.qr)} alt="Código QR para vincular WhatsApp" width={240} height={240} />
                <ol className="bo-qrSteps">
                  <li>Abre WhatsApp en el teléfono del restaurante.</li>
                  <li>Entra en <strong>Dispositivos vinculados</strong>.</li>
                  <li>Pulsa <strong>Vincular dispositivo</strong> y escanea el QR.</li>
                </ol>
              </div>
            ) : connection?.pair_code ? (
              <>
                <p className="bo-muted">Introduce este código en WhatsApp → Dispositivos vinculados:</p>
                <div className="bo-pairCode" aria-label="Código de vinculación">{connection.pair_code}</div>
              </>
            ) : null}
            <p className="bo-muted bo-qrWaiting"><Loader2 className="bo-spin" size={16} aria-hidden="true" /> Esperando lectura del QR…</p>
            <div className="bo-row bo-qrActions">
              <Button variant="secondary" onClick={connect} disabled={busy} aria-label="Regenerar código QR">
                <QrCode size={16} aria-hidden="true" /> Regenerar QR
              </Button>
              <Button variant="secondary" onClick={() => void disconnect("Vinculación cancelada")} disabled={busy} aria-label="Cancelar vinculación">
                <X size={16} aria-hidden="true" /> Cancelar
              </Button>
            </div>
          </>
        ) : state === "provisioning" ? (
          <p className="bo-muted"><Loader2 className="bo-spin" size={16} aria-hidden="true" /> Preparando conexión segura…</p>
        ) : state === "error" ? (
          <>
            <p className="bo-muted">No se pudo preparar WhatsApp. Revisa la conexión e inténtalo de nuevo.</p>
            <Button variant="primary" onClick={connect} disabled={busy} aria-label="Reintentar conexión de WhatsApp">Reintentar</Button>
          </>
        ) : (
          <>
            <p className="bo-muted">Conecta el WhatsApp del restaurante para activar el bot de reservas.</p>
            <div className="bo-row">
              <Button variant="primary" onClick={connect} disabled={busy} aria-label="Conectar WhatsApp">
                {busy ? <Loader2 className="bo-spin" size={16} aria-hidden="true" /> : <Smartphone size={16} aria-hidden="true" />}
                Conectar WhatsApp
              </Button>
            </div>
          </>
        )}
      </div>
      <ConfirmDialog
        open={showDisconnectConfirm}
        title="Desconectar WhatsApp"
        message={`El bot dejará de responder hasta que vuelvas a conectar WhatsApp${connection?.phone ? ` en +${connection.phone}` : ""}.`}
        confirmText="Desconectar"
        cancelText="Cancelar"
        danger
        busy={busy}
        onClose={() => { if (!busy) setShowDisconnectConfirm(false); }}
        onConfirm={disconnect}
      />
    </section>
  );
}
