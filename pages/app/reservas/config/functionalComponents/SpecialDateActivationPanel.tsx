import React from "react";
import { motion } from "motion/react";
import { Sparkles } from "lucide-react";

import type { SpecialDateSettings } from "../../../../../api/types";
import { Switch } from "../../../../../ui/shadcn/Switch";

export interface SpecialDateActivationPanelProps {
  specialDate: SpecialDateSettings | null;
  busy: boolean;
  onToggle: (checked: boolean) => void;
}

export function SpecialDateActivationPanel({ specialDate, busy, onToggle }: SpecialDateActivationPanelProps) {
  const isActive = Boolean(specialDate?.is_active);

  return (
    <motion.div
      data-ui="special-date-activation-panel"
      data-testid="special-date-activation-panel"
      key="special-date-activation"
      className="bo-panel overflow-hidden w-full max-w-[768px] mx-auto"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div
        data-slot="panel-head"
        className="bo-panelHead px-4 pt-4 pb-3 sm:px-6 sm:pt-5 sm:pb-4 mx-auto justify-center"
        data-testid="special-date-activation-head"
      >
        <div
          className="flex flex-col sm:items-center sm:justify-between gap-2 mx-auto"
          data-slot="special-date-activation-head-inner"
          data-testid="special-date-activation-head-inner"
        >
          <div data-slot="special-date-activation-titles" data-testid="special-date-activation-titles">
            <div
              role="title"
              className="bo-panelTitle text-base sm:text-lg text-center flex items-center gap-2"
              data-testid="special-date-activation-title"
            >
              <Sparkles size={16} strokeWidth={1.8} aria-hidden="true" />
              Reservas especiales
            </div>
            <div
              data-slot="special-date-activation-subtitle"
              className="bo-panelMeta text-xs sm:text-sm mt-0.5 text-center"
              data-testid="special-date-activation-subtitle"
            >
              Activa esta fecha como fecha especial y configura los menús y el adelanto
            </div>
          </div>
          <div
            className="flex items-center gap-3 mx-auto"
            data-ui="special-date-activation-toggle"
            data-testid="special-date-activation-toggle-row"
          >
            <span
              className={`text-sm font-medium ${isActive ? "text-(--bo-accent)" : "text-(--bo-muted)"} transition-colors duration-150`}
              data-testid="special-date-activation-toggle-label"
            >
              {isActive ? "Activado" : "Desactivado"}
            </span>
            <Switch
              checked={isActive}
              onCheckedChange={onToggle}
              disabled={busy}
              aria-label="Activar reservas especiales para esta fecha"
              data-testid="special-date-activation-switch"
            />
          </div>
        </div>
      </div>
      {isActive ? (
        <div
          data-slot="special-date-activation-hint"
          className="bo-panelBody px-4 pb-4 sm:px-6 sm:pb-5"
          data-testid="special-date-activation-hint"
        >
          <div
            className="p-3 rounded-lg bg-(--bo-surface-2) border border-(--bo-border)"
            data-testid="special-date-activation-hint-banner"
          >
            <p className="text-xs text-(--bo-muted) leading-relaxed" data-testid="special-date-activation-hint-text">
              La pestaña <strong>Especial</strong> está disponible para configurar título, menús, prereserva y adelanto.
            </p>
          </div>
        </div>
      ) : null}
    </motion.div>
  );
}
