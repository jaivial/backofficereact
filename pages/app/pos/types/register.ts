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
/**
 * One component of a pack. Components sharing a slotGroup are alternatives the
 * operator chooses between; an empty slotGroup is a fixed part of the menu.
 */
export type PackComponent = { productId: number; productName: string; quantity: number; slotGroup?: string; isDefault: boolean; sortOrder?: number; vatRate?: number };
/**
 * A pack is a fixed-price menu ("Menú del día") sold as one line, whose
 * components expand underneath it. The price is the pack price, never the sum
 * of its parts.
 */
export type Pack = {
  id: number;
  name: string;
  description?: string;
  priceGrossCents: number;
  vatRate: number;
  isActive: boolean;
  sortOrder?: number;
  components: PackComponent[];
  /** Slot names in display order; a slot's options come from the components. */
  slots: string[];
};
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
  /** The pack this line was rung up from; the line carries the pack price. */
  packId?: number | null;
  /** Set on the component lines a pack expands into, pointing at the parent. */
  parentLineId?: number | null;
  /** Chosen modifiers, snapshotted when the line was created. */
  modifiers?: { modifierOptionId?: number | null; name: string; priceDeltaCents: number; quantity: number }[];
  /**
   * Last change to the line (quantity edit, comp/uncomp, note). The sell screen
   * orders lines by this so the most recently touched line comes first. Absent
   * on responses that do not carry it, in which case the id order is kept.
   */
  updatedAt?: string;
};
/** One row of GET /pos/tickets, used by the recall picker. */
export type TicketSummary = {
  id: number;
  visitId?: number;
  ticketNumber?: string;
  tableId?: number | null;
  tableName?: string | null;
  covers?: number;
  status?: string;
  totalGrossCents?: number;
  paidAt?: string | null;
  refundedCents?: number;
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
export type Bootstrap = { settings: Settings; restaurant?: RestaurantProfile; products: Product[]; productModifiers?: ProductModifiers; packs?: Pack[]; tables: Table[]; areas?: Area[]; visits: Visit[]; operators?: Operator[]; currentShift?: ShiftSummary | null; productStock?: Record<string, StockStatus> };
export type Reservation = { id: number; customerName: string; reservationDate: string; reservationTime: string; partySize: number; status: string; visitId?: number | null; visitStatus?: string | null };
