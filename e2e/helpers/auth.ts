/**
 * Authentication helpers for E2E tests.
 *
 * One login implementation shared by global-setup (cookie pre-seed/cache) and
 * the session fixture (per-context login), plus cookie injection used by
 * codegen/quick specs and a file-backed session cache.
 */
import type { Page } from "@playwright/test";
import * as path from "path";
import * as fs from "fs";

import { e2eEnv } from "../config";

export interface LoginInput {
  baseURL: string;
  email: string;
  password: string;
}

export interface LoginResult {
  /** Value of the `bo_session` cookie. */
  boSession: string;
}

/**
 * Log in via the backoffice JSON API from a real browser page and return the
 * `bo_session` cookie value. The page's context keeps the cookie so the caller
 * can navigate straight to an authenticated route afterwards.
 */
export async function login(page: Page, input: LoginInput): Promise<LoginResult> {
  await page.goto(input.baseURL, { waitUntil: "load", timeout: 30_000 });

  const res = await page.evaluate(
    async ({ url, email, password }: { url: string; email: string; password: string }) => {
      try {
        const r = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ identifier: email, password }),
          credentials: "include",
        });
        let data: { success?: boolean; message?: string } | null = null;
        try {
          data = await r.json();
        } catch {
          /* non-JSON body */
        }
        return { ok: r.ok, success: data?.success, message: data?.message, status: r.status };
      } catch (e) {
        return { ok: false, success: false, message: (e as Error).message, status: 0 };
      }
    },
    { url: `${input.baseURL}/api/admin/login`, email: input.email, password: input.password },
  );

  if (!res.ok || !res.success) {
    throw new Error(`Login failed: ${res.message ?? "unknown error"} (status ${res.status})`);
  }

  // bo_session is HttpOnly — read it from the browser context, not document.cookie.
  const cookies = await page.context().cookies(input.baseURL);
  const bo = cookies.find((c) => c.name === "bo_session");
  if (!bo) throw new Error("No bo_session cookie found after login");
  return { boSession: bo.value };
}

/**
 * Inject a `bo_session` cookie into a page context. Used by codegen traces and
 * quick specs that want to skip the login round-trip when they already hold a
 * token (e.g. read from the session cache).
 */
export async function injectSessionCookie(
  page: Page,
  token: string,
  domain = new URL(e2eEnv.baseURL).hostname,
): Promise<void> {
  await page.context().addCookies([
    {
      name: "bo_session",
      value: token,
      domain,
      path: "/",
      httpOnly: true,
      secure: true,
      sameSite: "Lax",
    },
  ]);
}

// --- File-backed session cache (used by global-setup to avoid a login per run) ---

const SESSION_CACHE_FILE = "test-results/.session-cache.json";
const SESSION_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours

interface CachedSession {
  bo_session: string;
  expiresAt: number;
  email?: string;
}

export function readCachedSession(email: string): string | null {
  const cachePath = path.resolve(process.cwd(), SESSION_CACHE_FILE);
  if (!fs.existsSync(cachePath)) return null;
  try {
    const parsed = JSON.parse(fs.readFileSync(cachePath, "utf-8")) as CachedSession;
    if (parsed.expiresAt && Date.now() < parsed.expiresAt && parsed.email === email) {
      return parsed.bo_session;
    }
  } catch {
    /* corrupted cache — ignore, caller will re-login */
  }
  return null;
}

export function writeCachedSession(token: string, email: string): void {
  const cachePath = path.resolve(process.cwd(), SESSION_CACHE_FILE);
  const cacheDir = path.dirname(cachePath);
  if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });
  fs.writeFileSync(
    cachePath,
    JSON.stringify({
      bo_session: token,
      email,
      expiresAt: Date.now() + SESSION_TTL_MS,
    } satisfies CachedSession),
  );
}
