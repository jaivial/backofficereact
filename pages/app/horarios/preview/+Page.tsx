import { useCallback, useEffect, useMemo, useState } from "react";
import { useAtomValue } from "jotai";
import { usePageContext } from "vike-react/usePageContext";
import { CalendarClock } from "lucide-react";

import { fichajeRealtimeAtom } from "../../../../state/atoms";
import { DatePicker } from "../../../../ui/inputs/DatePicker";
import { useErrorToast } from "../../../../ui/feedback/useErrorToast";
import { Tabs } from "../../../../ui/nav/Tabs";
import { Panel } from "../../../../ui/shell/Panel";
import { MemberShiftModal } from "../../../../ui/widgets/MemberShiftModal";
import { HorariosRosterTable, type HorariosRosterRow } from "../../../../ui/widgets/HorariosRosterTable";
import type { FichajeActiveEntry, FichajeSchedule, Member } from "../../../../api/types";
import type { PageData } from "./types";
import { VIEW_STORAGE_KEY, VIEW_TAB_ITEMS } from "./constants";
import { fullName, todayISO } from "./utils";
import { usePreviewView } from "./hooks/usePreviewView";
import { usePreviewDate } from "./hooks/usePreviewDate";
import { PreviewCounters } from "./functionalComponents/PreviewCounters/PreviewCounters";
import { LiveMembersGrid } from "./functionalComponents/LiveMembersGrid/LiveMembersGrid";
import { IdleMembersGrid } from "./functionalComponents/IdleMembersGrid/IdleMembersGrid";
import { MemberFilterView } from "./functionalComponents/MemberFilterView";

export default function Page() {
  const pageContext = usePageContext();
  const data = (pageContext.data ?? {
    date: todayISO(),
    members: [],
    schedules: [],
    error: null,
  }) as PageData;
  const realtime = useAtomValue(fichajeRealtimeAtom);
  const [tick, setTick] = useState(() => Date.now());
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const [view, setView] = usePreviewView("grid", VIEW_STORAGE_KEY);
  const { date, schedules, busy, error, onDateChange } = usePreviewDate(
    data.date || todayISO(),
    data.schedules || [],
    data.error,
  );

  useErrorToast(error);

  const membersSorted = useMemo(
    () => [...(data.members || [])].sort((a, b) => fullName(a).localeCompare(fullName(b), "es", { sensitivity: "base" })),
    [data.members],
  );

  const schedulesByMember = useMemo(() => {
    const out = new Map<number, FichajeSchedule>();
    for (const schedule of schedules) out.set(schedule.memberId, schedule);
    return out;
  }, [schedules]);

  const activeEntriesForDate = useMemo(() => {
    const out = new Map<number, FichajeActiveEntry>();
    for (const entry of Object.values(realtime.activeEntriesByMember)) {
      if (!entry || entry.workDate !== date) continue;
      out.set(entry.memberId, entry);
    }
    return out;
  }, [date, realtime.activeEntriesByMember]);

  const liveMembers = useMemo(
    () => membersSorted.filter((m) => activeEntriesForDate.has(m.id)),
    [activeEntriesForDate, membersSorted],
  );
  const idleMembers = useMemo(
    () => membersSorted.filter((m) => !activeEntriesForDate.has(m.id)),
    [activeEntriesForDate, membersSorted],
  );

  useEffect(() => {
    if (liveMembers.length === 0) return;
    const timer = window.setInterval(() => setTick(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [liveMembers.length]);

  const onMemberClick = useCallback((member: Member) => {
    setSelectedMember(member);
    setModalOpen(true);
  }, []);

  const onModalClose = useCallback(() => {
    setModalOpen(false);
    setSelectedMember(null);
  }, []);

  const onViewChange = useCallback(
    (id: string) => setView(id as "grid" | "table" | "member"),
    [setView],
  );

  const rosterRows = useMemo<HorariosRosterRow[]>(
    () =>
      [...liveMembers, ...idleMembers].map((member) => ({
        member,
        schedule: schedulesByMember.get(member.id),
        activeEntry: activeEntriesForDate.get(member.id),
      })),
    [activeEntriesForDate, idleMembers, liveMembers, schedulesByMember],
  );

  return (
    <section aria-label="Preview de horarios" data-ui="horariosPreviewPage" className="bo-horariosPreviewPage">
      <Panel
        data-ui="horariosPanel"
        title={
          <span className="bo-horariosTitle">
            <CalendarClock data-slot="titleIcon" size={16} strokeWidth={1.8} aria-hidden="true" />
            <span data-slot="titleText">Preview</span>
          </span>
        }
        meta="Estado en vivo para la fecha seleccionada."
        headClassName="md:flex-row flex-col w-fit md:w-full mx-auto md:mx-0 gap-3 md:gap-0"
        actions={
          <div data-slot="previewActions" className="bo-horariosPreviewActions flex flex-col md:flex-row gap-2">
            <div data-slot="datePicker">
              <DatePicker value={date} onChange={(nextDate) => void onDateChange(nextDate)} />
            </div>
            <Tabs
              tabs={VIEW_TAB_ITEMS}
              activeId={view}
              onNavigate={(_, id) => onViewChange(id)}
              ariaLabel="Cambiar vista"
              className="bo-tabs--glass bo-viewTabs flex flex-row ms-auto rounded-xl !w-fit"
              layoutId="boPreviewViewTabIndicator"
            />
          </div>
        }
        bodyClassName="bo-horariosPreviewBody"
      >
          <PreviewCounters liveCount={liveMembers.length} idleCount={idleMembers.length} />

          {view === "grid" ? (
            <div data-ui="previewGrid" className="bo-horariosPreviewGrid">
              <LiveMembersGrid
                members={liveMembers}
                activeEntriesForDate={activeEntriesForDate}
                schedulesByMember={schedulesByMember}
                tick={tick}
                onMemberClick={onMemberClick}
              />
              <IdleMembersGrid
                members={idleMembers}
                schedulesByMember={schedulesByMember}
                onMemberClick={onMemberClick}
              />
            </div>
          ) : view === "table" ? (
            <HorariosRosterTable
              rows={rosterRows}
              nowMs={tick}
              selectedMemberId={selectedMember?.id ?? null}
              onRowClick={onMemberClick}
              onEditMember={onMemberClick}
              ariaLabel="Tabla de horarios (preview)"
              emptyLabel="Sin miembros para mostrar."
            />
          ) : (
            <MemberFilterView members={membersSorted} />
          )}
      </Panel>

      {selectedMember ? (
        <MemberShiftModal
          member={selectedMember}
          selectedDate={date}
          open={modalOpen}
          onClose={onModalClose}
        />
      ) : null}
    </section>
  );
}
