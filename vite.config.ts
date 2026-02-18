import react from "@vitejs/plugin-react";
import vike from "vike/plugin";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [vike(), react()],
  server: {
    host: "0.0.0.0",
    port: 3001,
  },
});

