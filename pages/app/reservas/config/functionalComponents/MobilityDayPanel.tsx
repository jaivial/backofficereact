import React from "react";
import { motion } from "motion/react";
import { Accessibility } from "lucide-react";

import { Switch } from "../../../../../ui/shadcn/Switch";

export interface MobilityDayPanelProps {
  enabled: boolean;
  override: boolean | null;
  busy: boolean;
  onToggle: (checked: boolean) => void;
}

/**
 * Per-day "Problemas de movilidad" question toggle. The concrete day choice
 * always wins over the global default (configured in /app/config).
 *
 * Coordination id: mobility_day_override_v1
 * Observation point: `mobility_day.panel.render`
 */
export function MobilityDayPanel({ enabled, override, busy, onToggle }: MobilityDayPanelProps) {
  const inherits = override === null;

  return (
    <motion.div
      data-ui="mobility-day-panel"
      data-testid="mobility-day-panel"
      key="mobility-day"
      className="bo-panel overflow-hidden w-full max-w-[768px] mx-auto"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div
        data-slot="panel-head"
        className="bo-panelHead px-4 pt-4 pb-3 sm:px-6 sm:pt-5 sm:pb-4 mx-auto justify-center"
        data-testid="mobility-day-head"
      >
        <div
          className="flex flex-col sm:items-center sm:justify-between gap-2 mx-auto"
          data-slot="mobility-day-head-inner"
          data-testid="mobility-day-head-inner"
        >
          <div data-slot="mobility-day-titles" data-testid="mobility-day-titles">
            <div
              role="title"
              className="bo-panelTitle text-base sm:text-lg text-center flex items-center gap-2"
              data-testid="mobility-day-title"
            >
              <Accessibility size={16} strokeWidth={1.8} aria-hidden="true" />
              Problemas de movilidad
            </div>
            <div
              data-slot="mobility-day-subtitle"
              className="bo-panelMeta text-xs sm:text-sm mt-0.5 text-center"
              data-testid="mobility-day-subtitle"
            >
              Pregunta al cliente si hay personas con problemas de movilidad
            </div>
          </div>
          <div
            className="flex items-center gap-3 mx-auto"
            data-ui="mobility-day-toggle"
            data-testid="mobility-day-toggle-row"
          >
            <span
              className={`text-sm font-medium ${enabled ? "text-bo-accent" : "text-bo-muted"} transition-colors duration-150`}
              data-testid="mobility-day-toggle-label"
            >
              {enabled ? "Activado" : "Desactivado"}
            </span>
            <Switch
              checked={enabled}
              onCheckedChange={onToggle}
              disabled={busy}
              aria-label="Activar pregunta de problemas de movilidad para este día"
              data-testid="mobility-day-switch"
            />
          </div>
        </div>
      </div>
      {inherits ? (
        <div
          data-slot="mobility-day-hint"
          className="bo-panelBody px-4 pb-4 sm:px-6 sm:pb-5"
          data-testid="mobility-day-hint"
        >
          <div
            className="p-3 rounded-lg bg-bo-surface-2 border border-bo-border"
            data-testid="mobility-day-hint-banner"
          >
            <p className="text-xs text-bo-muted leading-relaxed" data-testid="mobility-day-hint-text">
              Este día sigue la configuración global. Al cambiarlo, este día tendrá preferencia.
            </p>
          </div>
        </div>
      ) : null}
    </motion.div>
  );
}
