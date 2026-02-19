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
      <form onSubmit={onSubmit}>
        <div className="bo-field">
          <label className="bo-label" htmlFor="food-category-name">Nombre categoria *</label>
          <input
            id="food-category-name"
            className="bo-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ejemplo: Fuera de carta"
            required
          />
        </div>

        <div className="bo-foodModal-actions">
          <button type="button" className="bo-btn bo-btn--ghost" onClick={onClose} disabled={busy}>
            Cancelar
          </button>
          <button type="submit" className="bo-btn bo-btn--primary" disabled={busy || !name.trim()}>
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
