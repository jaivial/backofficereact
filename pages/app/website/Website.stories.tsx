import type { Meta, StoryObj } from "@storybook/react";
import Page from "./+Page";

const shell = (data: Record<string, unknown>) => ({
  layout: "fullscreen" as const,
  appShell: { title: "Website", pathname: "/app/website", data },
});

const meta = {
  title: "Pages/Website",
  component: Page,
  tags: ["autodocs"],
  parameters: shell({}),
} satisfies Meta<typeof Page>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  name: "Empty",
  parameters: shell({}),
};

export const Populated: Story = {
  name: "Populated",
  parameters: shell({}),
};
