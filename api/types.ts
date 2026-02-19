import type { BORole, BOSection } from "../lib/rbac";

export type BOUser = {
  id: number;
  email: string;
  username?: string | null;
  name: string;
  role: BORole;
  roleImportance: number;
  sectionAccess: BOSection[];
  mustChangePassword?: boolean;
};

export type BORestaurant = {
  id: number;
  slug: string;
  name: string;
};

export type BOSession = {
  user: BOUser;
  restaurants: BORestaurant[];
  activeRestaurantId: number;
};

export type APIError = {
  success: false;
  message: string;
  code?: string;
};

export type APISuccess<T extends Record<string, unknown> = Record<string, never>> = {
  success: true;
} & T;

export type Booking = {
  id: number;
  customer_name: string;
  contact_email: string;
  reservation_date: string;
  reservation_time: string;
  party_size: number;
  contact_phone: string | null;
  contact_phone_country_code: string | null;
  status: string | null;
  arroz_type: string | null;
  arroz_servings: string | null;
  commentary: string | null;
  babyStrollers: number | null;
  highChairs: number | null;
  table_number: string | null;
  added_date: string | null;
  special_menu: boolean;
  menu_de_grupo_id: number | null;
  principales_json: string | null;
};

export type CalendarDay = {
  date: string;
  booking_count: number;
  total_people: number;
  limit: number;
  is_open: boolean;
};

export type DashboardMetrics = {
  date: string;
  total: number;
  pending: number;
  confirmed: number;
  cancelled: number;
  totalPeople: number;
};

export type InvoiceDashboardMetrics = {
  pendingCount: number;
  pendingAmount: number;
  monthIncome: number;
  weekSentCount: number;
};

export type MenuVisibilityItem = {
  menuKey: string;
  menuName: string;
  isActive: boolean;
  updatedAt?: string;
};

export type MenuDish = {
  num: number;
  descripcion: string;
  tipo: string;
  alergenos: string[];
  active: boolean;
};

export type MenuTable = {
  table: string;
  price: string | null;
  dishes: MenuDish[];
};

export type Postre = {
  num: number;
  descripcion: string;
  alergenos: string[];
  active: boolean;
  precio?: number;
};

export type Vino = {
  num: number;
  tipo: string;
  nombre: string;
  precio: number;
  descripcion: string;
  bodega: string;
  denominacion_origen: string;
  graduacion: number;
  anyo: string;
  active: boolean;
  has_foto: boolean;
  foto_url?: string;
};

export type FoodItem = {
  num: number;
  tipo: string;
  nombre: string;
  precio: number;
  descripcion: string;
  titulo: string;
  suplemento: number;
  alergenos: string[];
  active: boolean;
  has_foto: boolean;
  foto_url?: string;
  categoria?: string;
  category_id?: number | null;
  category_slug?: string;
};

export type ComidaTipo = "vinos" | "cafes" | "postres" | "platos" | "bebidas";

export type FoodCategory = {
  id: number;
  name: string;
  slug: string;
  source: "base" | "custom";
  active: boolean;
};

export type ComidaItem = {
  num: number;
  tipo: string;
  nombre: string;
  precio: number;
  descripcion: string;
  active: boolean;
  has_foto: boolean;
  foto_url?: string;
  titulo?: string;
  suplemento?: number;
  alergenos?: string[];
  bodega?: string;
  denominacion_origen?: string;
  graduacion?: number;
  anyo?: string;
  categoria?: string;
  category_id?: number | null;
  category_slug?: string;
  source_type: ComidaTipo;
};

export type GroupMenuSummary = {
  id: number;
  menu_title: string;
  price: string;
  included_coffee: boolean;
  active: boolean;
  min_party_size: number;
  created_at?: string;
  modified_at?: string;
};

export type GroupMenu = {
  id: number;
  menu_title: string;
  price: string;
  included_coffee: boolean;
  active: boolean;
  menu_subtitle: any;
  entrantes: any;
  principales: any;
  postre: any;
  beverage: any;
  comments: any;
  min_party_size: number;
  main_dishes_limit: boolean;
  main_dishes_limit_number: number;
  created_at?: string;
  modified_at?: string;
};

export type GroupMenuV2Summary = {
  id: number;
  menu_title: string;
  price: string;
  active: boolean;
  is_draft: boolean;
  menu_type: string;
  created_at?: string;
  modified_at?: string;
};

export type GroupMenuV2Dish = {
  id: number;
  section_id: number;
  catalog_dish_id?: number | null;
  title: string;
  description: string;
  allergens: string[];
  supplement_enabled: boolean;
  supplement_price: number | null;
  price: number | null;
  active: boolean;
  position: number;
};

export type GroupMenuV2Section = {
  id: number;
  title: string;
  kind: string;
  position: number;
  dishes: GroupMenuV2Dish[];
};

