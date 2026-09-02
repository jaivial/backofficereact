import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Bot,
  Check,
  Copy,
  KeyRound,
  Loader2,
  QrCode,
  Smartphone,
  Unplug,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";

import { createClient } from "../../../../../api/client";
import type {
  WhatsAppConnection as WAConnection,
  WhatsAppConnectionResponse,
} from "../../../../../api/types";
import { Button } from "../../../../../ui/actions/Button";
import { useToasts } from "../../../../../ui/feedback/useToasts";
import { ConfirmDialog } from "../../../../../ui/overlays/ConfirmDialog";
import { Modal } from "../../../../../ui/overlays/Modal";

export type ConnState =
  | "loading"
  | "locked"
  | "disconnected"
  | "provisioning"
  | "qr_ready"
  | "connected"
  | "error";

export function qrToSrc(qr: string): string {
  const value = qr.trim();
  return value.startsWith("data:") ? value : `data:image/png;base64,${value}`;
}

// Providers have been seen to stringify a null pairing code (Go's "<nil>").
// WhatsApp pairing codes are 4-15 alphanumeric characters (presented as
// XXXX-XXXX), so anything non-alphanumeric — "<nil>", URLs, payloads — is
// rejected and must not drive the code-first pairing UX.
export function sanitizePairCode(raw: string | null | undefined): string {
  const clean = (raw ?? "").trim();
  const chars = clean.replace(/[\s-]/g, "");
  return /^[A-Z0-9]{4,15}$/i.test(chars) ? clean : "";
}

