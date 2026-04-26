import type { Meta, StoryObj } from "@storybook/react";
import { InvoiceAnalyticsWidget } from "./InvoiceAnalyticsWidget";
import type { InvoiceAnalytics } from "../../api/types";

const sampleAnalytics: InvoiceAnalytics = {
  summary: {
    totalRevenue: 125750,
    totalInvoices: 342,
    averageInvoiceValue: 367.69,
    paidInvoices: 256,
    pendingInvoices: 42,
  },
  monthlyRevenue: [
    { month: "2024-01", monthLabel: "Ene 2024", revenue: 15000, invoiceCount: 42 },
    { month: "2024-02", monthLabel: "Feb 2024", revenue: 18500, invoiceCount: 51 },
    { month: "2024-03", monthLabel: "Mar 2024", revenue: 21000, invoiceCount: 58 },
    { month: "2024-04", monthLabel: "Abr 2024", revenue: 17500, invoiceCount: 47 },
    { month: "2024-05", monthLabel: "May 2024", revenue: 22000, invoiceCount: 62 },
    { month: "2024-06", monthLabel: "Jun 2024", revenue: 23750, invoiceCount: 65 },
    { month: "2024-07", monthLabel: "Jul 2024", revenue: 8000, invoiceCount: 17 },
  ],
  statusDistribution: [
    { status: "pagada", count: 256, amount: 98500, label: "Pagadas" },
    { status: "pendiente", count: 42, amount: 15750, label: "Pendientes" },
    { status: "enviada", count: 28, amount: 8500, label: "Enviadas" },
    { status: "solicitada", count: 12, amount: 2500, label: "Solicitadas" },
    { status: "borrador", count: 4, amount: 500, label: "Borradores" },
  ],
  topCustomers: [
    { customerName: "Restaurante El Mar", customerEmail: "facturas@elmar.es", totalRevenue: 24500, invoiceCount: 28 },
    { customerName: "Hotel Costa Brava", customerEmail: "admin@hotelcosta.com", totalRevenue: 18200, invoiceCount: 15 },
    { customerName: "Bar La Terraza", customerEmail: "info@terraza.es", totalRevenue: 12500, invoiceCount: 32 },
    { customerName: "Catering Mediterraneo", customerEmail: "catering@mediterraneo.com", totalRevenue: 9800, invoiceCount: 18 },
    { customerName: "Pizzería Napoli", customerEmail: "pedidos@pizzeria-napoli.es", totalRevenue: 7500, invoiceCount: 24 },
    { customerName: "Cafetería Central", customerEmail: "central@cafeteria.es", totalRevenue: 6200, invoiceCount: 21 },
    { customerName: "Comida Rápida SL", customerEmail: "facturacion@comidarapida.com", totalRevenue: 5500, invoiceCount: 12 },
    { customerName: "Panadería Artesana", customerEmail: "pedidos@panaderia.es", totalRevenue: 4200, invoiceCount: 15 },
    { customerName: "Heladería Dolce", customerEmail: "info@heladeriadolce.es", totalRevenue: 3800, invoiceCount: 8 },
    { customerName: "Tapería Madrid", customerEmail: "taperiamadrid@gmail.com", totalRevenue: 3200, invoiceCount: 11 },
  ],
  averageValueTrend: [
    { month: "2024-01", monthLabel: "Ene 2024", averageValue: 357, invoiceCount: 42 },
    { month: "2024-02", monthLabel: "Feb 2024", averageValue: 362, invoiceCount: 51 },
    { month: "2024-03", monthLabel: "Mar 2024", averageValue: 362, invoiceCount: 58 },
    { month: "2024-04", monthLabel: "Abr 2024", averageValue: 372, invoiceCount: 47 },
    { month: "2024-05", monthLabel: "May 2024", averageValue: 354, invoiceCount: 62 },
    { month: "2024-06", monthLabel: "Jun 2024", averageValue: 365, invoiceCount: 65 },
    { month: "2024-07", monthLabel: "Jul 2024", averageValue: 470, invoiceCount: 17 },
  ],
  paymentMethodDistribution: [
    { method: "transferencia", count: 145, amount: 56200, label: "Transferencia" },
    { method: "tarjeta", count: 98, amount: 38900, label: "Tarjeta" },
    { method: "efectivo", count: 67, amount: 21400, label: "Efectivo" },
    { method: "bizum", count: 24, amount: 7250, label: "Bizum" },
    { method: "cheque", count: 8, amount: 2000, label: "Cheque" },
  ],
};

