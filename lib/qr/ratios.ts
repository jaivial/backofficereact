/**
 * QR module — aspect ratio catalog.
 *
 * Coordination point: `qr-templates:ratios` (consumed by the "Personalizar" tab
 * and by `buildTemplateSvg`, which reads width/height from here).
 */

export type QrRatio = { id: string; label: string; width: number; height: number };

/** Exactly 7 ratios. */
export const QR_RATIOS: QrRatio[] = [
  { id: "1:1", label: "Cuadrado 1:1", width: 1080, height: 1080 },
  { id: "4:5", label: "Vertical 4:5", width: 1080, height: 1350 },
  { id: "9:16", label: "Story 9:16", width: 1080, height: 1920 },
  { id: "3:4", label: "Retrato 3:4", width: 1080, height: 1440 },
  { id: "2:3", label: "Retrato 2:3", width: 1080, height: 1620 },
  { id: "16:9", label: "Panorámico 16:9", width: 1920, height: 1080 },
  { id: "a4-portrait", label: "A4 vertical", width: 2480, height: 3508 },
];

/** Throws if the id is unknown. */
export function ratioById(id: string): QrRatio {
  const ratio = QR_RATIOS.find((candidate) => candidate.id === id);
  if (!ratio) throw new Error(`[qr-templates:ratios] Unknown ratio id: ${id}`);
  return ratio;
}
