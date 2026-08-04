import React, { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";

export type PromptField = {
  name: string;
  label: string;
  placeholder?: string;
  inputMode?: "text" | "numeric" | "decimal";
  required?: boolean;
  initialValue?: string;
  kind?: "input" | "textarea" | "select";
  options?: PromptOption[];
};

export type PromptOption = { value: string; label: string };

/**
 * Generic POS modal: a titled dialog with optional segmented options, free-text
 * fields and a confirm button. Rail features compose it instead of each shipping
 * its own near-identical modal markup.
 */
export function POSPromptModal({
  testId,
  title,
  fields,
  options,
  optionsLabel,
  initialOption,
  confirmLabel,
  summary,
  busy,
  onClose,
  onConfirm,
  validate,
}: {
  testId: string;
  title: string;
  fields?: PromptField[];
  options?: PromptOption[];
  optionsLabel?: string;
  initialOption?: string;
  confirmLabel: string;
  summary?: (values: Record<string, string>, option: string) => React.ReactNode;
  busy?: boolean;
  onClose: () => void;
  onConfirm: (values: Record<string, string>, option: string) => void;
  validate?: (values: Record<string, string>, option: string) => string | null;
}) {
  const resolvedFields = useMemo(() => fields ?? [], [fields]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [option, setOption] = useState(initialOption ?? options?.[0]?.value ?? "");

  useEffect(() => {
    setValues(Object.fromEntries(resolvedFields.map((field) => [field.name, field.initialValue ?? ""])));
  }, [resolvedFields]);

  const validationMessage = validate?.(values, option) ?? null;
  const canConfirm = resolvedFields.every((field) => !field.required || (values[field.name] || "").trim()) && !validationMessage;

  return (
    <div className="pos-modalBackdrop" role="presentation" onClick={busy ? undefined : onClose} data-testid={`${testId}-backdrop`}>
      <div className="pos-modal" role="dialog" aria-modal="true" aria-label={title} onClick={(event) => event.stopPropagation()} data-testid={`${testId}-modal`}>
        <header className="pos-modal__header" data-testid={`${testId}-header`}>
          <h2 data-testid={`${testId}-title`}>{title}</h2>
          <button className="pos-modal__close" type="button" aria-label="Cerrar" disabled={busy} onClick={onClose} data-testid={`${testId}-close`}>
            <X className="h-4 w-4" aria-hidden="true" data-testid={`${testId}-close-icon`} />
          </button>
        </header>
        <div className="pos-modal__confirm" data-testid={`${testId}-body`}>
          {options?.length ? (
            <div className="pos-modal__modes" role="group" aria-label={optionsLabel ?? title} data-testid={`${testId}-options`}>
              {options.map((entry) => (
                <button
                  className="pos-modal__secondary"
                  type="button"
                  key={entry.value}
                  aria-pressed={option === entry.value}
                  onClick={() => setOption(entry.value)}
                  data-testid={`${testId}-option-${entry.value}`}
                >
                  {entry.label}
                </button>
              ))}
            </div>
          ) : null}
          {resolvedFields.map((field) => (
            <label className="pos-modal__covers" htmlFor={`${testId}-${field.name}`} key={field.name} data-testid={`${testId}-${field.name}-field`}>
              {field.label}
              {field.kind === "textarea" ? (
                <textarea id={`${testId}-${field.name}`} placeholder={field.placeholder} value={values[field.name] ?? ""} onChange={(event) => setValues((current) => ({ ...current, [field.name]: event.target.value }))} data-ui={`${testId}-${field.name}`} data-testid={`${testId}-${field.name}`} />
              ) : field.kind === "select" ? (
                <select id={`${testId}-${field.name}`} value={values[field.name] ?? ""} onChange={(event) => setValues((current) => ({ ...current, [field.name]: event.target.value }))} data-ui={`${testId}-${field.name}`} data-testid={`${testId}-${field.name}`}>
                  {(field.options ?? []).map((entry) => <option value={entry.value} key={entry.value} data-ui={`${testId}-${field.name}-${entry.value || "none"}`}>{entry.label}</option>)}
                </select>
              ) : (
                <input id={`${testId}-${field.name}`} inputMode={field.inputMode ?? "text"} placeholder={field.placeholder} value={values[field.name] ?? ""} onChange={(event) => setValues((current) => ({ ...current, [field.name]: event.target.value }))} data-ui={`${testId}-${field.name}`} data-testid={`${testId}-${field.name}`} />
              )}
            </label>
          ))}
          {validationMessage ? <p className="pos-modal__error" role="alert" data-testid={`${testId}-validation`}>{validationMessage}</p> : null}
          {summary ? <p className="pos-modal__pending" data-testid={`${testId}-summary`}>{summary(values, option)}</p> : null}
          <button
            className="pos-modal__primary"
            type="button"
            disabled={busy || !canConfirm}
            onClick={() => onConfirm(values, option)}
            data-testid={`${testId}-confirm`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
