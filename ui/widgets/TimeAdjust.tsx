import React from "react";

export function TimeAdjust({
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
    <div className="bo-timeAdjust" aria-label={label}>
      <div className="bo-timeAdjustLabel">{label}</div>
      <div className="bo-timeAdjustCtrls">
        <button className="bo-btn bo-btn--ghost bo-btn--sm" type="button" onClick={onMinus} disabled={disabled} aria-label={`${label} menos 15 minutos`}>
          -15
        </button>
        <div className="bo-timeAdjustValue">{value}</div>
        <button className="bo-btn bo-btn--ghost bo-btn--sm" type="button" onClick={onPlus} disabled={disabled} aria-label={`${label} mas 15 minutos`}>
          +15
        </button>
      </div>
    </div>
  );
}
