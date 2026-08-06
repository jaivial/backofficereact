import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useAtomValue } from "jotai";
import { CalendarClock, CalendarDays } from "lucide-react";

import { createClient } from "../../../../api/client";
import type { FichajeActiveEntry, FichajeSchedule, Member, TimeEntry } from "../../../../api/types";

type EditableTimeEntry = {
  id: number;
  startTime: string;
  endTime: string | null;
  minutesWorked: number;
  source: string;
  isLive: boolean;
};
import { fichajeRealtimeAtom } from "../../../../state/atoms";
import { useErrorToast } from "../../../../ui/feedback/useErrorToast";
import { useToasts } from "../../../../ui/feedback/useToasts";
import { CalendarModal } from "./functionalComponents/CalendarModal/CalendarModal";
import { MemberFilterView } from "./functionalComponents/MemberFilterView/MemberFilterView";
import { Panel } from "../../../../ui/shell/Panel";
import { fullName } from "../../../../lib/member";

export type TurnosViewProps = {
  date: string;
  members: Member[];
  schedules: FichajeSchedule[];
  error: string | null;
  initialMemberId?: number | null;
  /** Notifies an embedding parent when the date changes here, so shared state stays in sync. */
  onDateChange?: (date: string) => void;
  /** Notifies an embedding parent when schedules are reloaded here. */
  onSchedulesChange?: (schedules: FichajeSchedule[]) => void;
};

function parseHHMM(value: string): number | null {
  const [h, m] = value.split(":").map((v) => Number(v));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
}

