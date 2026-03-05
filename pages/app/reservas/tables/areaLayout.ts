import type { TableMapArea } from "../../../../api/types";

import type { LinePoint } from "./lineDrawing";
import { normalizeLimitPoints } from "./mapLimits";

export function areaMetadata(area: Partial<TableMapArea> | null | undefined): Record<string, unknown> {
  if (!area) return {};

  const metadata = (area as any).metadata;
  if (metadata && typeof metadata === "object" && !Array.isArray(metadata)) {
    return metadata as Record<string, unknown>;
  }

  const metadataJSON = (area as any).metadata_json;
  if (metadataJSON && typeof metadataJSON === "object" && !Array.isArray(metadataJSON)) {
    return metadataJSON as Record<string, unknown>;
  }

  return {};
}

export function normalizeTableArea(area: any): TableMapArea {
  return {
    ...area,
    metadata: areaMetadata(area),
    tables: Array.isArray(area?.tables) ? area.tables : [],
  } as TableMapArea;
}

export function floorNumberForArea(area: TableMapArea): number {
  const m = areaMetadata(area);
  const fromMeta = Number(m.floorNumber);
  if (Number.isFinite(fromMeta) && fromMeta >= 0) return fromMeta;
  return 0;
}

export function limitAreaTemplatePointsForFloor(areas: TableMapArea[], floorNumber: number): LinePoint[] {
  const floorArea = areas.find((area) => floorNumberForArea(area) === floorNumber);
  if (!floorArea) return [];
  const metadata = areaMetadata(floorArea);
  const rawTemplate = (metadata as any).limit_area_template_points ?? (metadata as any).limitAreaTemplatePoints;
  return normalizeLimitPoints(rawTemplate);
}
