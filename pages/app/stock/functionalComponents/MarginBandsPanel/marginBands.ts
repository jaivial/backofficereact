// Margin-band boundary helpers. The owner-approved standard partitions food-cost
// percentages into four zones via THREE internal cut points:
//   PURPLE [0, b1)  GREEN [b1, b2)  AMBER [b2, b3)  RED [b3, 100]
// Half-open [min,max): a boundary value belongs to the higher zone.
//
// Four zones => three boundaries, so the editor needs three inputs, not four
// independent min/max rows (which is exactly how gaps used to slip in).

export const DEFAULT_BOUNDARIES: ReadonlyArray<number> = [25, 35, 40];

export type MarginScopeBandInput = {
  zone: "PURPLE" | "GREEN" | "AMBER" | "RED";
  min: number | null;
  max: number | null;
};

/**
 * Validate three strictly-increasing food-cost boundaries in (0, 100).
 * Returns the four-band PUT body, or throws with a localized message.
 */
export function boundariesToBands(
  boundaries: ReadonlyArray<number>,
): MarginScopeBandInput[] {
  if (boundaries.length !== 3) {
    throw new Error("Se requieren tres límites");
  }
  for (const b of boundaries) {
    if (!Number.isFinite(b) || b <= 0 || b >= 100) {
      throw new Error("Los límites deben estar entre 0 y 100");
    }
  }
  const [b1, b2, b3] = boundaries;
  if (!(b1 < b2 && b2 < b3)) {
    throw new Error("Los límites deben ser crecientes y sin solaparse");
  }
  return [
    { zone: "PURPLE", min: null, max: b1 },
    { zone: "GREEN", min: b1, max: b2 },
    { zone: "AMBER", min: b2, max: b3 },
    { zone: "RED", min: b3, max: null },
  ];
}

/** Inverse of boundariesToBands: read the 3 cut points from a resolved band set. */
export function bandsToBoundaries(
  bands: ReadonlyArray<MarginScopeBandInput>,
): number[] {
  const byZone = new Map(bands.map((b) => [b.zone, b] as const));
  const green = byZone.get("GREEN");
  const amber = byZone.get("AMBER");
  const red = byZone.get("RED");
  // Cut points: PURPLE.max/GREEN.min, GREEN.max/AMBER.min, AMBER.max/RED.min.
  const b1 = green?.min ?? byZone.get("PURPLE")?.max;
  const b2 = amber?.min ?? green?.max;
  const b3 = red?.min ?? amber?.max;
  if (b1 == null || b2 == null || b3 == null) {
    return [...DEFAULT_BOUNDARIES];
  }
  return [b1, b2, b3];
}

export const ZONE_LABELS: Record<MarginScopeBandInput["zone"], string> = {
  PURPLE: "Morado (margen alto)",
  GREEN: "Verde",
  AMBER: "Ámbar",
  RED: "Rojo (food cost alto)",
};
