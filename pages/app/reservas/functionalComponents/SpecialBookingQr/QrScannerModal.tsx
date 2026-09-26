import React, { useEffect, useRef, useState } from "react";

import { Modal } from "../../../../../ui/overlays/Modal";
import { ModalHeader } from "../../../../../ui/overlays/ModalHeader";

const SCANNER_ELEMENT_ID = "bo-reservas-qr-scanner";

type ScannerHandle = { stop: () => Promise<void>; clear: () => void; isScanning: boolean };

/**
 * Opens the device camera (rear camera on mobile) and navigates to the booking
 * page encoded in a special-date QR. Only same-origin backoffice booking URLs
 * are followed. Coordination id: special_booking_qr_v1
 */
export function QrScannerModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const scannerRef = useRef<ScannerHandle | null>(null);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setError(null);
    void import("html5-qrcode").then(async ({ Html5Qrcode }) => {
      if (!alive) return;
      const scanner = new Html5Qrcode(SCANNER_ELEMENT_ID);
      scannerRef.current = scanner;
      try {
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 240, height: 240 } },
          (text) => {
            const target = bookingPathFromQr(text);
            if (!target) { setError("QR no válido para una reserva."); return; }
            console.info("[special_booking_qr_v1] scanned", target);
            scannerRef.current = null; // cleanup must not stop it a second time
            void scanner.stop().catch(() => undefined).finally(() => { window.location.assign(target); });
          },
          () => undefined,
        );
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : "No se pudo abrir la cámara");
      }
    });
    return () => {
      alive = false;
      const s = scannerRef.current;
      scannerRef.current = null;
      if (s?.isScanning) void s.stop().then(() => s.clear()).catch(() => undefined);
    };
  }, [open]);

  return (
    <Modal open={open} title="Escanear QR" onClose={onClose} widthPx={520} className="bo-qrScannerModal" hideClose>
      <ModalHeader title="Escanear QR de reserva" onClose={onClose} />
      <div id={SCANNER_ELEMENT_ID} className="bo-qrScannerView" data-testid="reservas-qr-scanner-view" />
      {error ? <p className="bo-muted" data-testid="reservas-qr-scanner-error">{error}</p> : null}
    </Modal>
  );
}

/** Accepts only /app/reservas/especial/reserva URLs and returns a relative path. */
export function bookingPathFromQr(text: string): string | null {
  try {
    const url = new URL(text, window.location.origin);
    if (url.pathname !== "/app/reservas/especial/reserva" || !url.searchParams.get("booking_id")) return null;
    return `${url.pathname}${url.search}`;
  } catch {
    return null;
  }
}
