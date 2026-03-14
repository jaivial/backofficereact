import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useAtomValue } from "jotai";
import { usePageContext } from "vike-react/usePageContext";
import { CalendarClock, Clock3, Users } from "lucide-react";

import { createClient } from "../../../../api/client";
import type { FichajeSchedule, Member } from "../../../../api/types";
import { fichajeRealtimeAtom } from "../../../../state/atoms";
import { DatePicker } from "../../../../ui/inputs/DatePicker";
import { useErrorToast } from "../../../../ui/feedback/useErrorToast";
import { MemberShiftModal } from "../../../../ui/widgets/MemberShiftModal";
import { HorariosRosterTable, type HorariosRosterRow, type HorariosRosterTableView } from "../../../../ui/widgets/HorariosRosterTable";

type PageData = {
  date: string;
  members: Member[];
  schedules: FichajeSchedule[];
  error: string | null;
};

const VIEW_STORAGE_KEY = "bo_horarios_preview_view";

function fullName(member: Member): string {
  const name = `${member.firstName || ""} ${member.lastName || ""}`.trim();
  return name || `Miembro #${member.id}`;
}

function formatElapsed(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function elapsedLabel(startAtIso: string, nowMs: number): string {
  const startMs = Date.parse(startAtIso);
  if (!Number.isFinite(startMs)) return "--:--:--";
  return formatElapsed((nowMs - startMs) / 1000);
}

function scheduleLabel(schedule: FichajeSchedule | undefined): string {
  if (!schedule) return "Sin horario";
  return `${schedule.startTime} - ${schedule.endTime}`;
}

function todayISO(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
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
  const [date, setDate] = useState(data.date || todayISO());
  const [schedules, setSchedules] = useState<FichajeSchedule[]>(data.schedules || []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(data.error);
  useErrorToast(error);
  const [tick, setTick] = useState(() => Date.now());
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [view, setView] = useState<HorariosRosterTableView>(() => {
    try {
      if (typeof window !== "undefined") {
        const stored = window.localStorage.getItem(VIEW_STORAGE_KEY);
        if (stored === "table" || stored === "grid") return stored;
      }
    } catch {
      // ignore
    }
    return "grid";
  });

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
    const out = new Map<number, (typeof realtime.activeEntriesByMember)[number]>();
    for (const entry of Object.values(realtime.activeEntriesByMember)) {
      if (!entry || entry.workDate !== date) continue;
      out.set(entry.memberId, entry);
    }
    return out;
  }, [date, realtime.activeEntriesByMember]);

  const liveMembers = useMemo(
    () => membersSorted.filter((member) => activeEntriesForDate.has(member.id)),
    [activeEntriesForDate, membersSorted],
  );
  const idleMembers = useMemo(
    () => membersSorted.filter((member) => !activeEntriesForDate.has(member.id)),
    [activeEntriesForDate, membersSorted],
  );

  useEffect(() => {
    if (liveMembers.length === 0) return;
    const timer = window.setInterval(() => setTick(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [liveMembers.length]);

  useEffect(() => {
    try {
      window.localStorage.setItem(VIEW_STORAGE_KEY, view);
    } catch {
      // ignore
    }
  }, [view]);

  const syncURL = useCallback((nextDate: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set("date", nextDate);
    window.history.replaceState(null, "", url.toString());
  }, []);

  const onDateChange = useCallback(
    async (nextDate: string) => {
      setDate(nextDate);
      syncURL(nextDate);
      setBusy(true);
      setError(null);
      try {
        const res = await api.horarios.list(nextDate);
        if (!res.success) {
          setError(res.message || "No se pudieron cargar horarios");
          return;
        }
        setSchedules(res.schedules);
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudieron cargar horarios");
      } finally {
        setBusy(false);
      }
    },
    [api.horarios, syncURL],
  );

  const onMemberClick = useCallback((member: Member) => {
    setSelectedMember(member);
    setModalOpen(true);
  }, []);

  const onModalClose = useCallback(() => {
    setModalOpen(false);
    setSelectedMember(null);
  }, []);

  const tableMembers = useMemo(() => [...liveMembers, ...idleMembers], [idleMembers, liveMembers]);
  const rosterRows = useMemo<HorariosRosterRow[]>(
    () =>
      tableMembers.map((member) => ({
        member,
        schedule: schedulesByMember.get(member.id),
        activeEntry: activeEntriesForDate.get(member.id),
      })),
    [activeEntriesForDate, schedulesByMember, tableMembers],
  );

  return (
    <section aria-label="Preview de horarios" className="grid gap-3.5 w-full">
      <div className="rounded-xl border border-bo-border bg-bo-surface-2">
        <div className="flex items-center justify-between p-4 pb-0">
          <div>
            <div className="inline-flex items-center gap-2 text-sm font-semibold text-bo-text">
              <CalendarClock size={16} strokeWidth={1.8} />
              Preview
            </div>
            <div className="text-xs text-bo-muted mt-0.5">Estado en vivo para la fecha seleccionada.</div>
          </div>
          <div className="flex items-center gap-3">
            <DatePicker value={date} onChange={(nextDate) => void onDateChange(nextDate)} />
            <div className="h-[30px] rounded-full border border-bo-border px-3 inline-flex items-center text-xs font-medium text-bo-muted">
              {busy ? "Cargando..." : date}
            </div>
            <div className="bo-grid bo-grid-cols-2 bo-p-1" style={{ background: "var(--bo-surface-3)", borderRadius: "var(--bo-radius-sm)" }} role="tablist" aria-label="Cambiar vista">
              <button
                type="button"
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${view === "grid" ? "bg-bo-surface text-bo-text" : "text-bo-muted hover:text-bo-text"}`}
                role="tab"
                aria-selected={view === "grid"}
                onClick={() => setView("grid")}
              >
                {view === "grid" ? <span className="block h-0.5 w-4 bg-bo-accent rounded-full mb-1" /> : null}
                <span>Grid</span>
              </button>
              <button
                type="button"
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${view === "table" ? "bg-bo-surface text-bo-text" : "text-bo-muted hover:text-bo-text"}`}
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

        <div className="p-4">
          <div className="flex gap-4 mb-4">
            <div className="flex items-center gap-2 text-xs text-bo-text">
              <Users size={14} strokeWidth={1.8} />
              En vivo: {liveMembers.length}
            </div>
            <div className="flex items-center gap-2 text-xs text-bo-text">
              <Clock3 size={14} strokeWidth={1.8} />
              Fuera de turno: {idleMembers.length}
            </div>
          </div>

          {view === "grid" ? (
            <div className="grid gap-4 md:grid-cols-2">
              <section className="rounded-lg border border-bo-border bg-bo-surface-3/30 p-3" aria-label="Miembros en vivo">
                <div className="text-sm font-semibold text-bo-text mb-3">Trabajando ahora</div>
                <div className="grid gap-2">
                  {liveMembers.map((member) => {
                    const entry = activeEntriesForDate.get(member.id);
                    const schedule = schedulesByMember.get(member.id);
                    return (
                      <article
                        key={`live-${member.id}`}
                        className={`p-3 rounded-lg border cursor-pointer transition-all duration-150 hover:border-bo-accent/50 ${schedule ? "border-bo-accent/30 bg-bo-accent/5" : "border-bo-border bg-bo-surface"}`}
                        onClick={() => onMemberClick(member)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            onMemberClick(member);
                          }
                        }}
                      >
                        <div className="text-sm font-medium text-bo-text">{fullName(member)}</div>
                        <div className="text-xs text-bo-muted mt-0.5">{entry ? elapsedLabel(entry.startAtIso, tick) : "--:--:--"}</div>
                        <div className="flex flex-wrap gap-1 mt-2">
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium" style={{ backgroundColor: "color-mix(in srgb, var(--bo-color-success) 10%, transparent)", color: "var(--bo-color-success)" }}>En vivo</span>
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${schedule ? "bg-bo-accent/10 text-bo-accent" : "bg-bo-surface-2 text-bo-muted"}`}>
                            {schedule ? "Asignado hoy" : "Sin asignar"}
                          </span>
                        </div>
                        <div className="text-xs text-bo-muted mt-2">{scheduleLabel(schedule)}</div>
                      </article>
                    );
                  })}

                  {liveMembers.length === 0 ? <div className="text-bo-muted text-sm py-4 text-center">No hay fichajes abiertos para esta fecha.</div> : null}
                </div>
              </section>

              <section className="rounded-lg border border-bo-border bg-bo-surface-3/30 p-3" aria-label="Miembros fuera de turno">
                <div className="text-sm font-semibold text-bo-text mb-3">No trabajando ahora</div>
                <div className="grid gap-2">
                  {idleMembers.map((member) => {
                    const schedule = schedulesByMember.get(member.id);
                    return (
                      <article
                        key={`idle-${member.id}`}
                        className={`p-3 rounded-lg border cursor-pointer transition-all duration-150 hover:border-bo-accent/50 ${schedule ? "border-bo-accent/30 bg-bo-accent/5" : "border-bo-border bg-bo-surface"}`}
                        onClick={() => onMemberClick(member)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            onMemberClick(member);
                          }
                        }}
                      >
                        <div className="text-sm font-medium text-bo-text">{fullName(member)}</div>
                        <div className="flex flex-wrap gap-1 mt-2">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${schedule ? "bg-bo-accent/10 text-bo-accent" : "bg-bo-surface-2 text-bo-muted"}`}>
                            {schedule ? "Asignado hoy" : "Sin asignar"}
                          </span>
                        </div>
                        <div className="text-xs text-bo-muted mt-2">{scheduleLabel(schedule)}</div>
                      </article>
                    );
                  })}
                </div>
              </section>
            </div>
          ) : (
            <HorariosRosterTable
              rows={rosterRows}
              nowMs={tick}
              selectedMemberId={selectedMember?.id ?? null}
              onRowClick={onMemberClick}
              onEditMember={onMemberClick}
              ariaLabel="Tabla de horarios (preview)"
              emptyLabel="Sin miembros para mostrar."
            />
          )}
        </div>
      </div>

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
