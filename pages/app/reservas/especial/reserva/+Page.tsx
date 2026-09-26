import React, { useCallback, useEffect, useMemo, useState } from "react";
import { usePageContext } from "vike-react/usePageContext";
import { useAtomValue } from "jotai";

import { createClient } from "../../../../../api/client";
import { SPECIAL_DATE_PAYMENT_METHOD_LABELS, type Booking, type ConfigFloor } from "../../../../../api/types";
import { Breadcrumbs } from "../../../../../ui/nav/Breadcrumbs";
import { InlineAlert } from "../../../../../ui/feedback/InlineAlert";
import { Panel } from "../../../../../ui/shell/Panel";
import { useGlobalSocketTopic } from "../../../../../ui/realtime/GlobalSocketProvider";
import { sessionAtom } from "../../../../../state/atoms";
import { BookingDetailsPanel } from "../../functionalComponents/BookingDetailsPanel/BookingDetailsPanel";
import { SpecialBookingQrPanel } from "../../functionalComponents/SpecialBookingQr/SpecialBookingQrPanel";
import { useBookingQr } from "../../functionalComponents/SpecialBookingQr/useBookingQr";
import type { Data } from "./+data";

type BookingEvent = { type: string; restaurant_id: number; booking_id: number };

/**
 * Page opened by the special-date booking QR: full booking detail (live via
 * the global socket "booking" topic), QR and payment receipt preview.
 * Coordination id: special_booking_qr_v1
 */
export default function Page() {
  const { data } = usePageContext() as unknown as { data: Data };
  const session = useAtomValue(sessionAtom);
  const api = useMemo(() => createClient({ baseUrl: "" }), []);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [floors, setFloors] = useState<ConfigFloor[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [cancelled, setCancelled] = useState(false);
  const { info, error: qrError, reload: reloadQr } = useBookingQr(data.bookingId || null);

  const load = useCallback(async () => {
    if (!data.bookingId) { setError("QR sin reserva"); return; }
    const res = await api.reservas.get(data.bookingId);
    if (!res.success) { setError(res.message || "Reserva no encontrada"); setBooking(null); return; }
    setError(null);
    setBooking(res.booking);
    const list = await api.reservas.list({ date: res.booking.reservation_date, page: 1, count: 1 });
    if (list.success && Array.isArray(list.floors)) setFloors(list.floors);
  }, [api, data.bookingId]);

  useEffect(() => { void load(); }, [load]);

  const onBookingEvent = useCallback((payload: BookingEvent) => {
    if (!payload || payload.booking_id !== data.bookingId) return;
    console.info("[special_booking_qr_v1] live", payload.type, payload.booking_id);
    if (payload.type === "booking_cancelled") { setCancelled(true); return; }
    void load();
    void reloadQr();
  }, [data.bookingId, load, reloadQr]);
  useGlobalSocketTopic<BookingEvent>("booking", onBookingEvent);

  const date = booking?.reservation_date || data.date;
  const wrongRestaurant = Boolean(data.restaurantId && session?.activeRestaurantId && data.restaurantId !== session.activeRestaurantId);
  const special = booking?.special ?? null;

  return (
    <div className="bo-specialBookingPage" data-testid="special-booking-page">
      <Breadcrumbs items={[{ label: "Reservas", href: `/app/reservas?date=${encodeURIComponent(date)}` }, { label: `Reserva #${data.bookingId}` }]} />
      {wrongRestaurant ? <InlineAlert kind="info" title="Restaurante distinto" message="Este QR pertenece a otro restaurante. Cambia de restaurante para ver la reserva." testId="special-booking-wrong-restaurant" /> : null}
      {cancelled ? <InlineAlert kind="error" title="Reserva cancelada" message="Esta reserva se ha cancelado." testId="special-booking-cancelled" /> : null}
      {error ? <InlineAlert kind="error" title="Reserva" message={error} testId="special-booking-error" /> : null}
      {booking ? (
        <div className="bo-specialBookingGrid" data-slot="special-booking-grid">
          <BookingDetailsPanel booking={booking} floors={floors} />
          {special ? (
            <Panel title={`${special.is_prereserva ? "Prereserva" : "Reserva"} ${special.title}`} meta={special.adelanto_status === "paid" ? "Adelanto pagado" : "Adelanto pendiente"} data-testid="special-booking-summary">
              <ul className="bo-specialStatsList" data-testid="special-booking-menus">
                {special.menus.filter((m) => Number(m.count) > 0).map((m, i) => (
                  <li key={`${m.label}-${i}`} data-testid={`special-booking-menu-${i}`}>
                    <strong>{m.label}</strong> x{m.count}
                    {m.items && m.items.length > 0 ? (
                      <ul>
                        {groupNames(m.items.map((it) => it.name)).map(([name, n]) => (
                          <li key={name} data-testid={`special-booking-menu-${i}-dish-${name}`}>{name} x{n}</li>
                        ))}
                      </ul>
                    ) : null}
                  </li>
                ))}
              </ul>
              <p data-testid="special-booking-adelanto">
                Adelanto: <strong>{Number(special.adelanto_paid_total).toFixed(2)}€</strong> pagado de {Number(special.adelanto_required_total).toFixed(2)}€
                {special.adelanto_by_method.filter((m) => m.paid > 0).map((m) => ` · ${SPECIAL_DATE_PAYMENT_METHOD_LABELS[m.method] || m.method} ${Number(m.paid).toFixed(2)}€`).join("")}
              </p>
            </Panel>
          ) : null}
          <Panel title="QR y comprobante" data-testid="special-booking-qr-panel">
            <SpecialBookingQrPanel bookingId={booking.id} info={info} error={qrError} testId="special-booking-qr" />
          </Panel>
        </div>
      ) : null}
    </div>
  );
}

function groupNames(names: string[]): [string, number][] {
  const map = new Map<string, number>();
  for (const n of names) if (n) map.set(n, (map.get(n) ?? 0) + 1);
  return Array.from(map.entries());
}
