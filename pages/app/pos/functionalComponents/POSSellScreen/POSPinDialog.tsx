import React, { useEffect, useState } from "react";
import { Delete } from "lucide-react";

import { POSDialog } from "./POSDialog";

/**
 * A numeric PIN entry, used both to choose a PIN and to approve an action as
 * somebody else. On a terminal shared by the whole floor the typed digits must
 * never be readable over a shoulder, so there is no reveal toggle: you either
 * can type it without looking or you ask for a reset.
 */
export function POSPinDialog({ title, description, confirmLabel = "Confirmar", busy = false, error, minLength = 4, requireExisting = false, onClose, onSubmit }: {
  title: string;
  description?: string;
  confirmLabel?: string;
  busy?: boolean;
  error?: string;
  minLength?: number;
  /** When changing a PIN, the current one must be typed first. */
  requireExisting?: boolean;
  onClose: () => void;
  onSubmit: (value: { pin: string; currentPin?: string }) => void;
}) {
  const [pin, setPin] = useState("");
  const [current, setCurrent] = useState("");

  useEffect(() => {
    setPin(""); setCurrent("");
  }, []);

  const typing = requireExisting && !current ? "current" : "new";
  const value = typing === "current" ? current : pin;
  const lengthOk = requireExisting ? current.length >= minLength : pin.length >= minLength;

  const press = (digit: string) => {
    if (busy) return;
    const setter = typing === "current" ? setCurrent : setPin;
    setter((prev) => (prev.length >= 6 ? prev : prev + digit));
  };
  const backspace = () => {
    if (busy) return;
    const setter = typing === "current" ? setCurrent : setPin;
    setter((prev) => prev.slice(0, -1));
  };

  // Enter submits, because on a keypad keyboard Enter is the natural confirmation
  // and a waiter holding the tablet should not have to reach for the screen.
  const submit = () => {
    if (!lengthOk || busy) return;
    onSubmit(requireExisting ? { currentPin: current, pin } : { pin });
  };

  return (
    <POSDialog testId="pos-pin" title={title} busy={busy} error={error} onClose={onClose}>
      {description ? <p className="pos-pinDialog__hint" data-testid="pos-pin-hint">{description}</p> : null}
      {requireExisting ? (
        <ol className="pos-pinDialog__steps">
          <li className={typing === "current" ? "is-current" : "is-done"}>PIN actual</li>
          <li className={typing === "new" ? "is-current" : ""}>PIN nuevo</li>
        </ol>
      ) : null}
      <p className="pos-pinDialog__dots" aria-label={`${value.length} dígitos escritos`} data-testid="pos-pin-dots">
        {Array.from({ length: 6 }).map((_, index) => (
          <span key={index} className={`pos-pinDialog__dot${index < value.length ? " is-filled" : ""}`} />
        ))}
      </p>
      <div className="pos-pinDialog__keys" role="group" aria-label="Teclado numérico">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((digit) => (
          <button className="pos-pinDialog__key" type="button" key={digit} disabled={busy} onClick={() => press(digit)} data-testid={`pos-pin-key-${digit}`}>
            {digit}
          </button>
        ))}
        <button className="pos-pinDialog__key pos-pinDialog__key--ghost" type="button" disabled={busy} onClick={() => { const setter = typing === "current" ? setCurrent : setPin; setter(""); }} data-testid="pos-pin-clear">
          Borra
        </button>
        <button className="pos-pinDialog__key" type="button" disabled={busy} onClick={() => press("0")} data-testid="pos-pin-key-0">0</button>
        <button className="pos-pinDialog__key pos-pinDialog__key--ghost" type="button" disabled={busy} onClick={backspace} aria-label="Borrar el último dígito" data-testid="pos-pin-back">
          <Delete className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>
      <footer className="pos-modal__footer">
        <button className="pos-modal__primary" type="button" disabled={busy || !lengthOk} onClick={submit} data-testid="pos-pin-submit">
          {confirmLabel}
        </button>
      </footer>
    </POSDialog>
  );
}
