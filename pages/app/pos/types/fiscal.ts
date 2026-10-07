/**
 * Spanish fiscal documents as the POS sees them.
 *
 * READ THE NOTICE: nothing the backend issues here is certified, signed or
 * filed with the AEAT, and it does not implement VERI*FACTU (RD 1007/2023).
 * The panel that renders these types says so on screen, and the backend sends
 * `certificationNotice` with every document so the wording lives in one place
 * instead of being retyped per screen.
 *
 * What the types model is the *structure* the law expects — a per-terminal
 * series, a number that is never reused, a rectifying invoice that names the
 * document it corrects, and a hash chained to the previous document — so that
 * the numbers and links are already historical facts when the certified
 * component arrives.
 */

export type POSFiscalDocumentType = "SIMPLIFICADA" | "RECTIFICATIVA";

export type POSFiscalLine = {
  name: string;
  quantity: string;
  unitCents: number;
  lineCents: number;
  vatRate: string;
  baseCents: number;
  taxCents: number;
  discountCents: number;
  line: number;
  isComponent?: boolean;
};

export type POSFiscalDocument = {
  id: number;
  documentType: POSFiscalDocumentType;
  seriesNumber?: number;
  fullNumber: string;
  terminalKey: string;
  issuedAt: string;
  issuerName: string;
  issuerTaxId?: string;
  customerName?: string | null;
  customerTaxId?: string | null;
  ticketNumber?: string;
  baseCents: number;
  taxCents: number;
  surchargeCents?: number;
  discountCents?: number;
  totalCents: number;
  /** Tax cents keyed by the whole-percent VAT rate, e.g. { "10": 300 }. */
  vatBreakdown?: Record<string, number>;
  lines?: POSFiscalLine[];
  /** SHA-256 of the document content chained to its predecessor. */
  contentHash?: string;
  previousHash?: string;
  copyNumber?: number;
  /** Always false today: no row is certified. Kept explicit so a UI can never
   *  accidentally assume a document is compliant just because it exists. */
  isCertified: boolean;
  correctsId?: number | null;
  correctsNumber?: string | null;
  correctionReason?: string;
  /** Sentence from the backend saying what the document is not. */
  certificationNotice: string;
};

export type POSFiscalSeries = {
  id: number;
  terminalKey: string;
  prefix: string;
  documentType: POSFiscalDocumentType;
  nextNumber: number;
  lastHash: string;
  isActive: boolean;
  issued: number;
};

export type POSFiscalChain = {
  seriesId: number;
  documents: number;
  chainIntact: boolean;
  problems: { id: number; fullNumber: string; problems: string[] }[];
  unverifiable?: number;
  checkedAt: string;
  whatThisIs: string;
  whatThisIsNot: string;
};

/**
 * One row of the "cobradas de hoy" list the fiscal panel offers when the till
 * has no open ticket. Deliberately small: enough to recognise the sale
 * (number, table, covers, total, when) and to fetch it by id.
 */
export interface POSPaidTicketSummary {
  id: number;
  ticketNumber: string;
  status: string;
  totalGrossCents: number;
  refundedCents?: number;
  tableName?: string;
  covers?: number;
  paidAt?: string;
}
