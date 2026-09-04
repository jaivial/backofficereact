import React from "react";

import { InlineAlert } from "../../../../../ui/feedback/InlineAlert";
import type { SheetCost } from "./sheetsApi";

// Coste: what the dish costs and whether that number can be trusted.
//
// The zone is a diagnostic, never a verdict, and it is deliberately hidden
// whenever any ingredient price is missing: a confident-looking "GREEN" on an
// incomplete cost is worse than no zone at all.

const ZONE_LABELS: Record<string, string> = {
  PURPLE: "Margen muy alto — revisar valor percibido",
  GREEN: "Correcto",
  AMBER: "Ajustado — vigilar",
  RED: "Food cost alto — revisar",
};

function euro(value: number): string {
  return `${value.toFixed(2)} €`;
}

export function TechnicalSheetCostTab({ cost }: { cost: SheetCost | null }) {
  if (!cost) {
    return <p className="bo-sheetHint" data-role="sheet-cost-loading">Calculando coste...</p>;
  }

  const hasLines = cost.lines.length > 0;

  return (
    <div className="bo-stack" data-ui="sheet-cost-tab" data-testid="sheet-cost-tab">
      {!cost.costComplete ? (
        <div data-ui="sheet-cost-incomplete" data-testid="sheet-cost-incomplete">
          <InlineAlert
            kind="error"
            title="Coste incompleto"
            message={`Sin precio de compra: ${cost.missingPrices.join(", ")}. El total mostrado es un minimo, no el coste real.`}
          />
        </div>
      ) : null}

      {/* Without ingredients there is nothing to break down. An empty table with
          headers reads as a failed load, so the reason is spelled out. */}
      {!hasLines ? (
        <p className="bo-sheetHint" data-role="sheet-cost-empty">
          Sin ingredientes no hay coste que calcular. Anade ingredientes en la pestana Informacion
          para ver el desglose.
        </p>
      ) : (
        <>
          <div data-slot="technicalSheetCostTab-tableWrap" className="bo-tableWrap">
            <table data-slot="technicalSheetCostTab-table-cost" className="bo-table bo-table--cost">
              <caption className="sr-only">Desglose de coste por ingrediente</caption>
              <thead data-slot="technicalSheetCostTab-thead">
                <tr data-slot="technicalSheetCostTab-tr">
                  <th data-slot="technicalSheetCostTab-th" scope="col">Ingrediente</th>
                  <th data-slot="technicalSheetCostTab-table-num" scope="col" className="bo-table__num">
                    Cantidad
                  </th>
                  <th data-slot="technicalSheetCostTab-table-num" scope="col" className="bo-table__num">
                    Merma
                  </th>
                  <th data-slot="technicalSheetCostTab-table-num" scope="col" className="bo-table__num">
                    Coste
                  </th>
                </tr>
              </thead>
              <tbody data-slot="technicalSheetCostTab-tbody">
                {cost.lines.map((line) => (
                  <tr data-slot="technicalSheetCostTab-tr" key={`${line.stockItemId}-${line.name}`}>
                    <td data-slot="technicalSheetCostTab-td">{line.name}</td>
                    <td data-slot="technicalSheetCostTab-table-num" className="bo-table__num">
                      {line.enteredQty} {line.unitLabel}
                    </td>
                    <td data-slot="technicalSheetCostTab-table-num" className="bo-table__num">
                      {line.wastePct > 0 ? `${line.wastePct}%` : "—"}
                    </td>
                    <td data-slot="technicalSheetCostTab-table-num" className="bo-table__num">
                      {line.priceMissing ? (
                        <span data-slot="technicalSheetCostTab-costMissing" className="bo-costMissing">Sin precio</span>
                      ) : (
                        euro(line.lineCost)
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <dl className="bo-costSummary" data-ui="sheet-cost-summary" data-testid="sheet-cost-summary">
            <div data-slot="technicalSheetCostTab-costSummary-row" className="bo-costSummary__row">
              <dt>Ingredientes</dt>
              <dd>{euro(cost.ingredientCost)}</dd>
            </div>
            {cost.labourCost > 0 ? (
              <div data-slot="technicalSheetCostTab-costSummary-row" className="bo-costSummary__row">
                {/* Labour stays its own line so the food-cost % remains comparable
                    with ingredient-only industry benchmarks. */}
                <dt>Mano de obra</dt>
                <dd>{euro(cost.labourCost)}</dd>
              </div>
            ) : null}
            <div data-slot="technicalSheetCostTab-costSummary-row" className="bo-costSummary__row">
              <dt>Coste por racion</dt>
              <dd>{euro(cost.costPerPortion)}</dd>
            </div>
            {cost.grossPrice > 0 ? (
              <>
                <div data-slot="technicalSheetCostTab-costSummary-row" className="bo-costSummary__row">
                  <dt>Precio de venta</dt>
                  <dd>{euro(cost.grossPrice)}</dd>
                </div>
                <div data-slot="technicalSheetCostTab-costSummary-row" className="bo-costSummary__row">
                  <dt>Food cost</dt>
                  <dd>{cost.foodCostPct.toFixed(1)} %</dd>
                </div>
              </>
            ) : null}
            <div data-slot="technicalSheetCostTab-costSummary-row-total" className="bo-costSummary__row bo-costSummary__row--total">
              <dt>Coste total</dt>
              <dd data-ui="sheet-cost-total" data-testid="sheet-cost-total">
                {euro(cost.totalCost)}
              </dd>
            </div>
          </dl>

          {cost.grossPrice === 0 ? (
            <p className="bo-sheetHint" data-role="sheet-cost-no-price">
              Este producto no tiene precio de venta, asi que no se puede calcular el food cost ni
              el margen.
            </p>
          ) : null}

          {cost.zone && cost.costComplete ? (
            <p
              className={`bo-costZone bo-costZone--${cost.zone.toLowerCase()}`}
              data-ui="sheet-cost-zone"
              data-testid="sheet-cost-zone"
            >
              {ZONE_LABELS[cost.zone] ?? cost.zone}
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}
