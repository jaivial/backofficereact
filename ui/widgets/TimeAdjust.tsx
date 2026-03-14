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
    <div className="flex flex-col gap-2 p-4 rounded-lg border border-white/[0.06] bg-white/[0.02]" aria-label={label}>
      <div className="text-xs text-muted font-medium">{label}</div>
      <div className="flex items-center gap-2">
        <button className="h-8 px-3 rounded-md border border-white/[0.06] bg-transparent text-sm text-muted hover:bg-white/[0.04] hover:text-foreground hover:border-white/[0.12] transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed" type="button" onClick={onMinus} disabled={disabled} aria-label={`${label} menos 15 minutos`}>
          -15
        </button>
        <div className="flex-1 text-center text-sm font-semibold text-foreground">{value}</div>
        <button className="h-8 px-3 rounded-md border border-white/[0.06] bg-transparent text-sm text-muted hover:bg-white/[0.04] hover:text-foreground hover:border-white/[0.12] transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed" type="button" onClick={onPlus} disabled={disabled} aria-label={`${label} mas 15 minutos`}>
          +15
        </button>
      </div>
    </div>
  );
}
