import type { Meta, StoryObj } from "@storybook/react";
import { ReservationDayPanel, ReservationDayClosedPanel, ReservationDayStateBlock } from "./ReservationDayPanel";
import type { ConfigDayStatus } from "../../api/types";

const meta = {
  title: "ui/widgets/ReservationDayPanel",
  component: ReservationDayPanel,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
} satisfies Meta<typeof ReservationDayPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

// Sample day statuses
const sampleOpenDay: ConfigDayStatus = {
  date: "2026-04-26",
  isOpen: true,
};

const sampleClosedDay: ConfigDayStatus = {
  date: "2026-04-27",
  isOpen: false,
};

export const Default: Story = {
  name: "Default - Open Day",
  args: {
    title: "Sabado 26 de Abril",
    meta: "21:00 - 23:30",
    day: sampleOpenDay,
    onToggleDay: () => console.log("Toggle day clicked"),
    description: "Ultimo momento para reservas",
    actionLabel: undefined,
    actionMode: "toggle",
  },
};

export const ClosedDay: Story = {
  name: "Closed Day",
  args: {
    title: "Domingo 27 de Abril",
    meta: "Cerrado",
    day: sampleClosedDay,
    onToggleDay: () => console.log("Toggle day clicked"),
    description: null,
    actionLabel: undefined,
    actionMode: "toggle",
  },
};

export const OpenOnlyMode: Story = {
  name: "Open Only Mode",
  args: {
    title: "Lunes 28 de Abril",
    meta: "Sin reservas",
    day: sampleClosedDay,
    onToggleDay: () => console.log("Open day clicked"),
    actionLabel: "Abrir dia",
    actionMode: "openOnly",
    description: "Sin reservas programadas",
  },
};

export const BusyState: Story = {
  name: "Busy State",
  args: {
    title: "Martes 29 de Abril",
    meta: "15:00 - 18:00",
    day: sampleOpenDay,
    onToggleDay: () => console.log("Toggle day clicked"),
    busy: true,
    description: "Actualizando...",
  },
};

export const WithoutToggleAction: Story = {
  name: "Without Toggle Action",
  args: {
    title: "Miercoles 30 de Abril",
    meta: "Verano",
    day: sampleOpenDay,
    hideAction: true,
    description: "Solo lectura",
  },
};

export const WithRightSlot: Story = {
  name: "With Right Slot",
  args: {
    title: "Jueves 1 de Mayo",
    meta: "Festivo",
    day: sampleOpenDay,
    onToggleDay: () => console.log("Toggle day clicked"),
    rightSlot: (
      <div className="bo-configDayLimitRow" data-slot="right-slot">
        <span data-slot="reservationDayPanel.stories-span">15 reservas</span>
        <span data-slot="reservationDayPanel.stories-span">42 personas</span>
      </div>
    ),
  },
};

// ReservationDayClosedPanel stories
export const ClosedPanel: Story = {
  name: "ClosedPanel",
  render: () => (
    <ReservationDayClosedPanel
      day={sampleClosedDay}
      onToggleDay={() => console.log("Open day clicked")}
      actionMode="openOnly"
      description="El restaurante esta cerrado este dia"
    />
  ),
};

export const ClosedPanelDefault: Story = {
  name: "ClosedPanel Default Title",
  render: () => (
    <ReservationDayClosedPanel
      day={sampleClosedDay}
      meta="Sin servicio"
    />
  ),
};

// ReservationDayStateBlock stories
export const StateBlockOpen: Story = {
  name: "StateBlock - Open",
  render: () => (
    <ReservationDayStateBlock
      day={sampleOpenDay}
      onToggleDay={() => console.log("Toggle clicked")}
      label="Estado del dia"
    />
  ),
};

export const StateBlockClosed: Story = {
  name: "StateBlock - Closed",
  render: () => (
    <ReservationDayStateBlock
      day={sampleClosedDay}
      onToggleDay={() => console.log("Toggle clicked")}
      label="Estado del dia"
    />
  ),
};
