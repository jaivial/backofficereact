import path from "path";
import react from "@vitejs/plugin-react";
import vike from "vike/plugin";
import { defineConfig } from "vite";

const isStorybook = process.env.STORYBOOK === "true" ||
  process.argv.some(arg => arg.includes("storybook"));

export default defineConfig({
  plugins: [
    // Skip vike plugin in storybook mode — vike conflicts with @storybook/builder-vite
    // because it requires base="/" and storybook uses relative base "./" internally
    ...(isStorybook ? [react()] : [vike(), react()]),
  ],
  resolve: {
    alias: { "@ui": path.resolve(__dirname, "ui") },
  },
  server: {
    host: "0.0.0.0",
    port: 3001,
    allowedHosts: [
      "0.0.0.0",
      "localhost",
      ".trycloudflare.com",
    ],
  },
});

