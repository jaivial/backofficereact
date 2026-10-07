import React from "react";

import { money, type Table } from "../../hooks/usePOSRegister";

/**
 * Floor table tile reused by the tables modal: name, occupancy and either the
 * capacity or the running total when the table is occupied.
 *
 * The tile shows the name and the state as sibling elements, so the accessible
 * name computed from the contents concatenates them ("1" + "4 plazas" reads as
 * "14 plazas", i.e. table fourteen). The explicit `aria-label` keeps the spoken
 * name unambiguous and mentions the state, which the two child nodes alone also
 * left without a separator.
 */
export function POSTableTile({ table, totalCents, onSelect }: { table: Table; totalCents?: number; onSelect: (table: Table) => void }) {
  const state = table.occupied ? (totalCents ? `Ocupada · ${money(totalCents)}` : "Ocupada") : `${table.capacity} plazas`;
  return (
    <button
      className={table.occupied ? "pos-tableTile pos-tableTile--occupied" : "pos-tableTile"}
      type="button"
      onClick={() => onSelect(table)}
      aria-label={`Mesa ${table.name} · ${state}`}
      data-testid={`pos-table-${table.id}`}
    >
      <strong data-testid={`pos-table-name-${table.id}`}>{table.name}</strong>
      <span data-testid={`pos-table-state-${table.id}`}>{state}</span>
    </button>
  );
}
