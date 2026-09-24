import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  BadgeCheck,
  Banknote,
  Check,
  CreditCard,
  FlaskConical,
  Hourglass,
  Landmark,
  Loader2,
  Lock,
  Percent,
  PlugZap,
  RefreshCw,
  ShieldCheck,
  Wallet,
} from "lucide-react";

import { createClient } from "../../../../../api/client";
import type { StripeConnectStatus } from "../../../../../api/types";
import { useToasts } from "../../../../../ui/feedback/useToasts";

/**
 * "Cobros online" of the active restaurant (admin/config?content=stripe).
 *
 * The platform's Stripe account charges the guests; each restaurant only
 * completes Stripe's hosted onboarding (identity + IBAN) and receives payouts.
 * No keys or webhooks per restaurant. Demo mode runs the whole prereserva
 * payment flow without Stripe. While Stripe is still deciding (pending /
 * verifying) the status is polled so it never goes stale after returning from
 * Stripe.
 * Coordination id: stripe_connect_multitenant_v1
 */
type Status = StripeConnectStatus["status"];
type Tone = "neutral" | "warning" | "info" | "danger" | "success" | "demo";
type View = { tone: Tone; eyebrow: string; title: string; text: string; icon: React.ReactNode };

const VIEWS: Record<Status | "demo", View> = {
  not_connected: {
    tone: "neutral",
    eyebrow: "Sin activar",
    title: "Cobra el adelanto de las prereservas con tarjeta",
    text: "Activa los cobros en unos minutos: Stripe te pedirá tus datos y el IBAN donde quieres recibir el dinero. No necesitas cuenta propia de Stripe ni claves.",
    icon: <Wallet size={24} aria-hidden="true" />,
  },
  pending: {
    tone: "warning",
    eyebrow: "Alta sin terminar",
    title: "Te falta poco para empezar a cobrar",
    text: "Tu alta en Stripe está a medias. Continúa donde lo dejaste: lo que ya rellenaste se conserva.",
    icon: <Hourglass size={24} aria-hidden="true" />,
  },
  verifying: {
    tone: "info",
    eyebrow: "Stripe está verificando",
    title: "Ya has enviado todo. Stripe está comprobando tus datos",
    text: "Suele tardar unos minutos. No tienes que hacer nada: esta página se actualiza sola y te avisará cuando los cobros estén activos.",
    icon: <ShieldCheck size={24} aria-hidden="true" />,
  },
  restricted: {
    tone: "danger",
    eyebrow: "Stripe necesita más datos",
    title: "Faltan algunos datos para activar los cobros",
    text: "Stripe no puede activar la cuenta hasta recibirlos. Se completan en su formulario seguro.",
    icon: <AlertTriangle size={24} aria-hidden="true" />,
  },
  active: {
    tone: "success",
    eyebrow: "Activo",
    title: "Los cobros online están activos",
    text: "Tus clientes pagan el adelanto con tarjeta al hacer la prereserva y Stripe transfiere el dinero a tu cuenta bancaria.",
    icon: <BadgeCheck size={24} aria-hidden="true" />,
  },
  demo: {
    tone: "demo",
    eyebrow: "Modo demo",
    title: "Estás probando los cobros sin dinero real",
    text: "Las prereservas pasan por una pasarela simulada y no se cobra nada. Cuando quieras cobrar de verdad, activa los cobros online.",
    icon: <FlaskConical size={24} aria-hidden="true" />,
  },
};

