import React, { useCallback, useEffect, useRef, useState } from "react";

/**
 * Drop-in replacement for `<input>`/`<textarea>` in autosave forms.
 *
 * Coordination id: autosave_field_ownership_v1
 *
 * The operator's typing always wins over the save cycle:
 * - external value writes (server re-hydration, mirror syncs, payload
 *   normalization) are only adopted while the field is unfocused, so a trailing
 *   space is never eaten and clearing the value never resurrects the previous
 *   one;
 * - a `disabled` used as "a save is in flight" maps to `readOnly`, so the field
 *   never blurs and the mobile keyboard stays open;
 * - uncontrolled fields (file pickers and friends) pass straight through.
 */
export type AutosaveInputProps = Omit<
  React.InputHTMLAttributes<any> & React.TextareaHTMLAttributes<any>,
  "value" | "onChange"
> & {
  value?: string | number;
  onChange?: (event: React.ChangeEvent<any>) => void;
  /** Render a textarea instead of a single-line input. */
  multiline?: boolean;
};

export const AutosaveInput = React.forwardRef<any, AutosaveInputProps>(function AutosaveInput(
  { value, onChange, multiline = false, disabled = false, ...rest },
  ref,
) {
  const [draft, setDraft] = useState(value ?? "");
  const editingRef = useRef(false);
  const changeRef = useRef(onChange);
  changeRef.current = onChange;

  // External writes land only while the operator is not editing this field.
  useEffect(() => {
    if (!editingRef.current) setDraft(value ?? "");
  }, [value]);

  const handleChange = useCallback((event: any) => {
    setDraft(event.currentTarget.value);
    changeRef.current?.(event);
  }, []);
  const handleFocus = useCallback(() => {
    editingRef.current = true;
  }, []);
  const handleBlur = useCallback(() => {
    editingRef.current = false;
  }, []);

  // readOnly instead of disabled: it stops edits without stealing focus.
  const readOnly = !!disabled || !!rest.readOnly;

  if (value === undefined) {
    const passthrough = { ...rest, ref, onChange, disabled: !!disabled };
    return multiline ? <textarea {...(passthrough as any)} /> : <input {...(passthrough as any)} />;
  }

  const shared = { ...rest, ref, value: draft, onChange: handleChange, onFocus: handleFocus, onBlur: handleBlur, readOnly };
  return multiline ? <textarea {...(shared as any)} /> : <input {...(shared as any)} />;
});