export type GroupMenuV2Settings = {
  included_coffee: boolean;
  beverage: {
    type: string;
    price_per_person?: number | null;
    has_supplement?: boolean;
    supplement_price?: number | null;
  };
  comments: string[];
  min_party_size: number;
  main_dishes_limit: boolean;
  main_dishes_limit_number: number;
};

export type GroupMenuV2 = {
  id: number;
  menu_title: string;
  price: string;
  active: boolean;
  is_draft: boolean;
  menu_type: string;
  menu_subtitle: string[];
  settings: GroupMenuV2Settings;
  sections: GroupMenuV2Section[];
};

export type DishCatalogItem = {
  id: number;
  title: string;
  description: string;
  allergens: string[];
  default_supplement_enabled: boolean;
  default_supplement_price: number | null;
  updated_at?: string;
};

export type ConfigDayStatus = {
  date: string;
  isOpen: boolean;
};

export type OpeningMode = "morning" | "night" | "both";

export type WeekdayOpen = {
  monday: boolean;
  tuesday: boolean;
  wednesday: boolean;
  thursday: boolean;
  friday: boolean;
  saturday: boolean;
  sunday: boolean;
};

export type ConfigOpeningHours = {
  date: string;
  openingMode: OpeningMode;
  morningHours: string[];
  nightHours: string[];
  hours: string[];
  source?: "default" | "override";
};

export type ConfigMesasDeDos = {
  date: string;
  limit: string;
  source?: "default" | "override";
};

export type ConfigMesasDeTres = {
  date: string;
  limit: string;
  source?: "default" | "override";
};

export type ConfigSalonCondesa = {
  date: string;
  state: boolean;
};

export type ConfigDailyLimit = {
  date: string;
  limit: number;
  totalPeople: number;
  freeBookingSeats: number;
  source?: "default" | "override";
};

export type ConfigDefaults = {
  openingMode: OpeningMode;
  morningHours: string[];
  nightHours: string[];
  hours: string[];
  weekdayOpen: WeekdayOpen;
  dailyLimit: number;
  mesasDeDosLimit: string;
  mesasDeTresLimit: string;
};

export type ConfigFloor = {
  id: number;
  floorNumber: number;
  name: string;
  isGround: boolean;
  active: boolean;
};

export type RestaurantIntegrations = {
  n8nWebhookUrl: string;
  enabledEvents: string[];
  uazapiUrl: string;
  uazapiToken: string;
  restaurantWhatsappNumbers: string[];
};

export type RestaurantBranding = {
  brandName: string;
  logoUrl: string;
  primaryColor: string;
  accentColor: string;
  emailFromName: string;
  emailFromAddress: string;
};

export type Member = {
  id: number;
  boUserId: number | null;
  firstName: string;
  lastName: string;
  email: string | null;
  dni: string | null;
  bankAccount: string | null;
  phone: string | null;
  photoUrl: string | null;
  weeklyContractHours: number;
  isCurrentUser?: boolean;
};

export type DeliveryAttempt = {
  channel: "email" | "whatsapp";
  target: string;
  sent: boolean;
  error?: string;
};

export type MemberInvitationPreview = {
  memberId: number;
  firstName: string;
  lastName: string;
  email: string | null;
  dni: string | null;
  phone: string | null;
  photoUrl: string | null;
  roleSlug: string;
  roleLabel: string;
  expiresAt: string;
  hasOnboardingGuid?: boolean;
};

export type InvitationOnboardingMember = {
  id: number;
  firstName: string;
  lastName: string;
  email: string | null;
  dni: string | null;
  phone: string | null;
  photoUrl: string | null;
  username?: string | null;
  roleSlug: string;
  roleLabel: string;
};

export type PasswordResetPreview = {
  memberId: number;
  firstName: string;
  lastName: string;
  email: string | null;
  username?: string | null;
  expiresAt: string;
};

export type MemberStatsPoint = {
  date: string;
  label: string;
  hours: number;
};

export type MemberStatsSummary = {
  workedHours: number;
  expectedHours: number;
  progressPercent: number;
  weeklyWorkedHours: number;
  weeklyContractHours: number;
  weeklyProgressPercent: number;
};

export type MemberStats = {
  view: "weekly" | "monthly" | "quarterly" | "yearly";
  date: string;
  startDate: string;
  endDate: string;
  points: MemberStatsPoint[];
  summary: MemberStatsSummary;
};

export type MemberTimeBalance = {
  quarter: {
    startDate: string;
    endDate: string;
    cutoffDate: string;
    label: string;
  };
  weeklyContractHours: number;
  workedHours: number;
  expectedHours: number;
  balanceHours: number;
};

export type MemberStatsTableRow = {
  date: string;
  label: string;
  workedHours: number;
  expectedHours: number;
  difference: number;
};

export type MemberYearStats = {
  year: number;
  totalWorkedHours: number;
  totalExpectedHours: number;
  balance: number;
  months: MemberStatsTableRow[];
  quarters: MemberStatsTableRow[];
  weeks: MemberStatsTableRow[];
};

