import React, { useCallback, useEffect, useMemo, useState } from "react";

import { platformAPI } from "../../../../api/platform-client";
import type { ConnectFeeSettings, PlatformConnectAccount } from "../../../../api/platform-client";
import { feeCents, formatEuros, formatPercent, formatTotalFee } from "../../../../lib/payments/connectFees";

/**
 * Plataforma > Stripe Connect (root only; backend gates requireBOSuperadmin).
 * - Global platform commission, added on top of Stripe's base fee.
 * - Per-restaurant override (0 allowed) or "use global".
 * - Connected accounts overview (status, charges, payouts).
 * Coordination id: stripe_connect_fees_v1
 */
const STATUS_LABEL: Record<PlatformConnectAccount["status"], string> = {
  not_connected: "Sin cuenta",
  pending: "Alta sin terminar",
  verifying: "Verificando",
  restricted: "Necesita datos",
  active: "Activa",
};

const EXAMPLE_CENTS = 5000;

const parsePercent = (raw: string): number | null => {
  const v = Number(raw.replace(",", "."));
  return raw.trim() !== "" && Number.isFinite(v) && v >= 0 && v <= 30 ? Math.round(v * 100) / 100 : null;
};

export function StripeConnectTab() {
  const [settings, setSettings] = useState<ConnectFeeSettings | null>(null);
  const [accounts, setAccounts] = useState<PlatformConnectAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [globalDraft, setGlobalDraft] = useState("");
  const [baseDraft, setBaseDraft] = useState({ percent: "", fixed: "" });
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [onlyConnected, setOnlyConnected] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await platformAPI.listStripeConnect();
      if (!res.success) throw new Error(res.message || "No se pudieron cargar las cuentas conectadas");
      setSettings(res.settings);
      setAccounts(res.accounts);
      setGlobalDraft(String(res.settings.platform_fee_percent));
      setBaseDraft({ percent: String(res.settings.stripe_base_percent), fixed: (res.settings.stripe_base_fixed_cents / 100).toFixed(2) });
      setDrafts(Object.fromEntries(res.accounts.map((a) => [a.restaurant_id, a.fee_override === null ? "" : String(a.fee_override)])));
      console.log("[checkpoint] platform_stripe_connect_loaded", res.accounts.length);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const flash = (msg: string) => {
    setNotice(msg);
    window.setTimeout(() => setNotice(""), 3500);
  };

  const globalValue = parsePercent(globalDraft);
  const basePercent = parsePercent(baseDraft.percent);
  const baseFixed = Number(baseDraft.fixed.replace(",", "."));
  const baseValid = basePercent !== null && Number.isFinite(baseFixed) && baseFixed >= 0 && baseFixed <= 5;
  const preview = useMemo(
    () => (baseValid && basePercent !== null ? { stripe_base_percent: basePercent, stripe_base_fixed_cents: Math.round(baseFixed * 100) } : settings),
    [baseValid, basePercent, baseFixed, settings],
  );

  const saveGlobal = async () => {
    if (!settings || globalValue === null || !baseValid || basePercent === null) return;
    setSaving("global");
    setError("");
    try {
      const res = await platformAPI.saveStripeConnectSettings({
        platform_fee_percent: globalValue,
        stripe_base_percent: basePercent,
        stripe_base_fixed_cents: Math.round(baseFixed * 100),
      });
      if (!res.success) throw new Error(res.message || "No se pudo guardar");
      console.log("[checkpoint] platform_stripe_connect_global_saved", globalValue);
      flash("Comisión global guardada");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(null);
    }
  };

  const saveOverride = async (a: PlatformConnectAccount, value: number | null) => {
    setSaving(`r${a.restaurant_id}`);
    setError("");
    try {
      const res = await platformAPI.setStripeConnectRestaurantFee(a.restaurant_id, value);
      if (!res.success) throw new Error(res.message || "No se pudo guardar");
      console.log("[checkpoint] platform_stripe_connect_override_saved", a.restaurant_id, value);
      flash(value === null ? `${a.name}: usa la comisión global` : `${a.name}: comisión ${formatPercent(value)}`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(null);
    }
  };

  if (loading && !settings) {
    return <div className="bo-platformLoading" data-testid="platform-connect-loading">Cargando cuentas conectadas...</div>;
  }
  if (!settings || !preview) {
    return <div className="bo-platformError" data-testid="platform-connect-error">{error || "Sin datos"}</div>;
  }

  const visible = onlyConnected ? accounts.filter((a) => a.connected) : accounts;
  const counts = {
    connected: accounts.filter((a) => a.connected && !a.demo).length,
    active: accounts.filter((a) => a.status === "active" && !a.demo).length,
    demo: accounts.filter((a) => a.demo).length,
    overrides: accounts.filter((a) => a.fee_override !== null).length,
  };

  return (
    <div data-ui="platform-stripe-connect" data-testid="platform-connect" data-coordination-id="stripe_connect_fees_v1">
      <div className="bo-metricGrid" data-testid="platform-connect-metrics">
        <div className="bo-metricCard" data-testid="platform-connect-metric-connected">
          <div className="bo-metricValue">{counts.connected}</div>
          <div className="bo-metricLabel">Cuentas conectadas</div>
        </div>
        <div className="bo-metricCard" data-testid="platform-connect-metric-active">
          <div className="bo-metricValue">{counts.active}</div>
          <div className="bo-metricLabel">Cobrando</div>
        </div>
        <div className="bo-metricCard" data-testid="platform-connect-metric-demo">
          <div className="bo-metricValue">{counts.demo}</div>
          <div className="bo-metricLabel">En modo demo</div>
        </div>
        <div className="bo-metricCard" data-testid="platform-connect-metric-overrides">
          <div className="bo-metricValue">{counts.overrides}</div>
          <div className="bo-metricLabel">Comisión propia</div>
        </div>
      </div>

      <div className="bo-platformCard" data-testid="platform-connect-global">
        <h3 className="bo-platformCardTitle" data-testid="platform-connect-global-title">Comisión global</h3>
        <p className="bo-platformSub" data-testid="platform-connect-global-help">
          Se cobra a cada negocio encima de la tarifa de Stripe (Managed Risk: Stripe cobra su tarifa directamente al negocio y asume pérdidas y
          disputas). Con 0 % el negocio solo paga la tarifa de Stripe y la plataforma no cobra nada.
          Los negocios con comisión propia no se ven afectados.
        </p>
        <div className="bo-platformForm" data-testid="platform-connect-global-form">
          <label className="flex flex-col gap-1 text-xs" data-testid="platform-connect-global-fee-label">
            Comisión de la plataforma (%)
            <input
              className="bo-platformInput"
              inputMode="decimal"
              value={globalDraft}
              onChange={(e) => setGlobalDraft(e.target.value)}
              aria-invalid={globalValue === null}
              data-testid="platform-connect-global-fee"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs" data-testid="platform-connect-base-percent-label">
            Tarifa base Stripe (%)
            <input
              className="bo-platformInput"
              inputMode="decimal"
              value={baseDraft.percent}
              onChange={(e) => setBaseDraft((d) => ({ ...d, percent: e.target.value }))}
              aria-invalid={basePercent === null}
              data-testid="platform-connect-base-percent"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs" data-testid="platform-connect-base-fixed-label">
            Tarifa base Stripe fija (€)
            <input
              className="bo-platformInput"
              inputMode="decimal"
              value={baseDraft.fixed}
              onChange={(e) => setBaseDraft((d) => ({ ...d, fixed: e.target.value }))}
              aria-invalid={!baseValid}
              data-testid="platform-connect-base-fixed"
            />
          </label>
          <button
            type="button"
            className="bo-platformBtn bo-platformBtn--success"
            onClick={() => void saveGlobal()}
            disabled={saving !== null || globalValue === null || !baseValid}
            data-testid="platform-connect-global-save"
          >
            {saving === "global" ? "Guardando..." : "Guardar"}
          </button>
        </div>
        {globalValue !== null ? (
          <p className="bo-platformResult" data-testid="platform-connect-global-preview">
            Los negocios verán: <strong>{formatTotalFee(preview, globalValue)}</strong> por transacción · en un adelanto de {formatEuros(EXAMPLE_CENTS)} se
            descuentan {formatEuros(feeCents(preview, globalValue, EXAMPLE_CENTS))} y el negocio recibe{" "}
            {formatEuros(EXAMPLE_CENTS - feeCents(preview, globalValue, EXAMPLE_CENTS))}.
          </p>
        ) : (
          <p className="bo-platformError" data-testid="platform-connect-global-invalid">Introduce un porcentaje entre 0 y 30.</p>
        )}
      </div>

      <div className="bo-platformActionBar" data-testid="platform-connect-toolbar">
        <h3 className="bo-platformCardTitle" data-testid="platform-connect-accounts-title">Negocios</h3>
        <label className="bo-platformCheckbox" data-testid="platform-connect-only-connected-label">
          <input type="checkbox" checked={onlyConnected} onChange={(e) => setOnlyConnected(e.target.checked)} data-testid="platform-connect-only-connected" />
          Solo con cuenta conectada
        </label>
        <button type="button" className="bo-platformRefresh" onClick={() => void load()} disabled={loading} data-testid="platform-connect-refresh">
          {loading ? "Actualizando..." : "Actualizar"}
        </button>
      </div>
      {notice ? <div className="bo-platformResult" role="status" data-testid="platform-connect-notice">{notice}</div> : null}
      {error ? <div className="bo-platformError" role="alert" data-testid="platform-connect-error-inline">{error}</div> : null}

      {visible.length === 0 ? (
        <div className="bo-platformEmpty" data-testid="platform-connect-empty">
          {onlyConnected ? "Ningún negocio ha conectado todavía su cuenta de cobros." : "No hay negocios."}
        </div>
      ) : (
        <div className="bo-platformTableWrap" data-testid="platform-connect-table-wrap">
          <table className="bo-platformTable" data-testid="platform-connect-table">
            <thead>
              <tr>
                <th>Negocio</th>
                <th>Estado</th>
                <th>Cobros / Transferencias</th>
                <th>Comisión plataforma</th>
                <th>Total que paga</th>
                <th aria-label="Acciones" />
              </tr>
            </thead>
            <tbody>
              {visible.map((a) => {
                const draft = drafts[a.restaurant_id] ?? "";
                const draftValue = parsePercent(draft);
                const dirty = draft.trim() === "" ? a.fee_override !== null : draftValue !== a.fee_override;
                const shownFee = draft.trim() === "" ? settings.platform_fee_percent : draftValue;
                const busy = saving === `r${a.restaurant_id}`;
                const id = `platform-connect-row-${a.restaurant_id}`;
                return (
                  <tr key={a.restaurant_id} data-testid={id}>
                    <td data-testid={`${id}-name`}>
                      <strong>{a.name}</strong>
                      <div className="bo-platformSub">{a.slug}</div>
                    </td>
                    <td data-testid={`${id}-status`}>
                      <span className={`bo-waBadge ${a.status === "active" ? "bo-waBadge--on" : a.connected ? "bo-waBadge--pending" : "bo-waBadge--off"}`}>
                        {a.demo ? "Demo" : STATUS_LABEL[a.status]}
                      </span>
                    </td>
                    <td data-testid={`${id}-capabilities`}>
                      {a.demo ? "—" : `${a.charges_enabled ? "✓" : "✗"} cobros · ${a.payouts_enabled ? "✓" : "✗"} transferencias`}
                    </td>
                    <td data-testid={`${id}-fee`}>
                      <div className="flex items-center gap-2">
                        <input
                          className="bo-platformInput"
                          style={{ minWidth: 0, width: 90, flex: "0 0 auto" }}
                          inputMode="decimal"
                          placeholder={`Global ${formatPercent(settings.platform_fee_percent)}`}
                          value={draft}
                          onChange={(e) => setDrafts((d) => ({ ...d, [a.restaurant_id]: e.target.value }))}
                          aria-label={`Comisión propia de ${a.name} (%) — vacío usa la global`}
                          aria-invalid={draft.trim() !== "" && draftValue === null}
                          data-testid={`${id}-fee-input`}
                        />
                        <span className={`bo-waBadge ${a.fee_override !== null ? "bo-waBadge--pending" : "bo-waBadge--off"}`} data-testid={`${id}-fee-source`}>
                          {a.fee_override !== null ? "Propia" : "Global"}
                        </span>
                      </div>
                    </td>
                    <td data-testid={`${id}-total`}>{shownFee === null ? "—" : formatTotalFee(settings, shownFee)}</td>
                    <td className="bo-platformActions" data-testid={`${id}-actions`}>
                      <button
                        type="button"
                        className="bo-platformBtn bo-platformBtn--success"
                        disabled={busy || !dirty || (draft.trim() !== "" && draftValue === null)}
                        onClick={() => void saveOverride(a, draft.trim() === "" ? null : draftValue)}
                        data-testid={`${id}-save`}
                      >
                        {busy ? "..." : "Guardar"}
                      </button>
                      {a.fee_override !== null ? (
                        <button type="button" className="bo-platformBtn" disabled={busy} onClick={() => void saveOverride(a, null)} data-testid={`${id}-reset`}>
                          Usar global
                        </button>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
