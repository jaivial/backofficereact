import React, { useMemo, useState } from "react";
import { usePageContext } from "vike-react/usePageContext";
import { useAtomValue } from "jotai";
import {
  Users,
  Clock,
  Phone,
  ChevronRight,
  CalendarDays,
  CheckCircle2,
  XCircle,
  AlertCircle,
} from "lucide-react";
import { sessionAtom } from "../../../../state/atoms";
import type { Booking } from "../../../../api/types";
import { formatHHMM } from "../../../../ui/lib/format";

type PageData = {
  date: string;
  bookings: Booking[];
  error: string | null;
};

const STATUS_STYLES: Record<string, { bg: string; text: string; dot: string; label: string }> = {
  confirmed: { bg: "bg-emerald-500/10", text: "text-emerald-600 dark:text-emerald-400", dot: "bg-emerald-500", label: "Confirmada" },
  pending: { bg: "bg-amber-500/10", text: "text-amber-600 dark:text-amber-400", dot: "bg-amber-500", label: "Pendiente" },
  cancelled: { bg: "bg-red-500/10", text: "text-red-600 dark:text-red-400", dot: "bg-red-500", label: "Cancelada" },
  no_show: { bg: "bg-slate-500/10", text: "text-slate-600 dark:text-slate-400", dot: "bg-slate-500", label: "No-show" },
};

function BookingCard({ booking }: { booking: Booking }) {
  const statusStyle = STATUS_STYLES[booking.status ?? "pending"] ?? STATUS_STYLES.pending;
  const time = booking.reservation_time ?? "";
  const covers = booking.party_size ?? 0;
  const name = booking.customer_name ?? "Sin nombre";
  const phone = booking.contact_phone ?? "";

  return (
    <a
      href={`/m/app/reservas?date=${new Date().toISOString().split("T")[0]}&id=${booking.id}`}
      className="flex flex-col gap-2 p-4 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] no-underline active:scale-[0.99] transition-transform"
      data-ui="mobile-booking-card"
      data-role="booking-card"
      data-booking-id={booking.id}
    >
      {/* Top row: time + status */}
      <div className="flex items-center justify-between" data-slot="reservas-justify-between">
        <div className="flex items-center gap-1.5 text-[hsl(var(--foreground))] font-semibold" data-ui="mobile-booking-time">
          <Clock size={16} strokeWidth={1.8} aria-hidden="true" className="text-[hsl(var(--muted-foreground))]" />
          <span data-slot="reservas-ime">{formatHHMM(time)}</span>
        </div>
        <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${statusStyle.bg} ${statusStyle.text}`} data-ui="mobile-booking-status">
          <span className={`w-1.5 h-1.5 rounded-full ${statusStyle.dot}`} aria-hidden="true" data-slot="reservas-span" />
          {statusStyle.label}
        </span>
      </div>

      {/* Name + covers */}
      <div className="flex items-center justify-between" data-slot="reservas-justify-between">
        <h3 className="text-base font-bold text-[hsl(var(--foreground))]" data-ui="mobile-booking-name">{name}</h3>
        <div className="flex items-center gap-1 text-[hsl(var(--muted-foreground))]" data-ui="mobile-booking-covers">
          <Users size={14} strokeWidth={1.8} aria-hidden="true" />
          <span className="text-sm font-medium" data-slot="reservas-font-medium">{covers}</span>
        </div>
      </div>

      {/* Notes / phone */}
      {booking.commentary && (
        <p className="text-xs text-[hsl(var(--muted-foreground))] line-clamp-2" data-ui="mobile-booking-notes">{booking.commentary}</p>
      )}
      {phone && (
        <div className="flex items-center gap-1 text-xs text-[hsl(var(--muted-foreground))]" data-ui="mobile-booking-phone">
          <Phone size={12} strokeWidth={1.8} aria-hidden="true" />
          <span data-slot="reservas-one">{phone}</span>
        </div>
      )}
    </a>
  );
}

function StatusFilter({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const options = [
    { value: "all", label: "Todas" },
    { value: "confirmed", label: "Confirmadas" },
    { value: "pending", label: "Pendientes" },
  ];
  return (
    <div className="flex gap-2 overflow-x-auto pb-1" data-ui="mobile-status-filter" role="tablist" aria-label="Filtrar reservas">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={[
            "flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors",
            value === opt.value
              ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
              : "bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]",
          ].join(" ")}
          data-ui="mobile-status-filter-btn"
          data-role={opt.value}
          role="tab"
          aria-selected={value === opt.value}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export default function MobileReservasPage() {
  const pageContext = usePageContext();
  const session = useAtomValue(sessionAtom);
  const data = (pageContext.data ?? { date: "", bookings: [], error: null }) as PageData;
  const [statusFilter, setStatusFilter] = useState("all");

  const dateLabel = useMemo(() => {
    const d = data.date ? new Date(data.date + "T00:00:00") : new Date();
    return d.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });
  }, [data.date]);

  const filteredBookings = useMemo(() => {
    if (!data.bookings) return [];
    if (statusFilter === "all") return data.bookings;
    return data.bookings.filter((b) => b.status === statusFilter);
  }, [data.bookings, statusFilter]);

  if (!session) return null;

  return (
    <div className="flex flex-col gap-4 p-4" data-ui="mobile-reservas">
      {/* Header */}
      <header className="flex items-center justify-between pt-2" data-ui="mobile-reservas-header">
        <div data-slot="reservas-div">
          <h1 className="text-xl font-bold text-[hsl(var(--foreground))]" data-ui="mobile-reservas-title">Reservas</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))] capitalize" data-ui="mobile-reservas-date">{dateLabel}</p>
        </div>
        <a
          href={`/m/app/reservas?date=${data.date ?? new Date().toISOString().split("T")[0]}`}
          className="flex items-center gap-1 text-sm font-medium text-[hsl(var(--primary))] no-underline"
          data-ui="mobile-reservas-full-link"
        >
          Ver todo <ChevronRight size={16} strokeWidth={2} aria-hidden="true" />
        </a>
      </header>

      {/* Status filter */}
      <StatusFilter value={statusFilter} onChange={setStatusFilter}>

      {/* Booking cards */}
      {data.error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-sm" data-ui="mobile-reservas-error">
          {data.error}
        </div>
      )}

      <div className="flex flex-col gap-3" data-ui="mobile-booking-list" role="list" aria-label="Reservas">
        {filteredBookings.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center" data-ui="mobile-reservas-empty">
            <CalendarDays size={40} strokeWidth={1.5} className="text-[hsl(var(--muted-foreground))] mb-3" aria-hidden="true" />
            <p className="text-[hsl(var(--muted-foreground))] text-sm" data-slot="reservas-text-sm">No hay reservas{statusFilter !== "all" ? ` (${STATUS_STYLES[statusFilter]?.label ?? statusFilter})` : ""}</p>
          </div>
        ) : (
          filteredBookings.map((booking) => (
            <BookingCard key={booking.id} booking={booking}>
          ))
        )}
      </div>
    </div>
  );
}
