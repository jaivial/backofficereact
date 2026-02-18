import React, { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "../../../../../api/client";
import type { MemberStatsTableRow } from "../../../../../api/types";

type TableView = "weekly" | "monthly" | "quarterly" | "yearly";

interface StatsTableProps {
  memberId: number;
  initialYear?: number;
}

const viewOptions: { value: TableView; label: string }[] = [
  { value: "weekly", label: "Semanal" },
  { value: "monthly", label: "Mensual" },
  { value: "quarterly", label: "Trimestral" },
  { value: "yearly", label: "Anual" },
];

export function StatsTable({ memberId, initialYear }: StatsTableProps) {
  const api = useMemo(() => createClient({ baseUrl: "" }), []);
  const currentYear = initialYear ?? new Date().getFullYear();

  const [view, setView] = useState<TableView>("monthly");
  const [year, setYear] = useState(currentYear);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<MemberStatsTableRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Custom range state
  const [showCustomRange, setShowCustomRange] = useState(false);
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [customLoading, setCustomLoading] = useState(false);
  const [customRows, setCustomRows] = useState<MemberStatsTableRow[]>([]);

  const loadTableData = useCallback(async () => {
    if (memberId <= 0) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.members.getTableData(memberId, { view, year });
      if (res.success) {
        setRows(res.rows);
      } else {
        setError(res.message || "Error cargando datos");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  }, [api.members, memberId, view, year]);

  const loadCustomRange = useCallback(async () => {
    if (memberId <= 0 || !customFrom || !customTo) return;
    setCustomLoading(true);
    setError(null);
    try {
      const res = await api.members.getStatsRange(memberId, { from: customFrom, to: customTo });
      if (res.success) {
        setCustomRows(res.rows);
      } else {
        setError(res.message || "Error cargando datos");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setCustomLoading(false);
    }
  }, [api.members, memberId, customFrom, customTo]);

  useEffect(() => {
    if (showCustomRange) return;
    void loadTableData();
  }, [loadTableData, showCustomRange]);

  const formatHours = (hours: number) => hours.toFixed(2);

  const displayRows = showCustomRange ? customRows : rows;

  return (
    <div className="bo-statsTable">
      <div className="bo-statsTableControls">
        <div className="bo-statsTableFilters">
          <div className="bo-field">
            <label className="bo-label">Vista</label>
            <select
              className="bo-select"
              value={view}
              onChange={(e) => setView(e.target.value as TableView)}
              disabled={loading}
            >
              {viewOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="bo-field">
            <label className="bo-label">Año</label>
            <select
              className="bo-select"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              disabled={loading}
            >
              {[currentYear - 2, currentYear - 1, currentYear, currentYear + 1].map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            className={`bo-btn bo-btn--sm ${showCustomRange ? "bo-btn--primary" : "bo-btn--ghost"}`}
            onClick={() => setShowCustomRange(!showCustomRange)}
          >
            Rango personalizado
          </button>
        </div>

        {showCustomRange && (
          <div className="bo-statsTableCustomRange">
            <div className="bo-field">
              <label className="bo-label">Desde</label>
              <input
                type="date"
                className="bo-input"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
              />
            </div>
            <div className="bo-field">
              <label className="bo-label">Hasta</label>
              <input
                type="date"
                className="bo-input"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
              />
            </div>
            <button
              type="button"
              className="bo-btn bo-btn--primary bo-btn--sm"
              onClick={() => void loadCustomRange()}
              disabled={customLoading || !customFrom || !customTo}
            >
              {customLoading ? "Cargando..." : "Cargar"}
            </button>
          </div>
        )}
      </div>

      {error && <div className="bo-alert bo-alert--error">{error}</div>}

      <div className="bo-tableWrap">
        <table className="bo-table bo-table--stats" aria-label="Tabla de estadísticas">
          <thead>
            <tr>
              <th>Período</th>
              <th>Horas trabajadas</th>
              <th>Horas esperadas</th>
              <th>Diferencia</th>
            </tr>
          </thead>
          <tbody>
            {loading || customLoading ? (
              <tr>
                <td colSpan={4} className="bo-loading">
                  Cargando...
                </td>
              </tr>
            ) : displayRows.length === 0 ? (
              <tr>
                <td colSpan={4} className="bo-mutedText" style={{ textAlign: "center" }}>
                  No hay datos para el período seleccionado.
                </td>
              </tr>
            ) : (
              displayRows.map((row, idx) => (
                <tr key={row.date + idx}>
                  <td>{row.label}</td>
                  <td>{formatHours(row.workedHours)} h</td>
                  <td>{formatHours(row.expectedHours)} h</td>
                  <td className={row.difference >= 0 ? "bo-positive" : "bo-negative"}>
                    {row.difference >= 0 ? "+" : ""}
                    {formatHours(row.difference)} h
                  </td>
                </tr>
              ))
            )}
          </tbody>
          {!loading && !customLoading && displayRows.length > 0 && (
            <tfoot>
              <tr>
                <td><strong>Total</strong></td>
                <td>
                  <strong>
                    {formatHours(displayRows.reduce((sum, r) => sum + r.workedHours, 0))} h
                  </strong>
                </td>
                <td>
                  <strong>
                    {formatHours(displayRows.reduce((sum, r) => sum + r.expectedHours, 0))} h
                  </strong>
                </td>
                <td className={
                  displayRows.reduce((sum, r) => sum + r.difference, 0) >= 0
                    ? "bo-positive"
                    : "bo-negative"
                }>
                  <strong>
                    {displayRows.reduce((sum, r) => sum + r.difference, 0) >= 0 ? "+" : ""}
                    {formatHours(displayRows.reduce((sum, r) => sum + r.difference, 0))} h
                  </strong>
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
