/**
 * Storybook-specific Vite config.
 * Does NOT include the vike plugin (which conflicts with storybook's builder).
 */
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import path from "path";
import url from "url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "~": path.resolve(__dirname, "src"),
      "vike-react": path.resolve(__dirname, "node_modules/vike-react"),
    },
  },
  base: "/",
});
