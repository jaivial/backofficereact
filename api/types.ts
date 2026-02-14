export type BOUser = {
  id: number;
  email: string;
  name: string;
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
  status: string | null;
  arroz_type: string | null;
  arroz_servings: string | null;
  babyStrollers: number | null;
  highChairs: number | null;
  table_number: string | null;
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

export type ConfigDayStatus = {
  date: string;
  isOpen: boolean;
};

export type ConfigOpeningHours = {
  date: string;
  hours: string[];
};

export type ConfigMesasDeDos = {
  date: string;
  limit: string;
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
