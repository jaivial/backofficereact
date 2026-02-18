import React from "react";
import { usePageContext } from "vike-react/usePageContext";

import type { DashboardMetrics, InvoiceDashboardMetrics } from "../../../api/types";
import { StatCard } from "../../../ui/widgets/StatCard";
import { useErrorToast } from "../../../ui/feedback/useErrorToast";

function todayISO(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default function Page() {
  const pageContext = usePageContext();
  const data = pageContext.data as {
    date: string;
    metrics: DashboardMetrics | null;
    invoiceMetrics: InvoiceDashboardMetrics | null;
    error: string | null;
  };
  useErrorToast(data.error);

  if (!data.metrics) return null;

  const m = data.metrics;
  const im = data.invoiceMetrics;

  // Handle click on invoice widgets to navigate to facturas page with filters
  const handleInvoiceWidgetClick = (filterType: string) => {
    const baseUrl = "/app/facturas";

    if (filterType === "pending") {
      // Filter by pending status
      window.location.href = `${baseUrl}?status=pendiente`;
    } else if (filterType === "month") {
      // Filter by this month (date range)
      const today = new Date();
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      const yyyy = firstDay.getFullYear();
      const mm = String(firstDay.getMonth() + 1).padStart(2, "0");
      const dd = String(firstDay.getDate()).padStart(2, "0");
      const todayYyyy = today.getFullYear();
      const todayMm = String(today.getMonth() + 1).padStart(2, "0");
      const todayDd = String(today.getDate()).padStart(2, "0");
      window.location.href = `${baseUrl}?date_from=${yyyy}-${mm}-${dd}&date_to=${todayYyyy}-${todayMm}-${todayDd}`;
    } else if (filterType === "week-sent") {
      // Filter by sent this week (status = enviada + date range for this week)
      const today = new Date();
      const day = today.getDay();
      const diff = today.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(today);
      monday.setDate(diff);
      const yyyy = monday.getFullYear();
      const mm = String(monday.getMonth() + 1).padStart(2, "0");
      const dd = String(monday.getDate()).padStart(2, "0");
      const todayYyyy = today.getFullYear();
      const todayMm = String(today.getMonth() + 1).padStart(2, "0");
      const todayDd = String(today.getDate()).padStart(2, "0");
      window.location.href = `${baseUrl}?status=enviada&date_from=${yyyy}-${mm}-${dd}&date_to=${todayYyyy}-${todayMm}-${todayDd}`;
    }
  };

  return (
    <>
      <section className="bo-cardsRow" aria-label="KPIs de reservas">
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

      {im && (
        <section className="bo-cardsRow" aria-label="KPIs de facturas" style={{ marginTop: "14px" }}>
          <StatCard
            label="Facturas pendientes de pago"
            value={String(im.pendingCount)}
            icon="clock"
            onClick={() => handleInvoiceWidgetClick("pending")}
          />
          <StatCard
            label="Ingresos del mes"
            value={`${im.monthIncome.toFixed(2)} €`}
            icon="trending-up"
            onClick={() => handleInvoiceWidgetClick("month")}
          />
          <StatCard
            label="Facturas enviadas esta semana"
            value={String(im.weekSentCount)}
            icon="file-text"
            onClick={() => handleInvoiceWidgetClick("week-sent")}
          />
        </section>
      )}
    </>
  );
}
