import React, { useCallback, useEffect, useMemo, useState } from "react";
import { usePageContext } from "vike-react/usePageContext";

import { createClient } from "../../../../api/client";
import type { ConfigFloor } from "../../../../api/types";
import { useErrorToast } from "../../../../ui/feedback/useErrorToast";
import { useToasts } from "../../../../ui/feedback/useToasts";
import { BookingEditor, type BookingEditorDraft } from "../_components/BookingEditor";

type PageData = { date: string };

export default function Page() {
  const pageContext = usePageContext();
  const data = pageContext.data as PageData;
  const api = useMemo(() => createClient({ baseUrl: "" }), []);
  const { pushToast } = useToasts();

  const [busy, setBusy] = useState(false);
  const [floors, setFloors] = useState<ConfigFloor[]>([]);
  const [error, setError] = useState<string | null>(null);
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
        const d = payload?.reservation_date || data.date;
        pushToast({ kind: "success", title: "Creada", message: "Reserva creada" });
        window.location.href = `/app/reservas?date=${encodeURIComponent(String(d))}`;
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Error creando reserva";
        setError(msg);
      } finally {
        setBusy(false);
      }
    },
    [api.reservas, data.date, pushToast],
  );

  return (
    <section aria-label="Añadir reserva">
      <BookingEditor api={api} initial={initial} busy={busy} submitLabel="Crear" onSubmit={submit} floors={floors} />
    </section>
  );
}
