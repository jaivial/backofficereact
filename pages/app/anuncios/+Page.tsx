import React from "react";
import { AdsList } from "./functionalComponents/AdsList";

/**
 * Anuncios module entry point. First-class section reachable from the sidenav
 * and the mobile bottom nav; it is no longer a tab inside `/app/config`.
 */
export default function AnunciosPage() {
  return (
    <section aria-label="Anuncios" className="bo-anunciosPage grid gap-4" data-testid="anuncios-page" data-slot="anuncios-page">
      <AdsList />
    </section>
  );
}