const STEPS: { id: string; label: string; hint: string; doneFrom: Status[] }[] = [
  { id: "account", label: "Cuenta creada", hint: "Tu cuenta de cobros", doneFrom: ["pending", "verifying", "restricted", "active"] },
  { id: "details", label: "Datos e IBAN", hint: "Identidad y banco", doneFrom: ["verifying", "restricted", "active"] },
  { id: "verified", label: "Verificación", hint: "Revisión de Stripe", doneFrom: ["active"] },
  { id: "active", label: "Cobros activos", hint: "Listo para cobrar", doneFrom: ["active"] },
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

const slug = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

const POLL_MS = 8000;
const timeFmt = new Intl.DateTimeFormat("es-ES", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

export function ConfigCobrosOnline() {
  const api = useMemo(() => createClient({ baseUrl: "" }), []);
  const { pushToast } = useToasts();
  const [connect, setConnect] = useState<StripeConnectStatus | null>(null);
  const [busy, setBusy] = useState<"onboard" | "demo" | "demo-off" | "dashboard" | null>(null);
  const [checking, setChecking] = useState(false);
  const [checkedAt, setCheckedAt] = useState<Date | null>(null);
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
        setCheckedAt(new Date());
        console.log("[checkpoint] stripe_connect_status_loaded", res.connect.status);
        if (prev && prev !== "active" && res.connect.status === "active" && !res.connect.demo) {
          pushToast({ kind: "success", title: "Cobros activados", message: "Stripe ha verificado la cuenta. Ya puedes cobrar adelantos con tarjeta." });
        } else if (manual) {
          pushToast({ kind: "info", title: "Estado actualizado", message: VIEWS[res.connect.demo ? "demo" : res.connect.status].eyebrow });
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
        pushToast({ kind: "info", title: "El enlace de Stripe caducó", message: "Pulsa «Continuar el alta» para seguir donde lo dejaste." });
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

  const run = async (kind: NonNullable<typeof busy>, fn: () => Promise<void>) => {
    setBusy(kind);
    try {
      await fn();
    } catch (e) {
      pushToast({ kind: "error", title: "Error", message: e instanceof Error ? e.message : "Operación no completada" });
    } finally {
      setBusy(null);
    }
  };

  const onboard = () =>
    run("onboard", async () => {
      const res = await api.config.startStripeConnectOnboarding();
      if (!res.success) throw new Error(res.message || "Stripe no pudo abrir el alta");
      if (!res.onboarding_url) throw new Error("Stripe no pudo abrir el alta");
      console.log("[checkpoint] stripe_connect_onboarding_redirect");
      window.location.assign(res.onboarding_url);
    });

  const demo = () =>
    run("demo", async () => {
      const res = await api.config.startStripeConnectOnboarding({ demo: true });
      if (!res.success) throw new Error(res.message || "No se pudo activar el modo demo");
      if (!res.connect) throw new Error("No se pudo activar el modo demo");
      lastStatus.current = res.connect.status;
      setConnect(res.connect);
      pushToast({ kind: "success", title: "Modo demo activado", message: "Los pagos se simulan y no se cobra nada." });
    });

  const leaveDemo = () =>
    run("demo-off", async () => {
      const res = await api.config.disconnectStripeConnectDemo();
      if (!res.success) throw new Error(res.message || "No se pudo desactivar el modo demo");
      lastStatus.current = null;
      await load();
    });

  const dashboard = () =>
    run("dashboard", async () => {
      const res = await api.config.openStripeConnectDashboard();
      if (!res.success) throw new Error(res.message || "Stripe no pudo abrir el panel");
      window.open(res.dashboard_url, "_blank", "noopener,noreferrer");
    });

  if (!connect) {
    return (
      <div className="bo-panel p-4" data-testid="config-cobros-loading" aria-busy="true" aria-label="Cargando cobros online">
        <div className="bo-cobrosSkeleton" data-testid="config-cobros-skeleton" />
      </div>
    );
  }

  const live = connect.connected && !connect.demo;
  const key: Status | "demo" = connect.demo ? "demo" : connect.status;
  const view = VIEWS[key];
  const due = describeRequirements(connect.currently_due);
  const needsOnboarding = !connect.connected || connect.demo || connect.status === "pending" || connect.status === "restricted";
  const onboardLabel = !live ? "Activar cobros online" : connect.status === "restricted" ? "Completar datos en Stripe" : "Continuar el alta";
  const spin = (k: typeof busy) => (busy === k ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : null);

  return (
    <div
      className="bo-panel"
      data-ui="config-cobros-online"
      data-testid="config-cobros-online"
      data-coordination-id="stripe_connect_multitenant_v1"
      data-tone={view.tone}
      data-waiting={waiting ? "true" : "false"}
    >
      <div className="bo-panelHead" data-testid="config-cobros-head">
        <div className="bo-panelTitle flex items-center gap-2" data-testid="config-cobros-title">
          <CreditCard size={18} className="text-[var(--bo-accent)]" aria-hidden="true" />
          Cobros online
        </div>
      </div>

      <div className="bo-panelBody flex flex-col gap-4" data-testid="config-cobros-body">
        <section className="bo-cobrosHero" data-testid="config-cobros-hero" aria-live="polite">
          <div className="bo-cobrosHeroIcon" data-testid="config-cobros-hero-icon">{view.icon}</div>
          <div className="min-w-0" data-testid="config-cobros-hero-copy">
            <span className="bo-cobrosHeroEyebrow" data-testid="config-cobros-status" data-status={key}>
              <span className="bo-cobrosHeroDot" aria-hidden="true" />
              {view.eyebrow}
            </span>
            <h3 className="bo-cobrosHeroTitle" data-testid="config-cobros-hero-title">{view.title}</h3>
            <p className="bo-cobrosHeroText" data-testid="config-cobros-hero-text">
              {connect.status === "restricted" && !connect.demo && due.length === 0
                ? "Stripe ha pausado los cobros de esta cuenta. Abre el alta para ver qué necesita."
                : !connect.platform_ready
                  ? "La plataforma de pagos no está configurada en el servidor. Contacta con soporte."
                  : view.text}
            </p>
          </div>

          {live && connect.status === "restricted" && due.length > 0 ? (
            <div className="bo-cobrosDueBox" data-testid="config-cobros-due">
              <p className="bo-cobrosDueTitle" data-testid="config-cobros-due-title">
                Stripe te pide {due.length === 1 ? "1 dato" : `${due.length} datos`}
              </p>
              <ul className="bo-cobrosDue" data-testid="config-cobros-due-list" aria-label="Datos que pide Stripe">
                {due.map((label) => (
                  <li key={label} className="bo-cobrosDueItem" data-testid={`config-cobros-due-${slug(label)}`}>
                    <AlertTriangle size={13} aria-hidden="true" /> {label}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="bo-cobrosHeroActions" data-testid="config-cobros-actions">
            {needsOnboarding ? (
              <button
                type="button"
                className="bo-btn bo-btn--primary"
                onClick={onboard}
                disabled={!!busy || !connect.platform_ready}
                data-testid="config-cobros-onboard"
              >
                {spin("onboard") ?? <ArrowUpRight size={16} aria-hidden="true" />} {onboardLabel}
              </button>
            ) : null}
            {live && connect.details_submitted ? (
              <button type="button" className={`bo-btn ${connect.status === "active" ? "bo-btn--primary" : "bo-btn--ghost"}`} onClick={dashboard} disabled={!!busy} data-testid="config-cobros-dashboard">
                {spin("dashboard") ?? <ArrowUpRight size={16} aria-hidden="true" />} Ver pagos y transferencias
              </button>
            ) : null}
            {!connect.connected ? (
              <button type="button" className="bo-btn bo-btn--ghost" onClick={demo} disabled={!!busy} data-testid="config-cobros-demo">
                {spin("demo") ?? <FlaskConical size={16} aria-hidden="true" />} Probar en modo demo
              </button>
            ) : null}
            {connect.demo ? (
              <button type="button" className="bo-btn bo-btn--ghost" onClick={leaveDemo} disabled={!!busy} data-testid="config-cobros-demo-off">
                {spin("demo-off")} Salir del modo demo
              </button>
            ) : null}
            {live && connect.status !== "active" ? (
              <button type="button" className="bo-btn bo-btn--ghost" onClick={() => void load(true)} disabled={checking} data-testid="config-cobros-refresh">
                <RefreshCw size={16} className={checking ? "animate-spin" : ""} aria-hidden="true" /> Comprobar ahora
              </button>
            ) : null}
            {live && checkedAt ? (
              <span className="bo-cobrosHeroChecked" data-testid="config-cobros-checked-at">
                {waiting ? "Comprobando cada 8 s · " : ""}Actualizado {timeFmt.format(checkedAt)}
              </span>
            ) : null}
          </div>
        </section>

        {live ? (
          <ol className="bo-stepper" data-testid="config-cobros-steps" aria-label="Progreso del alta en Stripe">
            {STEPS.map((step, i) => {
              const done = step.doneFrom.includes(connect.status);
              const current = !done && (i === 0 || STEPS[i - 1].doneFrom.includes(connect.status));
              const blocked = current && connect.status === "restricted";
              return (
                <React.Fragment key={step.id}>
                  <li
                    className={`bo-stepperItem${done ? " is-completed" : current ? " is-active" : " is-disabled"}`}
                    data-testid={`config-cobros-step-${step.id}`}
                    data-state={done ? "done" : current ? "current" : "todo"}
                    aria-current={current ? "step" : undefined}
                  >
                    <div className="bo-stepperTrigger" data-testid={`config-cobros-step-${step.id}-body`}>
                      <span className="bo-stepperIndicator" data-testid={`config-cobros-step-${step.id}-indicator`}>
                        {done ? (
                          <Check size={16} aria-hidden="true" />
                        ) : blocked ? (
                          <AlertTriangle size={16} aria-hidden="true" />
                        ) : current && waiting ? (
                          <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                        ) : (
                          i + 1
                        )}
                      </span>
                      <span className="bo-stepperContent" data-testid={`config-cobros-step-${step.id}-text`}>
                        <span className="bo-stepperLabel">{step.label}</span>
                        <span className="bo-stepperDescription">{blocked ? "Faltan datos" : step.hint}</span>
                      </span>
                    </div>
                  </li>
                  {i < STEPS.length - 1 ? <li className="bo-stepperDivider" aria-hidden="true" data-testid={`config-cobros-step-divider-${i + 1}`} /> : null}
                </React.Fragment>
              );
            })}
          </ol>
        ) : null}

        {live ? (
          <dl className="bo-cobrosMetrics" data-testid="config-cobros-summary">
            <div className="bo-cobrosMetric" data-on={connect.bank_last4 ? "true" : "false"} data-testid="config-cobros-summary-bank">
              <span className="bo-cobrosMetricIcon"><Landmark size={18} aria-hidden="true" /></span>
              <div>
                <dt className="bo-cobrosMetricLabel">Cuenta de cobro</dt>
                <dd className="bo-cobrosMetricValue" data-testid="config-cobros-bank">{connect.bank_last4 ? `IBAN ···· ${connect.bank_last4}` : "Sin IBAN"}</dd>
              </div>
            </div>
            <div className="bo-cobrosMetric" data-on={connect.charges_enabled ? "true" : "false"} data-testid="config-cobros-summary-charges">
              <span className="bo-cobrosMetricIcon"><CreditCard size={18} aria-hidden="true" /></span>
              <div>
                <dt className="bo-cobrosMetricLabel">Cobros con tarjeta</dt>
                <dd className="bo-cobrosMetricValue" data-testid="config-cobros-charges">{connect.charges_enabled ? "Activos" : "Pendientes"}</dd>
              </div>
            </div>
            <div className="bo-cobrosMetric" data-on={connect.payouts_enabled ? "true" : "false"} data-testid="config-cobros-summary-payouts">
              <span className="bo-cobrosMetricIcon"><Banknote size={18} aria-hidden="true" /></span>
              <div>
                <dt className="bo-cobrosMetricLabel">Transferencias al banco</dt>
                <dd className="bo-cobrosMetricValue" data-testid="config-cobros-payouts">{connect.payouts_enabled ? "Activas" : "Pendientes"}</dd>
              </div>
            </div>
            <div className="bo-cobrosMetric" data-on="true" data-testid="config-cobros-fee">
              <span className="bo-cobrosMetricIcon"><Percent size={18} aria-hidden="true" /></span>
              <div>
                <dt className="bo-cobrosMetricLabel">Comisión de la plataforma</dt>
                <dd className="bo-cobrosMetricValue" data-testid="config-cobros-fee-value">{connect.fee_percent > 0 ? `${connect.fee_percent}% por cobro` : "Sin comisión"}</dd>
              </div>
            </div>
          </dl>
        ) : (
          <ul className="bo-cobrosHow" data-testid="config-cobros-how" aria-label="Cómo funciona">
            <li className="bo-cobrosHowItem" data-testid="config-cobros-how-signup">
              <PlugZap size={18} className="bo-cobrosHowIcon" aria-hidden="true" />
              <span><strong>1. Alta en 5 minutos</strong>Stripe te pide tus datos y el IBAN en su formulario seguro.</span>
            </li>
            <li className="bo-cobrosHowItem" data-testid="config-cobros-how-pay">
              <CreditCard size={18} className="bo-cobrosHowIcon" aria-hidden="true" />
              <span><strong>2. El cliente paga el adelanto</strong>Al hacer la prereserva en fechas especiales, con tarjeta, Apple Pay o Google Pay.</span>
            </li>
            <li className="bo-cobrosHowItem" data-testid="config-cobros-how-payout">
              <Banknote size={18} className="bo-cobrosHowIcon" aria-hidden="true" />
              <span><strong>3. Recibes el dinero</strong>Stripe lo transfiere a tu cuenta bancaria. Tu nombre aparece en el extracto del cliente.</span>
            </li>
          </ul>
        )}

        <p className="bo-cobrosFoot" data-testid="config-cobros-foot">
          <Lock size={12} aria-hidden="true" /> Pagos procesados por Stripe. Tus datos personales y bancarios nunca se guardan en esta aplicación.
        </p>
      </div>
    </div>
  );
}
