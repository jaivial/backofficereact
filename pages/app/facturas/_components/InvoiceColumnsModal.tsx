import { Modal } from "../../../../ui/overlays/Modal";
import { ModalHeader } from "../../../../ui/overlays/ModalHeader";
import { SwitchField } from "../../../../ui/inputs/SwitchField";
import { INVOICE_COLUMNS, type InvoiceColumnId } from "./invoiceColumns";

/**
 * Column picker for the invoices table. Every switch writes through the shared
 * preference path (facturasVisibleColumns) so the choice survives reloads.
 * Coordination id: facturas_columns_preference_v1
 */
export function InvoiceColumnsModal({
  open,
  visible,
  busy,
  onToggle,
  onReset,
  onClose,
}: {
  open: boolean;
  visible: InvoiceColumnId[];
  busy?: boolean;
  onToggle: (id: InvoiceColumnId, next: boolean) => void;
  onReset: () => void;
  onClose: () => void;
}) {
  const selected = new Set(visible);
  return (
    <Modal open={open} title="Columnas de la tabla" onClose={onClose} widthPx={640} className="bo-columnsPickerModal" hideClose>
      <ModalHeader title="Columnas de la tabla" onClose={onClose} />
      <p className="bo-muted" data-testid="facturas-columns-hint" style={{ margin: "4px 0 14px", textAlign: "center" }}>
        Elige qué columnas quieres ver. Los cambios se aplican al instante.
      </p>
      <div className="bo-columnsPickerList" data-testid="facturas-columns-list" data-slot="facturas-columns-list">
        {INVOICE_COLUMNS.map((col) => (
          <SwitchField
            key={col.id}
            checked={selected.has(col.id)}
            disabled={busy || (selected.has(col.id) && selected.size <= 1)}
            onChange={(next) => onToggle(col.id, next)}
            label={col.label}
            className="bo-columnsPickerItem"
            data-testid={`facturas-columns-toggle-${col.id}`}
          />
        ))}
      </div>
      <div className="bo-modalActions" data-slot="facturas-columns-actions">
        <button className="bo-btn bo-btn--ghost" type="button" onClick={onReset} disabled={busy} data-testid="facturas-columns-reset">Mostrar todas</button>
        <button className="bo-btn bo-btn--primary" type="button" onClick={onClose} data-testid="facturas-columns-close">Listo</button>
      </div>
    </Modal>
  );
}
