import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  Ban,
  Clock,
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
  PencilLine,
  ShieldCheck,
  Trash2,
  Wallet,
} from "lucide-react";

import { createClient } from "../../../../../api/client";
import type { StripeConnectDeleteBlocker, StripeConnectStatus } from "../../../../../api/types";
import { useToasts } from "../../../../../ui/feedback/useToasts";
import { useStripeConnectSocket } from "../../../../../lib/payments/useStripeConnectSocket";
import { Accordion, ConfirmDialog, Modal } from "../../../../../ui/overlays";
import { feeCents, formatEuros, formatPercent, formatTotalFee } from "../../../../../lib/payments/connectFees";

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

const timeFmt = new Intl.DateTimeFormat("es-ES", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

export function ConfigCobrosOnline() {
  const api = useMemo(() => createClient({ baseUrl: "" }), []);
  const { pushToast } = useToasts();
  const [connect, setConnect] = useState<StripeConnectStatus | null>(null);
  const [busy, setBusy] = useState<"onboard" | "demo" | "demo-off" | "dashboard" | "delete" | "precheck" | null>(null);
  const [blockers, setBlockers] = useState<StripeConnectDeleteBlocker[] | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteText, setDeleteText] = useState("");
  const [checking, setChecking] = useState(false);
  const [checkedAt, setCheckedAt] = useState<Date | null>(null);
  const lastStatus = useRef<Status | null>(null);

  // Single entry point for every fresh status (REST load or socket push).
  const apply = useCallback(
    (next: StripeConnectStatus, notifyManual = false) => {
      const prev = lastStatus.current;
      lastStatus.current = next.status;
      setConnect(next);
      setCheckedAt(new Date());
      if (prev && prev !== "active" && next.status === "active" && !next.demo) {
        pushToast({ kind: "success", title: "Cobros activados", message: "Stripe ha verificado la cuenta. Ya puedes cobrar adelantos con tarjeta." });
      } else if (notifyManual) {
        pushToast({ kind: "info", title: "Estado actualizado", message: VIEWS[next.demo ? "demo" : next.status].eyebrow });
      }
    },
    [pushToast],
  );

  // REST refresh: first paint, manual "Comprobar ahora" and after actions. It
  // also re-reads the account from Stripe, which pushes to other open tabs.
  const load = useCallback(
    async (manual = false) => {
      setChecking(true);
      try {
        const res = await api.config.getStripeConnect();
        if (!res.success) {
          pushToast({ kind: "error", title: "Error", message: res.message || "No se pudo cargar el estado de cobros" });
          return;
        }
        console.log("[checkpoint] stripe_connect_status_loaded", res.connect.status);
        apply(res.connect, manual);
      } finally {
        setChecking(false);
      }
    },
    [api, pushToast, apply],
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

  // Realtime: the backend pushes every status change (webhook account.updated,
  // onboarding, demo, delete) over one WebSocket; no polling.
  const waiting = !!connect && !connect.demo && (connect.status === "pending" || connect.status === "verifying");
  const socket = useStripeConnectSocket(
    useCallback((next: StripeConnectStatus, source: "hello" | "push") => {
      // hello repeats what REST already showed; only pushes are news.
      if (source === "hello" && lastStatus.current === next.status) return;
      apply(next);
    }, [apply]),
  );

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

  // Edit = Stripe-hosted onboarding link again: on Express accounts it lets the
  // owner review and change the data already submitted (IBAN, address, ID...).
  const edit = () => {
    console.log("[checkpoint] stripe_connect_edit_open");
    onboard();
  };

  // Before asking for ELIMINAR, check the same rules the backend enforces
  // (payments in flight, money not yet paid out). Blocked -> explain, no delete.
  const askDelete = () =>
    run("precheck", async () => {
      const res = await api.config.stripeConnectDeletePrecheck();
      if (!res.success) throw new Error(res.message || "No se pudo comprobar la cuenta");
      console.log("[checkpoint] stripe_connect_delete_precheck", res.can_delete, res.blockers.map((b) => b.code).join(","));
      if (res.can_delete) setDeleteOpen(true);
      else setBlockers(res.blockers);
    });

  const removeAccount = () =>
    run("delete", async () => {
      console.log("[checkpoint] stripe_connect_delete_confirmed");
      let res;
      try {
        res = await api.config.deleteStripeConnectAccount(deleteText);
      } catch (e) {
        // A payment may have started between the precheck and the confirm.
        const again = await api.config.stripeConnectDeletePrecheck().catch(() => null);
        if (again && again.success && !again.can_delete) {
          setDeleteOpen(false);
          setDeleteText("");
          setBlockers(again.blockers);
          return;
        }
        throw e;
      }
      if (!res.success) throw new Error(res.message || "No se pudo eliminar la cuenta de cobros");
      setDeleteOpen(false);
      setDeleteText("");
      lastStatus.current = null;
      if (res.connect) setConnect(res.connect);
      else await load();
      pushToast({ kind: "success", title: "Cuenta de cobros eliminada", message: "Puedes volver a activar los cobros online cuando quieras." });
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
  // Older backends omit `fee`: fall back to Stripe EEA standard + fee_percent.
  const fee = connect.fee ?? { platform_fee_percent: connect.fee_percent, stripe_base_percent: 1.25, stripe_base_fixed_cents: 25, override: false, total_percent: 1.25 + connect.fee_percent };
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
            {live && connect.details_submitted ? (
              <button type="button" className="bo-btn bo-btn--ghost" onClick={edit} disabled={!!busy || !connect.platform_ready} data-testid="config-cobros-edit">
                {spin("onboard") ?? <PencilLine size={16} aria-hidden="true" />} Editar datos
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
                <span className={`bo-cobrosLive is-${socket}`} data-testid="config-cobros-live" data-state={socket} aria-hidden="true" />
                {socket === "open" ? "En directo" : socket === "connecting" ? "Conectando…" : "Sin conexión en directo"} · Actualizado {timeFmt.format(checkedAt)}
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
                <dt className="bo-cobrosMetricLabel">Comisión por cobro</dt>
                <dd className="bo-cobrosMetricValue" data-testid="config-cobros-fee-value">{formatTotalFee(fee, fee.platform_fee_percent)}</dd>
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

        {!connect.demo ? (
          <section className="bo-cobrosFees" data-testid="config-cobros-fees" aria-labelledby="config-cobros-fees-title">
            <h4 className="bo-cobrosFeesTitle" id="config-cobros-fees-title" data-testid="config-cobros-fees-title">
              Comisiones
            </h4>
            <dl className="bo-cobrosFeesRows" data-testid="config-cobros-fees-rows">
              <div className="bo-cobrosFeesRow" data-testid="config-cobros-fees-stripe">
                <dt>Tarifa de Stripe (procesamiento de tarjeta)</dt>
                <dd>{formatPercent(fee.stripe_base_percent)} + {formatEuros(fee.stripe_base_fixed_cents)}</dd>
              </div>
              <div className="bo-cobrosFeesRow" data-testid="config-cobros-fees-platform">
                <dt>Comisión de la plataforma</dt>
                <dd>{fee.platform_fee_percent > 0 ? formatPercent(fee.platform_fee_percent) : "0 %"}</dd>
              </div>
              <div className="bo-cobrosFeesRow is-total" data-testid="config-cobros-fees-total">
                <dt>Total por transacción</dt>
                <dd>{formatTotalFee(fee, fee.platform_fee_percent)}</dd>
              </div>
            </dl>
            <p className="bo-cobrosFeesExample" data-testid="config-cobros-fees-example">
              Ejemplo: en un adelanto de {formatEuros(5000)} se descuentan {formatEuros(feeCents(fee, fee.platform_fee_percent, 5000))} y recibes{" "}
              <strong>{formatEuros(5000 - feeCents(fee, fee.platform_fee_percent, 5000))}</strong>. Se descuenta automáticamente de cada cobro;
              no hay cuotas mensuales ni coste si no cobras. La tarifa de Stripe corresponde a tarjetas estándar del Espacio Económico Europeo.
            </p>
          </section>
        ) : null}

        {live ? (
          <Accordion title="Opciones avanzadas" testId="config-cobros-advanced" className="bo-cobrosAdvanced">
            <section className="bo-cobrosDanger" data-testid="config-cobros-danger" aria-labelledby="config-cobros-danger-title">
              <div className="min-w-0" data-testid="config-cobros-danger-copy">
                <h4 className="bo-cobrosDangerTitle" id="config-cobros-danger-title" data-testid="config-cobros-danger-title">Eliminar cuenta de cobros</h4>
                <p className="bo-cobrosDangerText" data-testid="config-cobros-danger-text">
                  Desconecta este restaurante de Stripe para empezar el alta de nuevo con otros datos o con otra titularidad. Los cobros online se desactivan
                  al momento. Solo es posible sin pagos en curso ni saldo pendiente de transferir.
                </p>
              </div>
              <button type="button" className="bo-btn bo-btn--danger" onClick={askDelete} disabled={!!busy} data-testid="config-cobros-delete">
                {spin("precheck") ?? <Trash2 size={16} aria-hidden="true" />} Eliminar cuenta
              </button>
            </section>
          </Accordion>
        ) : null}

        <DeleteBlockedModal blockers={blockers} onClose={() => setBlockers(null)} onDashboard={connect.details_submitted ? dashboard : undefined} />

        <ConfirmDialog
          open={deleteOpen}
          danger
          busy={busy === "delete"}
          title="¿Eliminar la cuenta de cobros?"
          confirmText="Eliminar definitivamente"
          cancelText="Cancelar"
          onClose={() => {
            if (busy === "delete") return;
            setDeleteOpen(false);
            setDeleteText("");
          }}
          onConfirm={() => {
            if (deleteText.trim().toUpperCase() !== "ELIMINAR") {
              pushToast({ kind: "error", title: "Confirmación necesaria", message: "Escribe ELIMINAR para confirmar." });
              return;
            }
            void removeAccount();
          }}
          message={
            <div className="flex flex-col gap-3 text-sm" data-testid="config-cobros-delete-dialog">
              <ul className="bo-cobrosDeleteList" data-testid="config-cobros-delete-consequences">
                <li data-testid="config-cobros-delete-c1">Se desactivan al momento los cobros online de las prereservas.</li>
                <li data-testid="config-cobros-delete-c2">La cuenta se elimina en Stripe y no se puede recuperar.</li>
                <li data-testid="config-cobros-delete-c3">Los cobros ya transferidos a tu banco no se ven afectados.</li>
                <li data-testid="config-cobros-delete-c4">Después podrás activar los cobros otra vez desde cero.</li>
              </ul>
              <label className="flex flex-col gap-1" data-testid="config-cobros-delete-confirm-label">
                <span>
                  Escribe <strong>ELIMINAR</strong> para confirmar
                </span>
                <input
                  className="bo-input"
                  value={deleteText}
                  onChange={(e) => setDeleteText(e.target.value)}
                  autoComplete="off"
                  autoFocus
                  aria-label="Escribe ELIMINAR para confirmar"
                  data-testid="config-cobros-delete-confirm-input"
                />
              </label>
            </div>
          }
        />

        <p className="bo-cobrosFoot" data-testid="config-cobros-foot">
          <Lock size={12} aria-hidden="true" /> Pagos procesados por Stripe. Tus datos personales y bancarios nunca se guardan en esta aplicación.
        </p>
      </div>
    </div>
  );
}

/**
 * Shown instead of the delete confirmation while the account cannot be
 * deleted: guest payments in progress or money not yet paid out to the bank.
 * Coordination id: stripe_connect_multitenant_v1.delete
 */
function DeleteBlockedModal({
  blockers,
  onClose,
  onDashboard,
}: {
  blockers: StripeConnectDeleteBlocker[] | null;
  onClose: () => void;
  onDashboard?: () => void;
}) {
  const open = !!blockers && blockers.length > 0;
  const balance = blockers?.find((b) => b.code === "BALANCE_NOT_ZERO");
  const checkouts = blockers?.find((b) => b.code === "CHECKOUTS_OPEN");
  const unknown = blockers?.find((b) => b.code === "BALANCE_UNKNOWN");
  return (
    <Modal open={open} title="Todavía no puedes eliminar la cuenta" onClose={onClose} className="bo-modal--confirm bo-cobrosBlocked">
      <div data-slot="modal-head" className="bo-modalHead" data-testid="config-cobros-blocked-head">
        <div data-ui="modal-title" className="bo-modalTitle flex items-center gap-2" data-testid="config-cobros-blocked-title">
          <Ban size={18} className="text-[var(--bo-on-surface-danger)]" aria-hidden="true" /> Todavía no puedes eliminar la cuenta
        </div>
        <button className="bo-modalX" type="button" onClick={onClose} aria-label="Cerrar" data-testid="config-cobros-blocked-x">
          ×
        </button>
      </div>
      <div data-slot="modal-body" className="bo-modalBody flex flex-col gap-3 text-sm" data-testid="config-cobros-blocked" role="alertdialog" aria-describedby="config-cobros-blocked-intro">
        <p id="config-cobros-blocked-intro" className="text-[var(--bo-muted)]" data-testid="config-cobros-blocked-intro">
          Para proteger tu dinero, Stripe solo permite eliminar la cuenta de cobros cuando no queda nada pendiente. No se ha eliminado nada.
        </p>

        {balance ? (
          <section className="bo-cobrosBlockedItem" data-testid="config-cobros-blocked-balance">
            <h5 className="bo-cobrosBlockedTitle" data-testid="config-cobros-blocked-balance-title">
              <Banknote size={16} aria-hidden="true" /> Tienes saldo pendiente de transferir
            </h5>
            <dl className="bo-cobrosFeesRows" data-testid="config-cobros-blocked-balance-rows">
              <div className="bo-cobrosFeesRow" data-testid="config-cobros-blocked-available">
                <dt>Disponible, en camino a tu banco</dt>
                <dd>{formatEuros(balance.available_cents ?? 0)}</dd>
              </div>
              <div className="bo-cobrosFeesRow" data-testid="config-cobros-blocked-pending">
                <dt>Pendiente (cobros recientes que Stripe aún retiene)</dt>
                <dd>{formatEuros(balance.pending_cents ?? 0)}</dd>
              </div>
              <div className="bo-cobrosFeesRow is-total" data-testid="config-cobros-blocked-total">
                <dt>Total</dt>
                <dd>{formatEuros((balance.available_cents ?? 0) + (balance.pending_cents ?? 0))}</dd>
              </div>
            </dl>
            <p className="bo-cobrosBlockedHint" data-testid="config-cobros-blocked-balance-hint">
              <Clock size={14} aria-hidden="true" /> Stripe lo transfiere automáticamente a tu cuenta bancaria cada día; los cobros nuevos suelen tardar unos días
              en estar disponibles. Cuando el saldo sea 0 € podrás eliminar la cuenta.
            </p>
          </section>
        ) : null}

        {checkouts ? (
          <section className="bo-cobrosBlockedItem" data-testid="config-cobros-blocked-checkouts">
            <h5 className="bo-cobrosBlockedTitle" data-testid="config-cobros-blocked-checkouts-title">
              <Loader2 size={16} aria-hidden="true" /> {checkouts.open_checkouts === 1 ? "Hay 1 pago de un cliente en curso" : `Hay ${checkouts.open_checkouts ?? ""} pagos de clientes en curso`}
            </h5>
            <p className="bo-cobrosBlockedHint" data-testid="config-cobros-blocked-checkouts-hint">
              Un cliente está pagando el adelanto de una prereserva. Los pagos sin terminar caducan solos en 30 minutos; inténtalo de nuevo después.
            </p>
          </section>
        ) : null}

        {unknown ? (
          <section className="bo-cobrosBlockedItem" data-testid="config-cobros-blocked-unknown">
            <h5 className="bo-cobrosBlockedTitle" data-testid="config-cobros-blocked-unknown-title">
              <AlertTriangle size={16} aria-hidden="true" /> No hemos podido comprobar tu saldo
            </h5>
            <p className="bo-cobrosBlockedHint" data-testid="config-cobros-blocked-unknown-hint">{unknown.message}</p>
          </section>
        ) : null}
      </div>
      <div data-slot="modal-actions" className="bo-modalActions" data-testid="config-cobros-blocked-actions">
        {balance && onDashboard ? (
          <button type="button" className="bo-btn bo-btn--ghost" onClick={onDashboard} data-testid="config-cobros-blocked-dashboard">
            <ArrowUpRight size={16} aria-hidden="true" /> Ver saldo en Stripe
          </button>
        ) : null}
        <button type="button" className="bo-btn bo-btn--primary" onClick={onClose} autoFocus data-testid="config-cobros-blocked-ok">
          Entendido
        </button>
      </div>
    </Modal>
  );
}
