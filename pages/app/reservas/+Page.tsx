import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useAtomValue } from "jotai";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { usePageContext } from "vike-react/usePageContext";
import { Download, FileText, Filter, Pencil, XCircle } from "lucide-react";

import { createClient } from "../../../api/client";
import type { Booking, CalendarDay, ConfigDailyLimit, ConfigDayStatus, ConfigFloor, DashboardMetrics } from "../../../api/types";
import { sessionAtom } from "../../../state/atoms";
import { Select } from "../../../ui/inputs/Select";
import { DropdownMenu } from "../../../ui/inputs/DropdownMenu";
import { ConfirmDialog } from "../../../ui/overlays/ConfirmDialog";
import { InlineAlert } from "../../../ui/feedback/InlineAlert";
import { useToasts } from "../../../ui/feedback/useToasts";
import { useErrorToast } from "../../../ui/feedback/useErrorToast";
import { formatArrozShort, formatHHMM, formatPhone } from "../../../ui/lib/format";
import { downloadReservationsPDF } from "../../../ui/lib/reservationsPdf";
import logoUrl from "../../../ui/assets/logopdf.webp";
import { MonthCalendar } from "../../../ui/widgets/MonthCalendar";
import { DonutOccupancy } from "../../../ui/widgets/DonutOccupancy";
import { ReservationDayPanel } from "../../../ui/widgets/ReservationDayPanel";
import { Modal } from "../../../ui/overlays/Modal";
import { BookingEditor, type BookingEditorDraft } from "./_components/BookingEditor";
import { arrozRowsFromBooking, principalesRowsFromBooking } from "./_components/bookingDraft";

type PageData = {
  date: string;
  bookings: Booking[];
  floors: ConfigFloor[];
  total_count: number;
  page: number;
  count: number;
  calendarDays: CalendarDay[];
  dailyLimit: ConfigDailyLimit | null;
  metrics: DashboardMetrics | null;
  day: ConfigDayStatus | null;
  error: string | null;
};

const statusOptions = [
  { value: "", label: "Todas" },
  { value: "pending", label: "Pendiente" },
  { value: "confirmed", label: "Confirmada" },
];

const sortOptions = [
  { value: "reservation_time", label: "Hora reserva" },
  { value: "added_date", label: "Añadida" },
];

const dirOptions = [
  { value: "asc", label: "Ascendente" },
  { value: "desc", label: "Descendente" },
];

