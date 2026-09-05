import type { Meta, StoryObj } from "@storybook/react";
import { CrearPage as Page } from "./crear";

const shell = (data: Record<string, unknown>) => ({
  layout: "fullscreen" as const,
  appShell: { title: "Crear menu", pathname: "/app/menus/crear", data },
});

const meta = {
  title: "Pages/Menus/Crear",
  component: Page,
  tags: ["autodocs"],
  parameters: shell({}),
} satisfies Meta<typeof Page>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  name: "Empty (new menu)",
  parameters: shell({ menus: [], error: null }),
};
