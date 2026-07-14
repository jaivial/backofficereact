import React, { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { usePageContext } from "vike-react/usePageContext";

import { createClient } from "../../../../api/client";
import type { ConfigFloor } from "../../../../api/types";
import { useErrorToast } from "../../../../ui/feedback/useErrorToast";
import { BookingEditor, type BookingEditorDraft } from "../functionalComponents/BookingEditor/BookingEditor";

type PageData = { date: string };
type CreatedBooking = {
  customerName: string;
  date: string;
  time: string;
  partySize: number;
  babyStrollers: number;
  highChairs: number;
  floor: string | null;
  tableNumber: string;
  groupMenu: { id: number; principales: Array<{ name: string; servings: number }> } | null;
  rice: Array<{ type: string; servings: number }>;
};

function todayISO(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default function Page() {
  const pageContext = usePageContext();
  const data = (pageContext.data ?? { date: todayISO() }) as PageData;
  const api = useMemo(() => createClient({ baseUrl: "" }), []);

  const [busy, setBusy] = useState(false);
  const [floors, setFloors] = useState<ConfigFloor[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [createdBooking, setCreatedBooking] = useState<CreatedBooking | null>(null);
  useErrorToast(error);

  useEffect(() => {
    let cancelled = false;
    api.config
      .getFloors(data.date)
      .then((res) => {
        if (cancelled || !res.success) return;
        setFloors(res.floors || []);
      })
      .catch(() => {
        if (cancelled) return;
        setFloors([]);
      });
    return () => {
      cancelled = true;
    };
  }, [api.config, data.date]);

  useEffect(() => {
    if (!createdBooking) return;
    const timeout = window.setTimeout(() => {
      window.location.href = `/app/reservas?date=${encodeURIComponent(createdBooking.date)}`;
    }, 5000);
    return () => window.clearTimeout(timeout);
  }, [createdBooking]);

  const initial = useMemo<BookingEditorDraft>(
    () => ({
      reservation_date: data.date,
      reservation_time: "13:30",
      party_size: 2,
      customer_name: "",
      contact_phone: "",
      contact_phone_country_code: "34",
      contact_email: "",
      table_number: "",
      babyStrollers: 0,
      highChairs: 0,
      preferred_floor_number: null,
      special_menu: false,
      menu_de_grupo_id: null,
      principales: [],
      arroz_enabled: false,
      arroz: [],
      commentary: "",
    }),
    [data.date],
  );

  const submit = useCallback(
    async (payload: any) => {
      setBusy(true);
      setError(null);
      try {
        const res = await api.reservas.create(payload);
        if (!res.success) {
          setError(res.message || "No se pudo crear la reserva");
          return;
        }
        const principales = Array.isArray(payload?.principales_json)
          ? payload.principales_json
              .map((row: any) => ({ name: String(row?.name || ""), servings: Number(row?.servings || 0) }))
              .filter((row: { name: string; servings: number }) => row.name && row.servings > 0)
          : [];
        const rice = Array.isArray(payload?.arroz_types)
          ? payload.arroz_types
              .map((type: unknown, index: number) => ({ type: String(type || ""), servings: Number(payload?.arroz_servings?.[index] || 0) }))
              .filter((row: { type: string; servings: number }) => row.type && row.servings > 0)
          : [];
        const preferredFloor = payload?.preferred_floor_number;
        const floorNumber = Number(preferredFloor);
        const floor = preferredFloor != null && Number.isFinite(floorNumber)
          ? floors.find((item) => item.floorNumber === floorNumber)?.name || `Planta ${floorNumber}`
          : null;
        setCreatedBooking({
          customerName: String(payload?.customer_name || ""),
          date: String(payload?.reservation_date || data.date),
          time: String(payload?.reservation_time || ""),
          partySize: Number(payload?.party_size || 0),
          babyStrollers: Number(payload?.babyStrollers || 0),
          highChairs: Number(payload?.highChairs || 0),
          floor,
          tableNumber: String(payload?.table_number || ""),
          groupMenu: payload?.special_menu ? { id: Number(payload?.menu_de_grupo_id || 0), principales } : null,
          rice,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Error creando reserva";
        setError(msg);
      } finally {
        setBusy(false);
      }
    },
    [api.reservas, data.date, floors],
  );

  return (
    <section aria-label="Añadir reserva" className="bo-reservaAddPage w-full max-w-[768px] mx-auto" data-testid="reservas-anadir-page">
      <BookingEditor api={api} initial={initial} busy={busy} submitLabel="Crear" onSubmit={submit} floors={floors} />
      {busy ? (
        <div className="bo-bookingSubmissionOverlay" role="status" aria-live="polite" data-slot="booking-create-loading-overlay">
          <div className="bo-bookingSubmissionLoading" data-slot="booking-create-loading-content">
            <span className="bo-spinner bo-spinner--xl bo-spinner--lila" aria-hidden="true" data-slot="booking-create-loading-spinner" />
            <span className="bo-bookingSubmissionLoadingText" data-slot="booking-create-loading-text">Creando reserva…</span>
          </div>
        </div>
      ) : createdBooking ? (
        <div className="bo-bookingSubmissionOverlay" role="status" aria-live="polite" data-slot="booking-create-success-overlay">
          <div className="bo-bookingSubmissionSuccess" data-slot="booking-create-success-content">
            <CheckCircle2 className="bo-bookingSubmissionSuccessIcon" size={44} strokeWidth={1.8} aria-hidden="true" data-slot="booking-create-success-icon" />
            <div className="bo-bookingSubmissionSuccessTitle" data-slot="booking-create-success-title">Reserva creada</div>
            <div className="bo-bookingSubmissionSuccessName" data-slot="booking-create-success-name">{createdBooking.customerName}</div>
            <div className="bo-bookingSubmissionSuccessInfo" data-slot="booking-create-success-info">
              {createdBooking.date} · {createdBooking.time} · {createdBooking.partySize} comensales
            </div>
            <div className="bo-bookingSubmissionSuccessInfo" data-slot="booking-create-success-extras">
              Carros: {createdBooking.babyStrollers} · Tronas: {createdBooking.highChairs}
            </div>
            {createdBooking.floor ? <div className="bo-bookingSubmissionSuccessInfo" data-slot="booking-create-success-floor">Planta: {createdBooking.floor}</div> : null}
            {createdBooking.tableNumber ? <div className="bo-bookingSubmissionSuccessInfo" data-slot="booking-create-success-table">Mesa: {createdBooking.tableNumber}</div> : null}
            {createdBooking.groupMenu ? (
              <div className="bo-bookingSubmissionSuccessInfo" data-slot="booking-create-success-group-menu">
                Menú de grupo #{createdBooking.groupMenu.id}
                {createdBooking.groupMenu.principales.map((principal) => (
                  <div key={principal.name} data-slot="booking-create-success-principal">{principal.name} · {principal.servings} raciones</div>
                ))}
              </div>
            ) : null}
            {createdBooking.rice.map((rice) => (
              <div key={rice.type} className="bo-bookingSubmissionSuccessInfo" data-slot="booking-create-success-rice">
                Arroz: {rice.type} · {rice.servings} raciones
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
