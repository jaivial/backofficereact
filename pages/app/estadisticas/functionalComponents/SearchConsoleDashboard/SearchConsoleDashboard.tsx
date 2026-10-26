import React from "react";
import { CalendarDays, Download, Eye, Info, ListFilter, MonitorSmartphone, MousePointerClick, Search } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Button } from "../../../../../ui/actions/Button";
import { Card } from "../../../../../ui/shell/Card";
import { downloadSearchConsoleCsv, SEARCH_CSV_FILENAME } from "./searchConsoleCsv";
import { SEARCH_SNAPSHOT, type SearchMetric } from "./searchConsoleSnapshot";

const NUMBER = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 0 });
const PERCENT = new Intl.NumberFormat("es-ES", { style: "percent", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const POSITION = new Intl.NumberFormat("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const INTENT_LABELS: Record<keyof typeof SEARCH_SNAPSHOT.intents, string> = {
  restaurant_catarroja: "Restaurante en Catarroja",
  rice: "Arroces y paellas",
  menus: "Menús",
  groups: "Grupos",
  weddings: "Bodas",
  communions: "Comuniones",
  company_events: "Eventos de empresa",
  brand: "Marca Villa Carmen",
};

const DEVICE_LABELS: Record<keyof typeof SEARCH_SNAPSHOT.devices, string> = {
  MOBILE: "Móvil",
  DESKTOP: "Ordenador",
  TABLET: "Tableta",
};

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
}

function Kpi({ label, value, detail, icon: Icon, testId }: { label: string; value: string; detail: string; icon: LucideIcon; testId: string }) {
  return (
    <Card variant="glass" className="flex h-full min-h-[132px] flex-col justify-between" data-testid={testId} data-ui={`${testId}-card`}>
      <div className="flex items-start justify-between gap-3" data-ui={`${testId}-head`}>
        <span className="text-xs font-medium uppercase tracking-wide text-[var(--bo-muted)]" data-ui={`${testId}-label`}>{label}</span>
        <span className="rounded-lg bg-[var(--bo-bg-selected)] p-2 text-[var(--bo-accent)]" aria-hidden="true" data-ui={`${testId}-icon-wrap`}>
          <Icon size={17} strokeWidth={1.8} data-ui={`${testId}-icon`} />
        </span>
      </div>
      <div data-ui={`${testId}-body`}>
        <div className="mt-3 text-2xl font-semibold tracking-tight" data-testid={`${testId}-value`} data-ui={`${testId}-value`}>{value}</div>
        <p className="mt-1 text-xs leading-5 text-[var(--bo-muted)]" data-ui={`${testId}-detail`}>{detail}</p>
      </div>
    </Card>
  );
}

type MetricRow = { key: string; label: string; metric: SearchMetric };

function MetricTable({ title, description, icon: Icon, rows, testId }: { title: string; description: string; icon: LucideIcon; rows: MetricRow[]; testId: string }) {
  return (
    <Card variant="glass" data-testid={testId} data-ui={`${testId}-panel`}>
      <div className="mb-4 flex items-start gap-3" data-ui={`${testId}-head`}>
        <span className="rounded-lg bg-[var(--bo-bg-selected)] p-2 text-[var(--bo-accent)]" aria-hidden="true" data-ui={`${testId}-icon-wrap`}>
          <Icon size={17} strokeWidth={1.8} data-ui={`${testId}-icon`} />
        </span>
        <div data-ui={`${testId}-heading`}>
          <h2 className="text-base font-semibold" data-ui={`${testId}-title`}>{title}</h2>
          <p className="mt-1 text-sm leading-6 text-[var(--bo-muted)]" data-ui={`${testId}-description`}>{description}</p>
        </div>
      </div>
      <div className="overflow-x-auto" data-ui={`${testId}-table-scroll`}>
        <table className="w-full min-w-[600px] border-collapse text-left text-sm" data-ui={`${testId}-table`}>
          <thead>
            <tr className="border-b border-[var(--bo-border)] text-xs uppercase tracking-wide text-[var(--bo-muted)]">
              <th className="px-3 py-3 font-medium" scope="col">Segmento</th>
              <th className="px-3 py-3 text-right font-medium" scope="col">Filas</th>
              <th className="px-3 py-3 text-right font-medium" scope="col">Clics</th>
              <th className="px-3 py-3 text-right font-medium" scope="col">Impresiones</th>
              <th className="px-3 py-3 text-right font-medium" scope="col">CTR</th>
              <th className="px-3 py-3 text-right font-medium" scope="col">Posición media</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ key, label, metric }) => (
              <tr className="border-b border-[var(--bo-border)] last:border-b-0" key={key} data-ui={`${testId}-row-${key}`}>
                <th className="px-3 py-3 font-medium" scope="row">{label}</th>
                <td className="px-3 py-3 text-right tabular-nums text-[var(--bo-muted)]">{NUMBER.format(metric.rows)}</td>
                <td className="px-3 py-3 text-right tabular-nums">{NUMBER.format(metric.clicks)}</td>
                <td className="px-3 py-3 text-right tabular-nums">{NUMBER.format(metric.impressions)}</td>
                <td className="px-3 py-3 text-right tabular-nums">{PERCENT.format(metric.ctr)}</td>
                <td className="px-3 py-3 text-right tabular-nums">{metric.averagePosition === null ? "Sin datos" : POSITION.format(metric.averagePosition)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

export type SearchConsoleDashboardProps = React.HTMLAttributes<HTMLElement>;

/** Private, aggregate-only snapshot. Raw Search Console queries are never shipped. */
export function SearchConsoleDashboard({ className, ...props }: SearchConsoleDashboardProps) {
  const period = `${formatDate(SEARCH_SNAPSHOT.startDate)} – ${formatDate(SEARCH_SNAPSHOT.endDate)}`;
  const intents = Object.entries(INTENT_LABELS).map(([key, label]) => ({
    key,
    label,
    metric: SEARCH_SNAPSHOT.intents[key as keyof typeof SEARCH_SNAPSHOT.intents],
  }));
  const devices = Object.entries(DEVICE_LABELS).map(([key, label]) => ({
    key,
    label,
    metric: SEARCH_SNAPSHOT.devices[key as keyof typeof SEARCH_SNAPSHOT.devices],
  }));

  return (
    <section
      className={["mx-auto flex w-full max-w-screen-2xl flex-col gap-4 px-0 pb-4 text-[var(--bo-text)] sm:gap-5 sm:px-6 sm:pb-6 xl:px-8 xl:pb-8", className].filter(Boolean).join(" ")}
      data-testid="search-console-dashboard"
      data-ui="search-console-dashboard"
      {...props}
    >
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between" data-ui="search-console-header">
        <div className="min-w-0" data-ui="search-console-heading">
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--bo-accent-2)]" data-ui="search-console-eyebrow">
            Informe privado · Google Search Console
          </p>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl" data-testid="search-console-title" data-ui="search-console-title">
            Demanda de búsqueda orgánica
          </h1>
          <p className="mt-1.5 max-w-2xl text-sm leading-6 text-[var(--bo-muted)] sm:mt-2" data-ui="search-console-description">
            Visibilidad y clics de Villa Carmen en la búsqueda web de Google durante seis meses.
          </p>
          <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--bo-faint)]" data-testid="search-console-period" data-ui="search-console-period">
            <CalendarDays size={14} aria-hidden="true" data-ui="search-console-period-icon" />
            <span>{period}</span><span aria-hidden="true">·</span><span>Exportado el {formatDate(SEARCH_SNAPSHOT.exportedAt)}</span>
          </p>
        </div>
        <Button variant="primary" className="inline-flex w-full items-center justify-center gap-2 sm:w-auto" onClick={downloadSearchConsoleCsv} data-testid="search-console-download" data-ui="search-console-download">
          <Download size={16} strokeWidth={1.8} aria-hidden="true" data-ui="search-console-download-icon" />
          Descargar CSV
        </Button>
      </header>

      <div className="rounded-xl border border-[var(--bo-border)] bg-[var(--bo-bg-selected)] px-4 py-3 text-sm leading-6 text-[var(--bo-muted)]" data-ui="search-console-scope">
        <strong className="font-semibold text-[var(--bo-text)]">Alcance:</strong> propiedad de Villa Carmen, búsqueda web y datos finales agregados por consulta, página y dispositivo. Es una instantánea histórica, no un feed en tiempo real.
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4" data-ui="search-console-kpis">
        <Kpi label="Clics" value={NUMBER.format(SEARCH_SNAPSHOT.total.clicks)} detail="Visitas desde resultados de Google" icon={MousePointerClick} testId="search-console-clicks" />
        <Kpi label="Impresiones" value={NUMBER.format(SEARCH_SNAPSHOT.total.impressions)} detail="Apariciones en resultados de búsqueda" icon={Eye} testId="search-console-impressions" />
        <Kpi label="CTR" value={PERCENT.format(SEARCH_SNAPSHOT.total.ctr)} detail="Clics divididos entre impresiones" icon={Search} testId="search-console-ctr" />
        <Kpi label="Posición media" value={POSITION.format(SEARCH_SNAPSHOT.total.averagePosition)} detail="Ponderada por impresiones" icon={ListFilter} testId="search-console-position" />
      </div>

      <div className="grid grid-cols-1 gap-4 2xl:grid-cols-2" data-ui="search-console-tables">
        <MetricTable
          title="Intención de búsqueda"
          description="Agrupación editorial de las consultas. Las categorías pueden solaparse: no deben sumarse para obtener el total."
          icon={ListFilter}
          rows={intents}
          testId="search-console-intents"
        />
        <MetricTable
          title="Dispositivos"
          description="Reparto del mismo informe por dispositivo. Estas filas sí componen el total agregado."
          icon={MonitorSmartphone}
          rows={devices}
          testId="search-console-devices"
        />
      </div>

      <Card variant="glass" data-testid="search-console-limitations" data-ui="search-console-limitations-panel">
        <div className="flex items-start gap-3" data-ui="search-console-limitations-head">
          <span className="rounded-lg bg-[var(--bo-bg-selected)] p-2 text-[var(--bo-accent)]" aria-hidden="true" data-ui="search-console-limitations-icon-wrap">
            <Info size={17} strokeWidth={1.8} data-ui="search-console-limitations-icon" />
          </span>
          <div data-ui="search-console-limitations-content">
            <h2 className="text-base font-semibold" data-ui="search-console-limitations-title">Cómo interpretar este informe</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-[var(--bo-muted)]" data-ui="search-console-limitations-list">
              <li>Solo contiene métricas agregadas de Villa Carmen; no representa la demanda de todos los restaurantes ni incluye consultas individuales.</li>
              <li>Una categoría sin filas significa que no apareció en esta exportación, no que no exista demanda.</li>
              <li>Los clics no son reservas: este informe no atribuye conversiones ni mide por sí solo el resultado de una campaña.</li>
              <li>La posición media está ponderada por impresiones. El CSV conserva los {SEARCH_SNAPSHOT.total.rows} registros de origen agrupados por intención y dispositivo.</li>
            </ul>
            <p className="mt-3 break-all text-xs text-[var(--bo-faint)]" data-ui="search-console-filename">Archivo: {SEARCH_CSV_FILENAME}</p>
          </div>
        </div>
      </Card>
    </section>
  );
}
