import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";

import { StatCard } from "./StatCard";

const meta = {
  title: "ui/widgets/StatCard",
  component: StatCard,
  tags: ["autodocs"],
  argTypes: {
    icon: {
      control: "select",
      options: ["calendar", "check", "clock", "users", "file-text", "trending-up"],
    },
  },
  parameters: {
    layout: "padded",
  },
  args: {
    onClick: fn(),
  },
} satisfies Meta<typeof StatCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: "Default",
  args: {
    label: "Reservas",
    value: "24",
    icon: "calendar",
  },
};

export const Users: Story = {
  name: "Users",
  args: {
    label: "Clientes",
    value: "156",
    icon: "users",
  },
};

export const CompletedTasks: Story = {
  name: "Completed Tasks",
  args: {
    label: "Completadas",
    value: "89",
    icon: "check",
  },
};

export const PendingTasks: Story = {
  name: "Pending Tasks",
  args: {
    label: "Pendientes",
    value: "12",
    icon: "clock",
  },
};

export const Documents: Story = {
  name: "Documents",
  args: {
    label: "Documentos",
    value: "45",
    icon: "file-text",
  },
};

export const TrendUp: Story = {
  name: "Trend Up",
  args: {
    label: "Crecimiento",
    value: "+18%",
    icon: "trending-up",
  },
};

export const UsingTitle: Story = {
  name: "Using Title Prop",
  args: {
    title: "Mes Actual",
    value: "32",
    icon: "calendar",
  },
};

export const Clickable: Story = {
  name: "Clickable",
  args: {
    label: "Ver Detalles",
    value: "24",
    icon: "calendar",
    onClick: fn(),
  },
};

export const Grid: Story = {
  name: "Grid Layout",
  render: () => (
    <div data-slot="statCard.stories-div" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem" }}>
      <StatCard label="Reservas" value="24" icon="calendar" />
      <StatCard label="Clientes" value="156" icon="users" />
      <StatCard label="Completadas" value="89" icon="check" />
      <StatCard label="Pendientes" value="12" icon="clock" />
      <StatCard label="Documentos" value="45" icon="file-text" />
      <StatCard label="Crecimiento" value="+18%" icon="trending-up" />
    </div>
  ),
  parameters: {
    controls: { disable: true },
  },
};
