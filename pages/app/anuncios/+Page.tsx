import React from "react";
import { AnunciosList } from "../config/functionalComponents/ConfigAnuncios/AnunciosList";
import { useAdsController } from "../config/functionalComponents/ConfigAnuncios/hooks/useAdsController";

/**
 * Anuncios module entry point. First-class section reachable from the sidenav
 * and the mobile bottom nav; it is no longer a tab inside `/app/config`.
 */
export default function AnunciosPage() {
  const { api, notify } = useAdsController();
  return (
    <section aria-label="Anuncios" className="grid gap-4" data-testid="anuncios-page" data-slot="anuncios-page">
      <AnunciosList api={api} notify={notify} />
    </section>
  );
}
