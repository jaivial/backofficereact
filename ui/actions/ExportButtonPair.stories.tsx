import type { Meta, StoryObj } from "@storybook/react";
import { ExportButtonPair } from "./ExportButtonPair";

const meta = {
  title: "ui/actions/ExportButtonPair",
  component: ExportButtonPair,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
} satisfies Meta<typeof ExportButtonPair>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: "Default",
  args: {
    onExportPdf: () => {},
    onExportExcel: () => {},
  },
};
