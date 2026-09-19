import React, { useMemo, useState } from "react";
import { usePageContext } from "vike-react/usePageContext";
import { ArrowLeft, CalendarDays, Sparkles } from "lucide-react";

import type { MenuSelectorItem, SpecialDateListEntry, SpecialDateSettings } from "../../../../api/types";
import { InlineAlert } from "../../../../ui/feedback/InlineAlert";
import { createClient } from "../../../../api/client";
import { useMonthCalendar } from "../../../../ui/hooks/useMonthCalendar";
import { MonthCalendarDatePicker } from "../../../../ui/widgets/MonthCalendarDatePicker";
import { SpecialDateForm } from "./functionalComponents/SpecialDateForm";
import { SpecialDateCardList } from "./functionalComponents/SpecialDateCardList";

type PageData = {
  date: string;
  specialDate: SpecialDateSettings | null;
  availableMenus: MenuSelectorItem[];
  list: SpecialDateListEntry[];
  error: string | null;
};

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function Page() {
  const pageContext = usePageContext();
  const data = (pageContext.data ?? {
    date: "",
    specialDate: null,
    availableMenus: [],
    list: [],
    error: null,
  }) as PageData;

  if (data.error) {
    return <InlineAlert kind="error" title="Error" message={data.error} testId="especial-error-alert" />;
  }

  // Date is "active special" only when the server returned is_active=true (not
  // merely when the row exists — deactivated rows fall back to the conversion view).
  const isActiveSpecial = Boolean(data.specialDate?.is_active);

  // The picker uses the same MonthCalendarDatePicker as the "Añadir reserva"
  // and "Config" pages so the operator gets one calendar everywhere.
  const api = useMemo(() => createClient({ baseUrl: "" }), []);
  const [pickDate, setPickDate] = useState<string>(data.date || todayISO());
  const calendar = useMonthCalendar(api, pickDate);
  const goToToday = () => setPickDate(todayISO());

  return (
    <section data-ui="especial-page" data-testid="especial-page-section" aria-label="Reservas especiales">
      <div
        className="mx-auto mb-4 flex max-w-[768px] items-center justify-between gap-3"
        data-testid="especial-page-header"
      >
        <a
          href={`/app/reservas/config?date=${encodeURIComponent(data.date)}`}
          className="bo-btn bo-btn--ghost flex items-center gap-2"
          data-testid="especial-page-activate-cta"
        >
          <ArrowLeft size={16} strokeWidth={1.8} aria-hidden="true" />
          Ir a configuración
        </a>
        <div className="text-sm text-(--bo-muted)" data-testid="especial-page-date">
          {data.date}
        </div>
      </div>

      {isActiveSpecial ? (
        <SpecialDateForm
          date={data.date}
          initial={data.specialDate}
          availableMenus={data.availableMenus}
        />
      ) : (
        <div className="mx-auto grid max-w-[768px] gap-6" data-testid="especial-page-inactive">
          {/* #1 — Convert this date to special. Same calendar as Añadir /
              Config so the operator gets one picker everywhere. The
              "Fecha de hoy" button above the picker jumps to today. */}
          <section
            data-testid="especial-page-convert-section"
            aria-labelledby="especial-page-convert-title"
            className="bo-panel"
          >
            <div className="bo-panelBody grid gap-3" data-testid="especial-page-convert-body">
              <div className="flex items-center gap-2">
                <Sparkles size={18} strokeWidth={1.6} className="text-(--bo-accent, rgba(185,168,255,0.9))" aria-hidden="true" />
                <h2 id="especial-page-convert-title" className="text-base font-medium">
                  Añadir menú especial
                </h2>
              </div>
              <p className="text-sm text-(--bo-muted)" data-testid="especial-page-convert-desc">
                Elige la fecha que quieres activar como menú especial. Por defecto se usa la fecha
                seleccionada en el calendario (o hoy si no hay ninguna). Tras elegir, ve a la
                pestaña de Configuración de esa fecha y activa el interruptor.
              </p>
              <div className="flex justify-end" data-testid="especial-page-convert-today-row">
                <button
                  type="button"
                  onClick={goToToday}
                  className="bo-btn bo-btn--ghost flex items-center gap-1.5 transition-transform duration-150 active:scale-[0.96]"
                  data-testid="especial-page-convert-today-btn"
                >
                  <CalendarDays size={14} strokeWidth={1.8} aria-hidden="true" />
                  Fecha de hoy
                </button>
              </div>
              <div
                className="flex flex-col gap-3 sm:flex-row sm:items-end"
                data-testid="especial-page-convert-row"
              >
                <div className="grid flex-1 gap-1.5" data-testid="especial-page-convert-date-field">
                  <label
                    className="bo-label text-left"
                    data-testid="especial-page-convert-date-label"
                  >
                    Fecha
                  </label>
                  <MonthCalendarDatePicker
                    value={pickDate}
                    onChange={(iso: string) => setPickDate(iso)}
                    year={calendar.year}
                    month={calendar.month}
                    days={calendar.days}
                    onPrevMonth={calendar.onPrevMonth}
                    onNextMonth={calendar.onNextMonth}
                    loading={calendar.loading}
                    className="w-full"
                    data-testid="especial-page-convert-date-input"
                    data-ui="date-picker"
                  />
                </div>
                <a
                  href={`/app/reservas/config?date=${encodeURIComponent(pickDate)}`}
                  className="bo-btn bo-btn--primary transition-transform duration-150 active:scale-[0.96]"
                  data-testid="especial-page-convert-btn"
                >
                  Activar reservas especiales
                </a>
              </div>
            </div>
          </section>

          {/* #2 — Card list of every existing special date */}
          <section
            data-testid="especial-page-list-section"
            aria-labelledby="especial-page-list-title"
            className="grid gap-3"
          >
            <h2 id="especial-page-list-title" className="text-base font-medium">
              Fechas con menú especial
            </h2>
            <SpecialDateCardList
              entries={data.list}
              onSelect={(d) => {
                window.location.assign(`/app/reservas/especial?date=${encodeURIComponent(d)}`);
              }}
              testId="especial-page-list"
            />
          </section>
        </div>
      )}
    </section>
  );
}
