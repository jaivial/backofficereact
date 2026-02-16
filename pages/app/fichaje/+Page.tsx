import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useAtom } from "jotai";
import { usePageContext } from "vike-react/usePageContext";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Clock3, Play, Square, Wifi, WifiOff } from "lucide-react";

import { createClient } from "../../../api/client";
import type { FichajeActiveEntry } from "../../../api/types";
import { fichajeRealtimeAtom } from "../../../state/atoms";
import { useToasts } from "../../../ui/feedback/useToasts";
import type { Data } from "./+data";
import { useErrorToast } from "../../../ui/feedback/useErrorToast";

function formatElapsed(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function toActiveEntriesByMember(entries: FichajeActiveEntry[] | null | undefined): Record<number, FichajeActiveEntry> {
  const out: Record<number, FichajeActiveEntry> = {};
  for (const entry of entries || []) {
    if (!entry || !Number.isFinite(entry.memberId) || entry.memberId <= 0) continue;
    out[entry.memberId] = entry;
  }
  return out;
}

export default function Page() {
  const pageContext = usePageContext();
  const data = pageContext.data as Data;
  const api = useMemo(() => createClient({ baseUrl: "" }), []);
  const { pushToast } = useToasts();
  const [realtime, setRealtime] = useAtom(fichajeRealtimeAtom);
  const reduceMotion = useReducedMotion();

  const [dni, setDni] = useState(data.state?.member?.dni ?? "");
  const [password, setPassword] = useState("");
  const [busyStart, setBusyStart] = useState(false);
  const [busyStop, setBusyStop] = useState(false);
  const [error, setError] = useState<string | null>(data.error);
  useErrorToast(error);
  const [tick, setTick] = useState(() => Date.now());

  useEffect(() => {
    if (!data.state) return;
    const byMember = toActiveEntriesByMember(data.state.activeEntries || []);
    if (data.state.activeEntry?.memberId) {
      byMember[data.state.activeEntry.memberId] = data.state.activeEntry;
    }
    setRealtime((prev) => ({
      ...prev,
      member: data.state?.member ?? null,
      activeEntriesByMember: byMember,
      activeEntry: data.state?.activeEntry ?? null,
      scheduleToday: data.state?.scheduleToday ?? null,
      lastSyncAt: Date.now(),
    }));
  }, [data.state?.now, data.state?.member?.id, data.state?.activeEntry?.id, data.state?.scheduleToday?.id, setRealtime]);

  useEffect(() => {
    const memberDni = data.state?.member?.dni ?? "";
    if (!memberDni) return;
    setDni((prev) => prev || memberDni);
  }, [data.state?.member?.dni]);

  useEffect(() => {
    if (!realtime.activeEntry) return;
    const timer = window.setInterval(() => setTick(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [realtime.activeEntry?.id, realtime.activeEntry?.startAtIso]);

  const elapsed = useMemo(() => {
    if (!realtime.activeEntry?.startAtIso) return "00:00:00";
    const startMs = Date.parse(realtime.activeEntry.startAtIso);
    if (!Number.isFinite(startMs)) return "00:00:00";
    return formatElapsed((tick - startMs) / 1000);
  }, [realtime.activeEntry?.startAtIso, tick]);

  const onStart = useCallback(
    async (ev: React.FormEvent) => {
      ev.preventDefault();
      setError(null);
      if (!dni.trim() || !password.trim()) {
        setError("Introduce DNI y contraseña para fichar");
        return;
      }
      setBusyStart(true);
      try {
        const res = await api.fichaje.start({ dni: dni.trim(), password });
        if (!res.success) {
          setError(res.message || "No se pudo iniciar el fichaje");
          return;
        }
        const byMember = toActiveEntriesByMember(res.state.activeEntries || []);
        if (res.state.activeEntry?.memberId) {
          byMember[res.state.activeEntry.memberId] = res.state.activeEntry;
        }
        setRealtime((prev) => ({
          ...prev,
          member: res.state.member,
          activeEntriesByMember: byMember,
          activeEntry: res.state.activeEntry,
          scheduleToday: res.state.scheduleToday,
          lastSyncAt: Date.now(),
        }));
        setPassword("");
        pushToast({ kind: "success", title: "Fichaje iniciado" });
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudo iniciar el fichaje");
      } finally {
        setBusyStart(false);
      }
    },
    [api.fichaje, dni, password, pushToast, setRealtime],
  );

  const onStop = useCallback(async () => {
    setError(null);
    setBusyStop(true);
    try {
      const res = await api.fichaje.stop();
      if (!res.success) {
        setError(res.message || "No se pudo cerrar el fichaje");
        return;
      }
      const byMember = toActiveEntriesByMember(res.state.activeEntries || []);
      if (res.state.activeEntry?.memberId) {
        byMember[res.state.activeEntry.memberId] = res.state.activeEntry;
      }
      setRealtime((prev) => ({
        ...prev,
        member: res.state.member,
        activeEntriesByMember: byMember,
        activeEntry: res.state.activeEntry,
        scheduleToday: res.state.scheduleToday,
        lastSyncAt: Date.now(),
      }));
      pushToast({ kind: "success", title: "Fichaje finalizado" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cerrar el fichaje");
    } finally {
      setBusyStop(false);
    }
  }, [api.fichaje, pushToast, setRealtime]);

  const transition = reduceMotion ? { duration: 0 } : { duration: 0.22, ease: "easeOut" as const };

  return (
    <section aria-label="Fichaje" className="bo-content-grid bo-fichajePage">
      <div className="bo-panel bo-fichajePanel">
        <div className="bo-panelHead">
          <div>
            <div className="bo-panelTitle bo-fichajeTitle">
              <Clock3 size={16} strokeWidth={1.8} />
              Fichaje
            </div>
            <div className="bo-panelMeta">
              {realtime.wsConnected
                ? "Conectado en tiempo real"
                : realtime.wsConnecting
                  ? "Conectando tiempo real..."
                  : "Sincronización por API"}
            </div>
          </div>
          <div className={`bo-fichajeConn${realtime.wsConnected ? " is-live" : ""}`}>
            {realtime.wsConnected ? <Wifi size={15} strokeWidth={1.8} /> : <WifiOff size={15} strokeWidth={1.8} />}
            {realtime.wsConnected ? "WS" : "OFF"}
          </div>
        </div>

        <div className="bo-panelBody bo-fichajeBody">
          <AnimatePresence mode="wait" initial={false}>
            {realtime.activeEntry ? (
              <motion.div
                key="active"
                className="bo-fichajeRunning"
                initial={reduceMotion ? { opacity: 1 } : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduceMotion ? { opacity: 1 } : { opacity: 0, y: -8 }}
                transition={transition}
              >
                <div className="bo-fichajeStartSmall">Fichaje inicial · {realtime.activeEntry.startTime}</div>
                <div className="bo-fichajeCounter" aria-live="polite">
                  {elapsed}
                </div>
                <div className="bo-fichajeMemberName">{realtime.activeEntry.memberName}</div>
                <div className="bo-fichajeScheduleNote">
                  {realtime.scheduleToday
                    ? `Horario previsto: ${realtime.scheduleToday.startTime} - ${realtime.scheduleToday.endTime}`
                    : "Sin horario previsto para hoy"}
                </div>
                <button className="bo-btn bo-btn--ghost bo-fichajeStopBtn" type="button" disabled={busyStop} onClick={onStop}>
                  <Square size={16} strokeWidth={1.8} />
                  {busyStop ? "Cerrando..." : "Finalizar fichaje"}
                </button>
              </motion.div>
            ) : (
              <motion.form
                key="form"
                className="bo-fichajeForm"
                initial={reduceMotion ? { opacity: 1 } : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduceMotion ? { opacity: 1 } : { opacity: 0, y: -8 }}
                transition={transition}
                onSubmit={onStart}
              >
                <div className="bo-fichajeFormRow">
                  <label className="bo-label" htmlFor="bo-fichaje-dni">
                    DNI
                  </label>
                  <input
                    id="bo-fichaje-dni"
                    className="bo-input"
                    value={dni}
                    onChange={(ev) => setDni(ev.target.value)}
                    placeholder="00000000X"
                    autoComplete="off"
                  />
                </div>

                <div className="bo-fichajeFormRow">
                  <label className="bo-label" htmlFor="bo-fichaje-password">
                    Contraseña
                  </label>
                  <input
                    id="bo-fichaje-password"
                    type="password"
                    className="bo-input"
                    value={password}
                    onChange={(ev) => setPassword(ev.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                  />
                </div>

                <button className="bo-btn bo-btn--primary bo-fichajeStartBtn" type="submit" disabled={busyStart}>
                  <Play size={16} strokeWidth={1.8} />
                  {busyStart ? "Validando..." : "Fichar"}
                </button>
              </motion.form>
            )}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
