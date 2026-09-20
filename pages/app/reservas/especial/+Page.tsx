import React, { useCallback, useMemo } from "react";
import { navigate } from "vike/client/router";
import { usePageContext } from "vike-react/usePageContext";
import { Sparkles } from "lucide-react";

import type { MenuSelectorItem, SpecialDateListEntry, SpecialDateSettings } from "../../../../api/types";
import { InlineAlert } from "../../../../ui/feedback/InlineAlert";
import { createClient } from "../../../../api/client";
import { useMonthCalendar } from "../../../../ui/hooks/useMonthCalendar";
import { MonthCalendarDatePicker } from "../../../../ui/widgets/MonthCalendarDatePicker";
import { PageToolbar } from "../../../../ui/shell/PageToolbar";
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

  // Date is "active special" only when the server returned is_active=true (not
  // merely when the row exists — deactivated rows fall back to the conversion view).
  const isActiveSpecial = Boolean(data.specialDate?.is_active);

  // The picker uses the same MonthCalendarDatePicker + PageToolbar combo as the
  // Settings tab (/app/reservas/config). It is ALWAYS visible at the top so the
  // operator can jump between special dates from any state (active or inactive)
  // without going back to the Reservas tab first.
  const api = useMemo(() => createClient({ baseUrl: "" }), []);
  const calendar = useMonthCalendar(api, data.date || todayISO());

  const onDateChange = useCallback(
    (iso: string) => {
      if (!iso || iso === data.date) return;
      // SPA navigation so +data.ts re-runs on the new date without a full reload
      // — matches how the other reservas tabs switch dates.
      void navigate(`/app/reservas/especial?date=${encodeURIComponent(iso)}`);
    },
    [data.date],
  );

  return (
    <section data-ui="especial-page" data-testid="especial-page-section" aria-label="Reservas especiales">
      {/* #1 — Top toolbar with the date picker. Same component + position as the
          Settings tab (/app/reservas/config) so the operator gets one
          calendar everywhere. Always visible regardless of the active/inactive
          state below. */}
      <PageToolbar
        className="bo-toolbar--centered"
        left={
          <MonthCalendarDatePicker
            value={data.date || todayISO()}
            onChange={onDateChange}
            year={calendar.year}
            month={calendar.month}
            days={calendar.days}
            onPrevMonth={calendar.onPrevMonth}
            onNextMonth={calendar.onNextMonth}
            loading={calendar.loading}
            data-testid="especial-page-date-picker"
            data-ui="date-picker"
          />
        }
        data-testid="especial-page-toolbar"
      />

      {data.error ? (
        <div className="mx-auto mt-4 max-w-[768px]" data-testid="especial-page-error-wrap">
          <InlineAlert kind="error" title="Error" message={data.error} testId="especial-error-alert" />
        </div>
      ) : null}

      {isActiveSpecial ? (
        <SpecialDateForm
          date={data.date}
          initial={data.specialDate}
          availableMenus={data.availableMenus}
        />
      ) : (
        <div className="mx-auto grid max-w-[768px] gap-6" data-testid="especial-page-inactive">
          {/* #2 — "Convert this date to special" hint. The date picker above
              already lets the user change date, so we only show a short
              instruction + a CTA into the Config tab to flip the switch. */}
          <section
            data-testid="especial-page-convert-section"
            aria-labelledby="especial-page-convert-title"
            className="bo-panel"
          >
            <div className="bo-panelBody grid gap-3" data-testid="especial-page-convert-body">
              <div className="flex items-center gap-2">
                <Sparkles size={18} strokeWidth={1.6} className="text-(--bo-accent, rgba(185,168,255,0.9))" aria-hidden="true" />
                <h2 id="especial-page-convert-title" className="text-base font-medium">
                  Activar fecha como menú especial
                </h2>
              </div>
              <p className="text-sm text-(--bo-muted)" data-testid="especial-page-convert-desc">
                Esta fecha aún no tiene un menú especial activo. Elige otra fecha
                con el calendario de arriba o ve a Configuración para activar el
                interruptor de “Reservas especiales” en esta fecha.
              </p>
              <div className="flex justify-end" data-testid="especial-page-convert-actions">
                <a
                  href={`/app/reservas/config?date=${encodeURIComponent(data.date || todayISO())}`}
                  className="bo-btn bo-btn--primary transition-transform duration-150 active:scale-[0.96]"
                  data-testid="especial-page-convert-btn"
                >
                  Ir a configuración
                </a>
              </div>
            </div>
          </section>

          {/* #3 — Card list of every existing special date. Always rendered so
              a transient failure on the single-date lookup (which only sets
              `data.error` for transport errors now) doesn't hide it. */}
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
