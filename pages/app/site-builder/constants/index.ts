import type { ThemeConfig } from "../../../../api/site-builder-types";

export const DEFAULT_THEME: ThemeConfig = {
  colors: {
    primary: "#1f4ed8",
    secondary: "#0f172a",
    accent: "#8b5cf6",
    background: "#ffffff",
    surface: "#f8fafc",
    text: "#0f172a",
    textMuted: "#64748b",
    border: "#e2e8f0",
  },
  fonts: {
    heading: "Inter",
    body: "Inter",
    headingWeights: [600, 700],
    bodyWeights: [400, 500],
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 48,
    "2xl": 80,
  },
  radius: {
    none: 0,
    sm: 4,
    md: 8,
    lg: 16,
    full: 9999,
  },
  shadows: {
    none: "none",
    sm: "0 1px 2px rgba(0,0,0,0.05)",
    md: "0 4px 6px rgba(0,0,0,0.1)",
    lg: "0 10px 15px rgba(0,0,0,0.1)",
  },
};

export type ViewportSize = "desktop" | "tablet" | "mobile";

export const VIEWPORT_CANVAS_WIDTH: Record<ViewportSize, string> = {
  desktop: "min(100%, 1200px)",
  tablet: "768px",
  mobile: "375px",
};

export const ROOT_PARENT_TYPE = "page";
export const WILDCARD = "*";
export const DRAG_DATA_MIME = "application/x-site-builder-node";
