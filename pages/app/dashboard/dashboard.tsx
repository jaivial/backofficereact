import React from "react";
import { usePageContext } from "vike-react/usePageContext";

import type { DashboardMetrics, InvoiceDashboardMetrics } from "../../../api/types";
import { StatCard } from "../../../ui/widgets/StatCard";
import { useErrorToast } from "../../../ui/feedback/useErrorToast";
import { todayISO } from "./utils";
import { navigateToFacturas } from "./helpers/navigation";

export default function Page() {
  const pageContext = usePageContext();
  const data = (pageContext.data ?? { date: "", metrics: null, invoiceMetrics: null, error: null }) as {
    date: string;
    metrics: DashboardMetrics | null;
    invoiceMetrics: InvoiceDashboardMetrics | null;
    error: string | null;
  };
  useErrorToast(data.error);

  if (!data.metrics) return null;

  const m = data.metrics;
  const im = data.invoiceMetrics;

  return (
    <>
      <section className="bo-cardsRow" data-ui="kpis-reservas" aria-label="KPIs de reservas">
        <StatCard label="Reservas" value={String(m.total)} icon="calendar" data-ui="stat-reservas" />
        <StatCard label="Confirmadas" value={String(m.confirmed)} icon="check" data-ui="stat-confirmadas" />
        <StatCard label="Pendientes" value={String(m.pending)} icon="clock" data-ui="stat-pendientes" />
        <StatCard label="Comensales" value={String(m.totalPeople)} icon="users" data-ui="stat-comensales" />
        <div className="bo-card bo-cardOb" aria-label="Resumen" data-ui="summary-card">
          <div className="bo-cardObHead" data-ui="summary-header">
            <div className="bo-statLabel" data-ui="summary-date-label">Dia seleccionado</div>
            <div className="bo-cardObIcon" aria-hidden="true" data-ui="summary-icon">
              <div className="bo-pill" data-ui="summary-pill" />
            </div>
          </div>
          <div className="bo-cardObTitle" data-ui="summary-date">{data.date}</div>
          <div className="bo-cardObBody" data-ui="summary-body">Panel inicial del backoffice. Mas modulos se agregan aqui.</div>
        </div>
      </section>

      {im && (
        <section className="bo-cardsRow" data-ui="kpis-facturas" aria-label="KPIs de facturas" style={{ marginTop: "14px" }}>
          <StatCard
            label="Facturas pendientes de pago"
            value={String(im.pendingCount)}
            icon="clock"
            onClick={() => navigateToFacturas("pending")}
            data-ui="stat-facturas-pendientes"
          />
          <StatCard
            label="Ingresos del mes"
            value={`${im.monthIncome.toFixed(2)} €`}
            icon="trending-up"
            onClick={() => navigateToFacturas("month")}
            data-ui="stat-ingresos-mes"
          />
          <StatCard
            label="Facturas enviadas esta semana"
            value={String(im.weekSentCount)}
            icon="file-text"
            onClick={() => navigateToFacturas("week-sent")}
            data-ui="stat-facturas-semanales"
          />
        </section>
      )}
    </>
  );
}