function shiftHHMM(value: string, deltaMinutes: number): string | null {
  const current = parseHHMM(value);
  if (current === null) return null;
  const next = current + deltaMinutes;
  if (next < 0 || next > 23 * 60 + 59) return null;
  const h = Math.floor(next / 60);
  const m = next % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function toHHMMFromNow(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function formatDateLabel(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return iso;
  const yyyy = Number(m[1]), mm = Number(m[2]), dd = Number(m[3]);
  if (!Number.isFinite(yyyy) || !Number.isFinite(mm) || !Number.isFinite(dd)) return iso;
  return new Date(yyyy, mm - 1, dd).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" });
}

function todayISO(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function TurnosView({ date: initialDate, members, schedules: initialSchedules, error: initialError, initialMemberId, onDateChange, onSchedulesChange }: TurnosViewProps) {
  const api = useMemo(() => createClient({ baseUrl: "" }), []);
  const realtime = useAtomValue(fichajeRealtimeAtom);

  const [date, setDate] = useState(initialDate || todayISO());
  const [calendarModalOpen, setCalendarModalOpen] = useState(false);
  const [schedules, setSchedules] = useState<FichajeSchedule[]>(initialSchedules || []);
  const [selectedMemberId, setSelectedMemberId] = useState<number | null>(() => {
    if (Number.isFinite(initialMemberId) && (initialMemberId ?? 0) > 0) return initialMemberId ?? null;
    return members[0]?.id ?? null;
  });
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyEntryId, setBusyEntryId] = useState<number | null>(null);
  const [busyFichaje, setBusyFichaje] = useState(false);
  const [error, setError] = useState<string | null>(initialError);
  const { pushToast } = useToasts();
  useErrorToast(error);

  const membersSorted = useMemo(
    () => [...(members || [])].sort((a, b) => fullName(a).localeCompare(fullName(b), "es", { sensitivity: "base" })),
    [members],
  );

  const scheduleByMember = useMemo(() => {
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

  const selectedMember = useMemo(
    () => membersSorted.find((member) => member.id === selectedMemberId) || null,
    [membersSorted, selectedMemberId],
  );

  const selectedSchedule = useMemo(
    () => (selectedMember ? scheduleByMember.get(selectedMember.id) : undefined),
    [scheduleByMember, selectedMember],
  );

  const editableEntries = useMemo<EditableTimeEntry[]>(
    () =>
      entries.map((entry) => ({
        id: entry.id,
        startTime: entry.startTime,
        endTime: entry.endTime,
        minutesWorked: entry.minutesWorked,
        source: entry.source,
        isLive: entry.endTime === null,
      })),
    [entries],
  );

  const syncURL = useCallback((nextDate: string, nextMemberId: number | null) => {
    const url = new URL(window.location.href);
    url.searchParams.set("date", nextDate);
    if (nextMemberId) url.searchParams.set("memberId", String(nextMemberId));
    else url.searchParams.delete("memberId");
    window.history.replaceState(null, "", url.toString());
  }, []);

  const loadSchedules = useCallback(
    async (nextDate: string) => {
      const res = await api.horarios.list(nextDate);
      if (!res.success) throw new Error(res.message || "No se pudieron cargar horarios");
      setSchedules(res.schedules);
      onSchedulesChange?.(res.schedules);
    },
    [api.horarios, onSchedulesChange],
  );

  const loadEntries = useCallback(
    async (nextDate: string, nextMemberId: number | null) => {
      if (!nextMemberId) {
        setEntries([]);
        return;
      }
      const res = await api.fichaje.entries.list({ date: nextDate, memberId: nextMemberId });
      if (!res.success) throw new Error(res.message || "No se pudieron cargar registros");
      setEntries(res.entries);
    },
    [api.fichaje.entries],
  );

  const selectDate = useCallback(
    async (nextDate: string) => {
      setDate(nextDate);
      onDateChange?.(nextDate);
      syncURL(nextDate, selectedMemberId);
      setLoading(true);
      setError(null);
      try {
        await Promise.all([loadSchedules(nextDate), loadEntries(nextDate, selectedMemberId)]);
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudo cargar la fecha");
      } finally {
        setLoading(false);
      }
    },
    [loadEntries, loadSchedules, onDateChange, selectedMemberId, syncURL],
  );

  const refreshMemberEntries = useCallback(async () => {
    await loadEntries(date, selectedMemberId);
  }, [date, loadEntries, selectedMemberId]);

  const patchEntry = useCallback(
    async (entryId: number, payload: { startTime?: string; endTime?: string }) => {
      setBusyEntryId(entryId);
      setError(null);
      try {
        const res = await api.fichaje.entries.patch(entryId, payload);
        if (!res.success) {
          setError(res.message || "No se pudo actualizar el registro");
          return;
        }
        await refreshMemberEntries();
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudo actualizar el registro");
      } finally {
        setBusyEntryId(null);
      }
    },
    [api.fichaje.entries, refreshMemberEntries],
  );

  const onShiftStart = useCallback(
    (entryId: number, deltaMinutes: number) => {
      const entry = editableEntries.find((item) => item.id === entryId);
      if (!entry) return;
      const nextStart = shiftHHMM(entry.startTime, deltaMinutes);
      if (!nextStart) return;
      if (entry.endTime) {
        const nextStartM = parseHHMM(nextStart);
        const endM = parseHHMM(entry.endTime);
        if (nextStartM === null || endM === null || nextStartM >= endM) {
          pushToast({ kind: "error", title: "Horario invalido", message: "La hora de inicio debe ser menor que la de fin" });
          return;
        }
      }
      void patchEntry(entryId, { startTime: nextStart });
    },
    [editableEntries, patchEntry, pushToast],
  );

  const onShiftEnd = useCallback(
    (entryId: number, deltaMinutes: number) => {
      const entry = editableEntries.find((item) => item.id === entryId);
      if (!entry || !entry.endTime) return;
      const nextEnd = shiftHHMM(entry.endTime, deltaMinutes);
      if (!nextEnd) return;
      const startM = parseHHMM(entry.startTime);
      const nextEndM = parseHHMM(nextEnd);
      if (startM === null || nextEndM === null || nextEndM <= startM) {
        pushToast({ kind: "error", title: "Horario invalido", message: "La hora de fin debe ser mayor que la de inicio" });
        return;
      }
      void patchEntry(entryId, { endTime: nextEnd });
    },
    [editableEntries, patchEntry, pushToast],
  );

  const onCloseLive = useCallback(
    (entryId: number) => {
      void patchEntry(entryId, { endTime: toHHMMFromNow() });
    },
    [patchEntry],
  );

  const startFichaje = useCallback(async () => {
    if (!selectedMemberId || !selectedSchedule) return;
    setBusyFichaje(true);
    try {
      const res = await api.fichaje.adminStart(selectedMemberId);
      if (res.success) {
        await refreshMemberEntries();
        pushToast({ kind: "success", title: "Fichaje iniciado" });
      } else {
        pushToast({ kind: "error", title: res.message || "Error al iniciar" });
      }
    } catch (err) {
      pushToast({ kind: "error", title: "Error al iniciar" });
    } finally {
      setBusyFichaje(false);
    }
  }, [selectedMemberId, selectedSchedule, api.fichaje, refreshMemberEntries, pushToast]);

  const stopFichaje = useCallback(async () => {
    if (!selectedMemberId) return;
    setBusyFichaje(true);
    try {
      const res = await api.fichaje.adminStop(selectedMemberId);
      if (res.success) {
        await refreshMemberEntries();
        pushToast({ kind: "success", title: "Fichaje terminado" });
      } else {
        pushToast({ kind: "error", title: res.message || "Error al terminar" });
      }
    } catch (err) {
      pushToast({ kind: "error", title: "Error al terminar" });
    } finally {
      setBusyFichaje(false);
    }
  }, [selectedMemberId, api.fichaje, refreshMemberEntries, pushToast]);

  const isMemberActive = useMemo(
    () => selectedMemberId ? activeEntriesForDate.has(selectedMemberId) : false,
    [selectedMemberId, activeEntriesForDate],
  );

  React.useEffect(() => {
    void loadEntries(date, selectedMemberId).catch((err) => {
      setError(err instanceof Error ? err.message : "No se pudieron cargar registros");
    });
  }, [date, loadEntries, selectedMemberId]);

  return (
    <section aria-label="Edicion de turnos" className="bo-turnosPage" data-testid="horarios-turnos-section">
      <Panel
        data-testid="horarios-turnos-panel"
        className="mt-4"
        title={
          <span className="bo-horariosTitle" data-testid="horarios-turnos-title">
            <CalendarClock size={16} strokeWidth={1.8} />
            Turnos
          </span>
        }
        actions={
          <div className="bo-horariosPreviewActions" data-testid="horarios-turnos-actions">
            <button
              type="button"
              className="bo-dateBtn bo-dateBtn--glass"
              onClick={() => setCalendarModalOpen(true)}
              data-testid="horarios-turnos-calendar-btn"
            >
              <CalendarDays size={18} strokeWidth={1.8} />
              <span className="bo-dateBtnLabel">{formatDateLabel(date)}</span>
            </button>
            <CalendarModal
              open={calendarModalOpen}
              onClose={() => setCalendarModalOpen(false)}
              onSelectDate={(nextDate) => void selectDate(nextDate)}
              year={Number(date.split("-")[0])}
              month={Number(date.split("-")[1])}
              currentDate={date}
            />
          </div>
        }
        bodyClassName="bo-turnosBody"
      >
          <MemberFilterView members={membersSorted} />
        </Panel>
    </section>
  );
}
