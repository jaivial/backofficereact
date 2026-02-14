import React, { useCallback, useMemo, useState } from "react";
import { useAtomValue } from "jotai";
import { usePageContext } from "vike-react/usePageContext";

import { createClient } from "../../../api/client";
import type { Booking } from "../../../api/types";
import { sessionAtom } from "../../../state/atoms";
import { DatePicker } from "../../../ui/inputs/DatePicker";
import { Select } from "../../../ui/inputs/Select";
import { DropdownMenu } from "../../../ui/inputs/DropdownMenu";
import { ConfirmDialog } from "../../../ui/overlays/ConfirmDialog";
import { InlineAlert } from "../../../ui/feedback/InlineAlert";
import { useToasts } from "../../../ui/feedback/useToasts";
import { formatArrozShort, formatHHMM } from "../../../ui/lib/format";

type PageData = {
  date: string;
  bookings: Booking[];
  total: number;
  error: string | null;
};

const statusOptions = [
  { value: "", label: "Todos" },
  { value: "pending", label: "Pendiente" },
  { value: "confirmed", label: "Confirmada" },
];

export default function Page() {
  const pageContext = usePageContext();
  const data = pageContext.data as PageData;
  const session = useAtomValue(sessionAtom);
  const api = useMemo(() => createClient({ baseUrl: "" }), []);
  const { pushToast } = useToasts();

  const [date, setDate] = useState(data.date);
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(data.error);
  const [rows, setRows] = useState<Booking[]>(data.bookings);

  const [confirm, setConfirm] = useState<{ open: boolean; booking: Booking | null }>({ open: false, booking: null });

  const load = useCallback(
    async (next: { date: string; status?: string; q?: string }) => {
      if (!session) return;
      setBusy(true);
      setError(null);
      try {
        const res = await api.reservas.list({ date: next.date, status: next.status, q: next.q, limit: 50, offset: 0 });
        if (!res.success) {
          setError(res.message || "Error cargando reservas");
          return;
        }
        setRows(res.bookings);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error cargando reservas");
      } finally {
        setBusy(false);
      }
    },
    [api, session],
  );

  const onDateChange = useCallback(
    (d: string) => {
      setDate(d);
      const url = new URL(window.location.href);
      url.searchParams.set("date", d);
      window.history.replaceState(null, "", url.toString());
      void load({ date: d, status, q });
    },
    [load, q, status],
  );

  const onStatusChange = useCallback(
    (v: string) => {
      setStatus(v);
      void load({ date, status: v || undefined, q: q || undefined });
    },
    [date, load, q],
  );

  const onSearch = useCallback(() => {
    void load({ date, status: status || undefined, q: q || undefined });
  }, [date, load, q, status]);

  const onCancel = useCallback((b: Booking) => setConfirm({ open: true, booking: b }), []);

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
      void load({ date, status: status || undefined, q: q || undefined });
    } finally {
      setBusy(false);
    }
  }, [api, confirm.booking, date, load, pushToast, q, status]);

  if (error) {
    return <InlineAlert kind="error" title="Error" message={error} />;
  }

  return (
    <section aria-label="Reservas">
      <div className="bo-toolbar">
        <div className="bo-toolbarLeft">
          <DatePicker value={date} onChange={onDateChange} />
          <Select value={status} onChange={onStatusChange} options={statusOptions} />
          <div className="bo-search">
            <input
              className="bo-input bo-input--sm"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar (nombre/telefono/email)"
            />
            <button className="bo-btn bo-btn--ghost" type="button" onClick={onSearch} disabled={busy}>
              Buscar
            </button>
          </div>
        </div>
        <div className="bo-toolbarRight">
          <div className="bo-mutedText">{busy ? "Actualizando..." : `${rows.length} reservas`}</div>
        </div>
      </div>

      <div className="bo-tableWrap">
        <table className="bo-table" aria-label="Tabla de reservas">
          <thead>
            <tr>
              <th>Hora</th>
              <th>Cliente</th>
              <th className="num">Pax</th>
              <th>Estado</th>
              <th>Telefono</th>
              <th>Arroz</th>
              <th className="end" />
            </tr>
          </thead>
          <tbody>
            {rows.map((b) => (
              <BookingRow key={b.id} booking={b} onCancel={onCancel} />
            ))}
          </tbody>
        </table>
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
    </section>
  );
}

const BookingRow = React.memo(function BookingRow({
  booking,
  onCancel,
}: {
  booking: Booking;
  onCancel: (b: Booking) => void;
}) {
  const arroz = useMemo(() => formatArrozShort(booking.arroz_type, booking.arroz_servings), [booking.arroz_servings, booking.arroz_type]);
  const time = useMemo(() => formatHHMM(booking.reservation_time), [booking.reservation_time]);
  return (
    <tr>
      <td>{time}</td>
      <td>{booking.customer_name}</td>
      <td className="num">{booking.party_size}</td>
      <td>{booking.status || ""}</td>
      <td>{booking.contact_phone || ""}</td>
      <td>{arroz}</td>
      <td className="end">
        <DropdownMenu
          label="Acciones"
          items={[
            { id: "cancel", label: "Cancelar", tone: "danger", onSelect: () => onCancel(booking) },
          ]}
        />
      </td>
    </tr>
  );
});

