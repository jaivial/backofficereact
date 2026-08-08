import React, { useState } from "react";
import { Coins } from "lucide-react";

import type { LabourCostReport as Report } from "../../../../../api/types";
import { Panel } from "../../../../../ui/shell/Panel";

type Props = { report: Report | null; loading: boolean; onRangeChange: (from: string, to: string) => void };

const money = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" });

function hoursLabel(minutes: number): string {
  return `${(minutes / 60).toFixed(2).replace(".", ",")} h`;
}

export function LabourCostReport({ report, loading, onRangeChange }: Props) {
  const now = new Date();
  const monthFrom = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const today = now.toISOString().slice(0, 10);
  const [from, setFrom] = useState(report?.from || monthFrom);
  const [to, setTo] = useState(report?.to || today);

  return (
    <section className="bo-labourReport" data-ui="labour-report">
      <Panel
        title={
          <span className="bo-labourReportTitle" data-ui="labour-report-title">
            <Coins size={16} strokeWidth={1.8} aria-hidden="true" />
            Coste laboral por fichajes
          </span>
        }
        meta="Horas reales × coste empresa vigente cada día."
        headClassName="bo-labourReportHead"
        data-testid="labour-report-panel"
      >
        <div className="bo-labourReportRange" data-ui="labour-report-range">
          <label data-ui="labour-report-from-label">
            Desde
            <input
              className="bo-input"
              type="date"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
              data-ui="labour-report-from"
            />
          </label>
          <label data-ui="labour-report-to-label">
            Hasta
            <input
              className="bo-input"
              type="date"
              value={to}
              onChange={(event) => setTo(event.target.value)}
              data-ui="labour-report-to"
            />
          </label>
          <button
            className="bo-btn bo-btn--ghost"
            type="button"
            disabled={loading || !from || !to}
            onClick={() => onRangeChange(from, to)}
            data-ui="labour-report-load"
          >
            {loading ? "Calculando..." : "Calcular"}
          </button>
        </div>

        {report ? (
          <>
            <div className="bo-labourReportSummary" data-ui="labour-report-summary">
              <div className="bo-kv" data-ui="labour-report-hours">
                <span className="bo-kvLabel" data-ui="labour-report-hours-label">Horas</span>
                <strong className="bo-kvValue" data-ui="labour-report-hours-value">{hoursLabel(report.totalMinutes)}</strong>
              </div>
              <div className="bo-kv" data-ui="labour-report-cost">
                <span className="bo-kvLabel" data-ui="labour-report-cost-label">Coste</span>
                <strong className="bo-kvValue" data-ui="labour-report-cost-value">{money.format(report.totalCost)}</strong>
              </div>
            </div>

            <div className="bo-labourReportMembers" data-ui="labour-report-members">
              {report.members.map((item) => (
                <div className="bo-labourReportMember" key={item.memberId} data-ui="labour-report-member">
                  <span className="bo-labourReportMemberName" data-ui="labour-report-member-name">
                    {item.name}
                    {item.missingCompensation ? <span className="bo-badge bo-badge--warn" data-ui="labour-report-member-missing">sin salario</span> : null}
                  </span>
                  <strong className="bo-labourReportMemberCost" data-ui="labour-report-member-cost">
                    {hoursLabel(item.minutesWorked)} · {money.format(item.cost)}
                  </strong>
                </div>
              ))}
            </div>

            {report.missingCompensationMembers.length ? (
              <p className="bo-labourReportMissing" role="alert" data-ui="labour-report-missing">
                Falta salario: {report.missingCompensationMembers.join(", ")}
              </p>
            ) : null}
          </>
        ) : (
          <p className="bo-mutedText" data-ui="labour-report-empty">Carga periodo para calcular coste real.</p>
        )}
      </Panel>
    </section>
  );
}
