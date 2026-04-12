import React, { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "../../../../../../api/client";
import type { MemberStatsTableRow } from "../../../../../../api/types";
import { Select } from "../../../../../../ui/inputs/Select";
import { DateRangePicker } from "../../../../../../ui/inputs/DateRangePicker";

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

function parseTableView(value: string): TableView {
  if (value === "weekly") return "weekly";
  if (value === "quarterly") return "quarterly";
  if (value === "yearly") return "yearly";
  return "monthly";
}

export function StatsTable({ memberId, initialYear }: StatsTableProps) {
  const api = useMemo(() => createClient({ baseUrl: "" }), []);
  const currentYear = initialYear ?? new Date().getFullYear();

  const [view, setView] = useState<TableView>("monthly");
  const [year, setYear] = useState(currentYear);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<MemberStatsTableRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [customLoading, setCustomLoading] = useState(false);
  const [customRows, setCustomRows] = useState<MemberStatsTableRow[]>([]);
  const showCustomRange = Boolean(customFrom && customTo);

  const loadTableData = useCallback(async () => {
    if (memberId <= 0) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.members.getTableData(memberId, { view, year });
      if (res.success) {
        setRows(res.rows);
      } else {
        setError("message" in res ? res.message : "Error cargando datos");
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
        setError("message" in res ? res.message : "Error cargando datos");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setCustomLoading(false);
    }
  }, [api.members, memberId, customFrom, customTo]);

  useEffect(() => {
    if (showCustomRange) {
      void loadCustomRange();
      return;
    }
    void loadTableData();
  }, [loadCustomRange, loadTableData, showCustomRange]);

  const formatHours = (hours: number) => hours.toFixed(2);

  const displayRows = showCustomRange ? customRows : rows;
  const totalWorked = useMemo(() => displayRows.reduce((sum, row) => sum + row.workedHours, 0), [displayRows]);
  const totalExpected = useMemo(() => displayRows.reduce((sum, row) => sum + row.expectedHours, 0), [displayRows]);
  const totalDifference = useMemo(() => displayRows.reduce((sum, row) => sum + row.difference, 0), [displayRows]);
  const yearOptions = useMemo(
    () =>
      [currentYear - 2, currentYear - 1, currentYear, currentYear + 1].map((itemYear) => ({
        value: String(itemYear),
        label: String(itemYear),
      })),
    [currentYear],
  );
  const isBusy = loading || customLoading;


  return (
    <div className="bo-statsTable" data-slot="stats-table-container">
      <div className="bo-statsTableControls" data-slot="statsTable-statsTableControls">
        <div className="bo-statsTableFilters" data-slot="statsTable-statsTableFilters">
          <div className="bo-field" data-slot="statsTable-field">
            <label className="bo-label" data-slot="statsTable-label">Vista</label>
            <Select
              className="bo-statsTableSelect"
              value={view}
              onChange={(nextView) => setView(parseTableView(nextView))}
              options={viewOptions}
              size="sm"
              ariaLabel="Vista de estadisticas"
              disabled={isBusy || showCustomRange}
            />
          </div>

          <div className="bo-field" data-slot="statsTable-field">
            <label className="bo-label" data-slot="statsTable-label">Año</label>
            <Select
              className="bo-statsTableSelect"
              value={String(year)}
              onChange={(nextYear) => setYear(Number(nextYear))}
              options={yearOptions}
              size="sm"
              ariaLabel="Año de estadisticas"
              disabled={isBusy || showCustomRange}
            />
          </div>

          <div className="bo-field bo-statsTableRangeField" data-slot="statsTable-statsTableRangeField">
            <label className="bo-label" data-slot="statsTable-label">Rango personalizado</label>
            <DateRangePicker
              from={customFrom}
              to={customTo}
              onChange={({ from, to }) => {
                setCustomFrom(from);
                setCustomTo(to);
                if (!from || !to) setCustomRows([]);
              }}
              className="bo-statsRangePicker !ms-auto !w-fit"
              buttonLabel="Rango personalizado"
              ariaLabel="Seleccionar rango personalizado"
            />
          </div>

          {showCustomRange ? (
            <button
              type="button"
              className="bo-btn bo-btn--sm bo-btn--ghost"
              onClick={() => {
                setCustomFrom("");
                setCustomTo("");
                setCustomRows([]);
              }}
              data-testid="stats-table-clear-range-btn"
            >
              Quitar rango
            </button>
          ) : null}
        </div>
        {showCustomRange ? <div className="bo-statsTableModeTag">Mostrando rango personalizado.</div> : null}
      </div>

      {error && <div className="bo-alert bo-alert--error">{error}</div>}

      <div className=" overflow-x-auto" data-slot="statsTable-overflow-x-auto">
        <div className=" mt-0" data-slot="statsTable-mt-0">
          <table className="bo-table bo-table--stats overflow-x-scroll" aria-label="Tabla de estadisticas" data-slot="statsTable-tabla-de-estadistica">
            <thead data-slot="statsTable-thead">
              <tr data-slot="statsTable-tr">
                <th data-slot="statsTable-odo">Periodo</th>
                <th data-slot="statsTable-das">Horas trabajadas</th>
                <th data-slot="statsTable-das">Horas esperadas</th>
                <th data-slot="statsTable-cia">Diferencia</th>
              </tr>
            </thead>
            <tbody data-slot="statsTable-tbody">
              {isBusy ? (
                <tr data-slot="statsTable-tr">
                  <td colSpan={4} className="bo-loading" data-slot="statsTable-loading">
                    Cargando...
                  </td>
                </tr>
              ) : displayRows.length === 0 ? (
                <tr data-slot="statsTable-tr">
                  <td colSpan={4} className="bo-mutedText bo-statsTableEmpty" data-slot="statsTable-statsTableEmpty">
                    No hay datos para el período seleccionado.
                  </td>
                </tr>
              ) : (
                displayRows.map((row, idx) => (
                  <tr key={row.date + idx} data-slot="statsTable-tr">
                    <td data-slot="statsTable-bel">{row.label}</td>
                    <td data-slot="statsTable-urs">{formatHours(row.workedHours)} h</td>
                    <td data-slot="statsTable-urs">{formatHours(row.expectedHours)} h</td>
                    <td className={row.difference >= 0 ? "bo-positive" : "bo-negative"} data-slot="statsTable-td">
                      {row.difference >= 0 ? "+" : ""}
                      {formatHours(row.difference)} h
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {!isBusy && displayRows.length > 0 ? (
              <tfoot className="bo-table--statsFooter">
                <tr data-slot="statsTable-tr">
                  <td className="p-4" data-slot="statsTable-p-4">
                    <strong>Total</strong>
                  </td>
                  <td className="p-4" data-slot="statsTable-p-4">
                    <strong>{formatHours(totalWorked)} h</strong>
                  </td>
                  <td className="p-4" data-slot="statsTable-p-4">
                    <strong>{formatHours(totalExpected)} h</strong>
                  </td>
                  <td className={`p-4 ${totalDifference >= 0 ? "bo-positive" : "bo-negative"}`} data-slot="statsTable-td">
                    <strong>
                      {totalDifference >= 0 ? "+" : ""}
                      {formatHours(totalDifference)} h
                    </strong>
                  </td>
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>
      </div>
    </div>
  );
}
