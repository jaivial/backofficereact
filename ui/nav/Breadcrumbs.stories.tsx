import type { Meta, StoryObj } from "@storybook/react";
import React from "react";
import { Breadcrumbs } from "./Breadcrumbs";
import type { BreadcrumbItem } from "./Breadcrumbs";

const meta = {
  title: "ui/nav/Breadcrumbs",
  component: Breadcrumbs,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
} satisfies Meta<typeof Breadcrumbs>;

export default meta;
type Story = StoryObj<typeof meta>;

const singleItem: BreadcrumbItem[] = [{ label: "Backoffice" }];

const twoItems: BreadcrumbItem[] = [
  { label: "Backoffice", href: "/app/backoffice" },
  { label: "Reservas" },
];

const threeItems: BreadcrumbItem[] = [
  { label: "Backoffice", href: "/app/backoffice" },
  { label: "Reservas", href: "/app/reservas" },
  { label: "Anadir reserva" },
];

const fourItems: BreadcrumbItem[] = [
  { label: "Backoffice", href: "/app/backoffice" },
  { label: "Miembros", href: "/app/miembros" },
  { label: "Miembro #42", href: "/app/miembros/42" },
  { label: "Contrato" },
];

const fiveItems: BreadcrumbItem[] = [
  { label: "Backoffice", href: "/app/backoffice" },
  { label: "Facturas", href: "/app/facturas" },
  { label: "Recurrentes", href: "/app/facturas/recurrentes" },
  { label: "Factura #123", href: "/app/facturas/recurrentes/123" },
  { label: "Detalle" },
];

export const SingleItem: Story = {
  name: "Single Item (Root Only)",
  args: {
    items: singleItem,
  },
};

export const TwoItems: Story = {
  name: "Two Items (Root + One Level)",
  args: {
    items: twoItems,
  },
};

export const ThreeItems: Story = {
  name: "Three Items (Root + Two Levels)",
  args: {
    items: threeItems,
  },
};

export const FourItems: Story = {
  name: "Four Items (Deep Navigation)",
  args: {
    items: fourItems,
  },
};

export const FiveItems: Story = {
  name: "Five Items (Very Deep Navigation)",
  args: {
    items: fiveItems,
  },
};

export const Dashboard: Story = {
  name: "Dashboard Path",
  args: {
    items: [{ label: "Backoffice", href: "/app/backoffice" }, { label: "Dashboard" }],
  },
};

export const ConfiguracionReservas: Story = {
  name: "Configuracion Reservas",
  args: {
    items: [
      { label: "Backoffice", href: "/app/backoffice" },
      { label: "Reservas", href: "/app/reservas" },
      { label: "Configuracion reservas" },
    ],
  },
};

export const MenuEditor: Story = {
  name: "Menu Editor",
  args: {
    items: [
      { label: "Backoffice", href: "/app/backoffice" },
      { label: "Menus", href: "/app/menus" },
      { label: "Editor de menus" },
    ],
  },
};

export const MiembroDetalle: Story = {
  name: "Miembro Detail",
  args: {
    items: [
      { label: "Backoffice", href: "/app/backoffice" },
      { label: "Miembros", href: "/app/miembros" },
      { label: "Miembro #42", href: "/app/miembros/42" },
      { label: "Estadisticas" },
    ],
  },
};

export const HorariosPreview: Story = {
  name: "Horarios Preview",
  args: {
    items: [
      { label: "Backoffice", href: "/app/backoffice" },
      { label: "Horarios", href: "/app/horarios" },
      { label: "Horarios preview" },
    ],
  },
};

export const FacturacionRecurrente: Story = {
  name: "Facturacion Recurrente",
  args: {
    items: [
      { label: "Backoffice", href: "/app/backoffice" },
      { label: "Facturas", href: "/app/facturas" },
      { label: "Facturacion recurrente" },
    ],
  },
};
