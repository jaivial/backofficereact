import React from "react";
import { usePageContext } from "vike-react/usePageContext";
import { useAtomValue } from "jotai";
import {
  CalendarDays,
  UtensilsCrossed,
  Clock,
  ClipboardList,
  Receipt,
  ChefHat,
  type LucideIcon,
} from "lucide-react";
import { sessionAtom } from "../../../../state/atoms";
import { sidebarItemsForRole } from "../../../../lib/navigation";
import { iconForSidebarItemKey } from "../../../../ui/nav/sectionIcons";
import type { DashboardMetrics } from "../../../../api/types";

function todayDisplay(): string {
  const d = new Date();
  return d.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });
}

function StatCard({ label, value, icon: Icon, accent = "primary" }: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  accent?: string;
}) {
  return (
    <div
      className={`bo-stat-card flex flex-col gap-2 p-4 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] bg-gradient-to-br from-[hsl(var(--card))] to-[hsl(var(--card))]/80`}
      data-ui="mobile-stat-card"
    >
      <div className="flex items-center justify-between" data-slot="backoffice-justify-between">
        <span className="text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wide" data-slot="backoffice-tracking-wide">{label}</span>
        <Icon size={18} className="text-[hsl(var(--primary))]" strokeWidth={1.8} aria-hidden="true" />
      </div>
      <div className="text-3xl font-bold text-[hsl(var(--foreground))]" data-ui="mobile-stat-value">{value}</div>
    </div>
  );
}

function QuickActionCard({ href, label, icon: Icon, color }: {
  href: string;
  label: string;
  icon: LucideIcon;
  color: string;
}) {
  return (
    <a
      href={href}
      className="flex flex-col items-center gap-2 p-4 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] text-center no-underline active:scale-95 transition-transform"
      data-ui="mobile-quick-action"
      data-role={label}
    >
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center"
        style={{ backgroundColor: color }}
        data-ui="mobile-quick-action-icon-wrap"
        aria-hidden="true"
      >
        <Icon size={24} className="text-white" strokeWidth={1.8} aria-hidden="true" />
      </div>
      <span className="text-sm font-medium text-[hsl(var(--foreground))]" data-ui="mobile-quick-action-label">{label}</span>
    </a>
  );
}

const ACTION_COLORS = [
  "hsl(262, 83%, 65%)", // purple
  "hsl(199, 89%, 48%)", // cyan
  "hsl(142, 71%, 45%)", // green
  "hsl(25, 95%, 53%)", // orange
];

const SECTION_ICONS: Record<string, LucideIcon> = {
  reservas: CalendarDays,
  menus: UtensilsCrossed,
  fichaje: Clock,
  horarios: ClipboardList,
  facturas: Receipt,
  comida: ChefHat,
};

export default function MobileHomePage() {
  const pageContext = usePageContext();
  const session = useAtomValue(sessionAtom);
  const data = (pageContext.data ?? { metrics: null }) as { metrics: DashboardMetrics | null };
  const metrics = data.metrics;

  const items = React.useMemo(() => {
    if (!session) return [];
    return sidebarItemsForRole(
      session.user.role,
      session.user.sectionAccess,
      session.user.roleImportance,
      session.user.appVersion,
    );
  }, [session]);

  const firstName = React.useMemo(() => {
    const name = session?.user.name ?? "";
    const raw = String(name).trim();
    if (!raw) return "equipo";
    return raw.split(/\s+/)[0];
  }, [session?.user.name]);

  if (!session) return null;

  return (
    <div className="flex flex-col gap-6 p-4" data-ui="mobile-home">
      {/* Header */}
      <header className="pt-2" data-ui="mobile-home-header">
        <p className="text-sm text-[hsl(var(--muted-foreground))]" data-ui="mobile-home-date">{todayDisplay()}</p>
        <h1 className="text-2xl font-bold text-[hsl(var(--foreground))] mt-0.5" data-ui="mobile-home-title">
          Hola, <span data-ui="mobile-home-name">{firstName}</span>
        </h1>
      </header>

      {/* Metrics (if available) */}
      {metrics && (
        <section aria-label="Metricas de hoy" data-ui="mobile-home-metrics">
          <h2 className="text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider mb-3" data-ui="mobile-home-metrics-title">Hoy</h2>
          <div className="grid grid-cols-2 gap-3" data-ui="mobile-home-metrics-grid">
            <StatCard label="Reservas" value={metrics.total ?? 0} icon={CalendarDays} />
            <StatCard label="Cubiertos" value={metrics.totalPeople ?? 0} icon={ChefHat} />
            <StatCard label="Confirmadas" value={metrics.confirmed ?? 0} icon={CalendarDays} />
            <StatCard label="Pendientes" value={metrics.pending ?? 0} icon={ClipboardList} />
          </div>
        </section>
      )}

      {/* Quick Actions */}
      <section aria-label="Acciones rapidas" data-ui="mobile-home-actions">
        <h2 className="text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider mb-3" data-ui="mobile-home-actions-title">Secciones</h2>
        <div className="grid grid-cols-3 gap-3" data-ui="mobile-home-actions-grid">
          {items.map((item, i) => {
            const Icon = SECTION_ICONS[item.key] ?? ClipboardList;
            const color = ACTION_COLORS[i % ACTION_COLORS.length];
            return (
              <QuickActionCard
                key={item.key}
                href={`/m${item.href}`}
                label={item.label}
                icon={Icon}
                color={color}
              />
            );
          })}
        </div>
      </section>
    </div>
  );
}
