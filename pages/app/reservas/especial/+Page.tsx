import React from "react";
import { usePageContext } from "vike-react/usePageContext";
import { ArrowLeft, Sparkles } from "lucide-react";

import type { MenuSelectorItem, SpecialDateListEntry, SpecialDateSettings } from "../../../../api/types";
import { InlineAlert } from "../../../../ui/feedback/InlineAlert";
import { SpecialDateForm } from "./functionalComponents/SpecialDateForm";
import { SpecialDateCardList } from "./functionalComponents/SpecialDateCardList";

type PageData = {
  date: string;
  specialDate: SpecialDateSettings | null;
  availableMenus: MenuSelectorItem[];
  list: SpecialDateListEntry[];
  error: string | null;
};

export default function Page() {
  const pageContext = usePageContext();
  const data = (pageContext.data ?? {
    date: "",
    specialDate: null,
    availableMenus: [],
    list: [],
    error: null,
  }) as PageData;

  if (data.error) {
    return <InlineAlert kind="error" title="Error" message={data.error} testId="especial-error-alert" />;
  }

  // Date is "active special" only when the server returned is_active=true (not
  // merely when the row exists — deactivated rows fall back to the conversion view).
  const isActiveSpecial = Boolean(data.specialDate?.is_active);

  return (
    <section data-ui="especial-page" data-testid="especial-page-section" aria-label="Reservas especiales">
      <div
        className="mx-auto mb-4 flex max-w-[768px] items-center justify-between gap-3"
        data-testid="especial-page-header"
      >
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

      {isActiveSpecial ? (
        <SpecialDateForm
          date={data.date}
          initial={data.specialDate}
          availableMenus={data.availableMenus}
        />
      ) : (
        <div className="mx-auto grid max-w-[768px] gap-6" data-testid="especial-page-inactive">
          {/* #1 — Convert this date to special */}
          <section
            data-testid="especial-page-convert-section"
            aria-labelledby="especial-page-convert-title"
            className="bo-panel"
          >
            <div className="bo-panelBody grid gap-3" data-testid="especial-page-convert-body">
              <div className="flex items-center gap-2">
                <Sparkles size={18} strokeWidth={1.6} className="text-(--bo-accent, rgba(185,168,255,0.9))" aria-hidden="true" />
                <h2 id="especial-page-convert-title" className="text-base font-medium">
                  Convertir esta fecha en especial
                </h2>
              </div>
              <p className="text-sm text-(--bo-muted)" data-testid="especial-page-convert-desc">
                Activa la pestaña de menú especial para esta fecha desde Configuración. Luego podrás
                definir el título, los menús, prereserva y adelanto.
              </p>
              <div>
                <a
                  href={`/app/reservas/config?date=${encodeURIComponent(data.date)}`}
                  className="bo-btn bo-btn--primary"
                  data-testid="especial-page-convert-btn"
                >
                  Activar reservas especiales
                </a>
              </div>
            </div>
          </section>

          {/* #2 — Card list of every existing special date */}
          <section
            data-testid="especial-page-list-section"
            aria-labelledby="especial-page-list-title"
            className="grid gap-3"
          >
            <h2 id="especial-page-list-title" className="text-base font-medium">
              Fechas con menú especial
            </h2>
            <SpecialDateCardList
              entries={data.list}
              onSelect={(d) => {
                window.location.assign(`/app/reservas/especial?date=${encodeURIComponent(d)}`);
              }}
              testId="especial-page-list"
            />
          </section>
        </div>
      )}
    </section>
  );
}
