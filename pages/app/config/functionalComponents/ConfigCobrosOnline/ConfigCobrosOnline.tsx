import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BadgeCheck, CheckCircle2, Circle, CreditCard, ExternalLink, FlaskConical, Landmark, Loader2, RefreshCw, ShieldCheck } from "lucide-react";

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
 * While Stripe is still deciding (pending / verifying) the status is polled so
 * the chip never goes stale after returning from Stripe.
 * Coordination id: stripe_connect_multitenant_v1
 */
type Status = StripeConnectStatus["status"];

const STATUS_VIEW: Record<Status, { label: string; chip: string }> = {
  not_connected: { label: "Sin activar", chip: "" },
  pending: { label: "Alta sin terminar", chip: "bo-chip--yellow" },
  verifying: { label: "Stripe está verificando", chip: "bo-chip--cyan" },
  restricted: { label: "Stripe necesita más datos", chip: "bo-chip--red" },
  active: { label: "Activo", chip: "bo-chip--green" },
};

const STEPS: { id: string; label: string; doneFrom: Status[] }[] = [
  { id: "account", label: "Cuenta creada", doneFrom: ["pending", "verifying", "restricted", "active"] },
  { id: "details", label: "Datos e IBAN enviados", doneFrom: ["verifying", "restricted", "active"] },
  { id: "verified", label: "Identidad verificada", doneFrom: ["active"] },
  { id: "active", label: "Cobros activos", doneFrom: ["active"] },
];

// Stripe requirement ids -> what the restaurant has to do, in plain Spanish.
const REQUIREMENT_LABEL: [RegExp, string][] = [
  [/external_account/, "Cuenta bancaria (IBAN)"],
  [/tos_acceptance/, "Aceptar las condiciones de Stripe"],
  [/verification\.(additional_)?document/, "Documento de identidad"],
  [/id_number/, "DNI / NIE"],
  [/\.dob\./, "Fecha de nacimiento"],
  [/\.address\./, "Dirección"],
  [/(first|last)_name/, "Nombre y apellidos"],
  [/\.phone/, "Teléfono"],
  [/\.email/, "Email"],
  [/nationality/, "Nacionalidad"],
  [/business_type|company\.|business_profile/, "Datos del negocio"],
];

const describeRequirements = (ids: string[]) =>
  Array.from(new Set(ids.map((id) => REQUIREMENT_LABEL.find(([re]) => re.test(id))?.[1] ?? "Otros datos")));

const POLL_MS = 8000;

