import type { Member } from "../../../../api/types";

export function initials(firstName: string, lastName: string): string {
  const a = firstName.trim()[0] ?? "";
  const b = lastName.trim()[0] ?? "";
  return (a + b).toUpperCase() || "MM";
}

export { fullName } from "../../../../lib/member";

export function normalizeEmail(v: string | null | undefined): string {
  return String(v ?? "").trim().toLowerCase();
}
