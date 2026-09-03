import React, { useEffect, useRef, useState } from "react";

// Editor for stock_settings.seasonality_profile. The backend forecast gives an
// explicit monthlyFactors map priority over the classifier's peakMonths/
// lowMonths lists, so any manual edit materializes all 12 months as
// monthlyFactors (keys "1".."12") and keeps the classifier keys untouched.
// Factors are clamped to the same [0.2, 2.5] range the Go parser applies.

const MONTHS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

const MONTH_PREFIXES: Record<string, number> = {
  ene: 0, enero: 0, jan: 0, january: 0,
  feb: 1, febrero: 1, february: 1,
  mar: 2, marzo: 2, march: 2,
  abr: 3, abril: 3, apr: 3, april: 3,
  may: 4, mayo: 4,
  jun: 5, junio: 5, june: 5,
  jul: 6, julio: 6, july: 6,
  ago: 7, agosto: 7, aug: 7, august: 7,
  sep: 8, sept: 8, septiembre: 8, setiembre: 8, september: 8,
  oct: 9, octubre: 9, october: 9,
  nov: 10, noviembre: 10, november: 10,
  dic: 11, diciembre: 11, dec: 11, december: 11,
};

function monthIndex(key: string): number {
  const normalized = key.trim().toLowerCase();
  const numeric = Number(normalized);
  if (Number.isInteger(numeric) && numeric >= 1 && numeric <= 12) return numeric - 1;
  const index = MONTH_PREFIXES[normalized];
  return index === undefined ? -1 : index;
}

function clampFactor(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 1;
  return Math.min(2.5, Math.max(0.2, value));
}

function deriveFactors(profile: Record<string, unknown>): number[] {
  const factors = Array.from({ length: 12 }, () => 1);
  if (!profile || typeof profile !== "object") return factors;
  const monthly = profile.monthlyFactors;
  if (monthly && typeof monthly === "object" && !Array.isArray(monthly)) {
    for (const [key, value] of Object.entries(monthly as Record<string, unknown>)) {
      const index = monthIndex(key);
      const parsed = typeof value === "number" ? value : Number(value);
      if (index >= 0 && Number.isFinite(parsed)) factors[index] = clampFactor(parsed);
    }
    return factors;
  }
  const applyMonths = (list: unknown, factor: number) => {
    if (!Array.isArray(list)) return;
    for (const entry of list) {
      const index = monthIndex(String(entry));
      if (index >= 0) factors[index] = clampFactor(factor);
    }
  };
  const peakFactor = typeof profile.peakFactor === "number" ? profile.peakFactor : 1.2;
  const lowFactor = typeof profile.lowFactor === "number" ? profile.lowFactor : 0.8;
  applyMonths(profile.peakMonths, peakFactor);
  applyMonths(profile.lowMonths, lowFactor);
  return factors;
}

type SeasonalityEditorProps = {
  profile: Record<string, unknown>;
  onChange: (profile: Record<string, unknown>) => void;
};

export function SeasonalityEditor({ profile, onChange }: SeasonalityEditorProps) {
  const [draft, setDraft] = useState<string[]>(() => deriveFactors(profile).map(String));
  const lastProfile = useRef(profile);
  // Our own commits echo back as a new profile prop; without this guard the
  // re-derive effect would clobber the input mid-typing (e.g. "0." parses as 0,
  // clamps to 1, and rewrites the field while the user is still typing).
  const lastEcho = useRef<string | null>(null);

  useEffect(() => {
    if (lastProfile.current === profile) return;
    lastProfile.current = profile;
    if (lastEcho.current !== null && JSON.stringify(profile.monthlyFactors ?? null) === lastEcho.current) return;
    setDraft(deriveFactors(profile).map(String));
  }, [profile]);

  const commit = (next: string[]) => {
    setDraft(next);
    const monthlyFactors: Record<string, number> = {};
    next.forEach((raw, index) => {
      if (raw.trim() === "") return;
      const parsed = Number(raw);
      if (Number.isFinite(parsed)) monthlyFactors[String(index + 1)] = clampFactor(parsed);
    });
    lastEcho.current = JSON.stringify(monthlyFactors);
    onChange({ ...profile, monthlyFactors });
  };

  const derivedFromClassifier =
    !(profile.monthlyFactors instanceof Object) &&
    (Array.isArray(profile.peakMonths) || Array.isArray(profile.lowMonths));

  return (
    <div className="bo-seasonWrap" data-ui="stock-seasonality-editor">
      <div className="bo-seasonHead" data-ui="stock-seasonality-head">
        <h3 className="bo-stockSubtitle" data-ui="stock-seasonality-title">Estacionalidad mensual</h3>
        <button
          type="button"
          className="bo-stockIconBtn"
          aria-label="Restablecer multiplicadores a 1"
          title="Restablecer a 1"
          onClick={() => commit(Array.from({ length: 12 }, () => "1"))}
          data-ui="stock-seasonality-reset"
          data-testid="stock-seasonality-reset"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /></svg>
        </button>
      </div>
      <p className="bo-stockMuted" data-ui="stock-seasonality-hint">
        Multiplicador de afluencia por mes (0.2–2.5; 1 = neutro). Se aplica al pronóstico al guardar la configuración.
      </p>
      {derivedFromClassifier ? (
        <p className="bo-stockMuted" data-ui="stock-seasonality-derived">
          Valores derivados de la clasificación automática; ajústalos y guarda para materializarlos.
        </p>
      ) : null}
      <div className="bo-seasonGrid" data-ui="stock-seasonality-grid">
        {MONTHS.map((label, index) => (
          <label className="bo-seasonCell" key={label} data-ui={`stock-seasonality-cell-${index + 1}`}>
            <span className="bo-seasonMonth" data-ui={`stock-seasonality-month-label-${index + 1}`}>{label}</span>
            <input
              className="bo-input bo-seasonInput"
              type="number"
              step="0.1"
              min="0.2"
              max="2.5"
              inputMode="decimal"
              value={draft[index] ?? "1"}
              aria-label={`Multiplicador ${label}`}
              onChange={(event) => {
                const next = [...draft];
                next[index] = event.target.value;
                commit(next);
              }}
              data-ui="stock-seasonality-input"
              data-testid={`stock-seasonality-month-${index + 1}`}
            />
          </label>
        ))}
      </div>
    </div>
  );
}
