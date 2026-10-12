import React, { useEffect, useMemo, useState } from "react";
import { Minus, Plus } from "lucide-react";

import { POSDialog } from "./POSDialog";
import { money, type Pack } from "../../hooks/usePOSRegister";

/** Upper bound for a single pack's quantity, mirroring the server limit. */
const MAX_PACK_QUANTITY = 20;

/**
 * Picks what goes into a pack before it is added to the ticket.
 *
 * A pack has a fixed price and its components are grouped into slots, each of
 * which needs exactly one pick. A slot whose options are all defaults is not a
 * real choice, so it is pre-selected and does not block Confirm: a menu with
 * nothing to choose should need a single tap, not a decision per course.
 *
 * The server revalidates all of this, so this dialog is a convenience, never
 * the guard.
 */
export function POSPackPicker({ pack, busy = false, error, onClose, onConfirm }: {
  pack: Pack | null;
  busy?: boolean;
  error?: string;
  onClose: () => void;
  onConfirm: (selection: { quantity: number; choices: Record<string, number> }) => void;
}) {
  const [quantity, setQuantity] = useState(1);
  const [choices, setChoices] = useState<Record<string, number>>({});

  useEffect(() => {
    setQuantity(1);
    setChoices({});
  }, [pack?.id]);

  /** Slot name -> its options, in display order. */
  const slots = useMemo(() => {
    if (!pack) return [] as { name: string; options: Pack["components"] }[];
    return pack.slots.map((name) => ({ name, options: pack.components.filter((component) => component.slotGroup === name) }));
  }, [pack]);

  const prefill = useMemo(() => {
    if (!pack) return {} as Record<string, number>;
    // A slot with a single default is not a choice; select it so the pack can
    // go in with one tap, and so the server sees an explicit answer.
    const out: Record<string, number> = {};
    for (const component of pack.components) {
      if (!component.slotGroup || out[component.slotGroup] != null) continue;
      const options = pack.components.filter((c) => c.slotGroup === component.slotGroup);
      // A slot with a single option is not a decision, so it is pre-selected and
      // never blocks Confirm. A slot with several options always asks, even if
      // the catalogue marks them all default: showing two selected radios would
      // be a lie, and the guest would get the first one without choosing.
      if (options.length === 1) out[component.slotGroup] = component.productId;
    }
    return out;
  }, [pack]);

  const answered = useMemo(() => {
    const out: Record<string, number> = {};
    for (const [slot, defaultId] of Object.entries(prefill)) if (choices[slot] == null) out[slot] = defaultId;
    return { ...out, ...choices };
  }, [choices, prefill]);

  const missing = useMemo(() => slots.filter((slot) => answered[slot.name] == null), [answered, slots]);
  const canConfirm = Boolean(pack) && missing.length === 0;
  const total = (pack?.priceGrossCents ?? 0) * quantity;

  if (!pack) return null;

  return (
    <POSDialog testId="pos-pack-picker" title={pack.name} busy={busy} error={error} onClose={onClose}>
      <div className="pos-modifierPicker" data-testid="pos-pack-picker-body">
        {pack.description ? <p className="pos-packPicker__desc" data-testid="pos-pack-picker-desc">{pack.description}</p> : null}
        {pack.components.filter((component) => !component.slotGroup).length > 0 ? (
          <p className="pos-packPicker__includes" data-testid="pos-pack-picker-includes">
            <span className="pos-packPicker__includesLabel">Incluye</span>{" "}
            {pack.components.filter((component) => !component.slotGroup).map((component) => `${component.quantity} × ${component.productName}`).join(" · ")}
          </p>
        ) : null}
        {slots.map((slot) => (
          <fieldset className="pos-modifierGroup" key={slot.name} data-testid={`pos-pack-slot-${slot.name}`}>
            <legend className="pos-modifierGroup__legend">
              <span data-testid={`pos-pack-slot-name-${slot.name}`}>{slot.name}</span>
              <span className="pos-modifierGroup__rule">Elige 1</span>
            </legend>
            <div className="pos-modifierGroup__options" role="radiogroup" aria-label={slot.name}>
              {slot.options.map((option) => {
                const entry = answered[slot.name] === option.productId;
                return (
                  <div className={`pos-modifierOption${entry ? " pos-modifierOption--on" : ""}`} key={option.productId} data-testid={`pos-pack-option-${option.productId}`}>
                    <button className="pos-modifierOption__pick" type="button" role="radio" aria-checked={entry} disabled={busy} onClick={() => setChoices((current) => ({ ...current, [slot.name]: option.productId }))} data-testid={`pos-pack-option-pick-${option.productId}`}>
                      <span className="pos-modifierOption__name">{option.productName}</span>
                      <span className="pos-modifierOption__price">incluido</span>
                    </button>
                  </div>
                );
              })}
            </div>
          </fieldset>
        ))}
      </div>
      <footer className="pos-modal__footer pos-modifierPicker__footer">
        <span className="pos-modifierPicker__qty">
          <button className="pos-modifierOption__step" type="button" aria-label="Quitar una unidad del menú" disabled={busy || quantity <= 1} onClick={() => setQuantity((current) => Math.max(1, current - 1))} data-testid="pos-pack-qty-minus">
            <Minus className="h-4 w-4" aria-hidden="true" />
          </button>
          <span data-testid="pos-pack-qty">{quantity}</span>
          <button className="pos-modifierOption__step" type="button" aria-label="Añadir otra unidad del menú" disabled={busy || quantity >= MAX_PACK_QUANTITY} onClick={() => setQuantity((current) => Math.min(MAX_PACK_QUANTITY, current + 1))} data-testid="pos-pack-qty-plus">
            <Plus className="h-4 w-4" aria-hidden="true" />
          </button>
        </span>
        <span className="pos-modifierPicker__total" data-testid="pos-pack-picker-total">
          Total {money(total)}
        </span>
        <button className="pos-modal__primary" type="button" disabled={busy || !canConfirm} onClick={() => onConfirm({ quantity, choices: answered })} data-testid="pos-pack-picker-confirm">
          Añadir a la cuenta
        </button>
      </footer>
    </POSDialog>
  );
}
