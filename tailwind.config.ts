import type { Config } from "tailwindcss";

export default {
  darkMode: ["class", '[data-theme="dark"]'],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./ui/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        // `--bo-*` tokens from components/styles/base/variables.css, exposed as
        // Tailwind utilities (bg-bo-surface, text-bo-muted, border-bo-border, ...).
        // Use these instead of bg-[var(--bo-*)] arbitrary values.
        bo: {
          bg: "var(--bo-bg)",
          shell: "var(--bo-shell)",
          surface: "var(--bo-surface)",
          "surface-2": "var(--bo-surface-2)",
          "surface-3": "var(--bo-surface-3)",
          sidebar: "var(--bo-sidebar)",
          border: "var(--bo-border)",
          "border-2": "var(--bo-border-2)",
          text: "var(--bo-text)",
          muted: "var(--bo-muted)",
          faint: "var(--bo-faint)",
          accent: "var(--bo-accent)",
          "accent-2": "var(--bo-accent-2)",
          "accent-3": "var(--bo-accent-3)",
          "text-success": "var(--bo-text-success)",
          "text-warning": "var(--bo-text-warning)",
          "text-danger": "var(--bo-text-danger)",
          "text-info": "var(--bo-text-info)",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        // --bo-radius-* tokens as rounded-bo-* utilities.
        bo: {
          sm: "var(--bo-radius-sm)",
          md: "var(--bo-radius-md)",
          lg: "var(--bo-radius-lg)",
          full: "var(--bo-radius-full)",
        },
      },
      keyframes: {
        boFadeIn: {
          "0%": { opacity: "0", transform: "translateY(4px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        boFadeOut: {
          "0%": { opacity: "1", transform: "translateY(0)" },
          "100%": { opacity: "0", transform: "translateY(4px)" },
        },
      },
      animation: {
        // 200ms: long enough to read as a transition between the sheet list and
        // the editor, short enough not to delay the next click.
        boFadeIn: "boFadeIn 200ms ease-out both",
        boFadeOut: "boFadeOut 200ms ease-in both",
      },
    },
  },
  corePlugins: {
    preflight: false,
  },
  plugins: [],
} satisfies Config;
