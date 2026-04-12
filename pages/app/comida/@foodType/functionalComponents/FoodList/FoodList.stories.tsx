import type { Meta, StoryObj } from "@storybook/react";
import React from "react";
import { FoodList } from "./FoodList";

const WINE_ITEM = {
  num: 10,
  tipo: "TINTO",
  nombre: "Rioja Reserva",
  precio: 18.5,
  descripcion: "A full-bodied red wine",
  bodega: "Bodega Test",
  denominacion_origen: "Rioja",
  graduacion: 13.5,
  anyo: "2018",
  active: true,
  has_foto: false,
};

const PLATO_ITEM = {
  num: 1,
  tipo: "PRINCIPIO",
  nombre: "Paella Valenciana",
  precio: 12.0,
  descripcion: "Arroz con azafran",
  categoria: "Arroces",
  active: true,
  has_foto: false,
};

const NOOP = () => {};

function makeProps(overrides: Partial<React.ComponentProps<typeof FoodList>> = {}) {
  return {
    items: [WINE_ITEM, PLATO_ITEM] as any[],
    loading: false,
    processing: false,
    foodType: "vinos" as const,
    page: 1,
    pageSize: 24,
    total: 2,
    totalPages: 1,
    showPagerBtns: false,
    singularLabel: "vino",
    onOpenDetail: NOOP,
    onOpenEdit: NOOP,
    onDelete: NOOP,
    onToggle: NOOP,
    onOpenCreate: NOOP,
    onPageChange: NOOP,
    onPageSizeChange: NOOP,
    listLabel: "vinos",
    ...overrides,
  };
}

const meta = {
  title: "comida/FoodList",
  component: FoodList,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
} satisfies Meta<typeof FoodList>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: "Default",
  args: makeProps(),
};

export const Loading: Story = {
  name: "Loading",
  args: makeProps({ items: [], loading: true }),
};

export const Empty: Story = {
  name: "Empty",
  args: makeProps({ items: [], loading: false }),
};

export const Paginated: Story = {
  name: "Paginated",
  args: makeProps({
    items: [WINE_ITEM],
    loading: false,
    page: 2,
    total: 50,
    totalPages: 3,
    showPagerBtns: true,
  }),
};
