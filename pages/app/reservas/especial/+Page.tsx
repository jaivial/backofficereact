import React, { useCallback, useEffect, useMemo, useState } from "react";
import { usePageContext } from "vike-react/usePageContext";

import type { MenuSelectorItem, SpecialDateListEntry, SpecialDateSettings } from "../../../../api/types";
import { InlineAlert } from "../../../../ui/feedback/InlineAlert";
import { createClient } from "../../../../api/client";
import { useMonthCalendar } from "../../../../ui/hooks/useMonthCalendar";
import { MonthCalendarDatePicker } from "../../../../ui/widgets/MonthCalendarDatePicker";
import { PageToolbar } from "../../../../ui/shell/PageToolbar";
import { SpecialDateForm } from "./functionalComponents/SpecialDateForm";
import { SpecialDateCardList } from "./functionalComponents/SpecialDateCardList";
import { useGlobalSocketTopic } from "../../../../ui/realtime/GlobalSocketProvider";
import { SpecialDateActivateEmpty } from "./functionalComponents/SpecialDateActivateEmpty";
import { SpecialDateTabs } from "./functionalComponents/SpecialDateTabs";
import { SpecialDateStatsPanel } from "./functionalComponents/SpecialDateStatsPanel";
import type { SpecialDateTabId } from "./functionalComponents/SpecialDateTabs";
import { useSpecialDateActivation } from "./hooks/useSpecialDateActivation";

