import type { Meta, StoryObj } from "@storybook/react";
import { FoodItemCard } from "./FoodItemCard";
import type { FoodItem, Vino } from "../../../../api/types";

const WINE_ITEM: Vino = {
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

const PLATO_ITEM: FoodItem = {
  num: 1,
  tipo: "PRINCIPIO",
  nombre: "Paella Valenciana",
  precio: 12.0,
  descripcion: "Arroz con azafran",
  titulo: "Paella Valenciana",
  suplemento: 0,
  alergenos: [],
  categoria: "Arroces",
  active: true,
  has_foto: false,
};

const meta = {
  title: "comida/FoodItemCard",
  component: FoodItemCard,
  tags: ["autodocs"],
  argTypes: {
    foodType: {
      control: "select",
      options: ["vinos", "platos", "bebidas", "cafes", "postres"],
    },
    busy: { control: "boolean" },
  },
  parameters: {
    layout: "padded",
  },
} satisfies Meta<typeof FoodItemCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WineActive: Story = {
  name: "Wine — Active",
  args: {
    item: WINE_ITEM,
    foodType: "vinos",
    busy: false,
    onOpen: () => {},
    onEdit: () => {},
    onDelete: () => {},
    onToggle: () => {},
  },
};

export const WineInactive: Story = {
  name: "Wine — Inactive",
  args: {
    item: { ...WINE_ITEM, active: false },
    foodType: "vinos",
    busy: false,
    onOpen: () => {},
    onEdit: () => {},
    onDelete: () => {},
    onToggle: () => {},
  },
};

export const WineBusy: Story = {
  name: "Wine — Busy",
  args: {
    item: WINE_ITEM,
    foodType: "vinos",
    busy: true,
    onOpen: () => {},
    onEdit: () => {},
    onDelete: () => {},
    onToggle: () => {},
  },
};

export const PlatoActive: Story = {
  name: "Plato — Active",
  args: {
    item: PLATO_ITEM,
    foodType: "platos",
    busy: false,
    onOpen: () => {},
    onEdit: () => {},
    onDelete: () => {},
    onToggle: () => {},
  },
};

export const PlatoWithImage: Story = {
  name: "Plato — With Image",
  args: {
    item: { ...PLATO_ITEM, has_foto: true, foto_url: "https://picsum.photos/seed/paella/400/300" },
    foodType: "platos",
    busy: false,
    onOpen: () => {},
    onEdit: () => {},
    onDelete: () => {},
    onToggle: () => {},
  },
};

export const LongName: Story = {
  name: "Long Name",
  args: {
    item: {
      ...PLATO_ITEM,
      nombre: "Ensalada de Tomate Natural con Aceite de Oliva Extra Virgen de Primera Presión en Frío y Sal Maldon",
    },
    foodType: "platos",
    busy: false,
    onOpen: () => {},
    onEdit: () => {},
    onDelete: () => {},
    onToggle: () => {},
  },
};