export function ConfigCobrosOnline() {
  const api = useMemo(() => createClient({ baseUrl: "" }), []);
  const { pushToast } = useToasts();
  const [connect, setConnect] = useState<StripeConnectStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(false);
  const lastStatus = useRef<Status | null>(null);

  const load = useCallback(
    async (manual = false) => {
      setChecking(true);
      try {
        const res = await api.config.getStripeConnect();
        if (!res.success) {
          pushToast({ kind: "error", title: "Error", message: res.message || "No se pudo cargar el estado de cobros" });
          return;
        }
        const prev = lastStatus.current;
        lastStatus.current = res.connect.status;
        setConnect(res.connect);
        console.log("[checkpoint] stripe_connect_status_loaded", res.connect.status);
        if (prev && prev !== "active" && res.connect.status === "active" && !res.connect.demo) {
          pushToast({ kind: "success", title: "Cobros activados", message: "Stripe ha verificado la cuenta. Ya puedes cobrar adelantos con tarjeta." });
        } else if (manual) {
          pushToast({ kind: "info", title: "Estado actualizado", message: STATUS_VIEW[res.connect.status].label });
        }
      } finally {
        setChecking(false);
      }
    },
    [api, pushToast],
  );

  // First load + coming back from Stripe (?onboarding=return|refresh).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const back = params.get("onboarding");
    void load();
    if (back) {
      console.log("[checkpoint] stripe_connect_onboarding_back", back);
      if (back === "refresh") {
        pushToast({ kind: "info", title: "El enlace de Stripe caducó", message: "Pulsa «Continuar el alta en Stripe» para seguir donde lo dejaste." });
      }
      params.delete("onboarding");
      const qs = params.toString();
      window.history.replaceState(null, "", `${window.location.pathname}${qs ? `?${qs}` : ""}`);
    }
  }, [load, pushToast]);

  // Poll while Stripe still has to decide; stop once active/restricted.
  const waiting = !!connect && !connect.demo && (connect.status === "pending" || connect.status === "verifying");
  useEffect(() => {
    if (!waiting) return;
    const t = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, POLL_MS);
    return () => window.clearInterval(t);
  }, [waiting, load]);

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
      lastStatus.current = res.connect.status;
      setConnect(res.connect);
      pushToast({ kind: "success", title: "Modo demo activado", message: "Los pagos se simulan y no se cobra nada." });
    });

  const leaveDemo = () =>
    run(async () => {
      const res = await api.config.disconnectStripeConnectDemo();
      if (!res.success) throw new Error(res.message || "No se pudo desactivar el modo demo");
      lastStatus.current = null;
      await load();
    });

  const dashboard = () =>
    run(async () => {
      const res = await api.config.openStripeConnectDashboard();
      if (!res.success) throw new Error(res.message || "Stripe no pudo abrir el panel");
      window.open(res.dashboard_url, "_blank", "noopener,noreferrer");
    });

  if (!connect) {
    return (
      <div className="bo-panel flex items-center gap-2 p-6 text-sm text-[var(--bo-muted)]" data-testid="config-cobros-loading">
        <Loader2 size={16} className="animate-spin" aria-hidden="true" /> Cargando cobros online...
      </div>
    );
  }

  const live = connect.connected && !connect.demo;
  const view = connect.demo ? { label: "Modo demo", chip: "bo-chip--lila" } : STATUS_VIEW[connect.status];
  const due = describeRequirements(connect.currently_due);
  const needsOnboarding = !connect.connected || connect.demo || connect.status === "pending" || connect.status === "restricted";

  return (
    <div className="bo-panel" data-ui="config-cobros-online" data-testid="config-cobros-online" data-coordination-id="stripe_connect_multitenant_v1">
      <div className="bo-panelHead flex-col items-stretch gap-1" data-testid="config-cobros-head">
        <div className="flex items-center justify-between gap-2" data-testid="config-cobros-head-row">
          <div className="bo-panelTitle flex items-center gap-2" data-testid="config-cobros-title">
            <CreditCard size={18} className="text-[var(--bo-accent)]" aria-hidden="true" />
            Cobros online
          </div>
          <span className={`bo-chip bo-chip--static ${view.chip}`} data-testid="config-cobros-status" data-status={connect.demo ? "demo" : connect.status}>
            {checking && waiting ? <Loader2 size={12} className="animate-spin" aria-hidden="true" /> : null}
            {view.label}
          </span>
        </div>
        <div className="bo-panelMeta" data-testid="config-cobros-meta">
          Cobra el adelanto de las prereservas con tarjeta. El dinero llega a la cuenta bancaria del restaurante; no necesitas cuenta propia de Stripe.
        </div>
      </div>

      <div className="bo-panelBody flex flex-col gap-5" data-testid="config-cobros-body">
        {live ? (
          <ol className="grid grid-cols-2 gap-3 sm:grid-cols-4" data-testid="config-cobros-steps" aria-label="Progreso del alta en Stripe">
            {STEPS.map((step, i) => {
              const done = step.doneFrom.includes(connect.status);
              const current = !done && (i === 0 || STEPS[i - 1].doneFrom.includes(connect.status));
              return (
                <li
                  key={step.id}
                  className={`flex items-center gap-2 text-xs ${done ? "text-[var(--bo-text)]" : "text-[var(--bo-faint)]"}`}
                  data-testid={`config-cobros-step-${step.id}`}
                  data-state={done ? "done" : current ? "current" : "todo"}
                  aria-current={current ? "step" : undefined}
                >
                  {done ? (
                    <CheckCircle2 size={16} className="shrink-0 text-[var(--bo-success)]" aria-hidden="true" />
                  ) : current && waiting ? (
                    <Loader2 size={16} className="shrink-0 animate-spin text-[var(--bo-accent)]" aria-hidden="true" />
                  ) : (
                    <Circle size={16} className={`shrink-0 ${current ? "text-[var(--bo-accent)]" : ""}`} aria-hidden="true" />
                  )}
                  {step.label}
                </li>
              );
            })}
          </ol>
        ) : null}

        {connect.demo ? (
          <p className="bo-panelMeta" data-testid="config-cobros-demo-note">
            Los pagos se simulan con una pasarela de prueba y no se cobra nada. Activa los cobros reales para empezar a cobrar.
          </p>
        ) : connect.status === "verifying" ? (
          <p className="bo-panelMeta flex items-start gap-2" data-testid="config-cobros-verifying">
            <ShieldCheck size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
            Ya has enviado todo. Stripe está comprobando tu identidad y tu cuenta bancaria; suele tardar unos minutos. Esta página se actualiza sola.
          </p>
        ) : connect.status === "pending" ? (
          <p className="bo-panelMeta" data-testid="config-cobros-pending-note">
            El alta en Stripe está a medias. Continúa donde lo dejaste: tus datos ya guardados no se pierden.
          </p>
        ) : connect.status === "restricted" ? (
          <div className="flex flex-col gap-2" data-testid="config-cobros-due">
            <p className="bo-panelMeta" data-testid="config-cobros-due-intro">
              {due.length > 0 ? "Stripe necesita que completes estos datos para activar los cobros:" : "Stripe ha pausado los cobros de esta cuenta. Revisa el alta para ver qué falta."}
            </p>
            {due.length > 0 ? (
              <ul className="flex flex-wrap gap-2" data-testid="config-cobros-due-list">
                {due.map((label) => (
                  <li key={label} className="bo-chip bo-chip--static bo-chip--yellow" data-testid={`config-cobros-due-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}>
                    {label}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : !connect.platform_ready ? (
          <p className="bo-panelMeta" data-testid="config-cobros-platform-missing">La plataforma de pagos no está configurada en el servidor.</p>
        ) : null}

        {live && (connect.bank_last4 || connect.fee_percent > 0 || connect.status === "active") ? (
          <dl className="grid grid-cols-1 gap-3 rounded-[var(--bo-radius-sm)] border border-[var(--bo-border)] p-3 text-xs sm:grid-cols-3" data-testid="config-cobros-summary">
            <div className="flex flex-col gap-1" data-testid="config-cobros-summary-bank">
              <dt className="text-[var(--bo-faint)]">Cuenta de cobro</dt>
              <dd className="flex items-center gap-1 text-[var(--bo-text)]" data-testid="config-cobros-bank">
                <Landmark size={14} aria-hidden="true" /> {connect.bank_last4 ? `IBAN ···· ${connect.bank_last4}` : "Sin cuenta bancaria"}
              </dd>
            </div>
            <div className="flex flex-col gap-1" data-testid="config-cobros-summary-charges">
              <dt className="text-[var(--bo-faint)]">Cobros con tarjeta</dt>
              <dd className="text-[var(--bo-text)]" data-testid="config-cobros-charges">{connect.charges_enabled ? "Activos" : "Pendientes"}</dd>
            </div>
            <div className="flex flex-col gap-1" data-testid="config-cobros-summary-payouts">
              <dt className="text-[var(--bo-faint)]">Transferencias al banco</dt>
              <dd className="text-[var(--bo-text)]" data-testid="config-cobros-payouts">{connect.payouts_enabled ? "Activas" : "Pendientes"}</dd>
            </div>
            {connect.fee_percent > 0 ? (
              <div className="flex flex-col gap-1 sm:col-span-3" data-testid="config-cobros-fee">
                <dt className="text-[var(--bo-faint)]">Comisión de la plataforma</dt>
                <dd className="text-[var(--bo-text)]">{connect.fee_percent}% por cobro</dd>
              </div>
            ) : null}
          </dl>
        ) : null}

        <div className="flex flex-wrap gap-2" data-testid="config-cobros-actions">
          {needsOnboarding ? (
            <button type="button" className="bo-btn bo-btn--primary" onClick={onboard} disabled={busy || !connect.platform_ready} data-testid="config-cobros-onboard">
              {busy ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <BadgeCheck size={16} aria-hidden="true" />}
              {live ? (connect.status === "restricted" ? "Completar datos en Stripe" : "Continuar el alta en Stripe") : "Activar cobros online"}
            </button>
          ) : null}
          {live && connect.details_submitted ? (
            <button type="button" className="bo-btn bo-btn--ghost" onClick={dashboard} disabled={busy} data-testid="config-cobros-dashboard">
              <ExternalLink size={16} aria-hidden="true" /> Ver pagos y cuenta bancaria
            </button>
          ) : null}
          {live && connect.status !== "active" ? (
            <button type="button" className="bo-btn bo-btn--ghost" onClick={() => void load(true)} disabled={checking} data-testid="config-cobros-refresh">
              <RefreshCw size={16} className={checking ? "animate-spin" : ""} aria-hidden="true" /> Comprobar estado
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
