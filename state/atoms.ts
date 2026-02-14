import { atom } from "jotai";
import type { BOSession } from "../api/types";

export type ThemeMode = "dark" | "light";

export const sessionAtom = atom<BOSession | null>(null);
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