export type RoleCatalogItem = {
  slug: BORole;
  label: string;
  sortOrder: number;
  importance: number;
  level: number;
  iconKey: string;
  isSystem: boolean;
  permissions: string[];
};

export type RoleUserItem = {
  id: number;
  email: string;
  name: string;
  role: BORole;
  roleImportance: number;
};

export type RoleCurrentUser = {
  id: number;
  role: BORole;
  roleImportance: number;
};

export type FichajeMemberRef = {
  id: number;
  fullName: string;
  dni: string | null;
};

export type FichajeActiveEntry = {
  id: number;
  memberId: number;
  memberName: string;
  workDate: string;
  startTime: string;
  startAtIso: string;
};

export type FichajeSchedule = {
  id: number;
  memberId: number;
  memberName: string;
  date: string;
  startTime: string;
  endTime: string;
  updatedAt: string;
};

export type TimeEntry = {
  id: number;
  memberId: number;
  memberName: string;
  workDate: string;
  startTime: string;
  endTime: string | null;
  minutesWorked: number;
  source: string;
};

export type FichajeState = {
  now: string;
  member: FichajeMemberRef | null;
  activeEntry: FichajeActiveEntry | null;
  activeEntries: FichajeActiveEntry[];
  scheduleToday: FichajeSchedule | null;
};

export type HorarioMonthPoint = {
  date: string;
  assignedCount: number;
};

// Currency types
export type CurrencyCode = "EUR" | "USD" | "GBP";

export type CurrencyConfig = {
  code: CurrencyCode;
  symbol: string;
  name: string;
  exchangeRateToEUR: number; // Rate to convert to EUR (base currency)
};

export type CurrencySettings = {
  defaultCurrency: CurrencyCode;
  currencies: CurrencyConfig[];
};

export const CURRENCY_OPTIONS: { value: CurrencyCode; label: string; symbol: string }[] = [
  { value: "EUR", label: "Euro", symbol: "€" },
  { value: "USD", label: "Dólar estadounidense", symbol: "$" },
  { value: "GBP", label: "Libra esterlina", symbol: "£" },
];

// Exchange rates configuration (rates to convert TO EUR)
// Example: 1 USD = 0.92 EUR, 1 GBP = 1.18 EUR
export const DEFAULT_CURRENCY_RATES: Record<CurrencyCode, number> = {
  EUR: 1,
  USD: 0.92,
  GBP: 1.18,
};

export const CURRENCY_SYMBOLS: Record<CurrencyCode, string> = {
  EUR: "€",
  USD: "$",
  GBP: "£",
};

export function formatCurrency(amount: number, currency: CurrencyCode): string {
  const symbol = CURRENCY_SYMBOLS[currency] || "€";
  return `${symbol}${amount.toFixed(2)}`;
}

export function convertCurrency(amount: number, fromCurrency: CurrencyCode, toCurrency: CurrencyCode): number {
  if (fromCurrency === toCurrency) return amount;

  // Convert to EUR first, then to target currency
  const rates = DEFAULT_CURRENCY_RATES;
  const amountInEUR = amount / rates[fromCurrency];
  return amountInEUR * rates[toCurrency];
}

export type InvoiceStatus = "borrador" | "solicitada" | "pendiente" | "enviada" | "pagada";
export type PaymentMethod = "efectivo" | "tarjeta" | "transferencia" | "bizum" | "cheque";
export type InvoiceCategory = "reserva" | "productos" | "servicios" | "otros" | "nota_credito";

export const INVOICE_CATEGORY_OPTIONS: { value: InvoiceCategory; label: string }[] = [
  { value: "reserva", label: "Reserva" },
  { value: "productos", label: "Productos" },
  { value: "servicios", label: "Servicios" },
  { value: "otros", label: "Otros" },
  { value: "nota_credito", label: "Nota de credito" },
];

export type InvoicePayment = {
  id: number;
  invoice_id: number;
  amount: number;
  payment_method: PaymentMethod;
  payment_date: string;
  notes?: string;
  created_at: string;
};

export type InvoicePaymentInput = {
  amount: number;
  payment_method: PaymentMethod;
  payment_date: string;
  notes?: string;
};

export type InvoiceAddress = {
  street?: string;
  number?: string;
  postal_code?: string;
  city?: string;
  province?: string;
  country?: string;
};

export type InvoiceAttachment = {
  id: number;
  invoice_id: number;
  filename: string;
  original_name: string;
  mime_type: string;
  size: number;
  url: string;
  created_at: string;
};

