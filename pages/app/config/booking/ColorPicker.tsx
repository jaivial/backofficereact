import React, { useCallback } from "react";
import { useToasts } from "../../../../ui/feedback/useToasts";

export function ColorPicker({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const { pushToast } = useToasts();

  const handleInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange(e.target.value);
    },
    [onChange],
  );

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value);
      pushToast({ kind: "success", title: "Copiado", message: value });
    } catch {
      pushToast({ kind: "info", title: "Código", message: value });
    }
  }, [value, pushToast]);

  return (
    <div className="bo-colorPicker" data-ui="color-picker">
      <label className="bo-colorPickerLabel" htmlFor={`color-${label}`} data-ui="color-picker-label">
        {label}
      </label>
      <div className="bo-colorPickerField" data-ui="color-picker-field">
        <div
          className="bo-colorPickerSwatch"
          style={{ backgroundColor: value }}
          data-ui="color-picker-swatch"
          aria-hidden="true"
        />
        <input
          id={`color-${label}`}
          type="color"
          className="bo-colorPickerInput"
          value={value}
          onChange={handleInput}
          disabled={disabled}
          aria-label={label}
          data-ui="color-picker-input"
        />
        <button
          type="button"
          className="bo-btn bo-btn--ghost bo-btn--sm bo-colorPickerCopy"
          onClick={handleCopy}
          disabled={disabled}
          aria-label={`Copiar código de color ${value}`}
          data-ui="color-picker-copy"
        >
          {value}
        </button>
      </div>
    </div>
  );
}
