import React, { useState } from "react";
import { Plus, Trash2 } from "lucide-react";

import { Modal } from "../../overlays/Modal";
import { ModalHeader } from "../../overlays/ModalHeader";
import { Switch } from "../../shadcn/Switch";

// Coordination id: booking_extras_v1 / reusable_options_toggle_v1
//
// Reusable "toggle a catalog of options" UI, extracted from the menu editor's
// "bebidas incluidas" pattern (chip row + modal with custom-add and delete) so
// the booking extras section reuses the same interaction and styling. The
// content is data-driven, so any restaurant-scoped option catalog can use it.

export type ToggleOption = {
  id: number;
  slug: string;
  name: string;
  is_custom?: boolean;
};

function isSelected(selectedIds: number[], id: number): boolean {
  return selectedIds.includes(id);
}

/**
 * Inline list of toggle rows (label + switch). Used for the booking "Extras"
 * section where every catalog option is a switch.
 */
export function OptionsSwitchList({
  options,
  selectedIds,
  onToggle,
  disabled = false,
  testIdPrefix = "option",
  slotPrefix = "option",
  emptyHint = "No hay opciones disponibles.",
}: {
  options: ToggleOption[];
  selectedIds: number[];
  onToggle: (id: number, selected: boolean) => void;
  disabled?: boolean;
  testIdPrefix?: string;
  slotPrefix?: string;
  emptyHint?: string;
}) {
  return (
    <div className="bo-stackFields" data-slot={`${slotPrefix}-switchList`} data-testid={`${testIdPrefix}-switch-list`}>
      {options.map((option) => (
        <div key={option.id} className="bo-field bo-field--inline" data-slot={`${slotPrefix}-switchField`}>
          <div className="bo-label" data-slot={`${slotPrefix}-switchLabel`}>{option.name}</div>
          <Switch
            checked={isSelected(selectedIds, option.id)}
            onCheckedChange={(checked) => onToggle(option.id, checked)}
            disabled={disabled}
            aria-label={option.name}
            data-testid={`${testIdPrefix}-switch-${option.slug}`}
          />
        </div>
      ))}
      {options.length === 0 ? <div className="bo-mutedText" data-slot={`${slotPrefix}-empty`}>{emptyHint}</div> : null}
    </div>
  );
}

/**
 * Modal to manage a catalog of toggle options: toggle each option, add a new
 * custom one, and request deleting custom entries. Mirrors the beverage options
 * modal so both surfaces feel identical.
 */
export function OptionsToggleModal({
  open,
  title = "Opciones",
  headerTitle = "Selecciona opciones",
  options,
  selectedIds,
  onToggle,
  onCreate,
  onRequestDelete,
  onClose,
  disabled = false,
  placeholder = "Añadir opción personalizada",
  addLabel = "Añadir",
  testIdPrefix = "option-modal",
  slotPrefix = "optionModal",
}: {
  open: boolean;
  title?: string;
  headerTitle?: string;
  options: ToggleOption[];
  selectedIds: number[];
  onToggle: (id: number, selected: boolean) => void;
  /** May return a promise; the input is cleared only once it resolves. */
  onCreate: (name: string) => void | Promise<void>;
  onRequestDelete?: (option: ToggleOption) => void;
  onClose: () => void;
  disabled?: boolean;
  placeholder?: string;
  addLabel?: string;
  testIdPrefix?: string;
  slotPrefix?: string;
}) {
  const [draftName, setDraftName] = useState("");
  const [creating, setCreating] = useState(false);

  const submitNew = async () => {
    const name = draftName.trim();
    if (!name || creating) return;
    setCreating(true);
    try {
      await onCreate(name);
      // Cleared only on success so a failed create keeps the typed value.
      setDraftName("");
    } finally {
      setCreating(false);
    }
  };

  return (
    <Modal open={open} title={title} onClose={onClose} widthPx={620} hideClose>
      <ModalHeader title={headerTitle} onClose={onClose} />
      <div className="bo-modalBody" data-slot={`${slotPrefix}-body`}>
        <div className="bo-allergenGrid" data-testid={`${testIdPrefix}-grid`}>
          {options.map((option) => {
            const selected = isSelected(selectedIds, option.id);
            return (
              <div key={option.id} className="bo-beverageOptionCell" data-testid={`${testIdPrefix}-option-${option.slug}`}>
                <button
                  type="button"
                  className={`bo-allergenCircle ${selected ? "is-selected" : ""}`}
                  onClick={() => onToggle(option.id, !selected)}
                  disabled={disabled}
                  data-testid={`${testIdPrefix}-toggle-${option.slug}`}
                >
                  <span className="bo-allergenCircleLabel" data-slot={`${slotPrefix}-circleLabel`}>{option.name}</span>
                </button>
                {option.is_custom && onRequestDelete ? (
                  <button
                    type="button"
                    className="bo-beverageDeleteBtn"
                    aria-label={`Eliminar ${option.name}`}
                    onClick={() => onRequestDelete(option)}
                    disabled={disabled}
                    data-testid={`${testIdPrefix}-delete-${option.slug}`}
                  >
                    <Trash2 size={12} />
                  </button>
                ) : null}
              </div>
            );
          })}
          <div className="bo-beverageCustomAdd" data-testid={`${testIdPrefix}-custom-add`}>
            <input
              className="bo-input"
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void submitNew(); } }}
              placeholder={placeholder}
              data-testid={`${testIdPrefix}-custom-input`}
            />
            <button
              type="button"
              className="bo-btn bo-btn--ghost bo-btn--sm"
              onClick={() => void submitNew()}
              disabled={disabled || creating || !draftName.trim()}
              data-testid={`${testIdPrefix}-custom-confirm`}
            >
              <Plus size={14} /> {addLabel}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

export default OptionsToggleModal;
