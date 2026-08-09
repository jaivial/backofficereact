import { useEffect } from "react";
import { useAtom, useAtomValue } from "jotai";

import { createClient } from "../../api/client";
import { createFichajeStateClient } from "../../api/fichaje-state-client";
import type {
  FichajeActiveEntry,
  FichajePosRevenue,
  FichajeSchedule,
  FichajeState,
} from "../../api/types";
import { fichajeRealtimeAtom, sessionAtom, type FichajeRealtimeState } from "../../state/atoms";

const BASE_RETRY_MS = 800;
const MAX_RETRY_MS = 8000;

type StateUpdater = (prev: FichajeRealtimeState) => FichajeRealtimeState;
type Subscriber = (update: StateUpdater) => void;

type FichajeSession = {
  activeRestaurantId: number;
  user: { id: number };
};

type FichajeConnection = {
  key: string;
  session: FichajeSession;
  subscribe: (subscriber: Subscriber) => () => void;
  stop: () => void;
};

const EMPTY_STATE = (restaurantId: number | null): FichajeRealtimeState => ({
  wsConnected: false,
  wsConnecting: false,
  restaurantId,
  lastSyncAt: null,
  member: null,
  activeEntriesByMember: {},
  activeEntry: null,
  scheduleToday: null,
  pendingScheduleUpdates: false,
  posRevenueToday: null,
  hourlyCosts: [],
  ticketSeries: [],
});

let activeConnection: FichajeConnection | null = null;

