/**
 * SSR-safe portal target for POS overlays.
 *
 * `document` does not exist while the POS page is rendered on the server, so a
 * modal that calls `createPortal(..., document.body)` during render throws
 * "ReferenceError: document is not defined" and takes the whole sell-screen
 * subtree down with it. The POS cash-day gates render on the very first pass
 * (they only depend on data), so they must resolve their target the same way
 * `ui/overlays/Modal` does: bail out on the server, portal after mount.
 */
export function posPortalRoot(): HTMLElement | null {
  if (typeof document === "undefined") return null;
  return document.getElementById("bo-portal") || document.body;
}
