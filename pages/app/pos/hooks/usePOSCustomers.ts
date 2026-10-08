import { useCallback, useState } from "react";

import { POSRequestError, request } from "./usePOSRegister";
import type { POSCustomer, POSCustomerSummary } from "../types/customers";

export type POSCustomerDraft = { displayName: string; phone: string; email: string; taxId: string; notes: string };

/**
 * Guest search, profile and the link between a check and a guest. Kept out of
 * usePOSRegister: it is a side panel the till opens, not part of ringing a sale.
 */
export function usePOSCustomers() {
  const [results, setResults] = useState<POSCustomerSummary[]>([]);
  const [profile, setProfile] = useState<POSCustomer | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  /** Set when a create collides with an existing phone/email: offer that guest instead. */
  const [existing, setExisting] = useState<{ id: number; displayName: string } | null>(null);

  const search = useCallback(async (q: string) => {
    setError("");
    try {
      const data = await request<{ customers: POSCustomerSummary[] }>(`/customers?q=${encodeURIComponent(q.trim())}`);
      setResults(data.customers);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo buscar"); }
  }, []);

  const open = useCallback(async (id: number) => {
    setBusy(true); setError("");
    try { const data = await request<{ customer: POSCustomer }>(`/customers/${id}`); setProfile(data.customer); return data.customer; }
    catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo cargar el cliente"); return null; }
    finally { setBusy(false); }
  }, []);

  const save = useCallback(async (draft: POSCustomerDraft, id?: number) => {
    setBusy(true); setError(""); setExisting(null);
    try {
      const data = await request<{ customer: POSCustomer }>(id ? `/customers/${id}` : "/customers", { method: id ? "PATCH" : "POST", body: JSON.stringify(draft) });
      setProfile(data.customer);
      return data.customer;
    } catch (reason) {
      if (reason instanceof POSRequestError && reason.code === "CUSTOMER_EXISTS") {
        // The server names the guest who already owns that phone/email.
        const id = Number(reason.body?.customerId);
        setExisting(id > 0 ? { id, displayName: String(reason.body?.displayName || "") } : null);
      }
      setError(reason instanceof Error ? reason.message : "No se pudo guardar el cliente");
      return null;
    } finally { setBusy(false); }
  }, []);

  const anonymise = useCallback(async (id: number) => {
    setBusy(true); setError("");
    try { await request(`/customers/${id}/anonymise`, { method: "POST", body: "{}" }); setProfile(null); return true; }
    catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo anonimizar"); return false; }
    finally { setBusy(false); }
  }, []);

  return { results, search, profile, setProfile, open, save, anonymise, busy, error, setError, existing };
}
