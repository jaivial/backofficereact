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

export default function Page() {
  const pageContext = usePageContext();
  const data = pageContext.data as PageData;
  const api = useMemo(() => createClient({ baseUrl: "" }), []);
  const realtime = useAtomValue(fichajeRealtimeAtom);
  const [date, setDate] = useState(data.date);
  const [schedules, setSchedules] = useState<FichajeSchedule[]>(data.schedules || []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(data.error);
  useErrorToast(error);
  const [tick, setTick] = useState(() => Date.now());
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

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

  return (
    <section aria-label="Preview de horarios" className="bo-horariosPreviewPage">
      <div className="bo-panel">
        <div className="bo-panelHead">
          <div>
            <div className="bo-panelTitle bo-horariosTitle">
              <CalendarClock size={16} strokeWidth={1.8} />
              Preview
            </div>
            <div className="bo-panelMeta">Estado en vivo para la fecha seleccionada.</div>
          </div>
          <div className="bo-horariosPreviewActions">
            <DatePicker value={date} onChange={(nextDate) => void onDateChange(nextDate)} />
            <div className="bo-horariosDateBadge">{busy ? "Cargando..." : date}</div>
          </div>
        </div>

        <div className="bo-panelBody bo-horariosPreviewBody">
          <div className="bo-horariosPreviewCounters">
            <div className="bo-horariosPreviewCounter">
              <Users size={14} strokeWidth={1.8} />
              En vivo: {liveMembers.length}
            </div>
            <div className="bo-horariosPreviewCounter">
              <Clock3 size={14} strokeWidth={1.8} />
              Fuera de turno: {idleMembers.length}
            </div>
          </div>

          <div className="bo-horariosPreviewGrid">
            <section className="bo-horariosPreviewBlock" aria-label="Miembros en vivo">
              <div className="bo-panelTitle">Trabajando ahora</div>
              <div className="bo-horariosPreviewCards">
                {liveMembers.map((member) => {
                  const entry = activeEntriesForDate.get(member.id);
                  const schedule = schedulesByMember.get(member.id);
                  return (
                    <article
                      key={`live-${member.id}`}
                      className={`bo-memberCard bo-memberCard--live${schedule ? " bo-memberCard--assigned" : ""}`}
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
                      <div className="bo-memberName">{fullName(member)}</div>
                      <div className="bo-memberSub">{entry ? elapsedLabel(entry.startAtIso, tick) : "--:--:--"}</div>
                      <div className="bo-horariosPreviewBadges">
                        <span className="bo-badge bo-horariosPreviewBadge bo-horariosPreviewBadge--live">En vivo</span>
                        <span className={`bo-badge bo-horariosPreviewBadge${schedule ? " is-assigned" : " is-unassigned"}`}>
                          {schedule ? "Asignado hoy" : "Sin asignar"}
                        </span>
                      </div>
                      <div className="bo-memberMeta">{scheduleLabel(schedule)}</div>
                    </article>
                  );
                })}

                {liveMembers.length === 0 ? <div className="bo-mutedText">No hay fichajes abiertos para esta fecha.</div> : null}
              </div>
            </section>

            <section className="bo-horariosPreviewBlock" aria-label="Miembros fuera de turno">
              <div className="bo-panelTitle">No trabajando ahora</div>
              <div className="bo-horariosPreviewCards">
                {idleMembers.map((member) => {
                  const schedule = schedulesByMember.get(member.id);
                  return (
                    <article
                      key={`idle-${member.id}`}
                      className={`bo-memberCard${schedule ? " bo-memberCard--assigned" : ""}`}
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
                      <div className="bo-memberName">{fullName(member)}</div>
                      <div className="bo-horariosPreviewBadges">
                        <span className={`bo-badge bo-horariosPreviewBadge${schedule ? " is-assigned" : " is-unassigned"}`}>
                          {schedule ? "Asignado hoy" : "Sin asignar"}
                        </span>
                      </div>
                      <div className="bo-memberMeta">{scheduleLabel(schedule)}</div>
                    </article>
                  );
                })}
              </div>
            </section>
          </div>
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
