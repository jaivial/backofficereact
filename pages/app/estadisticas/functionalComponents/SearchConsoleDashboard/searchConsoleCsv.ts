import { SEARCH_SNAPSHOT, type SearchMetric } from "./searchConsoleSnapshot";

export const SEARCH_CSV_FILENAME = `villa-carmen-search-demand-${SEARCH_SNAPSHOT.startDate}_${SEARCH_SNAPSHOT.endDate}.csv`;

const INTENTS = [
  "restaurant_catarroja",
  "rice",
  "menus",
  "groups",
  "weddings",
  "communions",
  "company_events",
  "brand",
] as const;

const DEVICES = ["MOBILE", "DESKTOP", "TABLET"] as const;

function csvRow(dimension: "intent" | "device", segment: string, metric: SearchMetric): string {
  return [
    dimension,
    segment,
    metric.rows,
    metric.clicks,
    metric.impressions,
    metric.ctr.toFixed(12),
    metric.averagePosition?.toFixed(2) ?? "",
  ].join(",");
}

/** The same aggregate export previously published by the public frontend. */
export function searchConsoleCsv(): string {
  const rows = [
    "dimension,segment,source_rows,clicks,impressions,ctr,impression_weighted_average_position",
    ...INTENTS.map((key) => csvRow("intent", key, SEARCH_SNAPSHOT.intents[key])),
    ...DEVICES.map((key) => csvRow("device", key, SEARCH_SNAPSHOT.devices[key])),
  ];
  return `${rows.join("\r\n")}\r\n`;
}

export function downloadSearchConsoleCsv(): void {
  const blob = new Blob([searchConsoleCsv()], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = SEARCH_CSV_FILENAME;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
