// Platform (superadmin) API client.
// Uses direct fetch — all platform endpoints are same-origin /api/admin/*
// and the session cookie is included automatically via credentials:include.

// ---- Types ----

export type PlatformRestaurant = {
  id: number;
  slug: string;
  name: string;
  avatar: string;
  cif: string;
  contactPhone: string;
  contactEmail: string;
  location: string;
  websiteUrl: string;
  isActive: boolean;
  createdAt: string;
  userCount: number;
  memberCount: number;
  bookingCount: number;
  domainCount: number;
  whatsappStatus: string;
};

export type PlatformUser = {
  id: number;
  email: string;
  username: string;
  name: string;
  isSuperadmin: boolean;
  mustChangePassword: boolean;
  createdAt: string;
  restaurants: { restaurantId: number; restaurantName: string; role: string }[];
  activeSessionCount: number;
};

export type PlatformSubscription = {
  id: number;
  restaurantId: number;
  restaurantName: string;
  featureKey: string;
  concept: string;
  amount: number;
  currency: string;
  frequency: string;
  isActive: boolean;
  startDate: string;
  nextRunAt: string;
};

export type PlatformWhatsAppInstance = {
  id: number;
  restaurantId: number;
  restaurantName: string;
  serverId: number;
  instanceName: string;
  connectedPhone: string;
  status: string;
  pairCode: string;
  isActive: boolean;
  connectedAt: string;
  updatedAt: string;
};

export type PlatformDomain = {
  id: number;
  restaurantId: number;
  restaurantName: string;
  domain: string;
  isPrimary: boolean;
  registrationStatus: string;
  stripePaymentStatus: string;
  registrationCost: number;
  autoRenew: boolean;
  createdAt: string;
};

export type PlatformDashboard = {
  success: boolean;
  metrics: {
    restaurants: number;
    users: number;
    superadmins: number;
    activeSessions: number;
    subscriptions: number;
    activeSubscriptions: number;
    domains: number;
    whatsappInstances: number;
    monthlyRecurringRevenue: number;
  };
};

export type PlatformUAZAPIServer = {
  id: number;
  name: string;
  provider: string;
  baseUrl: string;
  capacity: number;
  usedCount: number;
  isActive: boolean;
};

// ---- API ----

async function platformGet<T>(path: string): Promise<T> {
  const res = await fetch(`/api${path}`, { credentials: "include" });
  return res.json();
}

async function platformPost<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method: "POST",
    credentials: "include",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json();
}

async function platformPatch<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

async function platformDelete<T>(path: string): Promise<T> {
  const res = await fetch(`/api${path}`, { method: "DELETE", credentials: "include" });
  return res.json();
}

export const platformAPI = {
  // Dashboard
  getDashboard: () => platformGet<PlatformDashboard>("/admin/platform/dashboard"),

  // Restaurants
  listRestaurants: () => platformGet<{ success: boolean; restaurants: PlatformRestaurant[] }>("/admin/platform/restaurants"),
  createRestaurant: (data: { slug: string; name: string; cif?: string; contactPhone?: string; contactEmail?: string; location?: string; websiteUrl?: string }) =>
    platformPost<{ success: boolean; restaurantId?: number; message?: string }>("/admin/platform/restaurants", data),
  patchRestaurant: (id: number, data: { name?: string; cif?: string; contactPhone?: string; contactEmail?: string; location?: string; websiteUrl?: string }) =>
    platformPatch<{ success: boolean; message?: string }>(`/admin/platform/restaurants/${id}`, data),
  deactivateRestaurant: (id: number) =>
    platformPost<{ success: boolean; message: string }>(`/admin/platform/restaurants/${id}/deactivate`),
  activateRestaurant: (id: number) =>
    platformPost<{ success: boolean; message: string }>(`/admin/platform/restaurants/${id}/activate`),

  // Users
  listUsers: () => platformGet<{ success: boolean; users: PlatformUser[] }>("/admin/platform/users"),
  createUser: (data: { email: string; name: string; password: string; isSuperadmin?: boolean; restaurantId?: number; role?: string }) =>
    platformPost<{ success: boolean; userId?: number; message?: string }>("/admin/platform/users", data),
  patchUser: (id: number, data: { name?: string; isSuperadmin?: boolean; mustChangePassword?: boolean }) =>
    platformPatch<{ success: boolean }>(`/admin/platform/users/${id}`, data),
  resetUserPassword: (id: number, newPassword: string) =>
    platformPost<{ success: boolean; message: string }>(`/admin/platform/users/${id}/password`, { newPassword }),
  revokeUserSessions: (id: number) =>
    platformPost<{ success: boolean; message: string }>(`/admin/platform/users/${id}/revoke-sessions`),
  assignUser: (id: number, restaurantId: number, role: string) =>
    platformPost<{ success: boolean }>(`/admin/platform/users/${id}/assign`, { restaurantId, role }),
  unassignUser: (id: number, restaurantId: number) =>
    platformDelete<{ success: boolean }>(`/admin/platform/users/${id}/assign/${restaurantId}`),

  // Subscriptions
  listSubscriptions: () => platformGet<{ success: boolean; subscriptions: PlatformSubscription[] }>("/admin/platform/subscriptions"),
  toggleSubscription: (id: number, isActive: boolean) =>
    platformPost<{ success: boolean }>(`/admin/platform/subscriptions/${id}/toggle`, { isActive }),

  // WhatsApp
  listWhatsApp: () => platformGet<{ success: boolean; instances: PlatformWhatsAppInstance[] }>("/admin/platform/whatsapp"),
  renewWhatsAppQR: (id: number) =>
    platformPost<{ success: boolean; connection?: unknown; message?: string }>(`/admin/platform/whatsapp/${id}/renew-qr`),
  disconnectWhatsApp: (id: number) =>
    platformPost<{ success: boolean; message: string }>(`/admin/platform/whatsapp/${id}/disconnect`),

  // UAZAPI Servers
  listUAZAPIServers: () => platformGet<{ success: boolean; servers: PlatformUAZAPIServer[] }>("/admin/platform/uazapi-servers"),

  // Domains
  listDomains: () => platformGet<{ success: boolean; domains: PlatformDomain[] }>("/admin/platform/domains"),

  // Stripe
  listStripePayments: () => platformGet<{ success: boolean; localEvents: unknown[]; livePayments: unknown[] }>("/admin/platform/stripe/payments"),
  refundStripe: (data: { chargeId?: string; paymentIntentId?: string; amount?: number; reason?: string }) =>
    platformPost<{ success: boolean; refund?: unknown; message?: string }>("/admin/platform/stripe/refund", data),
};
