import type { Meta, StoryObj } from "@storybook/react";
import Page from "./+Page";

const shell = (data: Record<string, unknown>) => ({
  layout: "fullscreen" as const,
  appShell: { title: "Menus", pathname: "/app/menus", data },
});

const meta = {
  title: "Pages/Menus",
  component: Page,
  tags: ["autodocs"],
  parameters: shell({}),
} satisfies Meta<typeof Page>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  name: "Empty (no menus)",
  parameters: shell({ menus: [], error: null }),
};

export const Populated: Story = {
  name: "Populated",
  parameters: shell({
    menus: [
      { id: 1, menu_title: "Menu Degustacion", menu_type: "closed_conventional", price: 45, active: true, is_draft: false, created_at: "2026-04-01", modified_at: "2026-04-20" },
      { id: 2, menu_title: "Menu Fin de Semana", menu_type: "closed_conventional", price: 55, active: true, is_draft: false, created_at: "2026-04-05", modified_at: "2026-04-18" },
      { id: 3, menu_title: "Menu Infantil", menu_type: "closed_conventional", price: 20, active: false, is_draft: false, created_at: "2026-04-10", modified_at: "2026-04-15" },
    ],
    error: null,
  }),
};
