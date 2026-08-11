import type { Config } from "vike/types";
import vikeReact from "vike-react/config";

export default {
  extends: [vikeReact],
  title: "Backoffice",
  description: "Backoffice multitenant",
  passToClient: ["bo"],
  // Prefetch static assets (JS/CSS chunks) on link hover for faster navigation.
  prefetchStaticAssets: "hover",
} satisfies Config;
