import { atom } from "jotai";
import type { BOSession, FichajeActiveEntry, FichajeMemberRef, FichajeSchedule } from "../api/types";

export type ThemeMode = "dark" | "light";

export const sessionAtom = atom<BOSession | null>(null);
export const sessionMovingExpirationAtom = atom<string | null>(null);
export const themeAtom = atom<ThemeMode>("dark");

export type ToastKind = "success" | "error" | "info";
export type Toast = {
  id: string;
  kind: ToastKind;
  title: string;
  message?: string;
  createdAt: number;
  timeoutMs: number;
};

export const toastsAtom = atom<Toast[]>([]);

export type FichajeRealtimeState = {
  wsConnected: boolean;
  wsConnecting: boolean;
  restaurantId: number | null;
  lastSyncAt: number | null;
  member: FichajeMemberRef | null;
  activeEntriesByMember: Record<number, FichajeActiveEntry>;
  activeEntry: FichajeActiveEntry | null;
  scheduleToday: FichajeSchedule | null;
  pendingScheduleUpdates: boolean;
};

export const fichajeRealtimeAtom = atom<FichajeRealtimeState>({
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
