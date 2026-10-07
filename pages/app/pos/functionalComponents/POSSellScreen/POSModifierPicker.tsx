import React, { useEffect, useMemo, useState } from "react";
import { Minus, Plus } from "lucide-react";

import { POSDialog } from "./POSDialog";
import { money, type ModifierGroup, type Product } from "../../hooks/usePOSRegister";

type Picked = { optionId: number; name: string; priceDeltaCents: number; quantity: number };

/** Upper bound for a single modifier's quantity, mirroring the server limit. */
const MAX_MODIFIER_QUANTITY = 20;

/**
 * Picks the modifiers of a product before it is added to the ticket: the size
 * of an espresso, the extras on a burger, "sin gluten".
 *
 * The group rules (min/max select) drive the UI: a group with minSelect 0 can
 * be skipped, a group with maxSelect 0 (COMBO) has no upper bound, and Confirm
 * stays disabled until every group satisfies its minimum. The server
 * revalidates all of this, so this is a convenience, never the guard.
 */
export function POSModifierPicker({ product, busy = false, error, onClose, onConfirm }: {
  product: Product | null;
  busy?: boolean;
  error?: string;
  onClose: () => void;
  onConfirm: (picks: { modifierOptionId: number; quantity: number }[]) => void;
}) {
  const [picked, setPicked] = useState<Record<number, Picked>>({});

  useEffect(() => {
    setPicked({});
  }, [product?.id]);

  const groups = product?.modifierGroups ?? [];

  const countIn = useMemo(() => {
    const counts: Record<number, number> = {};
    for (const entry of Object.values(picked)) {
      const group = groups.find((g) => g.options.some((o) => o.id === entry.optionId));
      if (group) counts[group.id] = (counts[group.id] ?? 0) + 1;
    }
    return counts;
  }, [groups, picked]);

  const delta = useMemo(() => Object.values(picked).reduce((sum, entry) => sum + entry.priceDeltaCents * entry.quantity, 0), [picked]);
  const missing = useMemo(() => groups.filter((g) => (countIn[g.id] ?? 0) < g.minSelect), [countIn, groups]);
  const canConfirm = Boolean(product) && missing.length === 0;

  const atMax = (group: ModifierGroup, optionId: number) => {
    const chosen = countIn[group.id] ?? 0;
    // A COMBO-style group (maxSelect 0) is unlimited, so it never blocks.
    if (group.maxSelect > 0 && chosen >= group.maxSelect) {
      const isAlreadyPicked = Boolean(picked[optionId]);
      if (!isAlreadyPicked) return true;
    }
    return false;
  };

  const toggle = (group: ModifierGroup, option: { id: number; name: string; priceDeltaCents: number }) => {
    setPicked((current) => {
      const next = { ...current };
      const existing = next[option.id];
      if (existing) {
        if (existing.quantity > 1) {
          next[option.id] = { ...existing, quantity: existing.quantity - 1 };
        } else {
          delete next[option.id];
        }
        return next;
      }
      if (atMax(group, option.id)) return current;
      next[option.id] = { optionId: option.id, name: option.name, priceDeltaCents: option.priceDeltaCents, quantity: 1 };
      return next;
    });
  };

  // Bounded so a slip of the finger cannot queue 1000 side dishes: the server
  // would reject the line anyway, and a ticket that big means a mis-tap.
  const step = (optionId: number, direction: 1 | -1) => {
    setPicked((current) => {
      const existing = current[optionId];
      if (!existing) return current;
      const quantity = existing.quantity + direction;
      if (quantity <= 0) {
        const next = { ...current };
        delete next[optionId];
        return next;
      }
      if (quantity > MAX_MODIFIER_QUANTITY) return current;
      return { ...current, [optionId]: { ...existing, quantity } };
    });
  };

  if (!product) return null;

  return (
    <POSDialog testId="pos-modifier-picker" title={product.name} busy={busy} error={error} onClose={onClose}>
      <div className="pos-modifierPicker" data-testid="pos-modifier-picker-body">
        {groups.map((group) => {
          const chosen = countIn[group.id] ?? 0;
          const rule = group.maxSelect > 0
            ? chosen > group.minSelect ? `Elige hasta ${group.maxSelect}` : group.minSelect > 0 ? `Elige ${group.minSelect}` : `Opcional · hasta ${group.maxSelect}`
            : `${group.minSelect > 0 ? `Elige al menos ${group.minSelect}` : "Sin límite"}`;
          return (
            <fieldset className="pos-modifierGroup" key={group.id} data-testid={`pos-modifier-group-${group.id}`}>
              <legend className="pos-modifierGroup__legend">
                <span data-testid={`pos-modifier-group-name-${group.id}`}>{group.name}</span>
                <span className="pos-modifierGroup__rule" data-testid={`pos-modifier-group-rule-${group.id}`}>{rule}</span>
              </legend>
              <div className="pos-modifierGroup__options">
                {group.options.map((option) => {
                  const entry = picked[option.id];
                  const blocked = !entry && atMax(group, option.id);
                  return (
                    <div className={`pos-modifierOption${entry ? " pos-modifierOption--on" : ""}${blocked ? " pos-modifierOption--blocked" : ""}`} key={option.id} data-testid={`pos-modifier-option-${option.id}`}>
                      <button className="pos-modifierOption__pick" type="button" aria-pressed={Boolean(entry)} disabled={busy || blocked} onClick={() => toggle(group, option)} data-testid={`pos-modifier-option-pick-${option.id}`}>
                        <span className="pos-modifierOption__name">{option.name}</span>
                        <span className="pos-modifierOption__price">{option.priceDeltaCents === 0 ? "sin coste" : `${option.priceDeltaCents > 0 ? "+" : ""}${money(option.priceDeltaCents)}`}</span>
                      </button>
                      {entry ? (
                        <span className="pos-modifierOption__qty">
                          <button className="pos-modifierOption__step" type="button" aria-label={`Quitar una unidad de ${option.name}`} disabled={busy} onClick={() => step(option.id, -1)} data-testid={`pos-modifier-option-minus-${option.id}`}>
                            <Minus className="h-4 w-4" aria-hidden="true" />
                          </button>
                          <span data-testid={`pos-modifier-option-qty-${option.id}`}>{entry.quantity}</span>
                          <button className="pos-modifierOption__step" type="button" aria-label={`Añadir otra unidad de ${option.name}`} disabled={busy || entry.quantity >= MAX_MODIFIER_QUANTITY} onClick={() => step(option.id, 1)} data-testid={`pos-modifier-option-plus-${option.id}`}>
                            <Plus className="h-4 w-4" aria-hidden="true" />
                          </button>
                        </span>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </fieldset>
          );
        })}
      </div>
      <footer className="pos-modal__footer pos-modifierPicker__footer">
        <span className="pos-modifierPicker__total" data-testid="pos-modifier-picker-total">
          Total {money(product.priceGrossCents + delta)}
          {delta !== 0 ? <span className="pos-modifierPicker__delta" data-testid="pos-modifier-picker-delta"> ({delta > 0 ? "+" : ""}{money(delta)})</span> : null}
        </span>
        <button className="pos-modal__primary" type="button" disabled={busy || !canConfirm} onClick={() => onConfirm(Object.values(picked).map((entry) => ({ modifierOptionId: entry.optionId, quantity: entry.quantity })))} data-testid="pos-modifier-picker-confirm">
          Añadir a la cuenta
        </button>
      </footer>
    </POSDialog>
  );
}
