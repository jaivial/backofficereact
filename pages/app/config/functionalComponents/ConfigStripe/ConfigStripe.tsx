import React, { useCallback, useEffect, useMemo, useState } from "react";
import { CreditCard, Save, ShieldCheck } from "lucide-react";

import { createClient } from "../../../../../api/client";
import type { StripeConfig, StripeConfigInput } from "../../../../../api/types";
import { useToasts } from "../../../../../ui/feedback/useToasts";
import { Switch } from "../../../../../ui/shadcn/Switch";

/**
 * Stripe settings of the active restaurant (admin/config?content=stripe).
 *
 * Secrets are write-only: the backend returns masked hints and a blank input
 * keeps the stored value. Demo mode swaps Stripe Checkout for a local demo page
 * so the prereserva payment flow can be tested without charging a card.
 * Coordination id: stripe_prereserva_adelanto_v1
 */
export function ConfigStripe() {
  const api = useMemo(() => createClient({ baseUrl: "" }), []);
  const { pushToast } = useToasts();
  const [config, setConfig] = useState<StripeConfig | null>(null);
  const [secretKey, setSecretKey] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [publishableKey, setPublishableKey] = useState("");
  const [demoMode, setDemoMode] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const apply = useCallback((c: StripeConfig) => {
    setConfig(c);
    setDemoMode(c.demo_mode);
    setPublishableKey(c.publishable_key || "");
    setSecretKey("");
    setWebhookSecret("");
  }, []);

  useEffect(() => {
    void api.config.getStripeConfig().then((res) => {
      if (res.success) apply(res.config);
      else pushToast({ kind: "error", title: "Error", message: res.message || "No se pudo cargar Stripe" });
    });
  }, [api, apply, pushToast]);

  const save = async (patch: StripeConfigInput = {}) => {
    setSaving(true);
    try {
      const input: StripeConfigInput = { publishable_key: publishableKey, demo_mode: demoMode, ...patch };
      if (secretKey.trim()) input.secret_key = secretKey.trim();
      if (webhookSecret.trim()) input.webhook_secret = webhookSecret.trim();
      const res = await api.config.setStripeConfig(input);
      if (!res.success) throw new Error(res.message || "No se pudo guardar");
      apply(res.config);
      console.log("[checkpoint] stripe_config_saved", `demo=${res.config.demo_mode}`);
      pushToast({ kind: "success", title: "Stripe guardado" });
    } catch (e) {
      pushToast({ kind: "error", title: "Error", message: e instanceof Error ? e.message : "No se pudo guardar" });
    } finally {
      setSaving(false);
    }
  };

  const test = async () => {
    setTesting(true);
    try {
      const res = await api.config.testStripeConfig();
      if (!res.success) throw new Error(res.message || "Stripe rechazó la clave");
      pushToast({ kind: "success", title: "Conexión correcta", message: res.live_mode ? "Clave en modo LIVE" : "Clave en modo test" });
    } catch (e) {
      pushToast({ kind: "error", title: "Conexión fallida", message: e instanceof Error ? e.message : "Stripe rechazó la clave" });
    } finally {
      setTesting(false);
    }
  };

  if (!config) {
    return <div className="bo-panel p-6 text-sm text-[var(--bo-muted)]" data-testid="config-stripe-loading">Cargando configuración de Stripe...</div>;
  }

  return (
    <div className="bo-panel" data-ui="config-stripe" data-testid="config-stripe" data-coordination-id="stripe_prereserva_adelanto_v1">
      <div className="bo-panelHead flex-col items-stretch gap-1" data-testid="config-stripe-head">
        <div className="bo-panelTitle flex items-center gap-2" data-testid="config-stripe-title">
          <CreditCard size={18} className="text-[var(--bo-accent)]" aria-hidden="true" />
          Pagos online (Stripe)
        </div>
        <div className="bo-panelMeta" data-testid="config-stripe-meta">
          Se usa para cobrar el adelanto de las prereservas de fechas especiales. Las claves se guardan cifradas y nunca se muestran completas.
        </div>
      </div>

      <div className="bo-panelBody flex flex-col gap-5" data-testid="config-stripe-body">
        <div className="bo-field bo-field--inline" data-testid="config-stripe-demo-row">
          <div className="grid gap-0.5" data-testid="config-stripe-demo-text">
            <span className="bo-label" data-testid="config-stripe-demo-label">Modo demo</span>
            <span className="bo-mutedText text-xs" data-testid="config-stripe-demo-desc">
              Muestra una pasarela de prueba y no cobra nada. Desactívalo para cobrar de verdad con Stripe.
            </span>
          </div>
          <Switch checked={demoMode} onCheckedChange={setDemoMode} disabled={saving} data-testid="config-stripe-demo-switch" />
        </div>
        {!demoMode && config.live_mode ? (
          <div className="bo-panelMeta text-[var(--bo-warning,#c48c2c)]" data-testid="config-stripe-live-warning">
            Clave LIVE: los pagos serán reales.
          </div>
        ) : null}

        <label className="bo-field" data-testid="config-stripe-secret-field">
          <span className="bo-label" data-testid="config-stripe-secret-label">Clave secreta o restringida</span>
          <input
            className="bo-input"
            type="password"
            autoComplete="off"
            value={secretKey}
            onChange={(e) => setSecretKey(e.target.value)}
            placeholder={config.has_secret_key ? `Guardada: ${config.secret_key_hint} (déjalo vacío para mantenerla)` : "rk_live_… o sk_test_…"}
            data-testid="config-stripe-secret-input"
          />
        </label>

        <label className="bo-field" data-testid="config-stripe-webhook-field">
          <span className="bo-label" data-testid="config-stripe-webhook-label">Secreto del webhook</span>
          <input
            className="bo-input"
            type="password"
            autoComplete="off"
            value={webhookSecret}
            onChange={(e) => setWebhookSecret(e.target.value)}
            placeholder={config.has_webhook_secret ? `Guardado: ${config.webhook_secret_hint}` : "whsec_…"}
            data-testid="config-stripe-webhook-input"
          />
          <span className="bo-mutedText text-xs" data-testid="config-stripe-webhook-url">
            URL del webhook en Stripe (evento checkout.session.completed): <code data-testid="config-stripe-webhook-url-value">{config.webhook_url}</code>
          </span>
        </label>

        <label className="bo-field" data-testid="config-stripe-publishable-field">
          <span className="bo-label" data-testid="config-stripe-publishable-label">Clave publicable (opcional)</span>
          <input
            className="bo-input"
            value={publishableKey}
            onChange={(e) => setPublishableKey(e.target.value)}
            placeholder="pk_live_…"
            data-testid="config-stripe-publishable-input"
          />
        </label>

        <div className="flex flex-wrap gap-2" data-testid="config-stripe-actions">
          <button type="button" className="bo-btn bo-btn--primary" onClick={() => void save()} disabled={saving} data-testid="config-stripe-save">
            <Save size={16} aria-hidden="true" /> {saving ? "Guardando..." : "Guardar"}
          </button>
          <button type="button" className="bo-btn bo-btn--ghost" onClick={() => void test()} disabled={testing || !config.has_secret_key} data-testid="config-stripe-test">
            <ShieldCheck size={16} aria-hidden="true" /> {testing ? "Comprobando..." : "Probar conexión"}
          </button>
        </div>
      </div>
    </div>
  );
}
