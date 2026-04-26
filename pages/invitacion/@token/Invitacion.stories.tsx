import type { Meta, StoryObj } from "@storybook/react";
import Page from "./+Page";

const meta = {
  title: "Pages/Public/Invitacion",
  component: Page,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    appShell: { noShell: true, data: {} },
  },
} satisfies Meta<typeof Page>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: "Default",
};
