import React, { useCallback, useEffect, useState } from "react";

import { Modal } from "../../../../ui/overlays/Modal";
import { Button } from "../../../../ui/actions/Button";
import { LoadingSpinner } from "../../../../ui/feedback/LoadingSpinner";

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
        <div className="grid gap-1.5">
          <label className="text-xs text-[var(--text-muted)] font-semibold" htmlFor="food-category-name">Nombre categoria *</label>
          <input
            id="food-category-name"
            className="h-10 rounded-lg border border-[var(--border)] bg-card-2 text-foreground px-3 outline-none transition-colors duration-150 focus:border-[color-mix(in srgb,var(--accent)38%,transparent)] focus:shadow-[0_0_0_3px_color-mix(in srgb,var(--accent)10%,transparent)]"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ejemplo: Fuera de carta"
            required
          />
        </div>

        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-[var(--border)]">
          <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" disabled={busy || !name.trim()}>
            {busy ? (
              <>
                <LoadingSpinner size="sm" />
                Guardando...
              </>
            ) : (
              "Guardar"
            )}
          </Button>
        </div>
      </form>
    </Modal>
  );
});
