import React, { useState } from "react";
import { Plus, Trash2 } from "lucide-react";

import { Modal } from "../../overlays/Modal";
import { ModalHeader } from "../../overlays/ModalHeader";
import { SwitchField } from "../../inputs/SwitchField";

// Coordination id: booking_extras_v1 / reusable_options_toggle_v1
//
// Reusable "toggle a catalog of options" UI. The disposition mirrors the table
// columns picker (ReservasColumnsModal / InvoiceColumnsModal): a centered hint,
// two columns of bordered switch cards with the switch on the right, and a
// right-aligned action row. The content is data-driven, so any restaurant-scoped
// option catalog can reuse it.

export type ToggleOption = {
  id: number;
  slug: string;
  name: string;
  is_custom?: boolean;
};

function isSelected(selectedIds: number[], id: number): boolean {
  return selectedIds.includes(id);
}

function listClassName(inline: boolean, extra?: string): string {
  return ["bo-optionsToggleList", inline ? "bo-optionsToggleList--inline" : "", extra].filter(Boolean).join(" ");
}

/**
 * Inline list of toggle switches laid out like the table columns picker. Used
 * for the booking "Extras" section where every catalog option is a switch.
 */
export function OptionsSwitchList({
  options,
  selectedIds,
  onToggle,
  disabled = false,
  hint,
  inline = false,
  ariaLabel,
  testIdPrefix = "option",
  slotPrefix = "option",
  emptyHint = "No hay opciones disponibles.",
}: {
  options: ToggleOption[];
  selectedIds: number[];
  onToggle: (id: number, selected: boolean) => void;
  disabled?: boolean;
  hint?: string;
  inline?: boolean;
  ariaLabel?: string;
  testIdPrefix?: string;
  slotPrefix?: string;
  emptyHint?: string;
}) {
  return (
    <div
      className={listClassName(inline, "bo-optionsToggleList--section")}
      role="group"
      aria-label={ariaLabel}
      data-slot={`${slotPrefix}-switchList`}
      data-testid={`${testIdPrefix}-switch-list`}
    >
      {hint ? (
        <p className="bo-mutedText bo-optionsToggleHint" data-slot={`${slotPrefix}-hint`} data-testid={`${testIdPrefix}-hint`}>
          {hint}
        </p>
      ) : null}
      {options.map((option) => (
        <div
          key={option.id}
          className={["bo-optionsToggleItem", option.is_custom ? "bo-optionsToggleItem--deletable" : ""].filter(Boolean).join(" ")}
          data-slot={`${slotPrefix}-switchItem`}
          data-testid={`${testIdPrefix}-item-${option.slug}`}
        >
          <SwitchField
            checked={isSelected(selectedIds, option.id)}
            onChange={(next) => onToggle(option.id, next)}
            label={option.name}
            disabled={disabled}
            data-testid={`${testIdPrefix}-switch-${option.slug}`}
          />
        </div>
      ))}
      {options.length === 0 ? (
        <div className="bo-mutedText bo-optionsToggleEmpty" data-slot={`${slotPrefix}-empty`} data-testid={`${testIdPrefix}-empty`}>
          {emptyHint}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Modal to manage a catalog of toggle options: toggle each option, add a new
 * custom one, and request deleting custom entries. Same disposition as the
 * table columns picker modal so both surfaces feel identical.
 */
export function OptionsToggleModal({
  open,
  title = "Opciones",
  headerTitle = "Selecciona opciones",
  hint,
  options,
  selectedIds,
  onToggle,
  onCreate,
  onRequestDelete,
  onClose,
  disabled = false,
  placeholder = "Añadir opción personalizada",
  addLabel = "Añadir",
  closeLabel = "Listo",
  testIdPrefix = "option-modal",
  slotPrefix = "optionModal",
}: {
  open: boolean;
  title?: string;
  headerTitle?: string;
  hint?: string;
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
  closeLabel?: string;
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
    <Modal open={open} title={title} onClose={onClose} widthPx={640} className="bo-optionsToggleModal" hideClose>
      <ModalHeader title={headerTitle} onClose={onClose} />
      <div
        className={listClassName(false)}
        role="group"
        aria-label={headerTitle}
        data-slot={`${slotPrefix}-list`}
        data-testid={`${testIdPrefix}-grid`}
      >
        {hint ? (
          <p className="bo-mutedText bo-optionsToggleHint" data-slot={`${slotPrefix}-hint`} data-testid={`${testIdPrefix}-hint`}>
            {hint}
          </p>
        ) : null}
        {options.map((option) => {
          const selected = isSelected(selectedIds, option.id);
          return (
            <div
              key={option.id}
              className={["bo-optionsToggleItem", option.is_custom ? "bo-optionsToggleItem--deletable" : ""].filter(Boolean).join(" ")}
              data-slot={`${slotPrefix}-item`}
              data-testid={`${testIdPrefix}-option-${option.slug}`}
            >
              <SwitchField
                checked={selected}
                onChange={(next) => onToggle(option.id, next)}
                label={option.name}
                disabled={disabled}
                data-testid={`${testIdPrefix}-toggle-${option.slug}`}
              />
              {option.is_custom && onRequestDelete ? (
                <button
                  type="button"
                  className="bo-optionsToggleDelete"
                  aria-label={`Eliminar ${option.name}`}
                  onClick={() => onRequestDelete(option)}
                  disabled={disabled}
                  data-slot={`${slotPrefix}-delete`}
                  data-testid={`${testIdPrefix}-delete-${option.slug}`}
                >
                  <Trash2 size={14} strokeWidth={1.8} />
                </button>
              ) : null}
            </div>
          );
        })}
        {options.length === 0 ? (
          <div className="bo-mutedText bo-optionsToggleEmpty" data-slot={`${slotPrefix}-empty`} data-testid={`${testIdPrefix}-empty`}>
            Todavía no hay opciones. Añade la primera abajo.
          </div>
        ) : null}
        <div className="bo-optionsToggleAdd" data-slot={`${slotPrefix}-add`} data-testid={`${testIdPrefix}-custom-add`}>
          <input
            className="bo-input"
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void submitNew(); } }}
            placeholder={placeholder}
            disabled={disabled}
            data-testid={`${testIdPrefix}-custom-input`}
          />
          <button
            type="button"
            className="bo-btn bo-btn--ghost bo-btn--sm"
            onClick={() => void submitNew()}
            disabled={disabled || creating || !draftName.trim()}
            data-testid={`${testIdPrefix}-custom-confirm`}
          >
            <Plus size={14} strokeWidth={1.8} /> {addLabel}
          </button>
        </div>
      </div>
      <div className="bo-modalActions" data-slot={`${slotPrefix}-actions`}>
        <button className="bo-btn bo-btn--primary" type="button" onClick={onClose} disabled={disabled} data-testid={`${testIdPrefix}-close`}>
          {closeLabel}
        </button>
      </div>
    </Modal>
  );
}

export default OptionsToggleModal;
