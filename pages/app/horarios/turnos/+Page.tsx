import React, { useCallback, useMemo, useState } from "react";
import { useAtomValue } from "jotai";
import { usePageContext } from "vike-react/usePageContext";
import { CalendarClock, Play, Square } from "lucide-react";

import { createClient } from "../../../../api/client";
import type { FichajeSchedule, Member, TimeEntry } from "../../../../api/types";
import { fichajeRealtimeAtom } from "../../../../state/atoms";
import { useErrorToast } from "../../../../ui/feedback/useErrorToast";
import { DatePicker } from "../../../../ui/inputs/DatePicker";
import { MemberPicker, type MemberPickerItem } from "../../../../ui/widgets/MemberPicker";
import { TimeEntriesEditor, type EditableTimeEntry } from "../../../../ui/widgets/TimeEntriesEditor";
import { useToasts } from "../../../../ui/feedback/useToasts";

type PageData = {
  date: string;
  members: Member[];
  schedules: FichajeSchedule[];
  error: string | null;
};

function fullName(member: Member): string {
  const name = `${member.firstName || ""} ${member.lastName || ""}`.trim();
  return name || `Miembro #${member.id}`;
}

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

function totalMinutes(entries: EditableTimeEntry[]): number {
  return entries.reduce((acc, it) => acc + Math.max(0, it.minutesWorked), 0);
}

export default function Page() {
  const pageContext = usePageContext();
  const data = pageContext.data as PageData;
  const api = useMemo(() => createClient({ baseUrl: "" }), []);
  const realtime = useAtomValue(fichajeRealtimeAtom);
  const { pushToast } = useToasts();

  const [date, setDate] = useState(data.date);
  const [schedules, setSchedules] = useState<FichajeSchedule[]>(data.schedules || []);
  const [memberSearch, setMemberSearch] = useState("");
  const [selectedMemberId, setSelectedMemberId] = useState<number | null>(() => {
    const raw = Number(pageContext.urlParsed?.search?.memberId ?? 0);
    if (Number.isFinite(raw) && raw > 0) return raw;
    return data.members[0]?.id ?? null;
  });
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyEntryId, setBusyEntryId] = useState<number | null>(null);
  const [busyFichaje, setBusyFichaje] = useState(false);
  const [error, setError] = useState<string | null>(data.error);
  useErrorToast(error);

  const membersSorted = useMemo(
    () => [...(data.members || [])].sort((a, b) => fullName(a).localeCompare(fullName(b), "es", { sensitivity: "base" })),
    [data.members],
  );

  const scheduleByMember = useMemo(() => {
    const out = new Map<number, FichajeSchedule>();
    for (const schedule of schedules) out.set(schedule.memberId, schedule);
    return out;
  }, [schedules]);

  const activeEntriesForDate = useMemo(() => {
    const out = new Set<number>();
    for (const entry of Object.values(realtime.activeEntriesByMember)) {
      if (!entry || entry.workDate !== date) continue;
      out.add(entry.memberId);
    }
    return out;
  }, [date, realtime.activeEntriesByMember]);

  const pickerItems = useMemo<MemberPickerItem[]>(() => {
    const filtered = membersSorted.filter((member) => {
      const query = memberSearch.trim().toLowerCase();
      if (!query) return true;
      return fullName(member).toLowerCase().includes(query);
    });
    return filtered.map((member) => ({
      id: member.id,
      name: fullName(member),
      meta: scheduleByMember.has(member.id) ? "Asignado" : "Sin horario",
      live: activeEntriesForDate.has(member.id),
    }));
  }, [activeEntriesForDate, memberSearch, membersSorted, scheduleByMember]);

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
    },
    [api.horarios],
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
    [loadEntries, loadSchedules, selectedMemberId, syncURL],
  );

  const selectMember = useCallback(
    async (memberId: number) => {
      setSelectedMemberId(memberId);
      syncURL(date, memberId);
      setLoading(true);
      setError(null);
      try {
        await loadEntries(date, memberId);
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudo cargar el miembro");
      } finally {
        setLoading(false);
      }
    },
    [date, loadEntries, syncURL],
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
    <section aria-label="Edicion de turnos" className="bo-turnosPage">
      <div className="bo-panel">
        <div className="bo-panelHead">
          <div>
            <div className="bo-panelTitle bo-horariosTitle">
              <CalendarClock size={16} strokeWidth={1.8} />
              Turnos
            </div>
            <div className="bo-panelMeta">Editar tiempo registrado por miembro y fecha.</div>
          </div>
          <div className="bo-horariosPreviewActions">
            <DatePicker value={date} onChange={(nextDate) => void selectDate(nextDate)} />
            <div className="bo-horariosDateBadge">{loading ? "Cargando..." : date}</div>
          </div>
        </div>

        <div className="bo-panelBody bo-turnosBody">
          <MemberPicker
            title="Miembros"
            searchValue={memberSearch}
            onSearchChange={setMemberSearch}
            items={pickerItems}
            selectedId={selectedMemberId}
            onSelect={(memberId) => void selectMember(memberId)}
            emptyLabel="Sin miembros para mostrar."
          />

          <section className="bo-turnosEditor" aria-label="Editor de turnos">
            <div className="bo-turnosEditorHead">
              <div className="bo-panelTitle">{selectedMember ? fullName(selectedMember) : "Selecciona un miembro"}</div>
              <div className="bo-turnosEditorMeta">
                {selectedSchedule ? `Horario asignado: ${selectedSchedule.startTime} - ${selectedSchedule.endTime}` : "Sin horario asignado para este dia"}
              </div>
            </div>

            {selectedMember && selectedSchedule && !isMemberActive && (
              <div className="bo-turnosFichajeSection">
                <button
                  className="bo-btn bo-btn--primary bo-btn--fit"
                  type="button"
                  onClick={startFichaje}
                  disabled={busyFichaje || !selectedSchedule}
                >
                  <Play size={14} strokeWidth={1.8} />
                  Iniciar turno
                </button>
              </div>
            )}

            {selectedMember && isMemberActive && (
              <div className="bo-turnosFichajeSection bo-turnosFichajeSection--active">
                <div className="bo-turnosFichajeActive">
                  <span className="bo-badge bo-badge--success">En curso</span>
                </div>
                <button
                  className="bo-btn bo-btn--danger bo-btn--fit"
                  type="button"
                  onClick={stopFichaje}
                  disabled={busyFichaje}
                >
                  <Square size={14} strokeWidth={1.8} />
                  Terminar turno
                </button>
              </div>
            )}

            <TimeEntriesEditor
              entries={editableEntries}
              busyEntryId={busyEntryId}
              onShiftStart={onShiftStart}
              onShiftEnd={onShiftEnd}
              onCloseLive={onCloseLive}
            />
            <div className="bo-turnosTotal">Total del dia: {Math.round((totalMinutes(editableEntries) / 60) * 100) / 100} h</div>
          </section>
        </div>
      </div>
    </section>
  );
}
