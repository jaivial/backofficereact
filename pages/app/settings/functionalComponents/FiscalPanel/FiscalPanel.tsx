import React from "react";
import { Panel } from "../../../../../ui/shell/Panel";

export type FiscalEntityType = "autonomo" | "sl" | "sl_new" | "sl_micro" | "sa";

export const FISCAL_ENTITY_OPTIONS: Array<{ value: FiscalEntityType; label: string; description: string }> = [
  { value: "autonomo", label: "Autónomo", description: "IRPF progresivo por tramos + cuota RETA (Seguridad Social)" },
  { value: "sl", label: "SL · tipo general", description: "Impuesto de Sociedades al 25% sobre el beneficio" },
  { value: "sl_new", label: "SL · nueva creación", description: "Impuesto de Sociedades al 15% los 2 primeros ejercicios con beneficios" },
  { value: "sl_micro", label: "SL · micropyme", description: "Tipo reducido 19% primeros 50.000 € y 21% sobre el resto" },
  { value: "sa", label: "SA · tipo general", description: "Impuesto de Sociedades al 25% sobre el beneficio" },
];

interface FiscalPanelProps {
  tipoEmpresa: FiscalEntityType;
  busy: boolean;
  onTipoEmpresaChange: (value: FiscalEntityType) => void;
  onSave: () => Promise<void>;
}

export function FiscalPanel({ tipoEmpresa, busy, onTipoEmpresaChange, onSave }: FiscalPanelProps) {
  return (
    <Panel title="Datos fiscales" meta="Elige como tributa tu negocio; el simulador de estadisticas usa este tipo por defecto" aria-label="Datos fiscales" data-ui="fiscal-panel">
      <div className="bo-stack" data-slot="fiscalPanel-stack">
        <label className="bo-field" data-ui="tipoEmpresaField">
          <div className="bo-label" data-slot="fieldLabel">Tipo de empresa o autonomo</div>
          <select
            className="bo-input"
            value={tipoEmpresa}
            onChange={(e) => onTipoEmpresaChange(e.target.value as FiscalEntityType)}
            data-slot="fieldInput"
            data-testid="settings-tipo-empresa"
          >
            {FISCAL_ENTITY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <div className="bo-mutedText" data-slot="fieldHint">
            {FISCAL_ENTITY_OPTIONS.find((option) => option.value === tipoEmpresa)?.description}
          </div>
        </label>

        <div className="bo-mutedText" data-ui="fiscalHint">
          Este tipo se guarda por restaurante y se usa como valor inicial en la simulacion fiscal de la pagina de estadisticas. Puedes cambiarlo ahi en cualquier momento sin afectar a este ajuste.
        </div>

        <div className="bo-row" data-slot="actions">
          <button className="bo-btn bo-btn--primary" type="button" onClick={onSave} disabled={busy} data-role="saveBtn">
            Guardar datos fiscales
          </button>
        </div>
      </div>
    </Panel>
  );
}
