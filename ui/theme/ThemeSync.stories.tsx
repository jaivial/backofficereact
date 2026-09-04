import type { Meta, StoryObj } from "@storybook/react";
import { ThemeSync } from "./ThemeSync";
import { Provider as JotaiProvider } from "jotai";
import React from "react";
import { atom, useAtomValue } from "jotai";

const themeAtom = atom<string>("light");

function WithThemeProvider({
  theme,
  children,
}: {
  theme: string;
  children: React.ReactNode;
}) {
  return (
    <JotaiProvider
      initialValues={[[themeAtom, theme]] as unknown as Iterable<readonly [unknown, unknown]>}
    >
      {children}
    </JotaiProvider>
  );
}

function ThemeStatusDisplay() {
  const theme = useAtomValue(themeAtom);

  React.useEffect(() => {
    const html = document.documentElement;
    const cookieMatch = document.cookie.match(/bo_theme=([^;]+)/);
    console.log("ThemeSync Effect:", {
      htmlDatasetTheme: html.dataset.theme,
      cookieValue: cookieMatch?.[1],
    });
  }, [theme]);

  return (
    <div data-slot="themeSync.stories-div"
      style={{
        padding: "16px",
        background: theme === "dark" ? "#1f2937" : "#f9fafb",
        color: theme === "dark" ? "#f9fafb" : "#1f2937",
        borderRadius: "8px",
      }}
    >
      <p data-slot="themeSync.stories-p" style={{ margin: 0 }}>Current theme: {theme}</p>
      <p data-slot="themeSync.stories-p" style={{ margin: 0, fontSize: "12px", opacity: 0.7 }}>
        ThemeSync is syncing to document.documentElement.dataset.theme and bo_theme cookie
      </p>
    </div>
  );
}

const meta = {
  title: "Theme/ThemeSync",
  component: ThemeSync,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "A silent component that syncs the Jotai themeAtom state with the DOM (data-theme attribute) and a cookie. Renders nothing but handles side effects.",
      },
    },
  },
} satisfies Meta<typeof ThemeSync>;

export default meta;
type Story = StoryObj<typeof meta>;

export const LightTheme: Story = {
  decorators: [
    (Story) => (
      <WithThemeProvider theme="light">
        <div data-slot="themeSync.stories-div">
          <Story />
          <ThemeStatusDisplay />
        </div>
      </WithThemeProvider>
    ),
  ],
};

export const DarkTheme: Story = {
  decorators: [
    (Story) => (
      <WithThemeProvider theme="dark">
        <div data-slot="themeSync.stories-div">
          <Story />
          <ThemeStatusDisplay />
        </div>
      </WithThemeProvider>
    ),
  ],
};

export const ThemeChangeSync: Story = {
  decorators: [
    (Story) => {
      const [theme, setTheme] = React.useState("light");

      return (
        <JotaiProvider
          initialValues={[[themeAtom, theme]] as unknown as Iterable<readonly [unknown, unknown]>}
        >
          <div data-slot="themeSync.stories-div" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <Story />
            <ThemeStatusDisplay />
            <div data-slot="themeSync.stories-div">
              <button data-testid="light"
                onClick={() => setTheme("light")}
                style={{
                  padding: "8px 16px",
                  marginRight: "8px",
                  background: theme === "light" ? "#3b82f6" : "#e5e7eb",
                  color: theme === "light" ? "#fff" : "#374151",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                }}
              >
                Light
              </button>
              <button data-testid="dark"
                onClick={() => setTheme("dark")}
                style={{
                  padding: "8px 16px",
                  background: theme === "dark" ? "#3b82f6" : "#e5e7eb",
                  color: theme === "dark" ? "#fff" : "#374151",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                }}
              >
                Dark
              </button>
            </div>
            <p data-slot="themeSync.stories-p" style={{ fontSize: "12px", opacity: 0.7 }}>
              Open browser DevTools console to see theme sync logs
            </p>
          </div>
        </JotaiProvider>
      );
    },
  ],
  parameters: {
    controls: { disable: true },
  },
};
