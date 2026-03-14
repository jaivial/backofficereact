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
        // shadcn/ui theme
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
        // Backoffice bo- theme colors
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
          success: "var(--bo-color-success)",
          warning: "var(--bo-color-warning)",
          danger: "var(--bo-color-danger)",
          info: "var(--bo-color-info)",
          "bg-selected": "var(--bo-bg-selected)",
          "surface-hover": "var(--bo-surface-hover)",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      spacing: {
        "1": "4px",
        "2": "8px",
        "3": "12px",
        "4": "16px",
        "5": "24px",
        "6": "32px",
        "8": "48px",
      },
      fontSize: {
        "xs": "10px",
        "sm": "12px",
        "base": "14px",
        "lg": "16px",
        "xl": "20px",
        "2xl": "24px",
        "3xl": "32px",
      },
      fontWeight: {
        normal: "400",
        medium: "500",
        semibold: "600",
        bold: "700",
      },
      lineHeight: {
        tight: "1.25",
        normal: "1.4",
        relaxed: "1.6",
      },
      boxShadow: {
        "soft": "0 10px 26px rgba(0, 0, 0, 0.36)",
        "elevated": "0 18px 52px rgba(0, 0, 0, 0.55)",
      },
      transitionDuration: {
        "fast": "120ms",
        "base": "150ms",
        "slow": "300ms",
      },
      transitionTimingFunction: {
        "bo": "ease",
        "bo-out": "ease-out",
        "bo-in-out": "ease-in-out",
      },
    },
  },
  corePlugins: {
    preflight: false,
  },
  plugins: [],
} satisfies Config;
