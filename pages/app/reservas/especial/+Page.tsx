import React, { useCallback, useEffect, useMemo, useState } from "react";
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
  const ssrData = (pageContext.data ?? {
    date: "",
    specialDate: null,
    availableMenus: [],
    list: [],
    error: null,
  }) as PageData;

  // Local mirror of the SSR data so the date selector can update the
  // selected date + view instantly (same UX as the Reservas/Bookings tab —
  // `onSelectDate` in pages/app/reservas/reservas.tsx). The SSR snapshot is
  // the initial seed only; everything afterwards is fetched via the API
  // client below.
  const [date, setDate] = useState<string>(ssrData.date || todayISO());
  const [specialDate, setSpecialDate] = useState<SpecialDateSettings | null>(ssrData.specialDate);
  const [list, setList] = useState<SpecialDateListEntry[]>(ssrData.list ?? []);
  const [availableMenus] = useState<MenuSelectorItem[]>(ssrData.availableMenus ?? []);
  const [error, setError] = useState<string | null>(ssrData.error);

  const api = useMemo(() => createClient({ baseUrl: "" }), []);

  // Re-fetch the single-date row whenever the date changes. The card list
  // is fetched once on mount (it doesn't depend on the selected date) so the
  // operator can immediately see every special date — even the one they
  // just activated — without waiting for the date-change effect.
  useEffect(() => {
    let cancelled = false;
    void api.config
      .getSpecialDate(date)
      .then((res) => {
        if (cancelled) return;
        if (res.success) {
          setSpecialDate((res as { special_date: SpecialDateSettings | null }).special_date ?? null);
        }
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [api, date]);

  // Card list: load once on mount + refresh whenever the active state of any
  // date may have changed (i.e. after the operator toggles the activation
  // switch on the Config tab, then returns here). Listening on a window
  // `focus` event is cheap and matches the "always render" requirement.
  useEffect(() => {
    let cancelled = false;
    const refresh = () => {
      void api.config.listSpecialDates().then((res) => {
        if (cancelled) return;
        if (res.success) {
          setList((res as { special_dates?: SpecialDateListEntry[] }).special_dates || []);
        }
      });
    };
    refresh();
    if (typeof window !== "undefined") {
      window.addEventListener("focus", refresh);
    }
    return () => {
      cancelled = true;
      if (typeof window !== "undefined") {
        window.removeEventListener("focus", refresh);
      }
    };
  }, [api]);

  // Calendar grid for the picker. Always derived from the *current* local
  // `date` so the popover follows the selection immediately.
  const calendar = useMonthCalendar(api, date);

  // Date is "active special" only when the server returned is_active=true
  // (not merely when the row exists — deactivated rows fall back to the
  // conversion view).
  const isActiveSpecial = Boolean(specialDate?.is_active);

  const onDateChange = useCallback(
    (iso: string) => {
      if (!iso || iso === date) return;
      // 1) Update local state immediately so the picker button label and
      //    the page view follow the click without waiting on the network.
      setDate(iso);
      // 2) Update the URL via replaceState so the new date is shareable /
      //    reloadable, but we do NOT trigger a full SPA navigation (which
      //    would re-mount the component and re-run +data.ts). This matches
      //    how the Reservas/Bookings tab switches dates.
      if (typeof window !== "undefined") {
        const url = new URL(window.location.href);
        url.searchParams.set("date", iso);
        window.history.replaceState(null, "", url.toString());
      }
    },
    [date],
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
            value={date || todayISO()}
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

      {error ? (
        <div className="mx-auto mt-4 max-w-[768px]" data-testid="especial-page-error-wrap">
          <InlineAlert kind="error" title="Error" message={error} testId="especial-error-alert" />
        </div>
      ) : null}

      {/* #2 — Active special-date form (full editor). */}
      {isActiveSpecial ? (
        <div className="mx-auto max-w-[768px] grid gap-6" data-testid="especial-page-active">
          {/* key={date} forces a clean remount when the operator picks a
              different date, so the form re-seeds its draft from the new
              `initial` (SpecialDateForm uses useState lazy initializers
              and does not re-derive on prop change). */}
          <SpecialDateForm
            key={date}
            date={date}
            initial={specialDate}
            availableMenus={availableMenus}
          />
          {/* Always show the list below the form so the operator can jump
              to another special date without leaving the tab — addresses
              "tengo una fecha con menú especial pero no aparece en la
              lista de cards". */}
          <section
            data-testid="especial-page-list-section"
            aria-labelledby="especial-page-list-title"
            className="grid gap-3"
          >
            <h2 id="especial-page-list-title" className="text-base font-medium">
              Fechas con menú especial
            </h2>
            <SpecialDateCardList
              entries={list}
              onSelect={(d) => {
                // Real SPA navigation — re-runs +data.ts on the new date so
                // the SSR snapshot (specialDate / list / availableMenus)
                // is fresh before the component renders. This matches the
                // operator's expectation: clicking a card "goes to" the
                // card's date on the Especial tab.
                void navigate(`/app/reservas/especial?date=${encodeURIComponent(d)}`);
              }}
              testId="especial-page-list"
            />
          </section>
        </div>
      ) : (
        <div className="mx-auto grid max-w-[768px] gap-6" data-testid="especial-page-inactive">
          {/* #3 — "Convert this date to special" hint. The date picker above
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
                  href={`/app/reservas/config?date=${encodeURIComponent(date || todayISO())}`}
                  className="bo-btn bo-btn--primary transition-transform duration-150 active:scale-[0.96]"
                  data-testid="especial-page-convert-btn"
                >
                  Ir a configuración
                </a>
              </div>
            </div>
          </section>

          {/* #4 — Card list of every existing special date. Always rendered so
              a transient failure on the single-date lookup (which only sets
              `error` for transport errors now) doesn't hide it. */}
          <section
            data-testid="especial-page-list-section"
            aria-labelledby="especial-page-list-title"
            className="grid gap-3"
          >
            <h2 id="especial-page-list-title" className="text-base font-medium">
              Fechas con menú especial
            </h2>
            <SpecialDateCardList
              entries={list}
              onSelect={(d) => {
                // Same SPA navigation as the active view — see the comment
                // above. The active/inactive toggle is derived from the
                // fresh `specialDate` returned by +data.ts on the new date.
                void navigate(`/app/reservas/especial?date=${encodeURIComponent(d)}`);
              }}
              testId="especial-page-list"
            />
          </section>
        </div>
      )}
    </section>
  );
}