export type Invoice = {
  id: number;
  restaurant_id: number;
  invoice_number?: string;
  customer_name: string;
  customer_surname?: string;
  customer_email: string;
  customer_dni_cif?: string;
  customer_phone?: string;
  customer_address_street?: string;
  customer_address_number?: string;
  customer_address_postal_code?: string;
  customer_address_city?: string;
  customer_address_province?: string;
  customer_address_country?: string;
  amount: number;
  currency: CurrencyCode;
  original_amount?: number;
  original_currency?: CurrencyCode;
  exchange_rate?: number;
  iva_rate?: number;
  iva_amount?: number;
  total?: number;
  payment_method?: PaymentMethod;
  account_image_url?: string;
  attachments?: InvoiceAttachment[];
  invoice_date: string;
  due_date?: string | null;
  payment_date?: string;
  status: InvoiceStatus;
  is_reservation?: boolean;
  reservation_id?: number;
  reservation_date?: string;
  reservation_customer_name?: string;
  reservation_party_size?: number;
  internal_notes?: string;
  pdf_url?: string;
  pdf_template?: PdfTemplateType;
  // Payment tracking fields
  paid_amount?: number;
  payments?: InvoicePayment[];
  category?: InvoiceCategory;
  tags?: string[];
  // Line items for detailed invoices
  line_items?: InvoiceLineItem[];
  // Discount fields
  discount_type?: "percentage" | "fixed";
  discount_value?: number;
  discount_amount?: number;
  discount_reason?: string;
  // Reminder tracking fields
  has_reminder_sent?: boolean;
  last_reminder_sent_at?: string | null;
  reminders_count?: number;
  // Invoice split tracking fields
  is_split_parent?: boolean;
  is_split_child?: boolean;
  split_parent_id?: number | null;
  split_percentage?: number | null;
  // Credit note tracking fields
  is_credit_note?: boolean;
  original_invoice_id?: number | null;
  original_invoice_number?: string | null;
  // Recurring billing fields
  recurring_invoice_id?: number | null;
  // Deposit tracking fields
  deposit_type?: InvoiceDepositType | null;
  deposit_amount?: number | null;
  remaining_balance?: number | null;
  final_invoice_id?: number | null;
  final_invoice_number?: string | null;
  created_at: string;
  updated_at: string;
};

export type InvoiceListParams = {
  search?: string;
  search_by?: "name" | "email" | "invoice_number";
  status?: InvoiceStatus;
  category?: InvoiceCategory;
  tag?: string;
  date_type?: "invoice_date" | "reservation_date";
  date_from?: string;
  date_to?: string;
  due_date_from?: string;
  due_date_to?: string;
  is_overdue?: boolean;
  is_reservation?: boolean;
  is_credit_note?: boolean;
  sort?: "amount_asc" | "amount_desc" | "date_asc" | "date_desc";
  page?: number;
  limit?: number;
};

export type InvoiceInput = {
  invoice_number?: string;
  customer_name: string;
  customer_surname?: string;
  customer_email: string;
  customer_dni_cif?: string;
  customer_phone?: string;
  customer_address_street?: string;
  customer_address_number?: string;
  customer_address_postal_code?: string;
  customer_address_city?: string;
  customer_address_province?: string;
  customer_address_country?: string;
  amount: number;
  currency: CurrencyCode;
  original_amount?: number;
  original_currency?: CurrencyCode;
  exchange_rate?: number;
  iva_rate?: number;
  iva_amount?: number;
  total?: number;
  payment_method?: PaymentMethod;
  account_image_url?: string;
  invoice_date: string;
  due_date?: string;
  payment_date?: string;
  status: InvoiceStatus;
  is_reservation?: boolean;
  reservation_id?: number;
  reservation_date?: string;
  reservation_customer_name?: string;
  reservation_party_size?: number;
  internal_notes?: string;
  pdf_template?: PdfTemplateType;
  category?: InvoiceCategory;
  tags?: string[];
  // Line items for detailed invoices
  line_items?: InvoiceLineItemInput[];
  // Discount fields
  discount_type?: "percentage" | "fixed";
  discount_value?: number;
  discount_amount?: number;
  discount_reason?: string;
  // Credit note fields
  is_credit_note?: boolean;
  original_invoice_id?: number;
  // Recurring billing fields
  recurring_invoice_id?: number;
  // Deposit tracking fields
  deposit_type?: InvoiceDepositType | null;
  deposit_amount?: number | null;
  remaining_balance?: number | null;
  final_invoice_id?: number | null;
};

export type ReservationSearchResult = {
  id: number;
  customer_name: string;
  contact_email: string;
  contact_phone: string;
  reservation_date: string;
  reservation_time: string;
  party_size: number;
};

export type InvoiceListResponse = {
  success: boolean;
  invoices: Invoice[];
  total: number;
  page: number;
  limit: number;
};

export type InvoiceResponse = {
  success: boolean;
  invoice?: Invoice;
  message?: string;
  id?: number;
  pdf_url?: string;
};

// Invoice Merge Types
export type InvoiceMergeInput = {
  invoice_ids: number[];
  delete_originals: boolean;
};

