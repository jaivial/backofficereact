import React from "react";

import { X } from "lucide-react";

import { Select } from "../../inputs/Select";
import { Modal } from "../../overlays/Modal";
import { cn } from "../../shadcn/utils";
import { MENU_TYPE_PANELS, menuTypeLabel } from "./menuPresentation";

const MENU_TYPE_OPTIONS = MENU_TYPE_PANELS.map((panel) => ({ value: panel.value, label: panel.label }));

export const MenuTypeChangeModal = React.memo(function MenuTypeChangeModal({
  open,
  currentType,
  nextType,
  saving,
  title = "Cambiar tipo de menu",
  className,
  onClose,
  onNextTypeChange,
  onConfirm,
}: {
  open: boolean;
  currentType: string;
  nextType: string;
  saving: boolean;
  title?: string;
  className?: string;
  onClose: () => void;
  onNextTypeChange: (value: string) => void;
  onConfirm: () => void;
}) {
  const disableConfirm = saving || !nextType || nextType === currentType;

  return (
    <Modal open={open} title={title} onClose={onClose} widthPx={520} className={className}>
      <div className="bo-modalHead">
        <div className="bo-modalTitle">{title}</div>
        <button className="bo-modalX" type="button" onClick={onClose} aria-label="Cerrar" data-testid="menu-type-change-modal-close">
          <X size={16} aria-hidden="true" focusable={false} />
        </button>
      </div>

      <div className="bo-modalBody">
        <div className="bo-field bo-field--full">
          <div className="bo-label">Tipo actual</div>
          <div className="bo-mutedText">{menuTypeLabel(currentType || "closed_conventional")}</div>
        </div>

        <label className="bo-field bo-field--full">
          <span className="bo-label">Nuevo tipo</span>
          <Select value={nextType} onChange={onNextTypeChange} options={MENU_TYPE_OPTIONS} ariaLabel="Nuevo tipo de menu" />
        </label>
      </div>

      <div className="bo-modalActions">
        <button className="bo-btn bo-btn--ghost" type="button" disabled={saving} onClick={onClose} data-testid="menu-type-change-modal-cancel">
          Cancelar
        </button>
        <button className="bo-btn bo-btn--primary" type="button" disabled={disableConfirm} onClick={onConfirm} data-testid="menu-type-change-modal-confirm">
          {saving ? "Guardando..." : "Guardar"}
        </button>
      </div>
    </Modal>
  );
});
