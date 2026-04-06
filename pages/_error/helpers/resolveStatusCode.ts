import type { ErrorStatus } from "../constants/errorContent";

export function resolveStatusCode(pageContext: unknown): ErrorStatus {
  const ctx = pageContext as Record<string, unknown>;
  const raw =
    ctx?.statusCode ??
    ctx?.abortStatusCode ??
    (ctx?.is404 ? 404 : undefined) ??
    (ctx?.is500 ? 500 : undefined) ??
    ((ctx?.httpResponse as Record<string, unknown>)?.statusCode as number) ??
    500;
  const status = Number(raw);
  return status === 401 || status === 403 || status === 404 || status === 500
    ? (status as ErrorStatus)
    : 500;
}
