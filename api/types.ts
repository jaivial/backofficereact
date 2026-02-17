import type { BORole, BOSection } from "../lib/rbac";

export type BOUser = {
  id: number;
  email: string;
  name: string;
  role: BORole;
  roleImportance: number;
  sectionAccess: BOSection[];
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
  view: "weekly" | "monthly" | "quarterly";
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

export type InvoiceStatus = "borrador" | "solicitada" | "pendiente" | "enviada";
export type PaymentMethod = "efectivo" | "tarjeta" | "transferencia" | "bizum" | "cheque";

export type InvoiceAddress = {
  street?: string;
  number?: string;
  postal_code?: string;
  city?: string;
  province?: string;
  country?: string;
};

export type Invoice = {
  id: number;
  restaurant_id: number;
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
  payment_method?: PaymentMethod;
  account_image_url?: string;
  invoice_date: string;
  payment_date?: string;
  status: InvoiceStatus;
  is_reservation: boolean;
  reservation_id?: number;
  reservation_date?: string;
  reservation_customer_name?: string;
  reservation_party_size?: number;
  pdf_url?: string;
  created_at: string;
  updated_at: string;
};

export type InvoiceListParams = {
  search?: string;
  status?: InvoiceStatus;
  date_type?: "invoice_date" | "reservation_date";
  date_from?: string;
  date_to?: string;
  is_reservation?: boolean;
  sort?: "amount_asc" | "amount_desc" | "date_asc" | "date_desc";
  page?: number;
  limit?: number;
};

export type InvoiceInput = {
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
  payment_method?: PaymentMethod;
  account_image_url?: string;
  invoice_date: string;
  payment_date?: string;
  status: InvoiceStatus;
  is_reservation: boolean;
  reservation_id?: number;
  reservation_date?: string;
  reservation_customer_name?: string;
  reservation_party_size?: number;
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
