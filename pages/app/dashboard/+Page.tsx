import React from "react";
import { usePageContext } from "vike-react/usePageContext";

import type { DashboardMetrics } from "../../../api/types";
import { StatCard } from "../../../ui/widgets/StatCard";
import { useErrorToast } from "../../../ui/feedback/useErrorToast";

export default function Page() {
  const pageContext = usePageContext();
  const data = pageContext.data as { date: string; metrics: DashboardMetrics | null; error: string | null };
  useErrorToast(data.error);

  if (!data.metrics) return null;

  const m = data.metrics;

  return (
    <section className="bo-cardsRow" aria-label="KPIs">
      <StatCard label="Reservas" value={String(m.total)} icon="calendar" />
      <StatCard label="Confirmadas" value={String(m.confirmed)} icon="check" />
      <StatCard label="Pendientes" value={String(m.pending)} icon="clock" />
      <StatCard label="Comensales" value={String(m.totalPeople)} icon="users" />
      <div className="bo-card bo-cardOb" aria-label="Resumen">
        <div className="bo-cardObHead">
          <div className="bo-statLabel">Dia seleccionado</div>
          <div className="bo-cardObIcon" aria-hidden="true">
            <div className="bo-pill" />
          </div>
        </div>
        <div className="bo-cardObTitle">{data.date}</div>
        <div className="bo-cardObBody">Panel inicial del backoffice. Mas modulos se agregan aqui.</div>
      </div>
    </section>
  );
}
