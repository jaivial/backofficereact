// Shared admin-API credential holder (VAULT_KEY).
//
// The Go backend demands `Authorization: Bearer VAULT_KEY` on every
// /api/admin/* route (REST + WebSocket). Browser calls never need it because
// the SSR proxy injects the secret server-side, but SSR data hooks talk to the
// backend DIRECTLY (baseUrl = backendOrigin), so they must present it too.
//
// The header value lives in server memory only, registered once by the SSR
// entry (server/index.ts). Nothing here is ever inlined into the browser
// bundle: the browser branch of the API client never calls into this module.
//
// Coordination id: vault_key_auth_v1

const REGISTRY_KEY = "__vc_admin_api_auth_header__";

type AuthRegistry = Record<string, unknown>;

function registry(): AuthRegistry {
  return globalThis as unknown as AuthRegistry;
}

// registerAdminApiAuth stores the ready-to-use header value, e.g.
// "Bearer <vault key>". Passing null/empty clears it (enforcement disabled).
export function registerAdminApiAuth(header: string | null): void {
  const value = typeof header === "string" ? header.trim() : "";
  registry()[REGISTRY_KEY] = value || null;
}

// adminApiAuthHeader returns the registered header value, or null when the
// backend has vault-key enforcement disabled (no VAULT_KEY configured).
export function adminApiAuthHeader(): string | null {
  const value = registry()[REGISTRY_KEY];
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

// Coordination id: stripe_connect_multitenant_v1 - second server-only secret
// (BEARER_TOKEN_KEY) sent as X-Bearer-Token on every backend request.
const BEARER_REGISTRY_KEY = "__vc_admin_api_bearer_token__";

export function registerAdminApiBearerToken(token: string | null): void {
  const value = typeof token === "string" ? token.trim() : "";
  registry()[BEARER_REGISTRY_KEY] = value || null;
}

// adminApiAuthHeaders returns every server-side auth header for the Go admin
// API. Single source for SSR fetches, the /api proxy and the WS proxy.
export function adminApiAuthHeaders(): Record<string, string> {
  const out: Record<string, string> = {};
  const auth = adminApiAuthHeader();
  if (auth) out.authorization = auth;
  const bearer = registry()[BEARER_REGISTRY_KEY];
  if (typeof bearer === "string" && bearer.trim() !== "") out["x-bearer-token"] = bearer.trim();
  return out;
}
