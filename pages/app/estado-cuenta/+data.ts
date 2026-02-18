import type { PageContextServer } from "vike/types";
import { useConfig } from "vike-react/useConfig";
import { createClient } from "../../../api/client";

type PageData = {
  customers: { name: string; email?: string; dni_cif?: string }[];
};

export type Data = Awaited<ReturnType<typeof data>>;

export async function data(pageContext: PageContextServer) {
  const config = useConfig();
  config({ title: "Estado de Cuenta" });

  const backendOrigin = pageContext.boRequest?.backendOrigin ?? "http://127.0.0.1:8080";
  const cookieHeader = pageContext.boRequest?.cookieHeader ?? "";
  const api = createClient({ baseUrl: backendOrigin, cookieHeader });

  let customers: { name: string; email?: string; dni_cif?: string }[] = [];

  try {
    const res = await api.taxReports.listCustomersWithInvoices();
    if (res.success && res.customers) {
      customers = res.customers;
    }
  } catch (e) {
    // Silently handle - customers will be loaded on demand
  }

  return { customers };
}
