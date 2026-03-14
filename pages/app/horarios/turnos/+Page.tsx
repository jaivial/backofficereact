import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useAtomValue } from "jotai";
import { usePageContext } from "vike-react/usePageContext";
import { CalendarClock, Play, Search, Square } from "lucide-react";

import { createClient } from "../../../../api/client";
import type { FichajeActiveEntry, FichajeSchedule, Member, TimeEntry } from "../../../../api/types";
import { fichajeRealtimeAtom } from "../../../../state/atoms";
import { useErrorToast } from "../../../../ui/feedback/useErrorToast";
import { DatePicker } from "../../../../ui/inputs/DatePicker";
import { MemberPicker, type MemberPickerItem } from "../../../../ui/widgets/MemberPicker";
import { MemberShiftModal } from "../../../../ui/widgets/MemberShiftModal";
import { TimeEntriesEditor, type EditableTimeEntry } from "../../../../ui/widgets/TimeEntriesEditor";
import { useToasts } from "../../../../ui/feedback/useToasts";
import { HorariosRosterTable, type HorariosRosterRow, type HorariosRosterTableView } from "../../../../ui/widgets/HorariosRosterTable";

type PageData = {
  date: string;
  members: Member[];
  schedules: FichajeSchedule[];
  error: string | null;
};

const VIEW_STORAGE_KEY = "bo_horarios_turnos_view";

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

