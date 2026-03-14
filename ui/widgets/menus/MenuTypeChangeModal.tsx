import React from "react";

import { X } from "lucide-react";

import { Select } from "../../inputs/Select";
import { Modal } from "../../overlays/Modal";
import { MENU_TYPE_PANELS, menuTypeLabel } from "./menuPresentation";

const MENU_TYPE_OPTIONS = MENU_TYPE_PANELS.map((panel) => ({ value: panel.value, label: panel.label }));

export const MenuTypeChangeModal = React.memo(function MenuTypeChangeModal({
  open,
  currentType,
  nextType,
  saving,
  title = "Cambiar tipo de menu",
  onClose,
  onNextTypeChange,
  onConfirm,
}: {
  open: boolean;
  currentType: string;
  nextType: string;
  saving: boolean;
  title?: string;
  onClose: () => void;
  onNextTypeChange: (value: string) => void;
  onConfirm: () => void;
}) {
  const disableConfirm = saving || !nextType || nextType === currentType;

  return (
    <Modal open={open} title={title} onClose={onClose} widthPx={520}>
      <div className="flex items-center justify-between mb-4">
        <div className="text-base font-semibold text-foreground">{title}</div>
        <button className="text-muted hover:text-foreground w-8 h-8 flex items-center justify-center" type="button" onClick={onClose} aria-label="Cerrar">
          <X size={16} aria-hidden="true" focusable={false} />
        </button>
      </div>

      <div className="mb-6">
        <div className="grid gap-1.5 mb-4">
          <div className="text-xs text-muted font-semibold">Tipo actual</div>
          <div className="text-sm text-foreground">{menuTypeLabel(currentType || "closed_conventional")}</div>
        </div>

        <label className="grid gap-1.5">
          <span className="text-xs text-muted font-semibold">Nuevo tipo</span>
          <Select value={nextType} onChange={onNextTypeChange} options={MENU_TYPE_OPTIONS} ariaLabel="Nuevo tipo de menu" />
        </label>
      </div>

      <div className="flex justify-end gap-3">
        <button className="h-10 px-4 rounded-lg border border-transparent bg-transparent text-sm font-bold text-foreground hover:bg-white/[0.06] transition-colors duration-150 disabled:opacity-55 disabled:cursor-not-allowed" type="button" disabled={saving} onClick={onClose}>
          Cancelar
        </button>
        <button className="h-10 px-4 rounded-lg border border-primary/30 bg-primary/16 text-sm font-bold text-foreground hover:bg-primary/24 hover:border-primary/40 transition-all duration-150 disabled:opacity-55 disabled:cursor-not-allowed" type="button" disabled={disableConfirm} onClick={onConfirm}>
          {saving ? "Guardando..." : "Guardar"}
        </button>
      </div>
    </Modal>
  );
});
