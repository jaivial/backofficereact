export type Settings = { isEnabled: boolean; stockMode: "OFF" | "SHADOW" | "LIVE"; coversMode: "MANUAL" | "SHADOW" | "LIVE"; timezone: string; businessDayCutoff: string; autoCloseVisit?: boolean; requireOpenShift?: boolean; receiptPrefix?: string };
export type ModifierOption = { id: number; name: string; priceDeltaCents: number; sortOrder?: number; isActive?: boolean };
/** A group of choices the guest picks for a product ("Talla", "Extras"). */
export type ModifierGroup = {
  id: number;
  name: string;
  /** OPTION = pick up to maxSelect; SUPPLEMENT = extras; COMBO = unlimited picks. */
  kind: "OPTION" | "SUPPLEMENT" | "COMBO";
  minSelect: number;
  /** 0 means unlimited (COMBO-style group). */
  maxSelect: number;
  sortOrder?: number;
  isActive?: boolean;
  options: ModifierOption[];
};
export type Product = { id: number; name: string; priceGrossCents: number; vatRate: number; categoryName?: string; isActive: boolean; modifierGroups?: ModifierGroup[] };
export type Table = { id: number; name: string; capacity: number; occupied: boolean; areaId?: number; areaName?: string };
export type TicketLine = {
  id: number;
  productId?: number | null;
  productName: string;
  quantity: number;
  unitPriceGrossCents: number;
  lineTotalGrossCents: number;
  vatRate?: number;
  status?: string;
  notes?: string;
  comped?: boolean;
  compReason?: string;
  tagIds?: number[];
  /** Chosen modifiers, snapshotted when the line was created. */
  modifiers?: { modifierOptionId?: number | null; name: string; priceDeltaCents: number; quantity: number }[];
  /**
   * Last change to the line (quantity edit, comp/uncomp, note). The sell screen
   * orders lines by this so the most recently touched line comes first. Absent
   * on responses that do not carry it, in which case the id order is kept.
   */
  updatedAt?: string;
};
export type Ticket = { id: number; ticketNumber?: string; version: number; status?: string; lines: TicketLine[]; subtotalGrossCents?: number; discountCents?: number; surchargeCents?: number; tipCents?: number; taxCents?: number; totalGrossCents: number; operatorMemberId?: number | null; note?: string };
export type Visit = { id: number; channel?: string; tableId?: number | null; tableName?: string; covers: number; status?: string; totalGrossCents?: number; parked?: boolean; parkedNote?: string; openedAt?: string; customerName?: string; customerTaxId?: string; ticket?: Ticket; tickets?: Ticket[] };
export type VisitSummary = Pick<Visit, "id" | "channel" | "tableId" | "tableName" | "covers" | "status" | "totalGrossCents" | "parked" | "parkedNote"> & { openedAt?: string; lineCount?: number };
export type Tag = { id: number; name: string; color?: string; scope?: string; isActive?: boolean };
export type Area = { id: number; name: string };
export type Operator = { id: number; displayName: string; isActive?: boolean };
export type ShiftSummary = { id: number; status: string; openedAt?: string; closedAt?: string | null };
export type RestaurantProfile = { name: string; taxId?: string; address?: string; phone?: string; email?: string; logoUrl?: string };
export type StockStatus = "ok" | "low" | "out";
/** Modifier groups keyed by product id (the API sends JSON object string keys). */
export type ProductModifiers = Record<string, ModifierGroup[]>;
export type Bootstrap = { settings: Settings; restaurant?: RestaurantProfile; products: Product[]; productModifiers?: ProductModifiers; tables: Table[]; areas?: Area[]; visits: Visit[]; operators?: Operator[]; currentShift?: ShiftSummary | null; productStock?: Record<string, StockStatus> };
export type Reservation = { id: number; customerName: string; reservationDate: string; reservationTime: string; partySize: number; status: string; visitId?: number | null; visitStatus?: string | null };