type PageData = {
  date: string;
  specialDate: SpecialDateSettings | null;
  availableMenus: MenuSelectorItem[];
  list: SpecialDateListEntry[];
  error: string | null;
};
type SpecialDateEvent = {
  type: "special_date_changed" | "special_date_deleted";
  restaurant_id: number;
  date: string;
  is_active?: boolean;
  title?: string;
  people?: number;
  limit?: number;
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

  // Keep the local date in sync with the SSR snapshot when vike swaps
  // `pageContext.data` during an SPA navigation to this same route (card
  // clicks, back/forward). The component re-renders without remounting, so
  // without this the view stayed on the previously picked date.
  const ssrDate = ssrData.date;
  useEffect(() => {
    if (!ssrDate) return;
    setDate((cur) => (cur === ssrDate ? cur : ssrDate));
  }, [ssrDate]);
  const [specialDate, setSpecialDate] = useState<SpecialDateSettings | null>(ssrData.specialDate);
  const [list, setList] = useState<SpecialDateListEntry[]>(ssrData.list ?? []);
  const [availableMenus] = useState<MenuSelectorItem[]>(ssrData.availableMenus ?? []);
  const [error, setError] = useState<string | null>(ssrData.error);

  const api = useMemo(() => createClient({ baseUrl: "" }), []);

  // Real-time sync: subscribe to special_date events from the global
  // WebSocket. When ANY tab saves a special_date, this hook patches
  // the local list in place — no refetch needed for the card list
  // summary. The single-date fetch below handles the detail.
  useGlobalSocketTopic<SpecialDateEvent>("special_date", (raw) => {
    const payload = raw as SpecialDateEvent | null;
    if (!payload || !payload.date) return;
    setList((prev) => {
      const idx = prev.findIndex((e) => e.date === payload.date);
      if (payload.type === "special_date_deleted") {
        return idx >= 0 ? prev.filter((e) => e.date !== payload.date) : prev;
      }
      // Upsert. The Especial card list only needs (date, title,
      // is_active, prereserva_enabled, menus, people, limit). For now
      // we patch the existing row if present, otherwise drop the
      // event — a fresh row will appear on the next focus refetch.
      if (idx < 0) return prev;
      const next = prev.slice();
      const cur = next[idx];
      next[idx] = {
        ...cur,
        title: payload.title ?? cur.title,
        is_active: payload.is_active ?? cur.is_active,
      };
      return next;
    });
    // If the event is for the *currently selected* date, also patch
    // `specialDate` so the form / inactive view updates without a
    // refetch.
    if (payload.date === date) {
      setSpecialDate((prev) => {
        if (!prev && payload.type === "special_date_deleted") return null;
        if (!prev) return prev;
        return {
          ...prev,
          is_active: payload.is_active ?? prev.is_active,
          title: payload.title ?? prev.title,
        };
      });
    }
  });

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

  // Single definition of "reload the card list", shared by the mount
  // effect, the window `focus` listener and the post-activation
  // reconcile below. Activating a date creates a row the list has never
  // seen, and the socket upsert deliberately ignores unknown dates, so
  // without this refetch a freshly activated date would be missing from
  // the "Fechas festivas" tab until the window regained focus.
  const refreshList = useCallback(async () => {
    const res = await api.config.listSpecialDates();
    if (res.success) {
      setList((res as { special_dates?: SpecialDateListEntry[] }).special_dates || []);
    }
  }, [api]);

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

  // Which tab of the special-date view is on screen. Local state only:
  // switching tabs must never navigate or remount, otherwise the form
  // would lose its in-progress draft.
  const [tab, setTab] = useState<SpecialDateTabId>("ajustes");

  // Activation writes through the save endpoint (which broadcasts on the
  // global socket) and flips `specialDate` optimistically so the tabs
  // appear with no re-render of the page shell.
  const { activating, error: activateError, activate } = useSpecialDateActivation({
    date,
    current: specialDate,
    onOptimistic: useCallback((next: SpecialDateSettings) => {
      setSpecialDate(next);
      // Land on the settings tab: the operator just asked for a special
      // menu, so the form is what they want next.
      setTab("ajustes");
    }, []),
    onRevert: useCallback((previous: SpecialDateSettings | null) => {
      setSpecialDate(previous);
    }, []),
    // Pull the card list once the row exists so the newly activated date
    // shows up in the "Fechas festivas" tab right away.
    onSuccess: useCallback(() => {
      void refreshList();
    }, [refreshList]),
  });

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

  // Clicking a card in the list selects that date locally through
  // `onDateChange` (state + URL). No vike navigation on purpose: navigating
  // to this same route swapped `pageContext.data` asynchronously and left the
  // date picker (and the view) mid-re-render, so follow-up clicks appeared
  // dead. Coordination id: especial_activate_v1
  const onSelectListedDate = useCallback(
    (d: string) => {
      onDateChange(d);
    },
    [onDateChange],
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

      {/* #2 — Special-menu day: settings form + dates list behind tabs.
          Inactive day: the "Sin fecha festiva" empty state with the
          Activar CTA. The switch between the two is driven purely by
          `specialDate.is_active`, which activation flips optimistically
          — so the tabs slide in without a remount or a navigation. */}
      {isActiveSpecial ? (
        <div className="mx-auto max-w-[768px] grid gap-4" data-testid="especial-page-active">
          <SpecialDateTabs active={tab} onChange={setTab} />

          {tab === "ajustes" ? (
            <section
              data-testid="especial-page-settings-section"
              aria-label="Reservas especiales"
            >
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
            </section>
          ) : tab === "estadisticas" ? (
            <SpecialDateStatsPanel date={date} />
          ) : (
            <section
              data-testid="especial-page-list-section"
              aria-labelledby="especial-page-list-title"
              className="grid gap-3"
            >
              <h2 id="especial-page-list-title" className="text-base font-medium text-center">
                Fechas festivas
              </h2>
              <SpecialDateCardList
                entries={list}
                onSelect={onSelectListedDate}
                testId="especial-page-list"
              />
            </section>
          )}
        </div>
      ) : (
        <div className="mx-auto grid max-w-[768px] gap-6" data-testid="especial-page-inactive">
          {/* #3 — No fecha festiva for this day yet. */}
          <section
            data-testid="especial-page-convert-section"
            aria-label="Activar fecha festiva"
            className="bo-panel"
          >
            <div className="bo-panelBody pt-4" data-testid="especial-page-convert-body">
              <SpecialDateActivateEmpty onActivate={() => void activate()} activating={activating} />
              {activateError ? (
                <div className="mt-4" data-testid="especial-page-activate-error-wrap">
                  <InlineAlert
                    kind="error"
                    title="Error"
                    message={activateError}
                    testId="especial-activate-error-alert"
                  />
                </div>
              ) : null}
            </div>
          </section>

          {/* #4 — Card list of every existing special date. Always rendered so
              a transient failure on the single-date lookup (which only sets
              `error` for transport errors now) doesn't hide it. */}
          <section
            data-testid="especial-page-inactive-list-section"
            aria-labelledby="especial-page-inactive-list-title"
            className="grid gap-3"
          >
            <h2 id="especial-page-inactive-list-title" className="text-base font-medium text-center">
              Fechas festivas
            </h2>
            <SpecialDateCardList
              entries={list}
              onSelect={onSelectListedDate}
              testId="especial-page-list"
            />
          </section>
        </div>
      )}
    </section>
  );
}
