export type Settings = { isEnabled: boolean; stockMode: "OFF" | "SHADOW" | "LIVE"; coversMode: "MANUAL" | "SHADOW" | "LIVE"; timezone: string; businessDayCutoff: string; autoCloseVisit?: boolean; requireOpenShift?: boolean; receiptPrefix?: string; /** A money-reducing action at or above this needs a manager PIN; null = no amount rule. */ pinThresholdCents?: number | null; /** Every discount and invitation needs a manager PIN. */ pinRequiredForDiscount?: boolean };
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
export type Product = { id: number; name: string; priceGrossCents: number; vatRate: number; categoryName?: string; isActive: boolean; modifierGroups?: ModifierGroup[]; allergens?: string[] };
/**
 * The allergens a product may declare, in the order the EU lists them. The
 * backend rejects anything outside this set, so the picker offers exactly these:
 * the declaration is rendered to the guest and has to be one that can be
 * defended.
 */
export const POS_ALLERGENS = [
  "Gluten", "Crustáceos", "Huevos", "Pescado", "Cacahuetes", "Soja", "Lácteos",
  "Frutos secos", "Apio", "Mostaza", "Sésamo", "Sulfitos", "Altramuz", "Moluscos",
  "Moluscos blasteados",
] as const;
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
  /**
   * How much of this line the kitchen already knows about, from the server's
   * dispatch history. Follows the line when it moves to another check, so a
   * reload, a second terminal or a split never makes a cooked dish look unsent.
   */
  kitchenSentQuantity?: number;
};
/** One course on a ticket, with how much of it the kitchen still has not seen. */
export type POSCourseSummary = {
  course: string;
  lines: number;
  firedLines: number;
  pendingLines: number;
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
export type Ticket = { id: number; ticketNumber?: string; guestLabel?: string; customerId?: number | null; customerName?: string; customerNotes?: string; version: number; status?: string; lines: TicketLine[]; subtotalGrossCents?: number; discountCents?: number; surchargeCents?: number; tipCents?: number; taxCents?: number; totalGrossCents: number; operatorMemberId?: number | null; note?: string };
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

/** One captured payment row of a ticket, as returned by the POS backend. */
export type POSPayment = { id: number; method: string; amountCents: number; tipCents?: number; provider?: string; cardLast4?: string; /** Cash handed over, when the cashier typed it; null otherwise. */ tenderedCents?: number | null; /** tendered - amount - tip; null when nothing was recorded. */ changeCents?: number | null };
