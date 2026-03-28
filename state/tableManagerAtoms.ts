import { atom } from "jotai";

export type TableSheetView = "list" | "table-detail";

export const tableSheetViewAtom = atom<TableSheetView>("list");
export const selectedTableCardIdAtom = atom<number | null>(null);
export const pendingAssignBookingIdAtom = atom<number | null>(null);