const emptyAnalytics: InvoiceAnalytics = {
  summary: {
    totalRevenue: 0,
    totalInvoices: 0,
    averageInvoiceValue: 0,
    paidInvoices: 0,
    pendingInvoices: 0,
  },
  monthlyRevenue: [],
  statusDistribution: [],
  topCustomers: [],
  averageValueTrend: [],
  paymentMethodDistribution: [],
};

const meta = {
  title: "ui/widgets/InvoiceAnalyticsWidget",
  component: InvoiceAnalyticsWidget,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof InvoiceAnalyticsWidget>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: "Default",
  args: {
    analytics: sampleAnalytics,
    loading: false,
  },
};

export const Loading: Story = {
  name: "Loading",
  args: {
    analytics: sampleAnalytics,
    loading: true,
  },
};

export const Empty: Story = {
  name: "Empty State",
  args: {
    analytics: emptyAnalytics,
    loading: false,
  },
};

export const HighRevenue: Story = {
  name: "High Revenue Data",
  args: {
    analytics: {
      summary: {
        totalRevenue: 1250750,
        totalInvoices: 2847,
        averageInvoiceValue: 439.32,
        paidInvoices: 2156,
        pendingInvoices: 342,
      },
      monthlyRevenue: [
        { month: "2024-01", monthLabel: "Ene 2024", revenue: 150000, invoiceCount: 342 },
        { month: "2024-02", monthLabel: "Feb 2024", revenue: 185000, invoiceCount: 412 },
        { month: "2024-03", monthLabel: "Mar 2024", revenue: 210000, invoiceCount: 478 },
        { month: "2024-04", monthLabel: "Abr 2024", revenue: 175000, invoiceCount: 398 },
        { month: "2024-05", monthLabel: "May 2024", revenue: 220000, invoiceCount: 512 },
        { month: "2024-06", monthLabel: "Jun 2024", revenue: 310750, invoiceCount: 705 },
      ],
      statusDistribution: [
        { status: "pagada", count: 2156, amount: 985000, label: "Pagadas" },
        { status: "pendiente", count: 342, amount: 157500, label: "Pendientes" },
        { status: "enviada", count: 189, amount: 68900, label: "Enviadas" },
        { status: "solicitada", count: 98, amount: 28400, label: "Solicitadas" },
        { status: "borrador", count: 62, amount: 12950, label: "Borradores" },
      ],
      topCustomers: [
        { customerName: "Gran Hotel Nacional", customerEmail: "facturas@granhotel.es", totalRevenue: 245000, invoiceCount: 128 },
        { customerName: "Cadena Restaurantes Uno", customerEmail: "admin@cadenauno.com", totalRevenue: 182000, invoiceCount: 85 },
        { customerName: "Eventos Corporativos SL", customerEmail: "eventos@corporativos.es", totalRevenue: 125000, invoiceCount: 42 },
        { customerName: "Resort Costa del Sol", customerEmail: "reservas@resortcosta.com", totalRevenue: 98000, invoiceCount: 58 },
        { customerName: "Grupo Alimentario SA", customerEmail: "compras@grupoalimentario.es", totalRevenue: 75000, invoiceCount: 124 },
      ],
      averageValueTrend: [
        { month: "2024-01", monthLabel: "Ene 2024", averageValue: 438, invoiceCount: 342 },
        { month: "2024-02", monthLabel: "Feb 2024", averageValue: 449, invoiceCount: 412 },
        { month: "2024-03", monthLabel: "Mar 2024", averageValue: 439, invoiceCount: 478 },
        { month: "2024-04", monthLabel: "Abr 2024", averageValue: 439, invoiceCount: 398 },
        { month: "2024-05", monthLabel: "May 2024", averageValue: 429, invoiceCount: 512 },
        { month: "2024-06", monthLabel: "Jun 2024", averageValue: 440, invoiceCount: 705 },
      ],
      paymentMethodDistribution: [
        { method: "transferencia", count: 1456, amount: 562000, label: "Transferencia" },
        { method: "tarjeta", count: 898, amount: 389000, label: "Tarjeta" },
        { method: "efectivo", count: 327, amount: 134000, label: "Efectivo" },
        { method: "bizum", count: 124, amount: 48750, label: "Bizum" },
        { method: "cheque", count: 42, amount: 17000, label: "Cheque" },
      ],
    },
    loading: false,
  },
};