export type InvoiceMergeResponse = {
  success: boolean;
  invoice?: Invoice;
  message?: string;
  id?: number;
  deleted_count?: number;
};

// Invoice Split Types
export type InvoiceSplitMethod = "percentage" | "equal";

export type InvoiceSplitItem = {
  // For percentage method: percentage of original amount (0-100)
  // For equal method: not used, amount is calculated automatically
  percentage?: number;
  // Customer info for the split invoice
  customer_name: string;
  customer_email: string;
  customer_dni_cif?: string;
  customer_surname?: string;
  customer_phone?: string;
  customer_address_street?: string;
  customer_address_number?: string;
  customer_address_postal_code?: string;
  customer_address_city?: string;
  customer_address_province?: string;
  customer_address_country?: string;
};

export type InvoiceSplitInput = {
  // The original invoice to split
  source_invoice_id: number;
  // Method of splitting
  method: InvoiceSplitMethod;
  // Number of splits (for equal method) or list of items (for percentage method)
  split_count?: number; // For equal method: number of equal parts
  items?: InvoiceSplitItem[]; // For percentage method: custom split with customer details
};

export type InvoiceSplitResponse = {
  success: boolean;
  message?: string;
  // The original invoice (will be marked as split parent)
  source_invoice?: Invoice;
  // The newly created split invoices
  split_invoices?: Invoice[];
  // IDs of created invoices
  created_ids?: number[];
};

// Invoice Split Relationship (for tracking)
export type InvoiceSplitInfo = {
  id: number;
  source_invoice_id: number;
  split_invoice_id: number;
  split_percentage: number;
  created_at: string;
};

export type InvoiceSplitInfoResponse = {
  success: boolean;
  split_info?: InvoiceSplitInfo;
  child_invoices?: Invoice[];
  parent_invoice?: Invoice;
};

export type InvoiceNumberFormat = {
  prefix: string;
  suffix: string;
  startingNumber: number;
  format: string; // e.g., "F-{YYYY}-{0001}"
  paddingZeros: number;
};

// PDF Template types
export type PdfTemplateType = "basic" | "modern" | "classic";

export const PDF_TEMPLATE_OPTIONS: { value: PdfTemplateType; label: string; description: string }[] = [
  { value: "basic", label: "Basico", description: "Diseno simple y funcional" },
  { value: "modern", label: "Moderno", description: "Diseno limpio con colores" },
  { value: "classic", label: "Clasico", description: "Diseno tradicional profesional" },
];

export type RestaurantInvoiceSettings = {
  format: InvoiceNumberFormat;
  nextNumber: number;
  defaultPdfTemplate?: PdfTemplateType;
  default_payment_terms?: number;
};