function normalizedHost(): string {
  return window.location.host;
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

function sessionKey(session: FichajeSession): string {
  return `${session.user.id}:${session.activeRestaurantId}`;
}

function createConnection(session: FichajeSession): FichajeConnection {
  const key = sessionKey(session);
  const subscribers = new Set<Subscriber>();
  const api = createFichajeStateClient({ baseUrl: "" });
  const client = createClient({ baseUrl: "" });
  let snapshot = EMPTY_STATE(session.activeRestaurantId);
  let retryTimer: number | null = null;
  let ws: WebSocket | null = null;
  let closed = false;
  let attempts = 0;
  let openedAtLeastOnce = false;

  const emit = (update: StateUpdater) => {
    snapshot = update(snapshot);
    subscribers.forEach((subscriber) => subscriber(update));
  };

  const mergeFromState = (payload: FichajeState) => {
    const byMember = toActiveEntriesByMember(payload.activeEntries);
    if (payload.activeEntry && payload.activeEntry.memberId > 0) {
      byMember[payload.activeEntry.memberId] = payload.activeEntry;
    }
    emit((prev) => ({
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
    emit((prev) => {
      if (!prev.member) return prev;
      if (schedule.memberId !== prev.member.id) return prev;
      if (schedule.date !== todayISO()) return prev;
      return { ...prev, scheduleToday: schedule, pendingScheduleUpdates: true, lastSyncAt: Date.now() };
    });
  };

  const scheduleReconnect = () => {
    if (closed || retryTimer !== null) return;
    const wait = Math.min(MAX_RETRY_MS, BASE_RETRY_MS * Math.pow(2, attempts));
    attempts += 1;
    retryTimer = window.setTimeout(() => {
      retryTimer = null;
      connect();
    }, wait);
  };

  const connect = () => {
    if (closed || ws) return;
    emit((prev) => ({
      ...prev,
      wsConnected: false,
      wsConnecting: true,
      restaurantId: session.activeRestaurantId,
    }));

    ws = new WebSocket(wsURL());

    ws.onopen = () => {
      if (closed || !ws) return;
      openedAtLeastOnce = true;
      attempts = 0;
      emit((prev) => ({ ...prev, wsConnected: true, wsConnecting: false }));
      ws.send(JSON.stringify({ type: "join_restaurant", restaurantId: session.activeRestaurantId }));
      // Initial state is fetched once during boot. Do not refetch on every WS open.
    };

    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(String(ev.data || "{}")) as any;
        if (!msg || typeof msg !== "object") return;
        if (msg.restaurantId && Number(msg.restaurantId) !== session.activeRestaurantId) return;

        const type = String(msg.type || "").toLowerCase();
        if (type === "hello" || type === "joined") {
          emit((prev) => {
            const nextByMember = toActiveEntriesByMember(msg.activeEntries);
            const hasOwnActive = Object.prototype.hasOwnProperty.call(msg, "activeEntry");
            const nextOwnActive = hasOwnActive
              ? (msg.activeEntry as FichajeActiveEntry | null)
              : prev.activeEntry;
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
          emit((prev) => {
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
          emit((prev) => {
            const nextByMember = { ...prev.activeEntriesByMember };
            if (stopped?.memberId) delete nextByMember[stopped.memberId];
            const nextOwnActive = prev.member && stopped?.memberId === prev.member.id ? null : prev.activeEntry;
            return {
              ...prev,
              activeEntriesByMember: nextByMember,
              activeEntry: nextOwnActive,
              lastSyncAt: Date.now(),
            };
          });
        } else if (type === "schedule_updated" || type === "schedule_created") {
          applyScheduleUpdate(msg.schedule as FichajeSchedule | null | undefined);
        } else if (type === "schedule_deleted") {
          const deletedSchedule = msg.schedule as FichajeSchedule | null | undefined;
          if (deletedSchedule) {
            emit((prev) => {
              if (!prev.member) return prev;
              if (deletedSchedule.memberId !== prev.member.id) return prev;
              if (deletedSchedule.date !== todayISO()) return prev;
              return { ...prev, scheduleToday: null, pendingScheduleUpdates: true, lastSyncAt: Date.now() };
            });
          }
        } else if (type === "pos_revenue_updated") {
          const revenue = msg as unknown as FichajePosRevenue & { type: string };
          emit((prev) => ({
            ...prev,
            posRevenueToday: {
              date: revenue.date,
              totalGrossCents: Number(revenue.totalGrossCents ?? 0),
              byHour: Array.isArray(revenue.byHour)
                ? revenue.byHour.map((h) => ({ hour: Number((h as { hour: number }).hour), grossCents: Number((h as { grossCents: number }).grossCents) }))
                : [],
            },
            lastSyncAt: Date.now(),
          }));
        }
      } catch {
        // Ignore malformed realtime payloads.
      }
    };

    ws.onerror = () => {
      ws?.close();
    };

    ws.onclose = () => {
      ws = null;
      if (closed) return;
      emit((prev) => ({ ...prev, wsConnected: false, wsConnecting: false }));
      if (openedAtLeastOnce) scheduleReconnect();
    };
  };

  const boot = async () => {
    try {
      // One preflight state request per persistent session connection. This is
      // the critical source of active clock entries — the WS is connected
      // afterwards regardless of auxiliary data fetches.
      const res = await api.getState();
      if (closed) return;
      if (!res.success) {
        emit(() => EMPTY_STATE(session.activeRestaurantId));
        return;
      }
      mergeFromState(res.state);
      const today = todayISO();

      // Auxiliary realtime data (POS income, hourly costs, 5' series) is
      // non-critical: each fetch is independent so one failing endpoint (e.g.
      // 403 when the role lacks POS access) can never reset the clock state or
      // prevent the WebSocket from connecting.
      const revRes = await client.pos.tickets.hourly({ date: today }).catch(() => null);
      const costsRes = await client.fichaje.hourlyCosts({ date: today }).catch(() => null);
      const seriesRes = await client.pos.tickets.series({ date: today }).catch(() => null);
      if (closed) return;
      emit((prev) => ({
        ...prev,
        posRevenueToday: revRes?.success
          ? { date: today, totalGrossCents: revRes.totalGrossCents, byHour: revRes.byHour }
          : prev.posRevenueToday,
        hourlyCosts: costsRes?.success ? costsRes.members : prev.hourlyCosts,
        ticketSeries: seriesRes?.success ? seriesRes.series : prev.ticketSeries,
      }));
    } catch {
      // Only a failure of the core fichaje state fetch lands here; keep the
      // snapshot rather than wiping it so a transient error does not blank the
      // panel or block the realtime socket.
    }
    if (closed) return;
    connect();
  };

  const connection: FichajeConnection = {
    key,
    session,
    subscribe(subscriber) {
      subscribers.add(subscriber);
      subscriber(() => snapshot);
      return () => {
        // Deliberately do not close the connection here. Vike/React can remount
        // layout consumers during navigation or lazy UI updates. The singleton
        // must keep the WS alive and avoid another state fetch.
        subscribers.delete(subscriber);
      };
    },
    stop() {
      closed = true;
      if (retryTimer !== null) {
        window.clearTimeout(retryTimer);
        retryTimer = null;
      }
      try {
        ws?.close();
      } catch {
        // noop
      }
      ws = null;
      subscribers.clear();
    },
  };

  void boot();
  return connection;
}

function getConnection(session: FichajeSession): FichajeConnection {
  const key = sessionKey(session);
  if (activeConnection?.key === key) return activeConnection;
  activeConnection?.stop();
  activeConnection = createConnection(session);
  return activeConnection;
}

export function FichajeRealtimeBridge() {
  const session = useAtomValue(sessionAtom);
  const [, setState] = useAtom(fichajeRealtimeAtom);

  useEffect(() => {
    if (!session || !session.activeRestaurantId || !session.user?.id) {
      activeConnection?.stop();
      activeConnection = null;
      setState(EMPTY_STATE(null));
      return;
    }

    const connection = getConnection({
      activeRestaurantId: session.activeRestaurantId,
      user: { id: session.user.id },
    });
    return connection.subscribe(setState);
  }, [session?.activeRestaurantId, session?.user?.id, setState]);

  return null;
}
