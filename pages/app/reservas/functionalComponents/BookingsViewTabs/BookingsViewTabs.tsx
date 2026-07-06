import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useAtomValue } from "jotai";
import { Calendar, XCircle, History, RefreshCw, ExternalLink } from "lucide-react";
import { motion } from "motion/react";
import { createClient } from "../../../../../api/client";
import type { CancelledBookingItem, ModifiedBookingItem, Booking } from "../../../../../api/types";
import { sessionAtom } from "../../../../../state/atoms";
import { Tabs } from "../../../../../ui/nav/Tabs";
import type { TabItem } from "../../../../../ui/nav/Tabs";
import { ConfirmDialog } from "../../../../../ui/overlays/ConfirmDialog";
import { useToasts } from "../../../../../ui/feedback/useToasts";
import { cn } from "../../../../../ui/shadcn/utils";
import { formatHHMM } from "../../../../../ui/lib/format";

// ─── Types ──────────────────────────────────────────────────────────────────

export type ViewTabId = "activas" | "canceladas" | "modificadas";

type TableItem = {
  rows: any[];
  label: string;
  emptyMsg: string;
};

// ─── Props ───────────────────────────────────────────────────────────────────

type Props = {
  date: string;
  activeTab: ViewTabId;
  onTabChange: (id: ViewTabId) => void;
  onReactivate: () => void;
  onNavigateDate: (d: string) => void;
  busy: boolean;
  reduceMotion: boolean;
};

// ─── Helper: table column configs ────────────────────────────────────────────

const CANCELLED_COLS = [
  { key: "cancellation_date", label: "Fecha cancelación" },
  { key: "cancelled_by_name", label: "Cancelado por" },
  { key: "customer_name", label: "Cliente" },
  { key: "party_size", label: "Pax" },
  { key: "reservation_time", label: "Hora", fmt: (v: string) => formatHHMM(v) },
  { key: "contact_phone", label: "Teléfono" },
  { key: "arroz_type", label: "Arroz" },
  { key: "babyStrollers", label: "Carros" },
  { key: "highChairs", label: "Tronas" },
];

const MODIFIED_COLS = [
  { key: "modification_date", label: "Fecha modificación" },
  { key: "modified_by_name", label: "Modificado por" },
  { key: "customer_name", label: "Cliente" },
  { key: "original_reservation_date", label: "Fecha original" },
  { key: "field_modified", label: "Campo", fmt: (v: string) => <FieldChip field={v} /> },
  { key: "old_value", label: "Valor anterior" },
  { key: "new_value", label: "Valor nuevo" },
];

function FieldChip({ field }: { field: string }) {
  const labels: Record<string, string> = {
    date: "Fecha", time: "Hora", party_size: "Pax", rice: "Arroz",
    strollers: "Carros", high_chairs: "Tronas", children: "Niños",
  };
  return (
    <span className="bo-badge bo-badge--sm" data-slot="field-chip">
      {labels[field] || field}
    </span>
  );
}

function isModifiedByDate(mods: ModifiedBookingItem[]): boolean {
  return mods.some((m) => m.field_modified === "date");
}
// ─── Fallback (error / empty / loading) ─────────────────────────────────────

