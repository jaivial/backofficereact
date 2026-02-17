import React from "react";
import { Minus, Plus } from "lucide-react";

export function TimeAdjustCounter({
  label,
  value,
  onMinus,
  onPlus,
  disabled,
}: {
  label: string;
  value: string;
  onMinus: () => void;
  onPlus: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="bo-timeAdjustCounter" aria-label={label}>
      <div className="bo-timeAdjustCounterLabel">{label}</div>
      <div className="bo-timeAdjustCounterCtrls">
        <button
          className="bo-counterBtn"
          type="button"
          onClick={onMinus}
          disabled={disabled}
          aria-label={`${label} menos 15 minutos`}
        >
          <Minus size={14} strokeWidth={2.2} />
        </button>
        <div className="bo-timeAdjustCounterValue">{value}</div>
        <button
          className="bo-counterBtn"
          type="button"
          onClick={onPlus}
          disabled={disabled}
          aria-label={`${label} más 15 minutos`}
        >
          <Plus size={14} strokeWidth={2.2} />
        </button>
      </div>
    </div>
  );
}
