import React from "react";
import { QrCode } from "lucide-react";

/**
 * Empty state for the QR preview area. Shown when there is no link to encode
 * so the preview card never collapses into a blank white box.
 *
 * Coordination point: `qr-core:empty`.
 */
export function QrEmptyState({
  message,
  hint,
  "data-testid": testId = "qr-empty-state",
}: {
  message: string;
  hint?: string;
  "data-testid"?: string;
}): React.ReactElement {
  return (
    <div className="qr-empty" data-testid={testId} data-ui="qr-empty" data-coord-id="qr-core:empty">
      <QrCode size={34} strokeWidth={1.5} aria-hidden="true" data-testid={`${testId}-icon`} />
      <span className="qr-emptyMessage" data-testid={`${testId}-message`} data-slot="qr-empty-message">
        {message}
      </span>
      {hint ? (
        <span className="qr-emptyHint" data-testid={`${testId}-hint`} data-slot="qr-empty-hint">
          {hint}
        </span>
      ) : null}
    </div>
  );
}