export type InvoiceTemplate = {
  id: number;
  restaurant_id: number;
  name: string;
  customer_name: string;
  customer_surname?: string;
  customer_email: string;
  customer_dni_cif?: string;
  customer_phone?: string;
  customer_address_street?: string;
  customer_address_number?: string;
  customer_address_postal_code?: string;
  customer_address_city?: string;
  customer_address_province?: string;
  customer_address_country?: string;
  default_amount: number;
  default_iva_rate: number;
  default_payment_method?: PaymentMethod;
  notes?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type InvoiceTemplateInput = {
  name: string;
  customer_name: string;
  customer_surname?: string;
  customer_email: string;
  customer_dni_cif?: string;
  customer_phone?: string;
  customer_address_street?: string;
  customer_address_number?: string;
  customer_address_postal_code?: string;
  customer_address_city?: string;
  customer_address_province?: string;
  customer_address_country?: string;
  default_amount: number;
  default_iva_rate: number;
  default_payment_method?: PaymentMethod;
  notes?: string;
  is_active?: boolean;
};

export type InvoiceTemplateListResponse = {
  success: boolean;
  templates: InvoiceTemplate[];
  total: number;
};

export type InvoiceTemplateResponse = {
  success: boolean;
  template?: InvoiceTemplate;
  message?: string;
  id?: number;
};

// Invoice History / Audit Log Types
export type InvoiceHistoryAction =
  | "created"
  | "updated"
  | "status_changed"
  | "deleted"
  | "sent"
  | "duplicated"
  | "renumbered";

export type InvoiceHistory = {
  id: number;
  invoice_id: number;
  action: InvoiceHistoryAction;
  field_name?: string;
  old_value?: string;
  new_value?: string;
  user_id?: number;
  user_name?: string;
  user_email?: string;
  created_at: string;
};

export type InvoiceHistoryListResponse = {
  success: boolean;
  history: InvoiceHistory[];
  total: number;
};

// Invoice Renumbering Types
export type InvoiceRenumberPreview = {
  invoice_id: number;
  current_number: string | null;
  new_number: string;
  invoice_date: string;
  customer_name: string;
  amount: number;
  status: InvoiceStatus;
};

export type InvoiceRenumberInput = {
  startingNumber: number;
  generateByDate: boolean;
  dateFormat?: string; // e.g., "YYYY" for yearly, "YYYY-MM" for monthly
};

export type InvoiceRenumberResult = {
  success: boolean;
  message?: string;
  preview?: InvoiceRenumberPreview[];
  applied_count?: number;
  errors?: string[];
};

export type InvoiceRenumberAudit = {
  id: number;
  restaurant_id: number;
  previous_format: string;
  new_format: string;
  starting_number: number;
  generate_by_date: boolean;
  date_format?: string;
  affected_invoices: number;
  performed_by: number;
  performed_by_name: string;
  performed_at: string;
};

export type InvoiceRenumberAuditListResponse = {
  success: boolean;
  audits: InvoiceRenumberAudit[];
  total: number;
};

// Reminder Types
export type ReminderStatus = "pending" | "sent" | "failed";

export type InvoiceReminder = {
  id: number;
  invoice_id: number;
  template_id: number | null;
  template_name?: string;
  status: ReminderStatus;
  sent_at: string | null;
  sent_via: "email" | "whatsapp" | null;
  error_message?: string;
  created_at: string;
};

export type ReminderTemplate = {
  id: number;
  restaurant_id: number;
  name: string;
  subject?: string;
  body: string;
  send_via: "email" | "whatsapp";
  is_default: boolean;
  created_at: string;
  updated_at: string;
};

export type ReminderTemplateInput = {
  name: string;
  subject?: string;
  body: string;
  send_via: "email" | "whatsapp";
  is_default?: boolean;
};

export type ReminderTemplateListResponse = {
  success: boolean;
  templates: ReminderTemplate[];
  total: number;
};

export type ReminderTemplateResponse = {
  success: boolean;
  template?: ReminderTemplate;
  message?: string;
  id?: number;
};

export type SendReminderInput = {
  template_id?: number;
  custom_message?: string;
  send_via?: "email" | "whatsapp";
};

export type SendReminderResponse = {
  success: boolean;
  reminder?: InvoiceReminder;
  message?: string;
};

export type InvoiceReminderListResponse = {
  success: boolean;
  reminders: InvoiceReminder[];
  total: number;
};

// Invoice Reminder Settings
export type ReminderSettings = {
  auto_reminder_enabled: boolean;
  auto_reminder_days_after_due: number;
  auto_reminder_template_id: number | null;
  auto_reminder_send_via: "email" | "whatsapp";
};

export type ReminderSettingsResponse = {
  success: boolean;
  settings?: ReminderSettings;
  message?: string;
};

// Scheduled Reminder Types
export type ScheduledReminderFrequency = "once" | "daily" | "weekly" | "monthly";

export type ScheduledReminderStatus = "pending" | "sent" | "cancelled" | "failed";

export type ScheduledReminder = {
  id: number;
  invoice_id: number;
  invoice_number?: string;
  customer_name: string;
  template_id: number | null;
  template_name?: string;
  scheduled_date: string;
  scheduled_time: string;
  frequency: ScheduledReminderFrequency;
  status: ScheduledReminderStatus;
  send_via: "email" | "whatsapp";
  custom_message?: string;
  sent_at: string | null;
  error_message?: string;
  created_at: string;
  created_by: number;
  created_by_name: string;
  // For recurring reminders
  next_scheduled_date?: string | null;
  recurrence_count?: number;
  max_recurrences?: number | null;
};

export type ScheduledReminderInput = {
  invoice_id: number;
  template_id?: number | null;
  scheduled_date: string;
  scheduled_time: string;
  frequency: ScheduledReminderFrequency;
  send_via: "email" | "whatsapp";
  custom_message?: string;
  max_recurrences?: number | null;
};

export type ScheduledReminderUpdateInput = {
  scheduled_date?: string;
  scheduled_time?: string;
  frequency?: ScheduledReminderFrequency;
  template_id?: number | null;
  send_via?: "email" | "whatsapp";
  custom_message?: string;
  status?: ScheduledReminderStatus;
  max_recurrences?: number | null;
};

export type ScheduledReminderListParams = {
  status?: ScheduledReminderStatus;
  frequency?: ScheduledReminderFrequency;
  date_from?: string;
  date_to?: string;
  invoice_id?: number;
  page?: number;
  limit?: number;
};

export type ScheduledReminderResponse = {
  success: boolean;
  reminder?: ScheduledReminder;
  message?: string;
  id?: number;
};

export type ScheduledReminderListResponse = {
  success: boolean;
  reminders: ScheduledReminder[];
  total: number;
  page: number;
  limit: number;
};

// Auto-Reminder Rules Types
export type AutoReminderRule = {
  id: number;
  name: string;
  description?: string;
  is_active: boolean;
  // Trigger conditions
  trigger_type: "due_date" | "overdue" | "days_after_invoice" | "custom_date";
  trigger_days?: number | null;
  trigger_date?: string | null;
  // Reminder settings
  template_id: number | null;
  template_name?: string;
  send_via: "email" | "whatsapp";
  send_time: string; // HH:MM format
  // Frequency
  frequency: ScheduledReminderFrequency;
  max_recurrences?: number | null;
  // Filters
  invoice_status_filter?: string[] | null;
  invoice_category_filter?: string[] | null;
  exclude_invoice_ids?: number[] | null;
  created_at: string;
  updated_at: string;
};

export type AutoReminderRuleInput = {
  name: string;
  description?: string;
  is_active?: boolean;
  trigger_type: "due_date" | "overdue" | "days_after_invoice" | "custom_date";
  trigger_days?: number | null;
  trigger_date?: string | null;
  template_id?: number | null;
  send_via: "email" | "whatsapp";
  send_time: string;
  frequency: ScheduledReminderFrequency;
  max_recurrences?: number | null;
  invoice_status_filter?: string[] | null;
  invoice_category_filter?: string[] | null;
  exclude_invoice_ids?: number[] | null;
};

export type AutoReminderRuleUpdateInput = Partial<AutoReminderRuleInput>;

export type AutoReminderRuleResponse = {
  success: boolean;
  rule?: AutoReminderRule;
  message?: string;
  id?: number;
};

export type AutoReminderRuleListResponse = {
  success: boolean;
  rules: AutoReminderRule[];
  total: number;
};

// Invoice email sending types
export type InvoiceEmailParams = {
  subject?: string;
  message?: string;
};

export type InvoiceEmailResponse = {
  success: boolean;
  message?: string;
  sent_at?: string;
};

// Invoice Analytics Types

export type InvoiceAnalyticsMonthRevenue = {
  month: string; // YYYY-MM format
  monthLabel: string; // Human readable e.g. "Enero 2024"
  revenue: number;
  invoiceCount: number;
};

export type InvoiceAnalyticsStatusCount = {
  status: InvoiceStatus;
  count: number;
  amount: number;
  label: string;
};

export type InvoiceAnalyticsTopCustomer = {
  customerName: string;
  customerEmail: string;
  totalRevenue: number;
  invoiceCount: number;
};

export type InvoiceAnalyticsPaymentMethod = {
  method: PaymentMethod;
  count: number;
  amount: number;
  label: string;
};

export type InvoiceAnalyticsAverageValue = {
  month: string;
  monthLabel: string;
  averageValue: number;
  invoiceCount: number;
};

export type InvoiceAnalyticsSummary = {
  totalRevenue: number;
  totalInvoices: number;
  averageInvoiceValue: number;
  paidInvoices: number;
  pendingInvoices: number;
};

export type InvoiceAnalytics = {
  summary: InvoiceAnalyticsSummary;
  monthlyRevenue: InvoiceAnalyticsMonthRevenue[];
  statusDistribution: InvoiceAnalyticsStatusCount[];
  topCustomers: InvoiceAnalyticsTopCustomer[];
  averageValueTrend: InvoiceAnalyticsAverageValue[];
  paymentMethodDistribution: InvoiceAnalyticsPaymentMethod[];
};

// Public Invoice View Types (for customer-facing invoice lookup)
export type PublicInvoiceResponse = {
  success: boolean;
  invoice?: Invoice;
  message?: string;
};

export type PublicInvoicePDFResponse = {
  success: boolean;
  pdf_url?: string;
  message?: string;
};

// Tax Report Types (IVA Summary)

export type TaxReportType = "iva" | "irpf" | "summary";

export type TaxReportParams = {
  date_from: string;
  date_to: string;
  include_credit_notes?: boolean;
  tax_type?: TaxReportType;
  quarter?: string; // YYYY-Q format for quarterly reports
};

export type TaxReportIVABreakdown = {
  iva_rate: number; // e.g., 21, 10, 4
  base_amount: number; // Total base (without IVA)
  iva_amount: number; // Total IVA for this rate
  invoice_count: number;
  credit_note_count: number;
  credit_note_base: number;
  credit_note_iva: number;
};

export type TaxReportSummary = {
  total_base: number;
  total_iva: number;
  total: number;
  invoice_count: number;
  credit_note_count: number;
  credit_note_base: number;
  credit_note_iva: number;
  // Net amounts after credit notes
  net_base: number;
  net_iva: number;
  net_total: number;
};

export type TaxReportQuarterlyBreakdown = {
  quarter: string; // YYYY-Q format, e.g., "2024-Q1"
  quarterLabel: string; // e.g., "Q1 2024"
  start_date: string;
  end_date: string;
  base_amount: number;
  iva_amount: number;
  total: number;
  invoice_count: number;
  credit_note_count: number;
  credit_note_base: number;
  credit_note_iva: number;
};

export type TaxReportInvoiceItem = {
  id: number;
  invoice_number: string | null;
  customer_name: string;
  invoice_date: string;
  base_amount: number;
  iva_rate: number;
  iva_amount: number;
  total: number;
  status: InvoiceStatus;
  is_credit_note: boolean;
  original_invoice_id?: number;
};

export type TaxReport = {
  report_type: TaxReportType;
  date_from: string;
  date_to: string;
  generated_at: string;
  summary: TaxReportSummary;
  breakdown_by_rate: TaxReportIVABreakdown[];
  quarterly_breakdown: TaxReportQuarterlyBreakdown[];
  invoices: TaxReportInvoiceItem[];
};

export type TaxReportResponse = {
  success: boolean;
  report?: TaxReport;
  message?: string;
};

export type TaxReportExportFormat = "pdf" | "excel" | "csv";

export type TaxReportExportParams = {
  date_from: string;
  date_to: string;
  include_credit_notes?: boolean;
  format: TaxReportExportFormat;
  report_type?: TaxReportType;
  quarter?: string;
};

export type TaxReportExportResponse = {
  success: boolean;
  download_url?: string;
  filename?: string;
  message?: string;
};

// Customer Statement Types

export type CustomerStatementParams = {
  customer_name: string;
  date_from: string;
  date_to: string;
};

export type CustomerStatementInvoice = {
  id: number;
  invoice_number: string | null;
  invoice_date: string;
  description: string;
  due_date?: string;
  amount: number;
  iva_amount: number;
  total: number;
  status: InvoiceStatus;
  is_credit_note: boolean;
  original_invoice_id?: number;
};

export type CustomerStatementPayment = {
  id: number;
  invoice_id: number;
  invoice_number: string | null;
  payment_date: string;
  amount: number;
  payment_method: PaymentMethod;
  notes?: string;
};

export type CustomerStatementSummary = {
  total_invoiced: number;
  total_paid: number;
  total_pending: number;
  total_overdue: number;
  invoice_count: number;
  payment_count: number;
  credit_note_count: number;
  credit_note_amount: number;
};

export type CustomerStatement = {
  customer_name: string;
  customer_email?: string;
  customer_dni_cif?: string;
  customer_address?: string;
  date_from: string;
  date_to: string;
  generated_at: string;
  summary: CustomerStatementSummary;
  invoices: CustomerStatementInvoice[];
  payments: CustomerStatementPayment[];
  opening_balance: number;
  closing_balance: number;
};

export type CustomerStatementResponse = {
  success: boolean;
  statement?: CustomerStatement;
  message?: string;
};

// Credit Note Types

export type CreditNote = {
  id: number;
  restaurant_id: number;
  invoice_id: number;
  credit_note_number: string;
  customer_name: string;
  customer_email: string;
  customer_dni_cif?: string;
  original_invoice_number: string;
  amount: number;
  iva_rate: number;
  iva_amount: number;
  total: number;
  reason?: string;
  status: "borrador" | "validada" | "aplicada";
  credit_note_date: string;
  created_at: string;
  updated_at: string;
};

export type CreditNoteInput = {
  invoice_id: number;
  customer_name: string;
  customer_email: string;
  customer_dni_cif?: string;
  amount: number;
  iva_rate: number;
  reason?: string;
  credit_note_date: string;
};

export type CreditNoteResponse = {
  success: boolean;
  credit_note?: CreditNote;
  message?: string;
  id?: number;
};

export type CreditNoteListResponse = {
  success: boolean;
  credit_notes: CreditNote[];
  total: number;
  page: number;
  limit: number;
};

export type CreditNoteListParams = {
  search?: string;
  date_from?: string;
  date_to?: string;
  status?: string;
  invoice_id?: number;
  page?: number;
  limit?: number;
};

// Invoice Line Item Types
export type InvoiceLineItem = {
  id?: number;
  description: string;
  quantity: number;
  unit_price: number;
  iva_rate: number;
  iva_amount: number;
  total: number;
};

export type InvoiceLineItemInput = {
  description: string;
  quantity: number;
  unit_price: number;
  iva_rate: number;
};

// Invoice Comment Types
export type InvoiceComment = {
  id: number;
  invoice_id: number;
  content: string;
  user_id: number;
  user_name: string;
  created_at: string;
  updated_at: string | null;
};

export type InvoiceCommentInput = {
  content: string;
};

export type InvoiceCommentUpdateInput = {
  content: string;
};

export type InvoiceCommentResponse = {
  success: boolean;
  comment?: InvoiceComment;
  message?: string;
};

export type InvoiceCommentListResponse = {
  success: boolean;
  comments: InvoiceComment[];
  total: number;
};

// Deposit Types
export type InvoiceDepositType = "advance" | "deposit";

export const INVOICE_DEPOSIT_TYPE_OPTIONS: { value: InvoiceDepositType; label: string }[] = [
  { value: "advance", label: "Anticipo" },
  { value: "deposit", label: "Seña" },
];
