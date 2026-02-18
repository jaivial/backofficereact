import type { PageContextServer } from "vike/types";
import { useConfig } from "vike-react/useConfig";
import { createClient } from "../../../api/client";
import type { Invoice } from "../../../api/types";

type PageData = {
  invoice: Invoice | null;
  error: string | null;
  backendOrigin: string;
};

export type Data = Awaited<ReturnType<typeof data>>;

export async function data(pageContext: PageContextServer) {
  const config = useConfig();
  config({ title: "Ver Factura" });

  const backendOrigin = pageContext.boRequest?.backendOrigin ?? "http://127.0.0.1:8080";
  const cookieHeader = pageContext.boRequest?.cookieHeader ?? "";

  // Extract invoice ID and token from URL
  // URL format: /factura/{id}?token={token}
  const url = new URL(pageContext.urlOriginal, "http://localhost");
  const pathParts = url.pathname.split("/").filter(Boolean);
  const invoiceId = pathParts[1]; // First part after "factura"
  const token = url.searchParams.get("token");

  let invoice: Invoice | null = null;
  let error: string | null = null;

  if (!invoiceId) {
    error = "ID de factura no proporcionado";
    return { invoice, error, backendOrigin };
  }

  if (!token) {
    error = "Token de acceso no proporcionado";
    return { invoice, error, backendOrigin };
  }

  const invoiceNum = parseInt(invoiceId, 10);
  if (isNaN(invoiceNum)) {
    error = "ID de factura inválido";
    return { invoice, error, backendOrigin };
  }

  try {
    // Create client for public API (no auth)
    const api = createClient({ baseUrl: backendOrigin, cookieHeader });

    // Fetch invoice using public endpoint with token
    const res = await api.publicInvoices.get(invoiceNum, token);

    if (res.success && res.invoice) {
      invoice = res.invoice;
    } else {
      error = res.message || "Factura no encontrada o token inválido";
    }
  } catch (e) {
    error = e instanceof Error ? e.message : "Error cargando la factura";
  }

  return { invoice, error, backendOrigin };
}
