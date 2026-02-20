import React, { useEffect, useMemo, useRef } from "react";
import { useAtom, useAtomValue } from "jotai";

import { createClient } from "../../api/client";
import type { FichajeActiveEntry, FichajeSchedule, FichajeState } from "../../api/types";
import { fichajeRealtimeAtom, sessionAtom } from "../../state/atoms";

const BASE_RETRY_MS = 800;
const MAX_RETRY_MS = 8000;

function normalizedHost(): string {
  if (window.location.hostname !== "0.0.0.0") return window.location.host;
  return window.location.port ? `localhost:${window.location.port}` : "localhost";
}

function wsURL(): string {
  const proto = window.location.protocol === "https:" ? "wss" : "ws";
  return `${proto}://${normalizedHost()}/api/admin/fichaje/ws`;
}

function todayISO(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function toActiveEntriesByMember(raw: unknown): Record<number, FichajeActiveEntry> {
  if (!Array.isArray(raw)) return {};
  const out: Record<number, FichajeActiveEntry> = {};
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const entry = item as FichajeActiveEntry;
    if (!Number.isFinite(entry.memberId) || entry.memberId <= 0) continue;
    out[entry.memberId] = entry;
  }
  return out;
}

export function FichajeRealtimeBridge() {
  const session = useAtomValue(sessionAtom);
  const [, setState] = useAtom(fichajeRealtimeAtom);
  const api = useMemo(() => createClient({ baseUrl: "" }), []);
  const retryRef = useRef<number | null>(null);

  useEffect(() => {
    if (!session || !session.activeRestaurantId) {
      setState({
        wsConnected: false,
        wsConnecting: false,
        restaurantId: null,
        lastSyncAt: null,
        member: null,
        activeEntriesByMember: {},
        activeEntry: null,
        scheduleToday: null,
        pendingScheduleUpdates: false,
      });
      return;
    }

    let closed = false;
    let ws: WebSocket | null = null;
    let attempts = 0;

    const mergeFromState = (payload: FichajeState) => {
      const byMember = toActiveEntriesByMember(payload.activeEntries);
      if (payload.activeEntry && payload.activeEntry.memberId > 0) {
        byMember[payload.activeEntry.memberId] = payload.activeEntry;
      }
      setState((prev) => ({
        ...prev,
        restaurantId: session.activeRestaurantId,
        member: payload.member,
        activeEntriesByMember: byMember,
        activeEntry: payload.activeEntry,
        scheduleToday: payload.scheduleToday,
        lastSyncAt: Date.now(),
      }));
    };

    const applyScheduleUpdate = (schedule: FichajeSchedule | null | undefined) => {
      if (!schedule) return;
      setState((prev) => {
        if (!prev.member) return prev;
        if (schedule.memberId !== prev.member.id) return prev;
        if (schedule.date !== todayISO()) return prev;
        return { ...prev, scheduleToday: schedule, pendingScheduleUpdates: true, lastSyncAt: Date.now() };
      });
    };

    const syncNow = async () => {
      try {
        const res = await api.fichaje.getState();
        if (closed || !res.success) return;
        mergeFromState(res.state);
      } catch {
        // Keep websocket retries alive even if HTTP sync fails.
      }
    };

    const scheduleReconnect = () => {
      if (closed) return;
      const wait = Math.min(MAX_RETRY_MS, BASE_RETRY_MS * Math.pow(2, attempts));
      attempts += 1;
      retryRef.current = window.setTimeout(connect, wait);
    };

    const connect = () => {
      if (closed) return;
      setState((prev) => ({
        ...prev,
        wsConnected: false,
        wsConnecting: true,
        restaurantId: session.activeRestaurantId,
      }));

      ws = new WebSocket(wsURL());

      ws.onopen = () => {
        if (closed || !ws) return;
        attempts = 0;
        setState((prev) => ({ ...prev, wsConnected: true, wsConnecting: false }));
        ws.send(JSON.stringify({ type: "join_restaurant", restaurantId: session.activeRestaurantId }));
        void syncNow();
      };

      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(String(ev.data || "{}")) as any;
          if (!msg || typeof msg !== "object") return;
          if (msg.restaurantId && Number(msg.restaurantId) !== session.activeRestaurantId) return;

          const type = String(msg.type || "").toLowerCase();
          if (type === "hello" || type === "joined") {
            setState((prev) => {
              const nextByMember = toActiveEntriesByMember(msg.activeEntries);
              const hasOwnActive = Object.prototype.hasOwnProperty.call(msg, "activeEntry");
              const nextOwnActive = hasOwnActive ? (msg.activeEntry as FichajeActiveEntry | null) : prev.activeEntry;
              if (nextOwnActive && nextOwnActive.memberId > 0) {
                nextByMember[nextOwnActive.memberId] = nextOwnActive;
              }
              return {
                ...prev,
                activeEntriesByMember: nextByMember,
                activeEntry: nextOwnActive ?? null,
                lastSyncAt: Date.now(),
              };
            });
          } else if (type === "clock_started") {
            const started = (msg.activeEntry as FichajeActiveEntry | null) ?? null;
            setState((prev) => {
              if (!started || !started.memberId) return prev;
              const nextByMember = { ...prev.activeEntriesByMember, [started.memberId]: started };
              const nextOwnActive = prev.member && prev.member.id === started.memberId ? started : prev.activeEntry;
              return {
                ...prev,
                activeEntriesByMember: nextByMember,
                activeEntry: nextOwnActive,
                lastSyncAt: Date.now(),
              };
            });
          } else if (type === "clock_stopped") {
            const stopped = (msg.activeEntry as FichajeActiveEntry | null) ?? null;
            setState((prev) => {
              const nextByMember = { ...prev.activeEntriesByMember };
              if (stopped?.memberId) {
                delete nextByMember[stopped.memberId];
              }
              const nextOwnActive = prev.member && stopped?.memberId === prev.member.id ? null : prev.activeEntry;
              return {
                ...prev,
                activeEntriesByMember: nextByMember,
                activeEntry: nextOwnActive,
                lastSyncAt: Date.now(),
              };
            });
          } else if (type === "schedule_updated") {
            applyScheduleUpdate(msg.schedule as FichajeSchedule | null | undefined);
          } else if (type === "schedule_created") {
            applyScheduleUpdate(msg.schedule as FichajeSchedule | null | undefined);
          } else if (type === "schedule_deleted") {
            // When a schedule is deleted, clear the scheduleToday if it matches
            const deletedSchedule = msg.schedule as FichajeSchedule | null | undefined;
            if (deletedSchedule) {
              setState((prev) => {
                if (!prev.member) return prev;
                if (deletedSchedule.memberId !== prev.member.id) return prev;
                if (deletedSchedule.date !== todayISO()) return prev;
                // Clear schedule when deleted and mark as pending
                return { ...prev, scheduleToday: null, pendingScheduleUpdates: true, lastSyncAt: Date.now() };
              });
            }
          }
        } catch {
          // Ignore malformed realtime payloads.
        }
      };

      ws.onerror = () => {
        ws?.close();
      };

      ws.onclose = () => {
        if (closed) return;
        setState((prev) => ({ ...prev, wsConnected: false, wsConnecting: false }));
        scheduleReconnect();
      };
    };

    void syncNow();
    connect();

    return () => {
      closed = true;
      if (retryRef.current !== null) {
        window.clearTimeout(retryRef.current);
        retryRef.current = null;
      }
      try {
        ws?.close();
      } catch {
        // noop
      }
    };
  }, [api, session?.activeRestaurantId, session?.user.id, setState]);

  // Keep this component mounted globally.
  return null;
}
