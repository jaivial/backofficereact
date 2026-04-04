import React, { useCallback, useEffect, useRef, useState } from "react";

import { Modal } from "../../../../ui/overlays/Modal";

interface BeverageCategoryModalProps {
  open: boolean;
  busy?: boolean;
  defaultCategoryNames: string[];
  onClose: () => void;
  onAddCategory: (name: string) => Promise<{ id: number; name: string; slug: string }>;
  onOptimisticAdd: (category: { value: string; label: string }) => void;
}

export const BeverageCategoryModal = React.memo(function BeverageCategoryModal({
  open,
  busy,
  defaultCategoryNames,
  onClose,
  onAddCategory,
  onOptimisticAdd,
}: BeverageCategoryModalProps) {
  const [name, setName] = useState("");
  const [duplicate, setDuplicate] = useState(false);
  const [checking, setChecking] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    setName("");
    setDuplicate(false);
    setChecking(false);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (abortRef.current) abortRef.current.abort();
  }, []);

  useEffect(() => {
    if (!open) reset();
  }, [open, reset]);

  const checkDuplicate = useCallback(
    async (value: string) => {
      const trimmed = value.trim();
      if (!trimmed) {
        setDuplicate(false);
        return;
      }

      const normalized = trimmed.toLowerCase();

      const matchesDefault = defaultCategoryNames.some(
        (d) => d.toLowerCase() === normalized,
      );
      if (matchesDefault) {
        setDuplicate(true);
        return;
      }

      if (abortRef.current) abortRef.current.abort();
      const ac = new AbortController();
      abortRef.current = ac;

      setChecking(true);
      try {
        const res = await onAddCategory(trimmed);
        if (!ac.signal.aborted) {
          setDuplicate(false);
          onOptimisticAdd({ value: String(res.id), label: res.name });
          reset();
          onClose();
        }
      } catch {
        if (!ac.signal.aborted) {
          setDuplicate(true);
        }
      } finally {
        if (!ac.signal.aborted) setChecking(false);
      }
    },
    [defaultCategoryNames, onClose, onAddCategory, onOptimisticAdd, reset],
  );

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!open || !name.trim()) {
      setDuplicate(false);
      return;
    }

    debounceRef.current = setTimeout(() => {
      void checkDuplicate(name);
    }, 1000);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [name, open, checkDuplicate]);

  const handleNameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setName(e.target.value);
    setDuplicate(false);
  }, []);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || duplicate || busy) return;

    try {
      setChecking(true);
      const res = await onAddCategory(trimmed);
      onOptimisticAdd({ value: String(res.id), label: res.name });
      reset();
      onClose();
    } catch {
      setDuplicate(true);
    } finally {
      setChecking(false);
    }
  }, [busy, duplicate, name, onClose, onAddCategory, onOptimisticAdd, reset]);

  return (
    <Modal
      open={open}
      onClose={busy ? () => undefined : onClose}
      title="Añadir nueva categoria de bebidas"
      size="sm"
    >
      <form onSubmit={handleSubmit} data-ui="beverage-cat-modal-form" noValidate>
        <p data-ui="beverage-cat-modal-subtitle" className="bo-foodModal-catSubtitle">
          Añade una nueva categoria para tu carta de bebidas
        </p>

        <div className="bo-field" data-ui="beverage-cat-modal-field">
          <label className="bo-label" htmlFor="beverage-category-name" data-ui="beverage-cat-modal-label">
            Nombre de categoria *
          </label>
          <input
            id="beverage-category-name"
            className={`bo-input${duplicate ? " bo-input--error" : ""}`}
            value={name}
            onChange={handleNameChange}
            placeholder="Ejemplo: Sin alcohol"
            required
            disabled={busy}
            data-ui="beverage-cat-modal-input"
            aria-invalid={duplicate}
            aria-describedby={duplicate ? "beverage-cat-error" : undefined}
          />
          {duplicate ? (
            <span
              id="beverage-cat-error"
              data-ui="beverage-cat-modal-error"
              className="bo-input-error"
              role="alert"
            >
              Esta categoria ya existe
            </span>
          ) : null}
        </div>

        <div className="bo-foodModal-actions" data-ui="beverage-cat-modal-actions">
          <button
            type="button"
            className="bo-btn bo-btn--ghost"
            onClick={onClose}
            disabled={busy}
            data-ui="beverage-cat-modal-cancel"
          >
            Cerrar
          </button>
          <button
            type="submit"
            className="bo-btn bo-btn--primary"
            disabled={busy || !name.trim() || duplicate}
            data-ui="beverage-cat-modal-submit"
          >
            {busy || checking ? (
              <>
                <div className="bo-spinner bo-spinner--sm" data-ui="beverage-cat-modal-spinner" />
                Añadiendo...
              </>
            ) : (
              "Añadir"
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
});
