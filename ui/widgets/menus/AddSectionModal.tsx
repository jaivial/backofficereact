import React, { useCallback, useEffect, useState } from "react";

import { Select } from "../../inputs/Select";
import { Modal } from "../../overlays/Modal";
import { ModalHeader } from "../../overlays/ModalHeader";
import { cn } from "../../shadcn/utils";
import {
  DESSERT_SOURCE_CUSTOM,
  DESSERT_SOURCE_OPTIONS,
  SECTION_KIND_PRESETS,
  SECTION_KIND_PRESET_OPTIONS,
  sectionKindPreset,
  type DessertSource,
} from "./sectionPresentation";

export type AddSectionSelection = {
  /** Persisted section_kind. */
  kind: string;
  /** Title seeded into the new section ("" for the blank, custom section). */
  title: string;
  /** Only meaningful for kind === "postres". Coordination id: dessert_section_source_v1 */
  dessertSource: DessertSource;
};

/**
 * Two-step "Anadir seccion" modal shared by every conventional closed menu and
 * a la carta menu editor.
 *
 * Step 1 asks the section type with the reusable Select (never the native
 * browser select). Entrantes / Principal / Arroz / Personalizada create the
 * section right away; Postres advances to step 2 to choose between the general
 * desserts carta (synced + read only) and a fully customizable dessert list.
 *
 * Coordination id: menu_section_kind_presets_v1 + dessert_section_source_v1
 */
export const AddSectionModal = React.memo(function AddSectionModal({
  open,
  busy,
  className,
  onClose,
  onConfirm,
}: {
  open: boolean;
  busy?: boolean;
  className?: string;
  onClose: () => void;
  onConfirm: (selection: AddSectionSelection) => void;
}) {
  const [kind, setKind] = useState<string>(SECTION_KIND_PRESETS[0].value);
  const [step, setStep] = useState<"kind" | "dessertSource">("kind");

  // Reopening always restarts at step 1 with the first preset selected, so a
  // previous dessert choice never leaks into the next section.
  useEffect(() => {
    if (!open) return;
    setKind(SECTION_KIND_PRESETS[0].value);
    setStep("kind");
  }, [open]);

  const preset = sectionKindPreset(kind);

  const handleKindContinue = useCallback(() => {
    if (busy) return;
    const selected = sectionKindPreset(kind);
    if (selected.needsExtraStep) {
      console.log("[checkpoint] add_section_dessert_step_opened", `kind=${selected.value}`);
      setStep("dessertSource");
      return;
    }
    console.log("[checkpoint] add_section_kind_confirmed", `kind=${selected.value}`);
    onConfirm({ kind: selected.value, title: selected.seedTitle, dessertSource: DESSERT_SOURCE_CUSTOM });
  }, [busy, kind, onConfirm]);

  const handleDessertSource = useCallback(
    (source: DessertSource) => {
      if (busy) return;
      const selected = sectionKindPreset(kind);
      console.log("[checkpoint] add_section_dessert_source_confirmed", `source=${source}`);
      onConfirm({ kind: selected.value, title: selected.seedTitle, dessertSource: source });
    },
    [busy, kind, onConfirm],
  );

  const title = step === "kind" ? "Anadir seccion" : "Carta de postres";

  return (
    <Modal open={open} title={title} onClose={onClose} widthPx={step === "kind" ? 520 : 680} className={className} hideClose>
      <ModalHeader title={title} onClose={onClose} data-testid="add-section-modal-header" />

      {step === "kind" ? (
        <>
          <div className="bo-modalBody" data-slot="add-section-modal-body" data-testid="add-section-modal-step-kind">
            <label className="bo-field bo-field--full" data-slot="add-section-modal-kind-field">
              <span className="bo-label" data-slot="add-section-modal-kind-label">
                ¿Qué tipo de sección quieres añadir?
              </span>
              <Select
                value={kind}
                onChange={setKind}
                options={SECTION_KIND_PRESET_OPTIONS}
                ariaLabel="Tipo de seccion"
                data-testid="add-section-modal-kind-select"
              />
            </label>
            <div className="bo-mutedText" data-testid="add-section-modal-kind-hint">
              {preset.description}
            </div>
          </div>

          <div className="bo-modalActions" data-slot="add-section-modal-actions">
            <button
              className="bo-btn bo-btn--ghost"
              type="button"
              disabled={busy}
              onClick={onClose}
              data-testid="add-section-modal-cancel"
            >
              Cancelar
            </button>
            <button
              className="bo-btn bo-btn--primary"
              type="button"
              disabled={busy}
              onClick={handleKindContinue}
              data-testid="add-section-modal-continue"
            >
              {preset.needsExtraStep ? "Continuar" : "Anadir seccion"}
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="bo-modalBody" data-slot="add-section-modal-dessert-body" data-testid="add-section-modal-step-dessert">
            <div className="bo-label" data-testid="add-section-modal-dessert-question">
              ¿Cómo quieres gestionar los postres de esta sección?
            </div>
            <div
              className="bo-menuTypePanelsGrid bo-addSectionDessertGrid"
              role="group"
              aria-label="Origen de la carta de postres"
              data-slot="add-section-modal-dessert-grid"
            >
              {DESSERT_SOURCE_OPTIONS.map((option) => {
                const Icon = option.icon;
                return (
                  <button
                    key={option.value}
                    className={cn("bo-panel", "bo-menuTypePanel", "bo-menuGlassPanel")}
                    type="button"
                    disabled={busy}
                    onClick={() => handleDessertSource(option.value)}
                    data-testid={`add-section-modal-dessert-source-${option.value}`}
                    data-coordination-id="dessert_section_source_v1"
                  >
                    <div className="bo-menuTypePanelIcon" aria-hidden="true" data-slot="add-section-modal-dessert-icon">
                      <Icon size={28} aria-hidden="true" focusable="false" />
                    </div>
                    <div className="bo-menuTypePanelLabel" data-slot="add-section-modal-dessert-label">
                      {option.label}
                    </div>
                    <div className="bo-menuTypePanelDesc" data-slot="add-section-modal-dessert-desc">
                      {option.description}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="bo-modalActions" data-slot="add-section-modal-dessert-actions">
            <button
              className="bo-btn bo-btn--ghost"
              type="button"
              disabled={busy}
              onClick={() => setStep("kind")}
              data-testid="add-section-modal-dessert-back"
            >
              Volver
            </button>
          </div>
        </>
      )}
    </Modal>
  );
});
