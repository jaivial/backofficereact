import React, { useMemo } from "react";

import { POSDialog } from "./POSDialog";

export type POSMultiSelectEntry = { id: number; label: string; detail?: string; amountCents?: number; covers?: number };

export function POSMultiSelectDialog({ testId, title, entries, selectedIds, busy, error, emptyLabel, confirmLabel, allowEmptySelection = false, onChange, onClose, onConfirm }: {
  testId: string;
  title: string;
  entries: POSMultiSelectEntry[];
  selectedIds: number[];
  busy?: boolean;
  error?: string;
  emptyLabel: string;
  confirmLabel: string;
  allowEmptySelection?: boolean;
  onChange: (ids: number[]) => void;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const selected = useMemo(() => new Set(selectedIds), [selectedIds]);
  const selectedEntries = useMemo(() => entries.filter((entry) => selected.has(entry.id)), [entries, selected]);
  const toggle = (id: number) => onChange(selected.has(id) ? selectedIds.filter((entry) => entry !== id) : [...selectedIds, id]);

  return (
    <POSDialog testId={testId} title={title} busy={busy} error={error} onClose={onClose}>
      <div className="pos-modal__choices" data-testid={`${testId}-choices`}>
        {entries.length ? entries.map((entry) => (
          <label className="pos-modal__choice" key={entry.id} data-testid={`${testId}-entry-${entry.id}`}>
            <input type="checkbox" checked={selected.has(entry.id)} onChange={() => toggle(entry.id)} data-ui={`${testId}-checkbox-${entry.id}`} data-testid={`${testId}-checkbox-${entry.id}`} />
            <span data-ui={`${testId}-label-${entry.id}`}><strong data-ui={`${testId}-name-${entry.id}`}>{entry.label}</strong>{entry.detail ? <small data-ui={`${testId}-detail-${entry.id}`}>{entry.detail}</small> : null}</span>
          </label>
        )) : <p className="pos-modal__empty" data-testid={`${testId}-empty`}>{emptyLabel}</p>}
      </div>
      <p className="pos-modal__pending" data-testid={`${testId}-summary`}>{selectedEntries.length} seleccionada(s) · {selectedEntries.reduce((sum, entry) => sum + (entry.covers || 0), 0)} comensales</p>
      <button className="pos-modal__primary" type="button" disabled={busy || (!allowEmptySelection && !selectedIds.length)} onClick={onConfirm} data-pos-command={testId} data-testid={`${testId}-confirm`}>{confirmLabel}</button>
    </POSDialog>
  );
}
