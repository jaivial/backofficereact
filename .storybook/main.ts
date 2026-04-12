import type { StorybookConfig } from "@storybook/react-vite";
import path from "path";
import url from "url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

const config: StorybookConfig = {
  stories: [
    "../pages/**/*.stories.@(js|jsx|mjs|ts|tsx)",
    "../ui/**/*.stories.@(js|jsx|mjs|ts|tsx)",
  ],
  addons: [
    "@storybook/addon-a11y",
    "@storybook/addon-interactions",
  ],
  framework: {
    name: "@storybook/react-vite",
    options: {},
  },
  viteFinal: async (viteConfig) => {
    // Keep existing plugins from vite.config.ts (which excludes vike in storybook mode).
    // Just add path aliases.
    return {
      ...viteConfig,
      resolve: {
        ...viteConfig.resolve,
        alias: {
          ...viteConfig.resolve?.alias,
          "~": path.resolve(__dirname, "../src"),
          "vike-react": path.resolve(__dirname, "../node_modules/vike-react"),
        },
      },
    };
  },
};

export default config;
