import { useCallback, useEffect, useMemo, useState } from "react";

import { createClient } from "../../../../../api/client";

export type BookingQrInfo = { qr_url: string; receipt_url: string; target_url: string };

/**
 * Loads (and backfills on demand) the QR + payment receipt CDN URLs of a
 * special-date booking. Coordination id: special_booking_qr_v1
 */
export function useBookingQr(bookingId: number | null, seed?: { qr_url?: string | null; receipt_url?: string | null }) {
  const api = useMemo(() => createClient({ baseUrl: "" }), []);
  const [info, setInfo] = useState<BookingQrInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!bookingId) return;
    setError(null);
    const res = await api.reservas.qr(bookingId);
    if (!res.success) { setError(res.message || "No se pudo cargar el QR"); return; }
    setInfo({ qr_url: res.qr_url || "", receipt_url: res.receipt_url || "", target_url: res.target_url || "" });
  }, [api, bookingId]);

  useEffect(() => {
    if (!bookingId) { setInfo(null); return; }
    if (seed?.qr_url) setInfo({ qr_url: seed.qr_url, receipt_url: seed.receipt_url || "", target_url: "" });
    void load();
  }, [bookingId, load, seed?.qr_url, seed?.receipt_url]);

  return { info, error, reload: load };
}
