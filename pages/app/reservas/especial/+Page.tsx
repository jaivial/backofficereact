import React from "react";
import { usePageContext } from "vike-react/usePageContext";
import { ArrowLeft } from "lucide-react";

import type { MenuSelectorItem, SpecialDateSettings } from "../../../../api/types";
import { InlineAlert } from "../../../../ui/feedback/InlineAlert";
import { SpecialDateForm } from "./functionalComponents/SpecialDateForm";

type PageData = {
  date: string;
  specialDate: SpecialDateSettings | null;
  availableMenus: MenuSelectorItem[];
  error: string | null;
};

export default function Page() {
  const pageContext = usePageContext();
  const data = (pageContext.data ?? {
    date: "",
    specialDate: null,
    availableMenus: [],
    error: null,
  }) as PageData;

  if (data.error) {
    return <InlineAlert kind="error" title="Error" message={data.error} testId="especial-error-alert" />;
  }

  return (
    <section data-ui="especial-page" data-testid="especial-page-section" aria-label="Reservas especiales">
      <div className="flex items-center justify-between mb-4 max-w-[768px] mx-auto" data-testid="especial-page-header">
        <a
          href={`/app/reservas/config?date=${encodeURIComponent(data.date)}`}
          className="bo-btn bo-btn--ghost flex items-center gap-2"
          data-testid="especial-page-activate-cta"
        >
          <ArrowLeft size={16} strokeWidth={1.8} aria-hidden="true" />
          Ir a configuración
        </a>
        <div className="text-sm text-(--bo-muted)" data-testid="especial-page-date">
          {data.date}
        </div>
      </div>
      {!data.specialDate?.is_active ? (
        <div className="max-w-[768px] mx-auto mb-4" data-testid="especial-page-activate-banner">
          <InlineAlert
            kind="info"
            title="Activa esta fecha como especial"
            message="Para guardar cambios primero activa 'Reservas especiales' desde la pestaña Configuración."
            testId="especial-page-activate-hint"
          />
        </div>
      ) : null}
      <SpecialDateForm
        date={data.date}
        initial={data.specialDate}
        availableMenus={data.availableMenus}
      />
    </section>
  );
}
