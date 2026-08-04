import path from "path";
import react from "@vitejs/plugin-react";
import vike from "vike/plugin";
import { defineConfig } from "vite";

/**
 * Custom plugin to detect invalid JSX data-* attribute placement at build time.
 * This prevents the 500 Internal Server Error caused by:
 *   <div className="..." /data-slot="id">  ← INVALID (data-* after />)
 *   <div className="..." data-slot="id" /> ← VALID
 */
function jsxDataAttrValidator() {
  return {
    name: "jsx-data-attr-validator",
    enforce: "pre" as const,
    transform(code: string, id: string) {
      if (!id.match(/\.(tsx|ts)$/)) return null;
      if (id.includes("node_modules")) return null;

      // Pattern: /> followed by data-* (invalid)
      const invalidPattern = /\/>\s*data-/g;
      const invalidPattern2 = /\/\s+data-/g;

      const lines = code.split("\n");
      const errors: { line: number; content: string }[] = [];

      lines.forEach((line, index) => {
        if (invalidPattern.test(line) || invalidPattern2.test(line)) {
          errors.push({ line: index + 1, content: line.trim() });
        }
      });

      if (errors.length > 0) {
        const errorMsg = errors
          .map(
            (e) =>
              `  Line ${e.line}: data-* found after self-closing tag />\n    ${e.content.substring(0, 80)}${e.content.length > 80 ? "..." : ""}`
          )
          .join("\n");

        throw new Error(
          `\n❌ JSX Syntax Error: Invalid data-* attribute placement\n\n${errorMsg}\n\n` +
            `Fix: Move data-* attributes BEFORE the closing />\n` +
            `   ❌ <div className="..." /data-slot="id">\n` +
            `   ✅ <div className="..." data-slot="id" />\n`
        );
      }

      return null;
    },
  };
}

const isStorybook = process.env.STORYBOOK === "true" ||
  process.argv.some(arg => arg.includes("storybook"));

export default defineConfig({
  plugins: [
    jsxDataAttrValidator(),
    // Skip vike plugin in storybook mode — vike conflicts with @storybook/builder-vite
    // because it requires base="/" and storybook uses relative base "./" internally
    ...(isStorybook ? [react()] : [vike(), react()]),
  ],
  resolve: {
    alias: {
      "@ui": path.resolve(__dirname, "ui"),
      three: path.resolve(__dirname, "node_modules/three"),
    },
    dedupe: ["react", "react-dom", "three"],
  },
  server: {
    host: "0.0.0.0",
    port: 3001,
    allowedHosts: [
      "0.0.0.0",
      "localhost",
      ".trycloudflare.com",
      ".menustudioai.com",
    ],
  },
});
