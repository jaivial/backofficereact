import React, { useCallback, useEffect, useState } from "react";

import { Modal } from "../../../../ui/overlays/Modal";

interface FoodCategoryModalProps {
  open: boolean;
  busy?: boolean;
  onClose: () => void;
  onCreate: (name: string) => Promise<void> | void;
}

export const FoodCategoryModal = React.memo(function FoodCategoryModal({
  open,
  busy,
  onClose,
  onCreate,
}: FoodCategoryModalProps) {
  const [name, setName] = useState("");

  useEffect(() => {
    if (!open) setName("");
  }, [open]);

  const onSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    await onCreate(trimmed);
  }, [name, onCreate]);

  return (
    <Modal open={open} onClose={onClose} title="Anadir categoria custom" size="sm">
      <form onSubmit={onSubmit} data-ui="food-cat-modal-form">
        <div className="bo-field" data-ui="food-cat-modal-field">
          <label className="bo-label" htmlFor="food-category-name" data-ui="food-cat-modal-label">Nombre categoria *</label>
          <input
            id="food-category-name"
            className="bo-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ejemplo: Fuera de carta"
            required
            data-ui="food-cat-modal-input"
          />
        </div>

        <div className="bo-foodModal-actions" data-ui="food-cat-modal-actions">
          <button type="button" className="bo-btn bo-btn--ghost" onClick={onClose} disabled={busy} data-ui="food-cat-modal-cancel">            Cancelar
          </button>
          <button type="submit" className="bo-btn bo-btn--primary" disabled={busy || !name.trim()} data-testid="food-category-submit-btn" data-ui="food-cat-modal-submit">
            {busy ? (
              <>
                <div className="bo-spinner bo-spinner--sm" />
                Guardando...
              </>
            ) : (
              "Guardar"
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
});
