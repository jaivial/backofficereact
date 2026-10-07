/**
 * Single source of truth for the menu_type domain (backoffice side).
 *
 * Coordination id: menu_type_codes_v1 - the Go backend migrated
 * `menus.menu_type` from legacy strings to NUMERIC codes. The backend keeps
 * accepting legacy strings on write for backwards compatibility, so the UI
 * normalises every incoming value through `normalizeMenuType` and always
 * works with the numeric code internally.
 *
 * WHAT EACH NUMERIC VALUE MEANS (authoritative mapping, mirrored from the
 * backend contract; do not reorder or renumber):
 *
 *   0 = UNKNOWN / NO TYPE      -> no type assigned (or an unrecognised value).
 *                                 Never persisted by the UI; used as the safe
 *                                 fallback so a menu without a type still
 *                                 renders, and excluded from the type pickers.
 *   1 = closed_conventional    -> Menu cerrado convencional (the DEFAULT type).
 *   2 = closed_group           -> Menu cerrado grupal.
 *   3 = a_la_carte             -> Carta / a la carta convencional.
 *   4 = a_la_carte_group       -> Carta grupal.
 *   5 = a_la_carte_time        -> Carta por tiempo (time-based carta). Known to
 *                                 the contract but not offered by the pickers
 *                                 yet, so it is intentionally absent from
 *                                 MENU_TYPE_ORDER.
 *   6 = special                -> Menu especial (season / event).
 *
 * Legacy string -> code table used by `normalizeMenuType` (kept here so the
 * only place that knows the legacy spelling is this file):
 *   "closed_conventional" -> 1, "closed_group" -> 2, "a_la_carte" -> 3,
 *   "a_la_carte_group" -> 4, "a_la_carte_time" -> 5, "special" -> 6.
 */

/** Numeric menu_type code sent to / received from the backend. */
export const MENU_TYPE = {
  UNKNOWN: 0,
  CLOSED_CONVENTIONAL: 1,
  CLOSED_GROUP: 2,
  A_LA_CARTE: 3,
  A_LA_CARTE_GROUP: 4,
  A_LA_CARTE_TIME: 5,
  SPECIAL: 6,
} as const;

/** A persisted menu type. UNKNOWN is a read-time fallback, never selectable. */
export type MenuTypeCode = (typeof MENU_TYPE)[keyof typeof MENU_TYPE];

/** The default used whenever a menu carries no (or an unknown) type. */
export const DEFAULT_MENU_TYPE: MenuTypeCode = MENU_TYPE.CLOSED_CONVENTIONAL;

const KNOWN_MENU_TYPE_CODES = new Set<number>(Object.values(MENU_TYPE));

/** Legacy string -> numeric code. The backend still accepts these on write. */
const LEGACY_MENU_TYPE_BY_NAME: Record<string, MenuTypeCode> = {
  closed_conventional: MENU_TYPE.CLOSED_CONVENTIONAL,
  closed_group: MENU_TYPE.CLOSED_GROUP,
  a_la_carte: MENU_TYPE.A_LA_CARTE,
  a_la_carte_group: MENU_TYPE.A_LA_CARTE_GROUP,
  a_la_carte_time: MENU_TYPE.A_LA_CARTE_TIME,
  special: MENU_TYPE.SPECIAL,
};

/**
 * Single tolerant entry point for any value that may hold a menu type
 * (API payload, query param, local state, legacy string...). Returns the
 * numeric code, falling back to DEFAULT_MENU_TYPE when the value is empty or
 * unknown so callers never have to re-implement the mapping.
 */
export function normalizeMenuType(raw: unknown): MenuTypeCode {
  if (typeof raw === "number") {
    // UNKNOWN (0) means "no type"; callers always want the default instead.
    return KNOWN_MENU_TYPE_CODES.has(raw) && raw !== MENU_TYPE.UNKNOWN ? (raw as MenuTypeCode) : DEFAULT_MENU_TYPE;
  }
  if (typeof raw === "string") {
    const trimmed = raw.trim().toLowerCase();
    if (!trimmed) return DEFAULT_MENU_TYPE;
    const legacy = LEGACY_MENU_TYPE_BY_NAME[trimmed];
    if (legacy !== undefined) return legacy;
    const asNumber = Number(trimmed);
    if (KNOWN_MENU_TYPE_CODES.has(asNumber) && asNumber !== MENU_TYPE.UNKNOWN) return asNumber as MenuTypeCode;
  }
  return DEFAULT_MENU_TYPE;
}

/** True for the codes that behave like an open carta. */
export function isALaCarteMenuType(raw: unknown): boolean {
  const code = normalizeMenuType(raw);
  return code === MENU_TYPE.A_LA_CARTE || code === MENU_TYPE.A_LA_CARTE_GROUP || code === MENU_TYPE.A_LA_CARTE_TIME;
}

/** True for the seasonal / event "menu especial". */
export function isSpecialMenuType(raw: unknown): boolean {
  return normalizeMenuType(raw) === MENU_TYPE.SPECIAL;
}
