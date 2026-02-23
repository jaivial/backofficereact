export const SESSION_EXPIRATION_UPDATED_EVENT = "bo:session-expiration-updated";
export const SESSION_EXPIRED_EVENT = "bo:session-expired";

export function normalizeExpirationDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Date.parse(trimmed);
  if (!Number.isFinite(parsed)) return null;
  return new Date(parsed).toISOString();
}

export function emitSessionExpirationUpdate(value: unknown): void {
  if (typeof window === "undefined") return;
  const normalized = normalizeExpirationDate(value);
  if (!normalized) return;
  window.dispatchEvent(
    new CustomEvent<string>(SESSION_EXPIRATION_UPDATED_EVENT, {
      detail: normalized,
    }),
  );
}

export function emitSessionExpired(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
}
