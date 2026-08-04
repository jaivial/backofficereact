import { createHash } from "node:crypto";

const BO_SESSION_COOKIE = "bo_session";

export function filterBOSessionCookie(cookieHeader: string | undefined): string | undefined {
  if (!cookieHeader) return undefined;
  for (const part of cookieHeader.split(";")) {
    const index = part.indexOf("=");
    if (index <= 0 || part.slice(0, index).trim() !== BO_SESSION_COOKIE) continue;
    const value = part.slice(index + 1).trim();
    if (!value || /[\r\n]/.test(value)) return undefined;
    return `${BO_SESSION_COOKIE}=${value}`;
  }
  return undefined;
}

export function filterBOSessionSetCookies(setCookies: string[]): string[] {
  return setCookies.filter((value) => value.trimStart().startsWith(`${BO_SESSION_COOKIE}=`));
}

export function sessionCacheKey(sessionToken: string): string {
  return createHash("sha256").update(sessionToken).digest("hex");
}

export function sessionTokenFromCookie(cookieHeader: string | undefined): string | undefined {
  return filterBOSessionCookie(cookieHeader)?.slice(BO_SESSION_COOKIE.length + 1);
}