export function deriveState(
  res: Partial<WhatsAppConnectionResponse>,
): ConnState {
  if (res.entitled === false || res.code === "NEEDS_SUBSCRIPTION")
    return "locked";
  if (res.connected || res.connection?.connected) return "connected";
  const status = (res.connection?.status || "").toLowerCase();
  if (res.connection?.qr || res.connection?.pair_code) return "qr_ready";
  if (
    status === "pending" ||
    status === "connecting" ||
    status === "provisioned"
  )
    return "provisioning";
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
  const [showPairingDialog, setShowPairingDialog] = useState(false);
  const [pairingPhone, setPairingPhone] = useState("");
  const [pairingError, setPairingError] = useState("");
  const [pairCopied, setPairCopied] = useState(false);
  const realtimeVersion = useRef(0);

  const applyResult = useCallback(
    (res: Partial<WhatsAppConnectionResponse>, realtime = false) => {
      if (realtime) realtimeVersion.current += 1;
      if (typeof res.entitled === "boolean") setEntitled(res.entitled);
      const connection = res.connection
        ? { ...res.connection, pair_code: sanitizePairCode(res.connection.pair_code) }
        : res.connection;
      setState(deriveState({ ...res, connection }));
      setConnection(connection ?? null);
    },
    [],
  );

  useEffect(() => {
    let alive = true;
    const version = realtimeVersion.current;
    void api.members
      .whatsappConnection()
      .then((res) => {
        if (alive && "success" in res && realtimeVersion.current === version)
          applyResult(res);
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
          const payload = JSON.parse(
            event.data,
          ) as WhatsAppConnectionResponse & { type?: string };
          if (payload.type === "whatsapp.connection" && payload.success)
            applyResult(payload, true);
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

  const connect = useCallback(
    async (phone?: string) => {
      setBusy(true);
      setState("provisioning");
      try {
        const res = await api.members.whatsappConnect(phone ? { phone } : {});
        if ("success" in res && res.success) {
          applyResult(res);
          if (!res.connected) {
            pushToast({
              kind: "info",
              title: phone ? "Código de vinculación" : "Escanea el QR",
              message: phone
                ? "Introduce el código en WhatsApp → Dispositivos vinculados → Vincular con número de teléfono"
                : "WhatsApp → Dispositivos vinculados → Vincular dispositivo",
            });
          }
        } else {
          if ("code" in res && res.code === "NEEDS_SUBSCRIPTION")
            applyResult({ entitled: false, code: res.code });
          else setState("error");
          pushToast({
            kind: "error",
            title: "WhatsApp",
            message:
              ("message" in res && res.message) ||
              "No se pudo iniciar la conexión",
          });
        }
      } catch {
        setState("error");
        pushToast({
          kind: "error",
          title: "WhatsApp",
          message: "No se pudo iniciar la conexión",
        });
      } finally {
        setBusy(false);
      }
    },
    [api.members, applyResult, pushToast],
  );

  const submitPairing = useCallback(async () => {
    const normalized = pairingPhone.replace(/[\s()+-]/g, "");
    if (!/^\d{7,15}$/.test(normalized)) {
      setPairingError(
        "Introduce un número válido con prefijo internacional (por ejemplo, 34600000000).",
      );
      return;
    }
    setPairingError("");
    setShowPairingDialog(false);
    await connect(normalized);
  }, [connect, pairingPhone]);

  const copyPairingCode = useCallback(async () => {
    const code = connection?.pair_code?.trim();
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setPairCopied(true);
      window.setTimeout(() => setPairCopied(false), 1800);
    } catch {
      pushToast({
        kind: "error",
        title: "Código de vinculación",
        message: "No se pudo copiar el código",
      });
    }
  }, [connection?.pair_code, pushToast]);

  const disconnect = useCallback(
    async (successMessage = "Dispositivo desconectado") => {
      setBusy(true);
      try {
        const res = await api.members.whatsappDisconnect({
          delete_instance: false,
        });
        if ("success" in res && res.success) {
          applyResult({
            ...res,
            entitled: true,
            connected: false,
            connection: null,
          });
          setShowDisconnectConfirm(false);
          pushToast({
            kind: "success",
            title: "WhatsApp",
            message: successMessage,
          });
        } else {
          pushToast({
            kind: "error",
            title: "WhatsApp",
            message:
              ("message" in res && res.message) || "No se pudo desconectar",
          });
        }
      } catch {
        pushToast({
          kind: "error",
          title: "WhatsApp",
          message: "No se pudo desconectar",
        });
      } finally {
        setBusy(false);
      }
    },
    [api.members, applyResult, pushToast],
  );

  if (entitled !== true) return null;

  return (
    <section
      className="bo-panel"
      style={{ padding: "1rem" }}
      data-ui="whatsapp-connection"
      data-state={state}
      aria-label="Bot de WhatsApp"
    >
      <div className="bo-panelHeader">
        <h3>
          <Bot size={18} aria-hidden="true" /> Bot de WhatsApp
        </h3>
        <span
          className={`bo-badge ${state === "connected" ? "bo-badge--ok" : "bo-badge--muted"}`}
        >
          {state === "connected" ? (
            <>
              <Wifi size={14} aria-hidden="true" /> Conectado
            </>
          ) : (
            <>
              <WifiOff size={14} aria-hidden="true" /> Sin conectar
            </>
          )}
        </span>
      </div>

      <div
        className="bo-stack"
        style={{ alignItems: "center", textAlign: "center" }}
        aria-live="polite"
      >
        {state === "loading" ? (
          <p className="bo-muted">
            <Loader2 className="bo-spin" size={16} aria-hidden="true" />{" "}
            Cargando estado…
          </p>
        ) : state === "connected" ? (
          <>
            <p className="bo-muted">
              WhatsApp conectado
              {connection?.phone ? (
                <>
                  {" "}
                  como <strong>+{connection.phone}</strong>
                </>
              ) : null}
              . El bot ya puede responder mensajes.
            </p>
            <div className="bo-row">
              <Button
                variant="secondary"
                onClick={() => setShowDisconnectConfirm(true)}
                disabled={busy}
                aria-label="Desconectar WhatsApp"
              >
                <Unplug size={16} aria-hidden="true" /> Desconectar
              </Button>
            </div>
          </>
        ) : state === "qr_ready" ? (
          <>
            {connection?.pair_code ? (
              <div className="bo-pairingCodeBlock">
                <p className="bo-muted">
                  Introduce este código en WhatsApp → Dispositivos vinculados →
                  Vincular con número de teléfono:
                </p>
                <div className="bo-pairCode" aria-label="Código de vinculación">
                  {connection.pair_code}
                </div>
                <Button
                  variant="secondary"
                  onClick={() => void copyPairingCode()}
                  aria-label={
                    pairCopied
                      ? "Código copiado"
                      : "Copiar código de vinculación"
                  }
                >
                  {pairCopied ? (
                    <Check size={15} aria-hidden="true" />
                  ) : (
                    <Copy size={15} aria-hidden="true" />
                  )}
                  {pairCopied ? "Copiado" : "Copiar código"}
                </Button>
              </div>
            ) : null}
            {connection?.qr ? (
              <div className="bo-qrWrap">
                <img
                  className="bo-qr"
                  src={qrToSrc(connection.qr)}
                  alt="Código QR para vincular WhatsApp"
                  width={240}
                  height={240}
                />
                <ol className="bo-qrSteps">
                  <li>Abre WhatsApp en el teléfono del restaurante.</li>
                  <li>
                    Entra en <strong>Dispositivos vinculados</strong>.
                  </li>
                  <li>
                    Pulsa <strong>Vincular dispositivo</strong> y escanea el QR.
                  </li>
                </ol>
              </div>
            ) : null}
            <p className="bo-muted bo-qrWaiting">
              <Loader2 className="bo-spin" size={16} aria-hidden="true" />{" "}
              {connection?.pair_code
                ? "Esperando confirmación del código…"
                : "Esperando lectura del QR…"}
            </p>
            <div className="bo-row bo-qrActions">
              <Button
                variant="secondary"
                onClick={() => void connect()}
                disabled={busy}
                aria-label="Regenerar código QR"
              >
                <QrCode size={16} aria-hidden="true" /> Regenerar QR
              </Button>
              <Button
                variant="secondary"
                onClick={() => void disconnect("Vinculación cancelada")}
                disabled={busy}
                aria-label="Cancelar vinculación"
              >
                <X size={16} aria-hidden="true" /> Cancelar
              </Button>
            </div>
          </>
        ) : state === "provisioning" ? (
          <p className="bo-muted">
            <Loader2 className="bo-spin" size={16} aria-hidden="true" />{" "}
            Preparando conexión segura…
          </p>
        ) : state === "error" ? (
          <>
            <p className="bo-muted">
              No se pudo preparar WhatsApp. Revisa la conexión e inténtalo de
              nuevo.
            </p>
            <Button
              variant="primary"
              onClick={() => void connect()}
              disabled={busy}
              aria-label="Reintentar conexión de WhatsApp"
            >
              Reintentar
            </Button>
          </>
        ) : (
          <>
            <p className="bo-muted">
              Conecta el WhatsApp del restaurante para activar el bot de
              reservas.
            </p>
            <div className="bo-row">
              <Button
                variant="primary"
                onClick={() => void connect()}
                disabled={busy}
                aria-label="Conectar WhatsApp"
              >
                {busy ? (
                  <Loader2 className="bo-spin" size={16} aria-hidden="true" />
                ) : (
                  <QrCode size={16} aria-hidden="true" />
                )}
                Conectar con QR
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setPairingError("");
                  setShowPairingDialog(true);
                }}
                disabled={busy}
                aria-label="Conectar WhatsApp con código de vinculación"
              >
                <KeyRound size={16} aria-hidden="true" /> Conectar con código
              </Button>
            </div>
          </>
        )}
      </div>
      <Modal
        open={showPairingDialog}
        title="Conectar con código de vinculación"
        onClose={() => {
          if (!busy) setShowPairingDialog(false);
        }}
        size="sm"
      >
        <div className="bo-modalHead">
          <div className="bo-modalTitle">
            Conectar con código de vinculación
          </div>
        </div>
        <div className="bo-modalBody">
          <p className="bo-muted">
            Introduce el número de WhatsApp con prefijo internacional para
            generar un código.
          </p>
          <label className="bo-label" htmlFor="whatsapp-pairing-phone">
            Número de teléfono
          </label>
          <input
            id="whatsapp-pairing-phone"
            className="bo-input"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={pairingPhone}
            onChange={(event) => setPairingPhone(event.target.value)}
            placeholder="34600000000"
            aria-describedby="whatsapp-pairing-help whatsapp-pairing-error"
          />
          <p id="whatsapp-pairing-help" className="bo-muted">
            Sin espacios ni el signo + (ejemplo: 34600000000).
          </p>
          {pairingError ? (
            <p id="whatsapp-pairing-error" role="alert" className="bo-error">
              {pairingError}
            </p>
          ) : null}
        </div>
        <div className="bo-modalActions">
          <button
            type="button"
            className="bo-btn bo-btn--ghost"
            onClick={() => setShowPairingDialog(false)}
            disabled={busy}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="bo-btn bo-btn--primary"
            onClick={() => void submitPairing()}
            disabled={busy}
          >
            Generar código
          </button>
        </div>
      </Modal>
      <ConfirmDialog
        open={showDisconnectConfirm}
        title="Desconectar WhatsApp"
        message={`El bot dejará de responder hasta que vuelvas a conectar WhatsApp${connection?.phone ? ` en +${connection.phone}` : ""}.`}
        confirmText="Desconectar"
        cancelText="Cancelar"
        danger
        busy={busy}
        onClose={() => {
          if (!busy) setShowDisconnectConfirm(false);
        }}
        onConfirm={disconnect}
      />
    </section>
  );
}