const pageSizeOptions = [
  { value: "15", label: "15" },
  { value: "20", label: "20" },
  { value: "25", label: "25" },
];

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function todayISO(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function parseYearMonth(iso: string): { year: number; month: number } {
  const parts = String(iso).split("-").map((x) => Number(x));
  const year = Number.isFinite(parts[0]) ? parts[0] : new Date().getFullYear();
  const month = Number.isFinite(parts[1]) ? parts[1] : new Date().getMonth() + 1;
  return { year, month };
}

function formatAddedDate(ts: string | null | undefined): string {
  if (!ts) return "";
  const s = String(ts).trim();
  if (!s.includes(" ")) return s;
  const [d, t] = s.split(" ");
  const [y, m, dd] = d.split("-");
  const hhmm = (t || "").slice(0, 5);
  if (dd && m) return `${dd}/${m} ${hhmm}`;
  return s;
}

function normalizeTableNumber(v: string): string {
  const raw = String(v || "").trim();
  if (!raw) return "";
  return raw.replace(/^mesa\b[\s#:\-]*/i, "").trim();
}

function normalizeBookings(v: unknown): Booking[] {
  return Array.isArray(v) ? (v as Booking[]) : [];
}

export default function Page() {
  const pageContext = usePageContext();
  const data = (pageContext.data ?? {
    date: "",
    bookings: [],
    floors: [],
    total_count: 0,
    page: 1,
    count: 15,
    calendarDays: [],
    dailyLimit: null,
    metrics: null,
    day: null,
    error: null,
  }) as PageData;
  const session = useAtomValue(sessionAtom);
  const api = useMemo(() => createClient({ baseUrl: "" }), []);
  const { pushToast } = useToasts();
  const reduceMotion = useReducedMotion();

  const [date, setDate] = useState(data.date || todayISO());
  const [view, setView] = useState(() => parseYearMonth(data.date || todayISO()));
  const [calendarDays, setCalendarDays] = useState<CalendarDay[]>(data.calendarDays || []);

  const [dailyLimit, setDailyLimit] = useState<ConfigDailyLimit | null>(data.dailyLimit);
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(data.metrics);
  const [day, setDay] = useState<ConfigDayStatus | null>(data.day);

  const [status, setStatus] = useState("");
  const [sort, setSort] = useState<"reservation_time" | "added_date">("reservation_time");
  const [dir, setDir] = useState<"asc" | "desc">("asc");
  const [q, setQ] = useState("");

  const [page, setPage] = useState(data.page || 1);
  const [count, setCount] = useState(data.count || 15);

  const [busy, setBusy] = useState(false);
  const [monthBusy, setMonthBusy] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [error, setError] = useState<string | null>(data.error);
  useErrorToast(error);

  const [rows, setRows] = useState<Booking[]>(normalizeBookings(data.bookings));
  const [floors, setFloors] = useState<ConfigFloor[]>(data.floors || []);
  const [totalCount, setTotalCount] = useState<number>(data.total_count || 0);

  const [confirm, setConfirm] = useState<{ open: boolean; booking: Booking | null }>({ open: false, booking: null });

  const [details, setDetails] = useState<{ open: boolean; booking: Booking | null }>({ open: false, booking: null });

  const [edit, setEdit] = useState<{ open: boolean; booking: Booking | null }>({ open: false, booking: null });

  const totalPages = Math.max(1, Math.ceil(totalCount / Math.max(1, count)));
  const showPagerBtns = totalPages > 1;
  const isDayOpen = day?.isOpen !== false;
  const dayVisibilityTransition = reduceMotion ? { duration: 0 } : { duration: 0.3, ease: "easeInOut" as const };

  const loadMonth = useCallback(
    async (year: number, month: number) => {
      if (!session) return;
      setMonthBusy(true);
      try {
        const res = await api.calendar.getMonth({ year, month });
        if (!res.success) return;
        setCalendarDays((res as any).data || []);
      } catch {
        // ignore
      } finally {
        setMonthBusy(false);
      }
    },
    [api, session],
  );

  const loadSummary = useCallback(
    async (d: string) => {
      if (!session) return;
      try {
        const [d0, d1, d2] = await Promise.all([api.config.getDailyLimit(d), api.dashboard.getMetrics(d), api.config.getDay(d)]);
        if (d0.success) setDailyLimit(d0 as any);
        if (d1.success) setMetrics((d1 as any).metrics || null);
        if (d2.success) setDay(d2);
      } catch {
        // ignore
      }
    },
    [api, session],
  );

  const loadBookings = useCallback(
    async (next: { date: string; status: string; q: string; sort: "reservation_time" | "added_date"; dir: "asc" | "desc"; page: number; count: number }) => {
      if (!session) return;
      setBusy(true);
      setError(null);
      try {
        const res = await api.reservas.list({
          date: next.date,
          status: next.status || undefined,
          q: next.q || undefined,
          sort: next.sort,
          dir: next.dir,
          page: next.page,
          count: next.count,
        });
        if (!res.success) {
          setError(res.message || "Error cargando reservas");
          return;
        }
        setRows(normalizeBookings(res.bookings));
        setFloors(Array.isArray(res.floors) ? res.floors : []);
        setTotalCount(res.total_count || res.total || 0);
        setPage(res.page || next.page);
        setCount(res.count || next.count);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error cargando reservas");
      } finally {
        setBusy(false);
      }
    },
    [api, session],
  );

  const syncURLDate = useCallback((d: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set("date", d);
    window.history.replaceState(null, "", url.toString());
  }, []);

  const onSelectDate = useCallback(
    (d: string) => {
      setDate(d);
      setDay(null);
      syncURLDate(d);

      const nextView = parseYearMonth(d);
      setView((currentView) => {
        const changedMonth = nextView.year !== currentView.year || nextView.month !== currentView.month;
        if (changedMonth) {
          void loadMonth(nextView.year, nextView.month);
          return nextView;
        }
        return currentView;
      });

      const nextPage = 1;
      setPage(nextPage);
      void loadBookings({ date: d, status, q, sort, dir, page: nextPage, count });
      void loadSummary(d);
    },
    [count, dir, loadBookings, loadMonth, loadSummary, q, sort, status, syncURLDate],
  );

  const onPrevMonth = useCallback(() => {
    setView((currentView) => {
      const next =
        currentView.month === 1
          ? { year: currentView.year - 1, month: 12 }
          : { year: currentView.year, month: currentView.month - 1 };
      void loadMonth(next.year, next.month);
      return next;
    });
  }, [loadMonth]);

  const onNextMonth = useCallback(() => {
    setView((currentView) => {
      const next =
        currentView.month === 12
          ? { year: currentView.year + 1, month: 1 }
          : { year: currentView.year, month: currentView.month + 1 };
      void loadMonth(next.year, next.month);
      return next;
    });
  }, [loadMonth]);

  const applyFilters = useCallback(
    () => {
      const nextPage = 1;
      setPage(nextPage);
      void loadBookings({ date, status, q, sort, dir, page: nextPage, count });
    },
    [count, date, dir, loadBookings, q, sort, status],
  );

  const onStatusChange = useCallback(
    (v: string) => {
      setStatus(v);
      const nextPage = 1;
      setPage(nextPage);
      void loadBookings({ date, status: v, q, sort, dir, page: nextPage, count });
    },
    [count, date, dir, loadBookings, q, sort],
  );

  const onSortChange = useCallback(
    (v: string) => {
      const nextSort = (v === "added_date" ? "added_date" : "reservation_time") as "reservation_time" | "added_date";
      setSort(nextSort);
      const nextPage = 1;
      setPage(nextPage);
      void loadBookings({ date, status, q, sort: nextSort, dir, page: nextPage, count });
    },
    [count, date, dir, loadBookings, q, status],
  );

  const onDirChange = useCallback(
    (v: string) => {
      const nextDir = (v === "desc" ? "desc" : "asc") as "asc" | "desc";
      setDir(nextDir);
      const nextPage = 1;
      setPage(nextPage);
      void loadBookings({ date, status, q, sort, dir: nextDir, page: nextPage, count });
    },
    [count, date, loadBookings, q, sort, status],
  );

  const onCountChange = useCallback(
    (v: string) => {
      const nextCount = Number(v);
      const clamped = [15, 20, 25].includes(nextCount) ? nextCount : 15;
      setCount(clamped);
      const nextPage = 1;
      setPage(nextPage);
      void loadBookings({ date, status, q, sort, dir, page: nextPage, count: clamped });
    },
    [date, dir, loadBookings, q, sort, status],
  );

  const onPageChange = useCallback(
    (nextPage: number) => {
      const p = Math.max(1, Math.min(totalPages, nextPage));
      setPage(p);
      void loadBookings({ date, status, q, sort, dir, page: p, count });
    },
    [count, date, dir, loadBookings, q, sort, status, totalPages],
  );

  const onDownloadPDF = useCallback(async () => {
    if (!session) return;
    setPdfBusy(true);
    try {
      pushToast({ kind: "info", title: "PDF", message: "Generando..." });
      const res = await api.reservas.exportDay(date);
      if (!res.success) {
        pushToast({ kind: "error", title: "Error", message: res.message || "No se pudo exportar" });
        return;
      }
      await downloadReservationsPDF({ dateISO: date, bookings: normalizeBookings(res.bookings), logoUrl });
    } catch (e) {
      pushToast({ kind: "error", title: "Error", message: e instanceof Error ? e.message : "Error generando PDF" });
    } finally {
      setPdfBusy(false);
    }
  }, [api.reservas, date, pushToast, session]);

  const onCancel = useCallback((b: Booking) => setConfirm({ open: true, booking: b }), []);

  const openDetails = useCallback((b: Booking) => setDetails({ open: true, booking: b }), []);
  const closeDetails = useCallback(() => setDetails({ open: false, booking: null }), []);

  const doCancel = useCallback(async () => {
    const b = confirm.booking;
    if (!b) return;
    setBusy(true);
    try {
      const res = await api.reservas.cancel(b.id);
      if (!res.success) {
        pushToast({ kind: "error", title: "Error", message: res.message || "No se pudo cancelar" });
        return;
      }
      pushToast({ kind: "success", title: "Cancelada", message: `Reserva #${b.id} cancelada` });
      setConfirm({ open: false, booking: null });
      void loadBookings({ date, status, q, sort, dir, page, count });
      void loadSummary(date);
    } finally {
      setBusy(false);
    }
  }, [api.reservas, confirm.booking, count, date, dir, loadBookings, loadSummary, page, pushToast, q, sort, status]);

  const openEdit = useCallback(
    (b: Booking) => {
      setEdit({ open: true, booking: b });
    },
    [],
  );

  const closeEdit = useCallback(() => {
    setEdit({ open: false, booking: null });
  }, []);

  useEffect(() => {
    if (day?.isOpen !== false) return;
    setConfirm({ open: false, booking: null });
    setDetails({ open: false, booking: null });
    setEdit({ open: false, booking: null });
    setFiltersOpen(false);
  }, [day?.isOpen]);

  const editInitial = useMemo<BookingEditorDraft | null>(() => {
    const b = edit.booking;
    if (!b) return null;
    const arroz = arrozRowsFromBooking(b);
    return {
      reservation_date: b.reservation_date,
      reservation_time: formatHHMM(b.reservation_time),
      party_size: b.party_size,
      customer_name: b.customer_name,
      contact_phone: b.contact_phone || "",
      contact_phone_country_code: b.contact_phone_country_code || "34",
      contact_email: b.contact_email || "",
      table_number: normalizeTableNumber(b.table_number || ""),
      babyStrollers: b.babyStrollers || 0,
      highChairs: b.highChairs || 0,
      special_menu: Boolean(b.special_menu),
      menu_de_grupo_id: b.menu_de_grupo_id || null,
      principales: principalesRowsFromBooking(b),
      arroz_enabled: !b.special_menu && arroz.length > 0,
      arroz,
      commentary: b.commentary || "",
      preferred_floor_number: typeof b.preferred_floor_number === "number" ? b.preferred_floor_number : null,
    };
  }, [edit.booking]);

  const submitEdit = useCallback(
    async (payload: any) => {
      const b = edit.booking;
      if (!b) return;
      setBusy(true);
      try {
        const res = await api.reservas.patch(b.id, payload);
        if (!res.success) {
          pushToast({ kind: "error", title: "Error", message: res.message || "No se pudo guardar" });
          return;
        }
        pushToast({ kind: "success", title: "Guardado", message: "Reserva actualizada" });
        closeEdit();
        void loadBookings({ date, status, q, sort, dir, page, count });
        void loadSummary(date);
      } finally {
        setBusy(false);
      }
    },
    [api.reservas, closeEdit, count, date, dir, edit.booking, loadBookings, loadSummary, page, pushToast, q, sort, status],
  );

  const saveTableNumber = useCallback(
    async (b: Booking, value: string) => {
      const v = normalizeTableNumber(value);
      setBusy(true);
      try {
        const res = await api.reservas.patch(b.id, { table_number: v });
        if (!res.success) {
          pushToast({ kind: "error", title: "Error", message: res.message || "No se pudo guardar mesa" });
          return false;
        }
        // Optimistic update for the row.
        setRows((prev) => normalizeBookings(prev).map((x) => (x.id === b.id ? { ...x, table_number: v || null } : x)));
        return true;
      } finally {
        setBusy(false);
      }
    },
    [api.reservas, pushToast],
  );

  const openDay = useCallback(async () => {
    if (day?.isOpen) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api.config.setDay(date, true);
      if (!res.success) {
        pushToast({ kind: "error", title: "Error", message: res.message || "No se pudo abrir el día" });
        return;
      }
      setDay(res);
      pushToast({ kind: "success", title: "Guardado", message: "Día abierto" });
      await Promise.all([
        loadBookings({ date, status, q, sort, dir, page, count }),
        loadSummary(date),
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo abrir el día");
    } finally {
      setBusy(false);
    }
  }, [api.config, count, date, day?.isOpen, dir, loadBookings, loadSummary, page, pushToast, q, sort, status]);

  const occPeople = dailyLimit?.totalPeople ?? 0;
  const occLimit = dailyLimit?.limit ?? 45;

  return (
    <section aria-label="Reservas">
      <div className={`grid grid-gap-5${isDayOpen ? "" : " grid-cols-[320px]"}`} style={{ gridTemplateColumns: isDayOpen ? "320px 1fr" : "320px" }}>
        <MonthCalendar
          year={view.year}
          month={view.month}
          days={calendarDays}
          selectedDateISO={date}
          onSelectDate={onSelectDate}
          onPrevMonth={onPrevMonth}
          onNextMonth={onNextMonth}
          loading={monthBusy}
        />

        <AnimatePresence initial={false}>
          {isDayOpen ? (
            <motion.div
              key="reservas-side"
              className="flex flex-col gap-4 p-4"
              initial={reduceMotion ? { opacity: 1 } : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={reduceMotion ? { opacity: 1 } : { opacity: 0 }}
              transition={dayVisibilityTransition}
            >
              <DonutOccupancy
                totalPeople={occPeople}
                limit={occLimit}
                totalBookings={metrics?.total}
                pending={metrics?.pending}
                confirmed={metrics?.confirmed}
              />

              <div className={`bo-card${filtersOpen ? "" : " collapsed"}`} aria-label="Filtros reservas">
                <div className="bo-filtersHeaderRow">
                  <button
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-white/[0.09] bg-bo-surface-2 text-bo-text text-sm font-bold transition-all hover:border-bo-primary hover:bg-bo-surface-2/80 disabled:opacity-55 disabled:cursor-not-allowed"
                    type="button"
                    onClick={() => setFiltersOpen((v) => !v)}
                    aria-expanded={filtersOpen}
                    aria-controls="bo-reservas-filters-body"
                  >
                    <Filter className="w-[18px] h-[18px]" />
                    Filtros
                  </button>
                  <button
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[rgba(185,168,255,0.30)] bg-[rgba(185,168,255,0.16)] text-bo-text text-sm font-bold transition-all hover:border-[rgba(185,168,255,0.40)] hover:bg-[rgba(185,168,255,0.24)] disabled:opacity-55 disabled:cursor-not-allowed mx-auto"
                    type="button"
                    onClick={onDownloadPDF}
                    disabled={pdfBusy || busy}
                  >
                    <Download className="w-[18px] h-[18px]" /> Descargar
                  </button>
                </div>
                <div id="bo-reservas-filters-body" className="bo-filtersBody">
                  <div className="bo-filtersRow">
                    <Select value={status} onChange={onStatusChange} options={statusOptions} size="sm" ariaLabel="Estado" />
                    <Select value={sort} onChange={onSortChange} options={sortOptions} size="sm" ariaLabel="Ordenar" />
                    <Select value={dir} onChange={onDirChange} options={dirOptions} size="sm" ariaLabel="Direccion" />
                    <Select
                      value={String(count)}
                      onChange={onCountChange}
                      options={pageSizeOptions}
                      size="sm"
                      ariaLabel="Tamano pagina"
                    />
                  </div>
                  <div className="bo-filtersRow bo-filtersRow--between">
                    <div className="flex items-center gap-2">
                      <input
                        className="h-[34px] rounded-bo-sm border border-bo-border bg-bo-surface-2 text-bo-text px-3 outline-none min-w-0 transition-colors"
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        placeholder="Buscar por nombre"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") applyFilters();
                        }}
                      />
                      <button className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-white/[0.09] bg-bo-surface-2 text-bo-text text-sm font-bold transition-all hover:border-bo-primary hover:bg-bo-surface-2/80 disabled:opacity-55 disabled:cursor-not-allowed" type="button" onClick={applyFilters} disabled={busy}>
                        Buscar
                      </button>
                    </div>
                    <button
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[rgba(185,168,255,0.30)] bg-[rgba(185,168,255,0.16)] text-bo-text text-sm font-bold transition-all hover:border-[rgba(185,168,255,0.40)] hover:bg-[rgba(185,168,255,0.24)] disabled:opacity-55 disabled:cursor-not-allowed mx-auto"
                      type="button"
                      onClick={onDownloadPDF}
                      disabled={pdfBusy || busy}
                    >
                      <Download className="w-[18px] h-[18px]" /> Descargar
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {isDayOpen ? (
          <motion.div
            key="reservas-open-content"
            initial={reduceMotion ? { opacity: 1 } : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={reduceMotion ? { opacity: 1 } : { opacity: 0 }}
            transition={dayVisibilityTransition}
          >
            <div className="rounded-[18px] bg-[linear-gradient(180deg,color-mix(in srgb,white,2%,transparent),color-mix(in srgb,black,12%,transparent))] border border-[var(--border)] overflow-hidden mt-[14px]">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-xs" aria-label="Tabla de reservas">
                  <thead>
                    <tr>
                      <th className="text-left font-semibold text-[var(--text-faint)] p-3 w-24">Añadida</th>
                      <th className="text-left font-semibold text-[var(--text-faint)] p-3 w-16 pl-2 pr-2">Mesa</th>
                      <th className="text-left font-semibold text-[var(--text-faint)] p-3 w-16">Hora</th>
                      <th className="text-left font-semibold text-[var(--text-faint)] p-3 min-w-[180px]">Cliente</th>
                      <th className="text-left font-semibold text-[var(--text-faint)] p-3 w-28">Estado</th>
                      <th className="text-right font-semibold text-[var(--text-faint)] p-3 w-16">Pax</th>
                      <th className="text-right font-semibold text-[var(--text-faint)] p-3 w-16">Niños</th>
                      <th className="text-left font-semibold text-[var(--text-faint)] p-3 w-32">Teléfono</th>
                      <th className="text-left font-semibold text-[var(--text-faint)] p-3 min-w-[210px]">Arroz</th>
                      <th className="text-left font-semibold text-[var(--text-faint)] p-3 min-w-[320px]">Comentario</th>
                      <th className="w-10" />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((b) => (
                      <BookingRow
                        key={b.id}
                        booking={b}
                        onCancel={onCancel}
                        onEdit={openEdit}
                        onOpenDetails={openDetails}
                        onSaveTable={saveTableNumber}
                        busy={busy}
                      />
                    ))}
                    {!rows.length ? (
                      <tr>
                        <td colSpan={11} className="p-4 text-bo-muted">
                          {busy ? "Cargando..." : "No hay reservas para este filtro."}
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>

              <div className={`flex items-center justify-between p-3${showPagerBtns ? "" : " justify-end"}`} aria-label="Paginación">
                <div className="text-xs text-[var(--text-muted)]">
                  Página {page} de {totalPages} · {totalCount} resultados
                </div>
                {showPagerBtns ? (
                  <div className="flex gap-2">
                    <button className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-white/[0.09] bg-bo-surface-2 text-bo-text text-sm font-bold transition-all hover:border-bo-primary hover:bg-bo-surface-2/80 disabled:opacity-55 disabled:cursor-not-allowed" type="button" onClick={() => onPageChange(page - 1)} disabled={busy || page <= 1}>
                      Anterior
                    </button>
                    <button className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-white/[0.09] bg-bo-surface-2 text-bo-text text-sm font-bold transition-all hover:border-bo-primary hover:bg-bo-surface-2/80 disabled:opacity-55 disabled:cursor-not-allowed" type="button" onClick={() => onPageChange(page + 1)} disabled={busy || page >= totalPages}>
                      Siguiente
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="reservas-closed-content"
            className="mt-[14px]"
            initial={reduceMotion ? { opacity: 1 } : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={reduceMotion ? { opacity: 1 } : { opacity: 0 }}
            transition={dayVisibilityTransition}
          >
            <ReservationDayPanel
              title="Día cerrado"
              meta={date}
              day={day ?? { date, isOpen: false }}
              busy={busy}
              onToggleDay={openDay}
              actionMode="openOnly"
              bodyClassName="p-3"
            />
          </motion.div>
        )}
      </AnimatePresence>

      <ConfirmDialog
        open={confirm.open}
        title="Cancelar reserva"
        message={confirm.booking ? `Cancelar la reserva #${confirm.booking.id} de ${confirm.booking.customer_name}?` : ""}
        confirmText="Cancelar"
        danger
        onClose={() => setConfirm({ open: false, booking: null })}
        onConfirm={doCancel}
      />

      <Modal open={details.open} title="Reserva completa" onClose={closeDetails} widthPx={820}>
        <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
          <div className="font-semibold text-sm">Reserva completa</div>
          <button className="w-8 h-8 rounded-lg border border-[var(--border)] bg-transparent text-[var(--text-muted)] cursor-pointer inline-flex items-center justify-center text-xl leading-none transition-all duration-150 hover:bg-bo-surface-3" type="button" onClick={closeDetails} aria-label="Close">
            ×
          </button>
        </div>
        <div className="mt-2 mt-[10px]">
          {details.booking ? <BookingDetails booking={details.booking} floors={floors} /> : null}
        </div>
        <div className="flex items-center justify-end gap-2 pt-4 border-t border-[var(--border)] mt-4">
          <button className="h-9 px-3 rounded-[12px] border border-[var(--border)] bg-transparent text-[var(--bo-text)] cursor-pointer font-semibold inline-flex items-center justify-center gap-2 transition-all duration-150 hover:bg-bo-surface-3" type="button" onClick={closeDetails}>
            Cerrar
          </button>
          {details.booking ? (
            <button
              className="h-9 px-3 rounded-[12px] border border-[color-mix(in srgb,var(--bo-accent)30%,transparent)] bg-[color-mix(in srgb,var(--bo-accent)16%,transparent)] text-[var(--bo-text)] cursor-pointer font-semibold inline-flex items-center justify-center gap-2 mx-auto transition-all duration-150 hover:bg-[color-mix(in srgb,var(--bo-accent)24%,transparent)]"
              type="button"
              onClick={() => {
                closeDetails();
                openEdit(details.booking!);
              }}
            >
              Editar
            </button>
          ) : null}
        </div>
      </Modal>

      <Modal open={edit.open} title="Editar reserva" onClose={closeEdit} widthPx={1040}>
        <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
          <div className="font-semibold text-sm">Editar reserva</div>
          <button className="w-8 h-8 rounded-lg border border-[var(--border)] bg-transparent text-[var(--text-muted)] cursor-pointer inline-flex items-center justify-center text-xl leading-none transition-all duration-150 hover:bg-bo-surface-3" type="button" onClick={closeEdit} aria-label="Close">
            ×
          </button>
        </div>
        <div className="mt-2 mt-[10px]">
          {edit.booking && editInitial ? (
            <BookingEditor
              api={api}
              initial={editInitial}
              busy={busy}
              submitLabel="Guardar"
              onSubmit={submitEdit}
              onCancel={closeEdit}
              stickyFooter
              floors={floors}
            />
          ) : (
            <InlineAlert kind="info" title="Cargando" message="Preparando editor..." />
          )}
        </div>
      </Modal>
    </section>
  );
}

const BookingRow = React.memo(function BookingRow({
  booking,
  onCancel,
  onEdit,
  onOpenDetails,
  onSaveTable,
  busy,
}: {
  booking: Booking;
  onCancel: (b: Booking) => void;
  onEdit: (b: Booking) => void;
  onOpenDetails: (b: Booking) => void;
  onSaveTable: (b: Booking, value: string) => Promise<boolean>;
  busy: boolean;
}) {
  const arroz = useMemo(() => formatArrozShort(booking.arroz_type, booking.arroz_servings), [booking.arroz_servings, booking.arroz_type]);
  const added = useMemo(() => formatAddedDate(booking.added_date), [booking.added_date]);

  const [draftMesa, setDraftMesa] = useState<string>(() => normalizeTableNumber(booking.table_number || ""));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraftMesa(normalizeTableNumber(booking.table_number || ""));
  }, [booking.table_number]);

  const save = useCallback(async () => {
    const next = normalizeTableNumber(draftMesa);
    const cur = normalizeTableNumber(booking.table_number || "");
    if (next === cur) {
      if (draftMesa !== next) setDraftMesa(next);
      return;
    }
    setSaving(true);
    try {
      const ok = await onSaveTable(booking, next);
      if (!ok) setDraftMesa(cur);
    } finally {
      setSaving(false);
    }
  }, [booking, draftMesa, onSaveTable]);

  return (
    <tr
      onClick={() => {
        if (typeof window === "undefined") return;
        // Row click only on mobile when the table collapses.
        if (!window.matchMedia("(max-width: 760px)").matches) return;
        onOpenDetails(booking);
      }}
    >
      <td className="text-left p-3 text-[var(--bo-text)] w-24">{added}</td>
      <td
        className="p-3 w-16 pl-2 pr-2"
        onClick={(e) => {
          e.stopPropagation();
        }}
      >
        <input
          className="h-[28px] min-w-[60px] rounded-[12px] border border-[var(--border)] bg-[var(--bo-surface-2)] text-[var(--bo-text)] px-2 outline-none text-xs w-16 text-center transition-colors duration-150 focus:border-[color-mix(in srgb,var(--bo-accent)38%,transparent)] focus:shadow-[0_0_0_3px_color-mix(in srgb,var(--bo-accent)10%,transparent)]"
          value={draftMesa}
          onChange={(e) => setDraftMesa(e.target.value)}
          onBlur={() => void save()}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              (e.target as HTMLInputElement).blur();
            }
          }}
          disabled={busy || saving}
          aria-label={`Mesa reserva #${booking.id}`}
        />
      </td>
      <td className="text-left p-3 text-[var(--bo-text)] w-16">{formatHHMM(booking.reservation_time)}</td>
      <td className="text-left p-3 text-[var(--bo-text)] min-w-[180px]">{booking.customer_name}</td>
      <td className="text-left p-3 text-[var(--bo-text)] w-28">{booking.status === "confirmed" ? "Confirmada" : "Pendiente"}</td>
      <td className="text-right p-3 text-[var(--bo-text)] w-16">{booking.party_size}</td>
      <td className="text-right p-3 text-[var(--bo-text)] w-16">{booking.children ?? 0}</td>
      <td className="text-left p-3 text-[var(--bo-text)] w-32">{formatPhone(booking.contact_phone_country_code, booking.contact_phone)}</td>
      <td className="text-left p-3 text-[var(--bo-text)] min-w-[210px]">{arroz}</td>
      <td className="text-left p-3 text-[var(--bo-text)] min-w-[320px] max-w-[360px] whitespace-pre-line">{booking.commentary || ""}</td>
      <td
        className="w-10 text-right"
        onClick={(e) => {
          e.stopPropagation();
        }}
      >
        <DropdownMenu
          label="Acciones"
          items={[
            { id: "details", label: "Reserva completa", onSelect: () => onOpenDetails(booking), icon: <FileText size={16} strokeWidth={1.8} /> },
            { id: "edit", label: "Editar", onSelect: () => onEdit(booking), icon: <Pencil size={16} strokeWidth={1.8} /> },
            { id: "cancel", label: "Cancelar", tone: "danger", onSelect: () => onCancel(booking), icon: <XCircle size={16} strokeWidth={1.8} /> },
          ]}
        />
      </td>
    </tr>
  );
});

function statusLabel(status: string | null | undefined): string {
  if (status === "confirmed") return "Confirmada";
  if (status === "pending") return "Pendiente";
  return status ? String(status) : "—";
}

function BookingDetails({ booking, floors }: { booking: Booking; floors: ConfigFloor[] }) {
  const arroz = formatArrozShort(booking.arroz_type, booking.arroz_servings);
  const added = formatAddedDate(booking.added_date);
  const time = formatHHMM(booking.reservation_time);
  const phone = formatPhone(booking.contact_phone_country_code, booking.contact_phone);
  const status = statusLabel(booking.status);
  const preferredFloorLabel = useMemo(() => {
    if (typeof booking.preferred_floor_number !== "number") return "Sin preferencia";
    const match = floors.find((floor) => floor.floorNumber === booking.preferred_floor_number);
    return match ? match.name : `Salón ${booking.preferred_floor_number}`;
  }, [booking.preferred_floor_number, floors]);
  const badgeCls =
    booking.status === "confirmed"
      ? "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--bo-color-success)]/20 text-[var(--text-success)]"
      : booking.status === "pending"
        ? "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--bo-color-warning)]/20 text-[var(--text-warning)]"
        : "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--bo-surface-2)] text-[var(--text-muted)]";

  return (
    <div className="flex flex-col gap-3 bo-bookingDetails">
      <div className="rounded-[18px] bg-[linear-gradient(180deg,color-mix(in srgb,white,3%,transparent),color-mix(in srgb,black,13%,transparent)),var(--bo-surface)] shadow-[0_10px_26px_rgba(0,0,0,0.36)]">
        <div className="flex items-end justify-between p-4 pb-2">
          <div className="font-semibold text-sm">{booking.customer_name || "Reserva"}</div>
          <div className="text-xs text-[var(--text-faint)]">{booking.reservation_date}</div>
        </div>
        <div className="p-4 pt-0 bo-bookingDetailsGrid">
          <div className="flex gap-4" aria-label="Hora y personas">
            <div>
              <div className="text-xs text-[var(--text-muted)]">Hora</div>
              <div className="text-sm">{time || "—"}</div>
            </div>
            <div>
              <div className="text-xs text-[var(--text-muted)]">Personas</div>
              <div className="text-sm">{booking.party_size} pax</div>
            </div>
          </div>

          <div className="grid grid-cols-2 grid-gap-3" aria-label="Datos principales">
            <div>
              <div className="text-xs text-[var(--text-muted)]">Estado</div>
              <div>
                <span className={badgeCls}>{status}</span>
              </div>
            </div>
            <div>
              <div className="text-xs text-[var(--text-muted)]">Mesa</div>
              <div className="text-sm">{normalizeTableNumber(booking.table_number || "") || "—"}</div>
            </div>
            <div>
              <div className="text-xs text-[var(--text-muted)]">Añadida</div>
              <div className="text-sm">{added || "—"}</div>
            </div>
            <div>
              <div className="text-xs text-[var(--text-muted)]">Teléfono</div>
              <div className="text-sm">{phone || "—"}</div>
            </div>
            <div>
              <div className="text-xs text-[var(--text-muted)]">Salón</div>
              <div className="text-sm">{preferredFloorLabel}</div>
            </div>
            <div>
              <div className="text-xs text-[var(--text-muted)]">Niños</div>
              <div className="text-sm">{String(booking.children ?? 0)}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-[18px] bg-[linear-gradient(180deg,color-mix(in srgb,white,3%,transparent),color-mix(in srgb,black,13%,transparent)),var(--bo-surface)] shadow-[0_10px_26px_rgba(0,0,0,0.36)]">
        <div className="flex items-end justify-between p-4 pb-2">
          <div className="font-semibold text-sm">Detalles</div>
          <div className="text-xs text-[var(--text-faint)]">{booking.special_menu ? "Menú de grupo" : "Reserva"}</div>
        </div>
        <div className="p-4 pt-0">
          <div className="grid grid-cols-2 grid-gap-3">
            <div className="col-span-2">
              <div className="text-xs text-[var(--text-muted)]">Email</div>
              <div className="text-sm break-words">{booking.contact_email || "—"}</div>
            </div>
            <div>
              <div className="text-xs text-[var(--text-muted)]">Carros</div>
              <div className="text-sm">{typeof booking.babyStrollers === "number" ? String(booking.babyStrollers) : "—"}</div>
            </div>
            <div>
              <div className="text-xs text-[var(--text-muted)]">Tronas</div>
              <div className="text-sm">{typeof booking.highChairs === "number" ? String(booking.highChairs) : "—"}</div>
            </div>
            <div className="col-span-2">
              <div className="text-xs text-[var(--text-muted)]">Arroz</div>
              <div className="text-sm">{arroz || "—"}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-[18px] bg-[linear-gradient(180deg,color-mix(in srgb,white,3%,transparent),color-mix(in srgb,black,13%,transparent)),var(--bo-surface)] shadow-[0_10px_26px_rgba(0,0,0,0.36)]">
        <div className="flex items-end justify-between p-4 pb-2">
          <div className="font-semibold text-sm">Comentario</div>
          <div className="text-xs text-[var(--text-faint)]">Opcional</div>
        </div>
        <div className="p-4 pt-0 bo-whiteSpacePre">
          {booking.commentary ? booking.commentary : <span className="text-xs text-[var(--text-muted)]">—</span>}
        </div>
      </div>
    </div>
  );
}