function TabFallback({
  kind,
  title,
  message,
  retryLabel = "Reintentar",
  onRetry,
  icon,
}: {
  kind: "error" | "empty";
  title: string;
  message?: string;
  retryLabel?: string;
  onRetry?: () => void;
  icon?: React.ReactNode;
}) {
  const isError = kind === "error";
  return (
    <div
      className={cn("bo-alert", "bo-alert--glass", isError ? "bo-alert--error" : undefined)}
      role="status"
      aria-live="polite"
      data-slot={isError ? "tab-error" : "tab-empty-fallback"}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        {icon ? (
          <div
            aria-hidden="true"
            style={{ color: "var(--bo-muted)", flexShrink: 0, marginTop: 2 }}
          >
            {icon}
          </div>
        ) : null}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="bo-alertTitle" data-slot="fallback-title">{title}</div>
          {message ? (
            <div className="bo-alertMsg" data-slot="fallback-message" style={{ wordBreak: "break-word" }}>
              {message}
            </div>
          ) : null}
          {onRetry ? (
            <div className="bo-alertActions" style={{ marginTop: 12, display: "flex", gap: 8 }}>
              <button
                type="button"
                className="bo-btn bo-btn--sm bo-btn--primary"
                onClick={onRetry}
                data-slot="fallback-retry"
              >
                <RefreshCw size={14} strokeWidth={1.8} aria-hidden="true" />
                <span className="bo-btnText">{retryLabel}</span>
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}


function anyToString(v: any): string {
  if (v == null) return "";
  return String(v);
}

// ─── Sub-table (reused for each group) ───────────────────────────────────────

function TableGroup({ label, items, cols, date, onNavigateDate, onReactivate, groupKey, busy }: {
  label: string;
  items: any[];
  cols: { key: string; label: string; fmt?: (v: any) => React.ReactNode }[];
  date: string;
  onNavigateDate?: (d: string) => void;
  onReactivate?: (id: number) => void;
  groupKey: string;
  busy: boolean;
}) {
  if (!items.length) return null;

  return (
    <div className="bo-tableGroup" data-slot={`tab-group-${groupKey}`} style={{ marginBottom: 24 }}>
      <h3 className="bo-text-sm bo-text-muted" style={{ marginBottom: 8, fontWeight: 600 }} data-slot="tab-group-title">
        {label} ({items.length})
      </h3>
      <div className="bo-tableScroll" data-slot="tab-table-scroll">
        <table className="bo-table bo-table--reservas" aria-label={label} data-slot="tab-table">
          <thead data-slot="tab-thead">
            <tr data-slot="tab-tr">
              {cols.map((c) => (
                <th key={c.key} data-slot={`tab-th-${c.key}`}>{c.label}</th>
              ))}
              {onReactivate && <th className="end" data-slot="tab-th-actions">Acción</th>}
            </tr>
          </thead>
          <tbody data-slot="tab-tbody">
            {items.map((row: any, i: number) => (
              <tr key={row.id || i} data-slot="tab-row">
                {cols.map((c) => (
                  <td key={c.key} data-slot={`tab-td-${c.key}`}>
                    {c.fmt ? c.fmt(row[c.key]) : anyToString(row[c.key])}
                    {c.key === "new_value" && row.field_modified === "date" && onNavigateDate && (
                      <button
                        type="button"
                        className="bo-btn bo-btn--ghost bo-btn--xs"
                        onClick={() => onNavigateDate(row.new_value)}
                        aria-label={`Ir a ${row.new_value}`}
                        data-testid="tab-goto-new-date"
                        style={{ marginLeft: 8 }}
                      >
                        <ExternalLink size={14} strokeWidth={1.8} /> Ir
                      </button>
                    )}
                  </td>
                ))}
                {onReactivate && (
                  <td className="end" data-slot="tab-td-actions">
                    <button
                      type="button"
                      className="bo-btn bo-btn--ghost bo-btn--xs"
                      onClick={() => onReactivate(row.id)}
                      disabled={busy}
                      aria-label="Reactivar"
                      data-testid="tab-reactivate-btn"
                    >
                      <RefreshCw size={14} strokeWidth={1.8} /> Reactivar
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Cancelled Panel ─────────────────────────────────────────────────────────

function CancelledPanel({ date, onReactivate, onNavigateDate, busy, reduceMotion }: {
  date: string;
  onReactivate: () => void;
  onNavigateDate: (d: string) => void;
  busy: boolean;
  reduceMotion: boolean;
}) {
  const session = useAtomValue(sessionAtom);
  const api = useMemo(() => createClient({ baseUrl: "" }), []);
  const { pushToast } = useToasts();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [staff, setStaff] = useState<CancelledBookingItem[]>([]);
  const [customer, setCustomer] = useState<CancelledBookingItem[]>([]);
  const [whatsapp, setWhatsapp] = useState<CancelledBookingItem[]>([]);
  const [confirm, setConfirm] = useState<{ open: boolean; id: number }>({ open: false, id: 0 });

  const fetchData = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.reservas.cancelledByDate(date);
      if (!res.success) { setError(res.message || "Error"); return; }
      setStaff(res.staff ?? []);
      setCustomer(res.customer ?? []);
      setWhatsapp(res.whatsapp ?? []);
    } catch (e) { setError(e instanceof Error ? e.message : "Error"); }
    finally { setLoading(false); }
  }, [api, session, date]);

  useEffect(() => { void fetchData(); }, [fetchData]);

  const doReactivate = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.reservas.reactivateCancelled(confirm.id);
      if (!res.success) { pushToast({ kind: "error", title: "Error", message: res.message || "Error" }); return; }
      pushToast({ kind: "success", title: "Reactivada", message: "Reserva reactivada" });
      setConfirm({ open: false, id: 0 });
      onReactivate();
      void fetchData();
    } finally { setLoading(false); }
  }, [api, confirm.id, pushToast, onReactivate, fetchData]);

  const groups = [
    { label: "Cancelaciones hechas por personal", items: staff, key: "staff" },
    { label: "Cancelaciones por WhatsApp", items: whatsapp, key: "whatsapp" },
    { label: "Cancelaciones por cliente", items: customer, key: "customer" },
  ];

  if (error) {
    return (
      <TabFallback
        kind="error"
        title="No se pudieron cargar las cancelaciones"
        message={error}
        onRetry={fetchData}
        icon={<XCircle size={20} strokeWidth={1.8} />}
      />
    );
  }
  if (loading && !staff.length && !customer.length && !whatsapp.length) {
    return <div style={{ padding: 32, textAlign: "center", color: "var(--bo-muted)" }} data-slot="tab-loading">Cargando cancelaciones...</div>;
  }

  const hasAny = staff.length > 0 || customer.length > 0 || whatsapp.length > 0;

  return (
    <motion.div key="canceladas" initial={reduceMotion ? { opacity: 1 } : { opacity: 0 }} animate={{ opacity: 1 }} data-slot="canceladas-panel">
      {!hasAny && !loading ? (
        <div style={{ padding: 32, textAlign: "center", color: "var(--bo-muted)" }} data-slot="tab-empty">No hay cancelaciones para esta fecha.</div>
      ) : (
        groups.map((g) => (
          <TableGroup
            key={g.key}
            label={g.label}
            items={g.items}
            cols={CANCELLED_COLS}
            date={date}
            onNavigateDate={onNavigateDate}
            onReactivate={(id) => setConfirm({ open: true, id })}
            groupKey={g.key}
            busy={busy}
          />
        ))
      )}

      <ConfirmDialog
        open={confirm.open}
        title="Reactivar reserva"
        message="¿Reactivar esta reserva cancelada? Se restaurará como confirmada."
        confirmText="Reactivar"
        danger={false}
        onClose={() => setConfirm({ open: false, id: 0 })}
        onConfirm={doReactivate}
      />
    </motion.div>
  );
}

// ─── Modified Panel ──────────────────────────────────────────────────────────

function ModifiedPanel({ date, onNavigateDate, busy, reduceMotion }: {
  date: string;
  onNavigateDate: (d: string) => void;
  busy: boolean;
  reduceMotion: boolean;
}) {
  const session = useAtomValue(sessionAtom);
  const api = useMemo(() => createClient({ baseUrl: "" }), []);
  const { pushToast } = useToasts();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [staff, setStaff] = useState<ModifiedBookingItem[]>([]);
  const [customer, setCustomer] = useState<ModifiedBookingItem[]>([]);
  const [whatsapp, setWhatsapp] = useState<ModifiedBookingItem[]>([]);

  const fetchData = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.reservas.modifiedByDate(date);
      if (!res.success) { setError(res.message || "Error"); return; }
      setStaff(res.staff ?? []);
      setCustomer(res.customer ?? []);
      setWhatsapp(res.whatsapp ?? []);
    } catch (e) { setError(e instanceof Error ? e.message : "Error"); }
    finally { setLoading(false); }
  }, [api, session, date]);

  useEffect(() => { void fetchData(); }, [fetchData]);

  if (error) {
    return (
      <TabFallback
        kind="error"
        title="No se pudieron cargar las modificaciones"
        message={error}
        onRetry={fetchData}
        icon={<History size={20} strokeWidth={1.8} />}
      />
    );
  }
  if (loading && !staff.length && !customer.length && !whatsapp.length) {
    return <div style={{ padding: 32, textAlign: "center", color: "var(--bo-muted)" }} data-slot="tab-loading">Cargando modificaciones...</div>;
  }

  const hasAny = staff.length > 0 || customer.length > 0 || whatsapp.length > 0;

  return (
    <motion.div key="modificadas" initial={reduceMotion ? { opacity: 1 } : { opacity: 0 }} animate={{ opacity: 1 }} data-slot="modificadas-panel">
      {!hasAny && !loading ? (
        <div style={{ padding: 32, textAlign: "center", color: "var(--bo-muted)" }} data-slot="tab-empty">No hay modificaciones para esta fecha.</div>
      ) : (
        <>
          {staff.length > 0 && (
            <TableGroup label="Modificaciones hechas por personal" items={staff} cols={MODIFIED_COLS} date={date} onNavigateDate={onNavigateDate} groupKey="modified-staff" busy={busy} />
          )}
          {whatsapp.length > 0 && (
            <TableGroup label="Modificaciones por WhatsApp" items={whatsapp} cols={MODIFIED_COLS} date={date} onNavigateDate={onNavigateDate} groupKey="modified-whatsapp" busy={busy} />
          )}
          {customer.length > 0 && (
            <TableGroup label="Modificaciones por cliente" items={customer} cols={MODIFIED_COLS} date={date} onNavigateDate={onNavigateDate} groupKey="modified-customer" busy={busy} />
          )}
        </>
      )}
    </motion.div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export function BookingsViewTabs({ date, activeTab, onTabChange, onReactivate, onNavigateDate, busy, reduceMotion }: Props) {
  const tabItems: TabItem[] = [
    { id: "activas", label: "Activas", href: "#", icon: <Calendar size={16} strokeWidth={1.8} /> },
    { id: "canceladas", label: "Canceladas", href: "#", icon: <XCircle size={16} strokeWidth={1.8} /> },
    { id: "modificadas", label: "Modificadas", href: "#", icon: <History size={16} strokeWidth={1.8} /> },
  ];

  return (
    <div data-slot="bookings-view-tabs" data-testid="bookings-view-tabs" style={{ marginTop: 14 }}>
      <Tabs
        tabs={tabItems}
        activeId={activeTab}
        ariaLabel="Vista de reservas"
        className="bo-tabs--reservas flex flex-row rounded-xl w-fit my-0 mx-auto"
        mode="button"
        onNavigate={(_href, id) => onTabChange(id as ViewTabId)}
      />

      <motion.div layout style={{ marginTop: 16 }}>
        {activeTab === "canceladas" && (
          <CancelledPanel date={date} onReactivate={onReactivate} onNavigateDate={onNavigateDate} busy={busy} reduceMotion={reduceMotion} />
        )}
        {activeTab === "modificadas" && (
          <ModifiedPanel date={date} onNavigateDate={onNavigateDate} busy={busy} reduceMotion={reduceMotion} />
        )}
      </motion.div>
    </div>
  );
}
