import React, { useCallback, useMemo } from "react";

import { createClient } from "../../../../../api/client";
import type { MenuPublicSEO } from "../../../../../api/types";
import { PublicSEOForm } from "../../../menus/crear/functionalComponents/MenuPublicSEOSettings";

// Coordination id: cafes_page_seo_v1
// /app/comida/cafes > Configuración: SEO of the public /cafes page, same fields
// as a menu's SEO panel. The path is fixed, so there is no slug.
export function CafesPageSEOSettings() {
  const api = useMemo(() => createClient({ baseUrl: "" }), []);
  const load = useCallback(async () => {
    const res = await api.settings.getCafesSEO();
    return res.success ? { ok: true, seo: res.seo } : { ok: false, message: res.message };
  }, [api]);
  const save = useCallback(async ({ seo_slug: _slug, ...seo }: MenuPublicSEO) => {
    const res = await api.settings.setCafesSEO(seo);
    return res.success ? { ok: true } : { ok: false, message: res.message };
  }, [api]);
  return (
    <div className="bo-card" data-testid="cafes-page-seo-card">
      <PublicSEOForm
        ready
        title="Carta de cafés"
        load={load}
        save={save}
        fixedPath="/cafes"
        heading="SEO de la página de cafés"
        testPrefix="cafes-page-seo"
        coordinationId="cafes_page_seo_v1"
      />
    </div>
  );
}
