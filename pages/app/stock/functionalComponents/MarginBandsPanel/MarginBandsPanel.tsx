import React, { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "../../../../../ui/actions/Button";
import { InlineAlert } from "../../../../../ui/feedback/InlineAlert";
import { FormField } from "../../../../../ui/inputs/FormField";
import {
  DEFAULT_BOUNDARIES,
  boundariesToBands,
  bandsToBoundaries,
  type MarginScopeBandInput,
} from "./marginBands";

// MarginBandsPanel edits the tenant-wide GLOBAL food-cost bands as three atomic
// boundaries. The DB enforces uniqueness/ranges; this UI enforces contiguity
// client-side too so a save can't be rejected for a gap.
//
// Diagnostics, not verdicts: zones are coloured for scan-speed, but every zone
// also carries a text label, so colour is never the only signal (WCAG).

type ScopeView = {
  scopeId: number;
  scopeKind: string;
  scopeKey: string;
  label: string;
  targetFoodCostPct?: number | null;
  bands: MarginScopeBandInput[];
};

type ScopesResponse = {
  scopes?: ScopeView[];
  defaults?: MarginScopeBandInput[];
};

async function scopeRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/admin/stock/margin-scopes${path}`, {
    ...init,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const body = await response.json();
  if (!response.ok || !body.success) {
    throw new Error(body.message || "Error de bandas de margen");
  }
  return body as T;
}

function fmt(n: number | null | undefined): string {
  return n == null ? "" : String(n);
}

export function MarginBandsPanel() {
  const [boundaries, setBoundaries] = useState<number[]>([...DEFAULT_BOUNDARIES]);
  const [target, setTarget] = useState("");
  const [configured, setConfigured] = useState(false);
  const [scopeId, setScopeId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await scopeRequest<ScopesResponse>("");
      const global = (data.scopes || []).find(
        (s) => s.scopeKind === "GLOBAL",
      );
      if (global) {
        setBoundaries(bandsToBoundaries(global.bands));
        setTarget(fmt(global.targetFoodCostPct));
        setScopeId(global.scopeId);
        setConfigured(true);
      } else {
        setBoundaries(bandsToBoundaries(data.defaults || []));
        setTarget("");
        setScopeId(null);
        setConfigured(false);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudieron cargar las bandas");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const setBoundary = useCallback((index: number, raw: string) => {
    const value = raw === "" ? NaN : Number(raw);
    setBoundaries((current) => {
      const next = [...current];
      next[index] = Number.isFinite(value) ? value : NaN;
      return next;
    });
  }, []);

  const preview = useMemo(() => {
    try {
      return boundariesToBands(boundaries);
    } catch {
      return null;
    }
  }, [boundaries]);

  const save = useCallback(async () => {
    setError("");
    setMessage("");
    let bands: MarginScopeBandInput[];
    try {
      bands = boundariesToBands(boundaries);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Bandas inválidas");
      return;
    }
    const targetNum = target.trim() === "" ? null : Number(target);
    if (targetNum != null && (!Number.isFinite(targetNum) || targetNum <= 0 || targetNum >= 100)) {
      setError("El objetivo debe estar entre 0 y 100");
      return;
    }
    setSaving(true);
    try {
      await scopeRequest("", {
        method: "PUT",
        body: JSON.stringify({
          scopeKind: "GLOBAL",
          label: "Global",
          targetFoodCostPct: targetNum,
          bands,
        }),
      });
      setConfigured(true);
      setMessage("Bandas de margen guardadas.");
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudieron guardar las bandas");
    } finally {
      setSaving(false);
    }
  }, [boundaries, load, target]);

  const reset = useCallback(async () => {
    if (!window.confirm("¿Restablecer las bandas globales a los valores por defecto?")) return;
    setError("");
    setMessage("");
    try {
      if (scopeId != null) {
        await scopeRequest(`/${scopeId}`, { method: "DELETE" });
      }
      setBoundaries([...DEFAULT_BOUNDARIES]);
      setTarget("");
      setConfigured(false);
      setScopeId(null);
      setMessage("Bandas restablecidas a los valores por defecto.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo restablecer");
    }
  }, [scopeId]);

  return (
    <div className="bo-stockSubsection" data-ui="margin-bands-panel">
      <h3 className="bo-stockSubtitle" data-ui="margin-bands-title">
        Bandas food cost globales
      </h3>
      <p className="bo-stockHint" data-ui="margin-bands-status">
        {loading
          ? "Cargando…"
          : configured
            ? "Configurado a medida."
            : "Usando valores por defecto (heredado del estándar)."}
      </p>
      <div className="bo-stockFormGrid bo-stockFormGrid--3" data-ui="margin-bands-fields">
        <FormField label="Límite Morado → Verde %" htmlFor="margin-band-b1">
          <input
            id="margin-band-b1"
            className="bo-input"
            inputMode="decimal"
            value={fmt(boundaries[0])}
            onChange={(event) => setBoundary(0, event.target.value)}
            data-testid="margin-band-b1"
          />
        </FormField>
        <FormField label="Límite Verde → Ámbar %" htmlFor="margin-band-b2">
          <input
            id="margin-band-b2"
            className="bo-input"
            inputMode="decimal"
            value={fmt(boundaries[1])}
            onChange={(event) => setBoundary(1, event.target.value)}
            data-testid="margin-band-b2"
          />
        </FormField>
        <FormField label="Límite Ámbar → Rojo %" htmlFor="margin-band-b3">
          <input
            id="margin-band-b3"
            className="bo-input"
            inputMode="decimal"
            value={fmt(boundaries[2])}
            onChange={(event) => setBoundary(2, event.target.value)}
            data-testid="margin-band-b3"
          />
        </FormField>
      </div>
      <FormField label="Objetivo food cost global % (opcional)" htmlFor="margin-band-target">
        <input
          id="margin-band-target"
          className="bo-input"
          inputMode="decimal"
          style={{ width: 140 }}
          value={target}
          onChange={(event) => setTarget(event.target.value)}
          data-testid="margin-band-target"
        />
      </FormField>
      {preview ? (
        <ul className="bo-stockRowList" data-ui="margin-bands-preview">
          {preview.map((band) => (
            <li
              className={`bo-stockRow bo-marginZone bo-marginZone--${band.zone.toLowerCase()}`}
              key={band.zone}
              data-ui={`margin-band-${band.zone.toLowerCase()}`}
            >
              <span data-ui="margin-band-zone-label">{band.zone}</span>
              <span className="bo-stockRowMeta" data-ui="margin-band-zone-range">
                {band.min == null ? "0" : band.min}% – {band.max == null ? "100" : band.max}%
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="bo-stockHint bo-stockHint--error" data-ui="margin-bands-invalid" data-testid="margin-bands-invalid">
          Los límites deben ser crecientes y estar entre 0 y 100.
        </p>
      )}
      <div className="bo-stockFormActions" data-ui="margin-bands-actions">
        <Button
          variant="primary"
          onClick={() => void save()}
          disabled={saving || !preview}
          data-testid="margin-bands-save"
        >
          {saving ? "Guardando…" : "Guardar bandas"}
        </Button>
        {configured ? (
          <Button variant="ghost" onClick={() => void reset()} data-testid="margin-bands-reset">
            Restablecer a defecto
          </Button>
        ) : null}
      </div>
      {error ? <InlineAlert kind="error" title="Bandas" message={error} /> : null}
      {message ? <InlineAlert kind="success" title="Bandas" message={message} /> : null}
    </div>
  );
}