function todayISO(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function totalMinutes(entries: EditableTimeEntry[]): number {
  return entries.reduce((acc, it) => acc + Math.max(0, it.minutesWorked), 0);
}

export default function Page() {
  const pageContext = usePageContext();
  const data = (pageContext.data ?? {
    date: todayISO(),
    members: [],
    schedules: [],
    error: null,
  }) as PageData;
  const api = useMemo(() => createClient({ baseUrl: "" }), []);
  const realtime = useAtomValue(fichajeRealtimeAtom);
  const { pushToast } = useToasts();

  const [date, setDate] = useState(data.date || todayISO());
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
  const [view, setView] = useState<HorariosRosterTableView>(() => {
    try {
      const stored = window.localStorage.getItem(VIEW_STORAGE_KEY);
      if (stored === "table" || stored === "grid") return stored;
    } catch {
      // ignore
    }
    return "grid";
  });
  const [shiftModalMember, setShiftModalMember] = useState<Member | null>(null);
  const [shiftModalOpen, setShiftModalOpen] = useState(false);

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
    const out = new Map<number, FichajeActiveEntry>();
    for (const entry of Object.values(realtime.activeEntriesByMember)) {
      if (!entry || entry.workDate !== date) continue;
      out.set(entry.memberId, entry);
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

  useEffect(() => {
    try {
      window.localStorage.setItem(VIEW_STORAGE_KEY, view);
    } catch {
      // ignore
    }
  }, [view]);

  React.useEffect(() => {
    void loadEntries(date, selectedMemberId).catch((err) => {
      setError(err instanceof Error ? err.message : "No se pudieron cargar registros");
    });
  }, [date, loadEntries, selectedMemberId]);

  const tableMembers = useMemo(() => {
    const query = memberSearch.trim().toLowerCase();
    if (!query) return membersSorted;
    return membersSorted.filter((member) => fullName(member).toLowerCase().includes(query));
  }, [memberSearch, membersSorted]);

  const rosterRows = useMemo<HorariosRosterRow[]>(
    () =>
      tableMembers.map((member) => ({
        member,
        schedule: scheduleByMember.get(member.id),
        activeEntry: activeEntriesForDate.get(member.id),
      })),
    [activeEntriesForDate, scheduleByMember, tableMembers],
  );

  const onRosterSelect = useCallback(
    (member: Member) => {
      void selectMember(member.id);
    },
    [selectMember],
  );

  const onOpenShiftModal = useCallback((member: Member) => {
    setShiftModalMember(member);
    setShiftModalOpen(true);
  }, []);

  const onCloseShiftModal = useCallback(() => {
    setShiftModalOpen(false);
    setShiftModalMember(null);
  }, []);

  return (
    <section aria-label="Edicion de turnos" className="grid gap-3.5 w-full">
      <div className="rounded-xl border border-border bg-bo-surface-2">
        <div className="flex items-center justify-between p-4 pb-0">
          <div>
            <div className="inline-flex items-center gap-2 text-sm font-semibold text-bo-text">
              <CalendarClock size={16} strokeWidth={1.8} />
              Turnos
            </div>
            <div className="text-xs text-text-muted mt-0.5">Editar tiempo registrado por miembro y fecha.</div>
          </div>
          <div className="flex items-center gap-3">
            <DatePicker value={date} onChange={(nextDate) => void selectDate(nextDate)} />
            <div className="h-[30px] rounded-full border border-border px-3 inline-flex items-center text-xs font-medium text-text-muted">
              {loading ? "Cargando..." : date}
            </div>
            <div className="grid grid-cols-2 p-1" style={{ background: "var(--bo-surface-3)", borderRadius: "var(--rounded-sm)" }} role="tablist" aria-label="Cambiar vista">
              <button
                type="button"
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${view === "grid" ? "bg-bo-surface text-bo-text" : "text-text-muted hover:text-bo-text"}`}
                role="tab"
                aria-selected={view === "grid"}
                onClick={() => setView("grid")}
              >
                {view === "grid" ? <span className="block h-0.5 w-4 bg-bo-accent rounded-full mb-1" /> : null}
                <span>Grid</span>
              </button>
              <button
                type="button"
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${view === "table" ? "bg-bo-surface text-bo-text" : "text-text-muted hover:text-bo-text"}`}
                role="tab"
                aria-selected={view === "table"}
                onClick={() => setView("table")}
              >
                {view === "table" ? <span className="block h-0.5 w-4 bg-bo-accent rounded-full mb-1" /> : null}
                <span>Tabla</span>
              </button>
            </div>
          </div>
        </div>

        <div className={`p-4 ${view === "table" ? "grid grid-gap-4" : "grid grid-gap-4"}`} style={view === "table" ? { gridTemplateColumns: "280px 1fr" } : {}}>
          {view === "grid" ? (
            <MemberPicker
              title="Miembros"
              searchValue={memberSearch}
              onSearchChange={setMemberSearch}
              items={pickerItems}
              selectedId={selectedMemberId}
              onSelect={(memberId) => void selectMember(memberId)}
              emptyLabel="Sin miembros para mostrar."
            />
          ) : (
            <section className="rounded-lg border border-border bg-bo-surface-3/30 p-3" aria-label="Tabla de miembros">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold text-bo-text">Miembros</span>
                <span className="text-xs text-text-muted">{tableMembers.length}</span>
              </div>
              <label className="flex items-center gap-2 mb-3 px-2 py-1.5 rounded-md bg-bo-surface border border-border" aria-label="Buscar miembro">
                <Search size={14} strokeWidth={1.8} className="text-text-muted" />
                <input
                  type="text"
                  className="flex-1 bg-transparent text-sm text-bo-text placeholder:text-text-muted focus:outline-none"
                  value={memberSearch}
                  onChange={(ev) => setMemberSearch(ev.target.value)}
                  placeholder="Buscar..."
                />
              </label>
              <HorariosRosterTable
                rows={rosterRows}
                selectedMemberId={selectedMemberId}
                onRowClick={onRosterSelect}
                onEditMember={onOpenShiftModal}
                ariaLabel="Tabla de horarios (turnos)"
              />
            </section>
          )}

          <section className="rounded-lg border border-border bg-bo-surface-3/30 p-4" aria-label="Editor de turnos">
            <div className="mb-4">
              <div className="text-sm font-semibold text-bo-text">{selectedMember ? fullName(selectedMember) : "Selecciona un miembro"}</div>
              <div className="text-xs text-text-muted mt-0.5">
                {selectedSchedule ? `Horario asignado: ${selectedSchedule.startTime} - ${selectedSchedule.endTime}` : "Sin horario asignado para este dia"}
              </div>
            </div>

            {selectedMember && selectedSchedule && !isMemberActive && (
              <div className="mb-4">
                <button
                  className="w-full h-10 rounded-md text-sm font-medium bg-bo-accent text-bo-bg hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
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
              <div className="mb-4 flex flex-col gap-2">
                <div className="flex items-center">
                  <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium" style={{ backgroundColor: "color-mix(in srgb, var(--bo-color-success) 10%, transparent)", color: "var(--bo-color-success)" }}>En curso</span>
                </div>
                <button
                  className="w-full h-10 rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-2"
                  style={{ backgroundColor: "var(--bo-color-danger)", color: "white" }}
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
            <div className="mt-4 text-xs text-text-muted">Total del dia: {Math.round((totalMinutes(editableEntries) / 60) * 100) / 100} h</div>
          </section>
        </div>
      </div>

      {shiftModalMember ? (
        <MemberShiftModal member={shiftModalMember} selectedDate={date} open={shiftModalOpen} onClose={onCloseShiftModal} />
      ) : null}
    </section>
  );
}
