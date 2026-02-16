import React, { useCallback, useMemo, useState } from "react";
import { useAtomValue } from "jotai";
import { usePageContext } from "vike-react/usePageContext";
import { Download, FileText, Filter, Pencil, XCircle } from "lucide-react";

import { createClient } from "../../../api/client";
import type { Booking, CalendarDay, ConfigDailyLimit, DashboardMetrics } from "../../../api/types";
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
import { Modal } from "../../../ui/overlays/Modal";
import { BookingEditor, type BookingEditorDraft } from "./_components/BookingEditor";
import { arrozRowsFromBooking, principalesRowsFromBooking } from "./_components/bookingDraft";

type PageData = {
  date: string;
  bookings: Booking[];
  total_count: number;
  page: number;
  count: number;
  calendarDays: CalendarDay[];
  dailyLimit: ConfigDailyLimit | null;
  metrics: DashboardMetrics | null;
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
  return String(v || "").trim();
}

export default function Page() {
  const pageContext = usePageContext();
  const data = pageContext.data as PageData;
  const session = useAtomValue(sessionAtom);
  const api = useMemo(() => createClient({ baseUrl: "" }), []);
  const { pushToast } = useToasts();

  const [date, setDate] = useState(data.date);
  const [view, setView] = useState(() => parseYearMonth(data.date));
  const [calendarDays, setCalendarDays] = useState<CalendarDay[]>(data.calendarDays || []);

  const [dailyLimit, setDailyLimit] = useState<ConfigDailyLimit | null>(data.dailyLimit);
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(data.metrics);

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

  const [rows, setRows] = useState<Booking[]>(data.bookings || []);
  const [totalCount, setTotalCount] = useState<number>(data.total_count || 0);

  const [confirm, setConfirm] = useState<{ open: boolean; booking: Booking | null }>({ open: false, booking: null });

  const [details, setDetails] = useState<{ open: boolean; booking: Booking | null }>({ open: false, booking: null });

  const [edit, setEdit] = useState<{ open: boolean; booking: Booking | null }>({ open: false, booking: null });

  const totalPages = Math.max(1, Math.ceil(totalCount / Math.max(1, count)));
  const showPagerBtns = totalPages > 1;

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
        const [d0, d1] = await Promise.all([api.config.getDailyLimit(d), api.dashboard.getMetrics(d)]);
        if (d0.success) setDailyLimit(d0 as any);
        if (d1.success) setMetrics((d1 as any).metrics || null);
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
        setRows(res.bookings);
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
      syncURLDate(d);

      const nextView = parseYearMonth(d);
      const changedMonth = nextView.year !== view.year || nextView.month !== view.month;
      if (changedMonth) {
        setView(nextView);
        void loadMonth(nextView.year, nextView.month);
      }

      const nextPage = 1;
      setPage(nextPage);
      void loadBookings({ date: d, status, q, sort, dir, page: nextPage, count });
      void loadSummary(d);
    },
    [count, dir, loadBookings, loadMonth, loadSummary, q, sort, status, syncURLDate, view.month, view.year],
  );

  const onPrevMonth = useCallback(() => {
    const y = view.year;
    const m = view.month;
    const next = m === 1 ? { year: y - 1, month: 12 } : { year: y, month: m - 1 };
    setView(next);
    void loadMonth(next.year, next.month);
  }, [loadMonth, view.month, view.year]);

  const onNextMonth = useCallback(() => {
    const y = view.year;
    const m = view.month;
    const next = m === 12 ? { year: y + 1, month: 1 } : { year: y, month: m + 1 };
    setView(next);
    void loadMonth(next.year, next.month);
  }, [loadMonth, view.month, view.year]);

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
      await downloadReservationsPDF({ dateISO: date, bookings: res.bookings, logoUrl });
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
      table_number: b.table_number || "",
      babyStrollers: b.babyStrollers || 0,
      highChairs: b.highChairs || 0,
      special_menu: Boolean(b.special_menu),
      menu_de_grupo_id: b.menu_de_grupo_id || null,
      principales: principalesRowsFromBooking(b),
      arroz_enabled: !b.special_menu && arroz.length > 0,
      arroz,
      commentary: b.commentary || "",
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
        pushToast({ kind: "success", title: "Guardado", message: `Reserva #${b.id} actualizada` });
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
        setRows((prev) => prev.map((x) => (x.id === b.id ? { ...x, table_number: v || null } : x)));
        return true;
      } finally {
        setBusy(false);
      }
    },
    [api.reservas, pushToast],
  );

  const occPeople = dailyLimit?.totalPeople ?? 0;
  const occLimit = dailyLimit?.limit ?? 45;

  return (
    <section aria-label="Reservas">
      <div className="bo-reservasGrid">
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

        <div className="bo-reservasSide">
          <DonutOccupancy
            totalPeople={occPeople}
            limit={occLimit}
            totalBookings={metrics?.total}
            pending={metrics?.pending}
            confirmed={metrics?.confirmed}
          />

          <div className={`bo-filters${filtersOpen ? " is-open" : ""}`} aria-label="Filtros reservas">
            <div className="bo-filtersTop">
              <button
                className="bo-btn bo-btn--ghost bo-filtersToggle"
                type="button"
                onClick={() => setFiltersOpen((v) => !v)}
                aria-expanded={filtersOpen}
                aria-controls="bo-reservas-filters-body"
              >
                <Filter className="bo-ico" />
                Filtros
              </button>
              <button
                className="bo-btn bo-btn--primary bo-btn--download bo-btn--downloadTop"
                type="button"
                onClick={onDownloadPDF}
                disabled={pdfBusy || busy}
              >
                <Download className="bo-ico" /> Descargar
              </button>
            </div>
            <div id="bo-reservas-filters-body" className="bo-filtersBody">
              <div className="bo-filterRow bo-filterRow--selects">
                <Select value={status} onChange={onStatusChange} options={statusOptions} size="sm" ariaLabel="Estado" />
                <Select value={sort} onChange={onSortChange} options={sortOptions} size="sm" ariaLabel="Ordenar" />
                <Select value={dir} onChange={onDirChange} options={dirOptions} size="sm" ariaLabel="Dirección" />
                <Select
                  value={String(count)}
                  onChange={onCountChange}
                  options={pageSizeOptions}
                  size="sm"
                  ariaLabel="Tamaño página"
                />
              </div>
              <div className="bo-filterRow bo-filterRow--actions">
                <div className="bo-search">
                  <input
                    className="bo-input bo-input--sm"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Buscar por nombre"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") applyFilters();
                    }}
                  />
                  <button className="bo-btn bo-btn--ghost" type="button" onClick={applyFilters} disabled={busy}>
                    Buscar
                  </button>
                </div>
                <button
                  className="bo-btn bo-btn--primary bo-btn--download bo-btn--downloadInline"
                  type="button"
                  onClick={onDownloadPDF}
                  disabled={pdfBusy || busy}
                >
                  <Download className="bo-ico" /> Descargar
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bo-tableWrap" style={{ marginTop: 14 }}>
        <div className="bo-tableScroll">
          <table className="bo-table bo-table--reservas" aria-label="Tabla de reservas">
            <thead>
              <tr>
                <th className="col-added">Añadida</th>
                <th className="col-mesa">Mesa</th>
                <th className="col-time">Hora</th>
                <th className="col-client">Cliente</th>
                <th className="col-status">Estado</th>
                <th className="num">Pax</th>
                <th className="col-phone">Teléfono</th>
                <th className="col-rice">Arroz</th>
                <th className="col-comment">Comentario</th>
                <th className="end" />
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
                  <td colSpan={10} style={{ padding: 16, color: "var(--bo-muted)" }}>
                    {busy ? "Cargando..." : "No hay reservas para este filtro."}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className={`bo-pager${showPagerBtns ? "" : " is-solo"}`} aria-label="Paginación">
          <div className="bo-pagerText">
            Página {page} de {totalPages} · {totalCount} resultados
          </div>
          {showPagerBtns ? (
            <div className="bo-pagerBtns">
              <button className="bo-btn bo-btn--ghost" type="button" onClick={() => onPageChange(page - 1)} disabled={busy || page <= 1}>
                Anterior
              </button>
              <button className="bo-btn bo-btn--ghost" type="button" onClick={() => onPageChange(page + 1)} disabled={busy || page >= totalPages}>
                Siguiente
              </button>
            </div>
          ) : null}
        </div>
      </div>

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
        <div className="bo-modalHead">
          <div className="bo-modalTitle">Reserva completa</div>
          <button className="bo-modalX" type="button" onClick={closeDetails} aria-label="Close">
            ×
          </button>
        </div>
        <div className="bo-modalOutline" style={{ marginTop: 10 }}>
          {details.booking ? <BookingDetails booking={details.booking} /> : null}
        </div>
        <div className="bo-modalActions">
          <button className="bo-btn bo-btn--ghost" type="button" onClick={closeDetails}>
            Cerrar
          </button>
          {details.booking ? (
            <button
              className="bo-btn bo-btn--primary"
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
        <div className="bo-modalHead">
          <div className="bo-modalTitle">Editar reserva</div>
          <button className="bo-modalX" type="button" onClick={closeEdit} aria-label="Close">
            ×
          </button>
        </div>
        <div className="bo-modalOutline" style={{ marginTop: 10 }}>
          {edit.booking && editInitial ? (
            <BookingEditor api={api} initial={editInitial} busy={busy} submitLabel="Guardar" onSubmit={submitEdit} onCancel={closeEdit} />
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

  const [draftMesa, setDraftMesa] = useState<string>(booking.table_number || "");
  const [saving, setSaving] = useState(false);

  const save = useCallback(async () => {
    const next = normalizeTableNumber(draftMesa);
    const cur = normalizeTableNumber(booking.table_number || "");
    if (next === cur) return;
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
      <td className="col-added">{added}</td>
      <td
        className="col-mesa"
        onClick={(e) => {
          e.stopPropagation();
        }}
      >
        <input
          className="bo-input bo-input--xs bo-input--mesa"
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
      <td className="col-time">{formatHHMM(booking.reservation_time)}</td>
      <td className="col-client">{booking.customer_name}</td>
      <td className="col-status">{booking.status === "confirmed" ? "Confirmada" : "Pendiente"}</td>
      <td className="num">{booking.party_size}</td>
      <td className="col-phone">{formatPhone(booking.contact_phone_country_code, booking.contact_phone)}</td>
      <td className="col-rice">{arroz}</td>
      <td className="col-comment">{booking.commentary || ""}</td>
      <td
        className="end"
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

function BookingDetails({ booking }: { booking: Booking }) {
  const arroz = formatArrozShort(booking.arroz_type, booking.arroz_servings);
  const added = formatAddedDate(booking.added_date);
  const time = formatHHMM(booking.reservation_time);
  const phone = formatPhone(booking.contact_phone_country_code, booking.contact_phone);
  const status = statusLabel(booking.status);
  const badgeCls =
    booking.status === "confirmed"
      ? "bo-badge bo-badge--ok"
      : booking.status === "pending"
        ? "bo-badge bo-badge--warn"
        : "bo-badge";

  return (
    <div className="bo-stack" style={{ gap: 12 }}>
      <div className="bo-panel">
        <div className="bo-panelHead">
          <div className="bo-panelTitle">{booking.customer_name || "Reserva"}</div>
          <div className="bo-panelMeta">{booking.reservation_date}</div>
        </div>
        <div className="bo-panelBody" style={{ display: "grid", gap: 12 }}>
          <div className="bo-bookingKey" aria-label="Hora y personas">
            <div>
              <div className="bo-bookingKeyLabel">Hora</div>
              <div className="bo-bookingKeyValue">{time || "—"}</div>
            </div>
            <div>
              <div className="bo-bookingKeyLabel">Personas</div>
              <div className="bo-bookingKeyValue">{booking.party_size} pax</div>
            </div>
          </div>

          <div className="bo-kvGrid" aria-label="Datos principales">
            <div className="bo-kv">
              <div className="bo-kvLabel">Estado</div>
              <div className="bo-kvValue">
                <span className={badgeCls}>{status}</span>
              </div>
            </div>
            <div className="bo-kv">
              <div className="bo-kvLabel">Mesa</div>
              <div className="bo-kvValue">{booking.table_number || "—"}</div>
            </div>
            <div className="bo-kv">
              <div className="bo-kvLabel">Añadida</div>
              <div className="bo-kvValue">{added || "—"}</div>
            </div>
            <div className="bo-kv">
              <div className="bo-kvLabel">Teléfono</div>
              <div className="bo-kvValue">{phone || "—"}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="bo-panel">
        <div className="bo-panelHead">
          <div className="bo-panelTitle">Detalles</div>
          <div className="bo-panelMeta">{booking.special_menu ? "Menú de grupo" : "Reserva"}</div>
        </div>
        <div className="bo-panelBody">
          <div className="bo-kvGrid">
            <div className="bo-kv bo-kv--wide">
              <div className="bo-kvLabel">Email</div>
              <div className="bo-kvValue bo-kvValue--wrap">{booking.contact_email || "—"}</div>
            </div>
            <div className="bo-kv">
              <div className="bo-kvLabel">Carros</div>
              <div className="bo-kvValue">{typeof booking.babyStrollers === "number" ? String(booking.babyStrollers) : "—"}</div>
            </div>
            <div className="bo-kv">
              <div className="bo-kvLabel">Tronas</div>
              <div className="bo-kvValue">{typeof booking.highChairs === "number" ? String(booking.highChairs) : "—"}</div>
            </div>
            <div className="bo-kv bo-kv--wide">
              <div className="bo-kvLabel">Arroz</div>
              <div className="bo-kvValue">{arroz || "—"}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="bo-panel">
        <div className="bo-panelHead">
          <div className="bo-panelTitle">Comentario</div>
          <div className="bo-panelMeta">Opcional</div>
        </div>
        <div className="bo-panelBody" style={{ whiteSpace: "pre-line" }}>
          {booking.commentary ? booking.commentary : <span className="bo-mutedText">—</span>}
        </div>
      </div>
    </div>
  );
}
