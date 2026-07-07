import React, { useEffect } from "react";
import { Scale } from "lucide-react";

import { InlineAlert } from "../../../../../ui/feedback/InlineAlert";
import { useLegalPagesList } from "./legalPagesApi";

export function ConfigLegalPages() {
  const { pages, loading, error, reload } = useLegalPagesList();

  useEffect(() => {
    void reload();
  }, [reload]);

  if (loading) {
    return <InlineAlert kind="info" title="Cargando" message="Preparando páginas legales..." />;
  }

  if (error) {
    return <InlineAlert kind="error" title="Error" message={error} />;
  }

  if (pages.length === 0) {
    return <InlineAlert kind="info" title="Sin páginas legales" message="No hay páginas legales configuradas." />;
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4" data-ui="legal-pages-grid" data-slot="legal-pages-grid">
      {pages.map((page) => (
        <a
          key={page.slug}
          href={`/app/config/legal-pages/${page.slug}`}
          className="bo-card bo-card--hoverable"
          data-slot="legal-page-card"
          data-testid={`legal-page-card-${page.slug}`}
        >
          <div className="bo-cardIconHeader" data-slot="legal-page-cardIconHeader">
            <div className="bo-cardIcon bo-cardIcon--purple" aria-hidden="true">
              <Scale className="bo-ico" />
            </div>
            <div className="bo-cardIconContent" data-slot="legal-page-cardIconContent">
              <div className="bo-cardIconTitle">{page.title}</div>
              <div className="bo-cardIconSubtitle">{page.slug}</div>
            </div>
          </div>
          <div className="bo-cardBody" data-slot="legal-page-cardBody">
            <span className="bo-btn bo-btn--primary" data-slot="legal-page-editBtn">
              Editar
            </span>
          </div>
        </a>
      ))}
    </div>
  );
}
