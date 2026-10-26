import { timingSafeEqual } from "node:crypto";
import type { IncomingHttpHeaders } from "node:http";
import { adminApiAuthHeaders } from "../api/adminApiAuth";

/*
 * Backend -> backoffice server calls (coordination id campaign_tools_v1).
 *
 * The Go backend reaches the backoffice server tools (campaign design engine,
 * email compiler) with the same server-only secrets the backoffice sends it on
 * every admin API call: Authorization (VAULT_KEY) and, when configured,
 * X-Bearer-Token (BEARER_TOKEN_KEY). Both sides already hold them, so no new
 * secret exists. Without VAULT_KEY the service path is closed (fail closed).
 */

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export function isBackendServiceRequest(headers: IncomingHttpHeaders): boolean {
  const expected = adminApiAuthHeaders();
  if (!expected.authorization) return false;
  for (const [name, value] of Object.entries(expected)) {
    const got = headers[name];
    if (typeof got !== "string" || !safeEqual(got.trim(), value)) return false;
  }
  return true;
}
