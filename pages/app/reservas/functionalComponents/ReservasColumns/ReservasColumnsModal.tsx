import { Modal } from "../../../../../ui/overlays/Modal";
import { ModalHeader } from "../../../../../ui/overlays/ModalHeader";
import { SwitchField } from "../../../../../ui/inputs/SwitchField";
import { RESERVAS_COLUMNS, type ReservasColumnId } from "./columns";

/**
 * Column picker for the reservations table. Every switch writes through the
 * shared preference + realtime path so the choice survives reloads and reaches
 * the user's other open tabs.
 * Coordination id: reservas_columns_realtime_v1
 */
export function ReservasColumnsModal({
  open,
  visible,
  busy,
  onToggle,
  onReset,
  onClose,
}: {
  open: boolean;
  visible: ReservasColumnId[];
  busy?: boolean;
  onToggle: (id: ReservasColumnId, next: boolean) => void;
  onReset: () => void;
  onClose: () => void;
}) {
  const selected = new Set(visible);
  return (
    <Modal open={open} title="Columnas de la tabla" onClose={onClose} widthPx={640} className="bo-reservasColumnsModal" hideClose>
      <ModalHeader title="Columnas de la tabla" onClose={onClose} />
      <p className="bo-muted" data-testid="reservas-columns-hint" style={{ margin: "4px 0 14px", textAlign: "center" }}>
        Elige qué columnas quieres ver. Los cambios se aplican al instante en todas tus pestañas.
      </p>
      <div className="bo-reservasColumnsList" data-testid="reservas-columns-list">
        {RESERVAS_COLUMNS.map((col) => (
          <SwitchField
            key={col.id}
            checked={selected.has(col.id)}
            disabled={busy || (selected.has(col.id) && selected.size <= 1)}
            onChange={(next) => onToggle(col.id, next)}
            label={col.label}
            className="bo-reservasColumnsItem"
            data-testid={`reservas-columns-toggle-${col.id}`}
          />
        ))}
      </div>
      <div className="bo-modalActions" data-slot="reservas-columns-actions">
        <button className="bo-btn bo-btn--ghost" type="button" onClick={onReset} disabled={busy} data-testid="reservas-columns-reset">Mostrar todas</button>
        <button className="bo-btn bo-btn--primary" type="button" onClick={onClose} data-testid="reservas-columns-close">Listo</button>
      </div>
    </Modal>
  );
}
