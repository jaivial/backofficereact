import React, { useMemo } from "react";
import type { WidgetSettings } from "../../../../api/types";

const STEPS = ["Fecha", "Hora", "Datos", "Confirmar"];

export function WidgetPreview({ settings }: { settings: WidgetSettings }) {
  const style = useMemo(
    () => ({
      "--vc-color-primary": settings.primary_color,
      "--vc-color-success": settings.success_color,
      "--vc-color-border": settings.border_color,
      "--vc-color-surface": settings.surface_color,
      "--vc-color-text": settings.text_color,
      "--vc-color-muted": settings.muted_color,
      fontFamily: settings.font_stack,
    }),
    [settings],
  );

  const primaryHex = settings.primary_color;

  return (
    <div className="bo-widget-preview-wrapper" data-ui="widget-preview-wrapper">
      <div
        className="vc-widget bo-widget-preview"
        style={style}
        data-ui="widget-preview"
      >
        <div className="vc-widget-header" data-ui="widget-header">
          <div className="vc-widget-title" data-ui="widget-title">
            Nueva Villa Carmen
          </div>
        </div>

        <div className="vc-widget-body" data-ui="widget-body">
          {/* Step indicator */}
          <div className="vc-widget-steps" data-ui="widget-steps">
            {STEPS.map((step, i) => (
              <div
                key={step}
                className={`vc-widget-step${i === 0 ? " is-active" : ""}`}
                data-ui="widget-step"
                data-step={step}
              >
                <div
                  className="vc-widget-stepDot"
                  style={{ backgroundColor: i === 0 ? primaryHex : "var(--vc-color-border)" }}
                  data-ui="widget-step-dot"
                />
                <div
                  className="vc-widget-stepLabel"
                  data-ui="widget-step-label"
                >
                  {step}
                </div>
              </div>
            ))}
          </div>

          {/* Date selection mock */}
          <div className="vc-widget-section" data-ui="widget-section">
            <div className="vc-widget-sectionTitle" data-ui="widget-section-title">
              Selecciona fecha
            </div>
            <div className="vc-widget-calendar" data-ui="widget-calendar">
              <div className="vc-widget-calHeader" data-ui="widget-cal-header">
                <button type="button" className="vc-widget-calNav" aria-label="Mes anterior" data-ui="widget-cal-nav-prev">&lt;</button>
                <span className="vc-widget-calMonth" data-ui="widget-cal-month">Mayo 2026</span>
                <button type="button" className="vc-widget-calNav" aria-label="Mes siguiente" data-ui="widget-cal-nav-next">&gt;</button>
              </div>
              <div className="vc-widget-calGrid" data-ui="widget-cal-grid">
                {["L", "M", "X", "J", "V", "S", "D"].map((d) => (
                  <div key={d} className="vc-widget-calWeekday" data-ui="widget-cal-weekday">{d}</div>
                ))}
                {Array.from({ length: 35 }, (_, i) => {
                  const day = i - 2;
                  const isPast = day <= 0 || day > 31;
                  const isSelected = day === 6;
                  const isToday = day === 5;
                  return (
                    <button
                      key={i}
                      type="button"
                      className={[
                        "vc-widget-calDay",
                        isPast ? " is-disabled" : "",
                        isSelected ? " is-selected" : "",
                        isToday ? " is-today" : "",
                      ].filter(Boolean).join("")}
                      disabled={isPast}
                      aria-label={`${Math.abs(day) + 1} de mayo`}
                      data-ui="widget-cal-day"
                      data-day={day > 0 ? day : undefined}
                    >
                      {day > 0 && day <= 31 ? day : ""}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Guests mock */}
          <div className="vc-widget-section" data-ui="widget-section-guests">
            <div className="vc-widget-sectionTitle" data-ui="widget-section-title-guests">
              Comensales
            </div>
            <div className="vc-widget-guestCounter" data-ui="widget-guest-counter">
              <button type="button" className="vc-widget-guestBtn" aria-label="Quitar comensal" data-ui="widget-guest-dec">−</button>
              <span className="vc-widget-guestCount" data-ui="widget-guest-count">2</span>
              <button type="button" className="vc-widget-guestBtn" aria-label="Añadir comensal" data-ui="widget-guest-inc">+</button>
            </div>
          </div>

          {/* CTA button */}
          <button
            type="button"
            className="vc-widget-cta"
            style={{ backgroundColor: primaryHex }}
            data-ui="widget-cta"
          >
            Ver horarios disponibles
          </button>
        </div>
      </div>
    </div>
  );
}
