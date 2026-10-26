// Aggregate-only publication of the six-month Search Console export. No raw queries.
// Intent rows may overlap (brand and locality); device rows partition the full export.
export const SEARCH_SNAPSHOT = {
  "startDate": "2026-04-23",
  "endDate": "2026-10-22",
  "exportedAt": "2026-10-26",
  "total": {
    "rows": 471,
    "clicks": 285,
    "impressions": 5201,
    "ctr": 0.05479715439338589,
    "averagePosition": 3.92
  },
  "intents": {
    "restaurant_catarroja": {
      "rows": 156,
      "clicks": 101,
      "impressions": 1568,
      "ctr": 0.06441326530612244,
      "averagePosition": 3.82
    },
    "rice": {
      "rows": 0,
      "clicks": 0,
      "impressions": 0,
      "ctr": 0,
      "averagePosition": null
    },
    "menus": {
      "rows": 35,
      "clicks": 8,
      "impressions": 111,
      "ctr": 0.07207207207207207,
      "averagePosition": 9.58
    },
    "groups": {
      "rows": 0,
      "clicks": 0,
      "impressions": 0,
      "ctr": 0,
      "averagePosition": null
    },
    "weddings": {
      "rows": 3,
      "clicks": 0,
      "impressions": 10,
      "ctr": 0.0,
      "averagePosition": 56.5
    },
    "communions": {
      "rows": 2,
      "clicks": 0,
      "impressions": 2,
      "ctr": 0.0,
      "averagePosition": 19.0
    },
    "company_events": {
      "rows": 0,
      "clicks": 0,
      "impressions": 0,
      "ctr": 0,
      "averagePosition": null
    },
    "brand": {
      "rows": 312,
      "clicks": 277,
      "impressions": 4867,
      "ctr": 0.05691391000616396,
      "averagePosition": 3.07
    }
  },
  "devices": {
    "MOBILE": {
      "rows": 237,
      "clicks": 248,
      "impressions": 4563,
      "ctr": 0.05435020819636204,
      "averagePosition": 2.81
    },
    "DESKTOP": {
      "rows": 184,
      "clicks": 34,
      "impressions": 572,
      "ctr": 0.05944055944055944,
      "averagePosition": 12.4
    },
    "TABLET": {
      "rows": 50,
      "clicks": 3,
      "impressions": 66,
      "ctr": 0.045454545454545456,
      "averagePosition": 7.15
    }
  }
} as const

export type SearchMetric = { rows: number; clicks: number; impressions: number; ctr: number; averagePosition: number | null }
