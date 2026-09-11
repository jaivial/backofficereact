import React from "react";

import { money, type Table } from "../../hooks/usePOSRegister";

/**
 * Floor table tile reused by the tables modal: name, occupancy and either the
 * capacity or the running total when the table is occupied.
 */
export function POSTableTile({ table, totalCents, onSelect }: { table: Table; totalCents?: number; onSelect: (table: Table) => void }) {
  return (
    <button
      className={table.occupied ? "pos-tableTile pos-tableTile--occupied" : "pos-tableTile"}
      type="button"
      onClick={() => onSelect(table)}
      data-testid={`pos-table-${table.id}`}
    >
      <strong data-testid={`pos-table-name-${table.id}`}>{table.name}</strong>
      <span data-testid={`pos-table-state-${table.id}`}>{table.occupied ? (totalCents ? `Ocupada · ${money(totalCents)}` : "Ocupada") : `${table.capacity} plazas`}</span>
    </button>
  );
}
