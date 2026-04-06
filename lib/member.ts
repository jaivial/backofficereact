import type { Member } from "../api/types";

/**
 * Returns the full display name for a member.
 * Falls back to "Miembro #N" when no name is available.
 */
export function fullName(member: Member): string {
  const name = `${member.firstName || ""} ${member.lastName || ""}`.trim();
  return name || `Miembro #${member.id}`;
}
