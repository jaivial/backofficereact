import React, { useCallback, useEffect, useMemo, useState } from "react";
import { BadgeCheck, CreditCard, ExternalLink, FlaskConical, Landmark } from "lucide-react";

import { createClient } from "../../../../../api/client";
import type { StripeConnectStatus } from "../../../../../api/types";
import { useToasts } from "../../../../../ui/feedback/useToasts";

/**
 * "Cobros online" of the active restaurant (admin/config?content=stripe).
 *
 * The platform's Stripe account charges the guests; each restaurant only
 * completes Stripe's hosted onboarding (identity + IBAN) and receives payouts.
 * No keys or webhooks per restaurant. Demo mode enables the whole prereserva
 * payment flow without Stripe for testing.
 * Coordination id: stripe_connect_multitenant_v1
 */
const STATUS_LABEL: Record<StripeConnectStatus["status"], string> = {
  not_connected: "Sin activar",
  pending: "Alta sin terminar",
  restricted: "Stripe necesita más datos",
  active: "Activo",
};

export function ConfigCobrosOnline() {
  const api = useMemo(() => createClient({ baseUrl: "" }), []);
  const { pushToast } = useToasts();
  const [connect, setConnect] = useState<StripeConnectStatus | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await api.config.getStripeConnect();
    if (res.success) setConnect(res.connect);
    else pushToast({ kind: "error", title: "Error", message: res.message || "No se pudo cargar el estado de cobros" });
  }, [api, pushToast]);

  useEffect(() => {
    void load();
  }, [load]);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      pushToast({ kind: "error", title: "Error", message: e instanceof Error ? e.message : "Operación no completada" });
    } finally {
      setBusy(false);
    }
  };

  const onboard = () =>
    run(async () => {
      const res = await api.config.startStripeConnectOnboarding();
      if (!res.success) throw new Error(res.message || "Stripe no pudo abrir el alta");
      if (!res.onboarding_url) throw new Error("Stripe no pudo abrir el alta");
      console.log("[checkpoint] stripe_connect_onboarding_redirect");
      window.location.assign(res.onboarding_url);
    });

  const demo = () =>
    run(async () => {
      const res = await api.config.startStripeConnectOnboarding({ demo: true });
      if (!res.success) throw new Error(res.message || "No se pudo activar el modo demo");
      if (!res.connect) throw new Error("No se pudo activar el modo demo");
      setConnect(res.connect);
      pushToast({ kind: "success", title: "Modo demo activado", message: "Los pagos se simulan y no se cobra nada." });
    });

  const leaveDemo = () =>
    run(async () => {
      const res = await api.config.disconnectStripeConnectDemo();
      if (!res.success) throw new Error(res.message || "No se pudo desactivar el modo demo");
      await load();
    });

  const dashboard = () =>
    run(async () => {
      const res = await api.config.openStripeConnectDashboard();
      if (!res.success) throw new Error(res.message || "Stripe no pudo abrir el panel");
      window.open(res.dashboard_url, "_blank", "noopener,noreferrer");
    });

  if (!connect) {
    return <div className="bo-panel p-6 text-sm text-[var(--bo-muted)]" data-testid="config-cobros-loading">Cargando cobros online...</div>;
  }

  const active = connect.status === "active";
  return (
    <div className="bo-panel" data-ui="config-cobros-online" data-testid="config-cobros-online" data-coordination-id="stripe_connect_multitenant_v1">
      <div className="bo-panelHead flex-col items-stretch gap-1" data-testid="config-cobros-head">
        <div className="bo-panelTitle flex items-center gap-2" data-testid="config-cobros-title">
          <CreditCard size={18} className="text-[var(--bo-accent)]" aria-hidden="true" />
          Cobros online
        </div>
        <div className="bo-panelMeta" data-testid="config-cobros-meta">
          Cobra el adelanto de las prereservas con tarjeta. El dinero llega a la cuenta bancaria del restaurante; no necesitas cuenta propia de Stripe.
        </div>
      </div>

      <div className="bo-panelBody flex flex-col gap-4" data-testid="config-cobros-body">
        <div className="flex flex-wrap items-center gap-2" data-testid="config-cobros-status-row">
          <span className={`bo-chip${active ? " is-on" : ""}`} data-testid="config-cobros-status" data-status={connect.status}>
            {connect.demo ? "Modo demo" : STATUS_LABEL[connect.status]}
          </span>
          {connect.bank_last4 ? (
            <span className="bo-mutedText flex items-center gap-1 text-xs" data-testid="config-cobros-bank">
              <Landmark size={14} aria-hidden="true" /> Cuenta ···· {connect.bank_last4}
            </span>
          ) : null}
          {connect.fee_percent > 0 ? (
            <span className="bo-mutedText text-xs" data-testid="config-cobros-fee">Comisión de la plataforma: {connect.fee_percent}%</span>
          ) : null}
        </div>

        {connect.demo ? (
          <p className="bo-panelMeta" data-testid="config-cobros-demo-note">
            Los pagos se simulan con una pasarela de prueba. Activa los cobros reales para empezar a cobrar.
          </p>
        ) : connect.status === "restricted" && connect.currently_due.length > 0 ? (
          <p className="bo-panelMeta" data-testid="config-cobros-due">Stripe necesita que completes {connect.currently_due.length} dato(s) para activar los cobros.</p>
        ) : !connect.platform_ready ? (
          <p className="bo-panelMeta" data-testid="config-cobros-platform-missing">La plataforma de pagos no está configurada en el servidor.</p>
        ) : null}

        <div className="flex flex-wrap gap-2" data-testid="config-cobros-actions">
          {!active || connect.demo ? (
            <button type="button" className="bo-btn bo-btn--primary" onClick={onboard} disabled={busy || !connect.platform_ready} data-testid="config-cobros-onboard">
              <BadgeCheck size={16} aria-hidden="true" /> {connect.connected && !connect.demo ? "Continuar el alta en Stripe" : "Activar cobros online"}
            </button>
          ) : null}
          {connect.connected && !connect.demo && connect.details_submitted ? (
            <button type="button" className="bo-btn bo-btn--ghost" onClick={dashboard} disabled={busy} data-testid="config-cobros-dashboard">
              <ExternalLink size={16} aria-hidden="true" /> Ver pagos y cuenta bancaria
            </button>
          ) : null}
          {!connect.connected ? (
            <button type="button" className="bo-btn bo-btn--ghost" onClick={demo} disabled={busy} data-testid="config-cobros-demo">
              <FlaskConical size={16} aria-hidden="true" /> Probar en modo demo
            </button>
          ) : null}
          {connect.demo ? (
            <button type="button" className="bo-btn bo-btn--ghost" onClick={leaveDemo} disabled={busy} data-testid="config-cobros-demo-off">
              Salir del modo demo
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
