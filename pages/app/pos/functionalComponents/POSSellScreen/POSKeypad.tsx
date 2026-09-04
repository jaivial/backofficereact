import React from "react";
import { Delete } from "lucide-react";

const KEYS = ["7", "8", "9", "4", "5", "6", "1", "2", "3", "0", ",", "⌫"] as const;
const OPS = [
  { symbol: "+", testId: "add" },
  { symbol: "−", testId: "sub" },
  { symbol: "×", testId: "mul" },
  { symbol: "÷", testId: "div" },
] as const;

function calcEval(expr: string): string {
  const sanitized = expr.replace(/×/g, "*").replace(/÷/g, "/").replace(/−/g, "-").replace(/,/g, ".");
  if (!/^[0-9+\-*/. ]+$/.test(sanitized)) return "Error";
  try {
    const result = new Function(`return (${sanitized})`)();
    if (typeof result !== "number" || !isFinite(result)) return "Error";
    return result % 1 === 0 ? String(result) : String(Number(result.toFixed(2))).replace(".", ",");
  } catch {
    return "Error";
  }
}

/** Contextual numeric keypad with calculator operators column. OK doubles as equals. */
export function POSKeypad({ value, onChange, contextLabel, onConfirm, confirmLabel, onMultiplier, multiplierQty, onClearMultiplier, readOnly = false }: {
  value: string;
  onChange: (next: string) => void;
  contextLabel: string;
  onConfirm: () => void;
  confirmLabel: string;
  /** Called when × is pressed with a value to set qty for product price override flow */
  onMultiplier?: (qty: number) => void;
  /** Current multiplier qty (shown as "N ×" indicator) */
  multiplierQty?: number | null;
  /** Called when multiplier should be cleared (backspace with no value) */
  onClearMultiplier?: () => void;
  /** Sealed day: disable every key so no value can be entered. */
  readOnly?: boolean;
}) {
  const [calcExpr, setCalcExpr] = React.useState("");

  const press = (key: string) => {
    if (key === "⌫") {
      if (!value && multiplierQty != null) {
        onClearMultiplier?.();
        return;
      }
      if (!value && calcExpr) {
        const trimmed = calcExpr.trimEnd();
        setCalcExpr("");
        onChange(trimmed.slice(0, -1).trim());
        return;
      }
      onChange(value.slice(0, -1));
      return;
    }
    if (key === ",") { if (!value.includes(",")) onChange(value ? `${value},` : "0,"); return; }
    onChange(value === "0" ? key : value + key);
  };

  const calcOp = (op: string) => {
    // Special handling for × when onMultiplier is provided: store qty for product price override
    if (op === "×" && onMultiplier && value) {
      const qty = Number(value.replace(",", ".")) || 0;
      if (qty > 0) {
        onMultiplier(qty);
        onChange("");
        return;
      }
    }
    const operand = value || (calcExpr ? "" : "0");
    if (!operand && !calcExpr) return;
    const next = operand ? `${calcExpr}${operand} ${op} ` : `${calcExpr.trimEnd().slice(0, -1)}${op} `;
    setCalcExpr(next);
    onChange("");
  };

  const handleConfirm = () => {
    if (calcExpr) {
      onChange(calcEval(`${calcExpr}${value || "0"}`));
      setCalcExpr("");
      return;
    }
    onConfirm();
  };

  return (
    <section className="pos-keypad" aria-label="Teclado numérico" data-testid="pos-keypad">
      <div className="pos-keypad__display" data-testid="pos-keypad-display">
        <span className="pos-keypad__context" data-ui="pos-keypad-context">{contextLabel}</span>
        {multiplierQty != null ? <span className="pos-keypad__multiplier" data-testid="pos-keypad-multiplier">{multiplierQty} ×</span> : null}
        {calcExpr ? <span className="pos-keypad__expr" data-testid="pos-keypad-expr">{calcExpr.trimEnd()}</span> : null}
        <strong className="pos-keypad__value" data-testid="pos-keypad-value">{value || "0"}</strong>
      </div>
      <div data-slot="pOSKeypad-pos-keypad-body" className="pos-keypad__body">
        <div data-slot="pOSKeypad-pos-keypad-grid" className="pos-keypad__grid">
          {KEYS.map((key) => (
            <button className="pos-keypad__key" type="button" key={key} disabled={readOnly} onClick={() => press(key)} data-testid={`pos-key-${key === "⌫" ? "back" : key === "," ? "comma" : key}`} aria-label={key === "⌫" ? "Borrar" : key}>
              {key === "⌫" ? <Delete className="h-5 w-5" aria-hidden="true" /> : key}
            </button>
          ))}
        </div>
        <div data-slot="pOSKeypad-pos-keypad-calcCol" className="pos-keypad__calcCol">
          {OPS.map((op) => (
            <button className="pos-keypad__calcOp" type="button" key={op.testId} disabled={readOnly} onClick={() => calcOp(op.symbol)} data-testid={`pos-key-op-${op.testId}`} aria-label={`Operador ${op.symbol}`}>{op.symbol}</button>
          ))}
        </div>
      </div>
      <button className="pos-keypad__confirm" type="button" disabled={readOnly} onClick={handleConfirm} data-testid="pos-keypad-confirm">{confirmLabel}</button>
    </section>
  );
}
