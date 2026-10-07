/** A remembered guest, as the search lists them. */
export type POSCustomerSummary = { id: number; displayName: string; phone: string; email: string; taxId: string; visits: number; lastVisitAt: string | null };

/**
 * The guest's profile. Everything under `stats`, `favourites` and `history` is
 * derived by the server from paid checks at read time; nothing here is stored
 * twice, so it cannot disagree with the tickets.
 */
export type POSCustomer = {
  id: number; displayName: string; phone: string; email: string; taxId: string; notes: string; createdAt: string; anonymised: boolean;
  stats: { visits: number; checks: number; spentCents: number; averageCheckCents: number; firstVisitAt: string | null; lastVisitAt: string | null };
  favourites: { productName: string; quantity: number }[];
  history: { ticketId: number; ticketNumber: string; status: string; totalGrossCents: number; refundedCents: number; serviceDate: string; tableName: string; paidAt: string | null }[];
};
