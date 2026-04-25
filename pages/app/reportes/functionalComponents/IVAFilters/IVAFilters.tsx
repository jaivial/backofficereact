import React from "react";
import { RefreshCw, Filter, FileText, FileSpreadsheet } from "lucide-react";
import { Card } from "../../../../../ui/shell/Card";

type DatePreset = "this_quarter" | "last_quarter" | "this_year" | "last_year" | "custom";

interface IVAFiltersProps {
  datePreset: DatePreset;
  dateFrom: string;
  dateTo: string;
  includeCreditNotes: boolean;
  loading: boolean;
  exporting: boolean;
  report: object | null;
  onDatePresetChange: (preset: DatePreset) => void;
  onDateFromChange: (value: string) => void;
  onDateToChange: (value: string) => void;
  onIncludeCreditNotesChange: (checked: boolean) => void;
  onGenerate: () => void;
  onExportPDF: () => void;
  onExportExcel: () => void;
}

const DATE_PRESETS: { value: DatePreset; label: string }[] = [
  { value: "this_quarter", label: "Este trimestre" },
  { value: "last_quarter", label: "Trimestre anterior" },
  { value: "this_year", label: "Este ano" },
  { value: "last_year", label: "Ano anterior" },
  { value: "custom", label: "Personalizado" },
];

export function IVAFilters({
  datePreset,
  dateFrom,
  dateTo,
  includeCreditNotes,
  loading,
  exporting,
  report,
  onDatePresetChange,
  onDateFromChange,
  onDateToChange,
  onIncludeCreditNotesChange,
  onGenerate,
  onExportPDF,
  onExportExcel,
}: IVAFiltersProps) {
  return (
    <Card variant="tailwind" padding className="mb-6" data-ui="iva-filters">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4" data-ui="filters-grid">
        <div data-ui="date-preset-wrapper">
          <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="date-preset" data-slot="iVAFilters-mb-1">Periodo</label>
          <select
            id="date-preset"
            value={datePreset}
            onChange={(e) => onDatePresetChange(e.target.value as DatePreset)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            data-ui="date-preset-select"
          >
            {DATE_PRESETS.map(preset => (
              <option key={preset.value} value={preset.value}>{preset.label}</option>
            ))}
          </select>
        </div>

        <div data-ui="date-from-wrapper">
          <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="iva-date-from" data-slot="iVAFilters-mb-1">Desde</label>
          <input
            id="iva-date-from"
            type="date"
            value={dateFrom}
            onChange={(e) => {
              onDateFromChange(e.target.value);
              onDatePresetChange("custom");
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            data-ui="date-from-input"
          />
        </div>

        <div data-ui="date-to-wrapper">
          <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="iva-date-to" data-slot="iVAFilters-mb-1">Hasta</label>
          <input
            id="iva-date-to"
            type="date"
            value={dateTo}
            onChange={(e) => {
              onDateToChange(e.target.value);
              onDatePresetChange("custom");
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            data-ui="date-to-input"
          />
        </div>

        <div className="flex items-end" data-ui="credit-notes-wrapper">
          <label className="flex items-center gap-2 cursor-pointer" data-slot="iVAFilters-cursor-pointer">
            <input
              type="checkbox"
              checked={includeCreditNotes}
              onChange={(e) => onIncludeCreditNotesChange(e.target.checked)}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              data-ui="credit-notes-checkbox"
            />
            <span className="text-sm text-gray-700" data-slot="iVAFilters-text-gray-700">Incluir notas de credito</span>
          </label>
        </div>
      </div>

      <div className="flex gap-2 mt-4" data-ui="actions">
        <button
          onClick={onGenerate}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          data-ui="generate-btn"
        >
          {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Filter className="w-4 h-4" />}
          Generar Reporte
        </button>

        {report && (
          <>
            <button
              onClick={onExportPDF}
              disabled={exporting}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
              data-ui="export-pdf-btn"
            >
              <FileText className="w-4 h-4" />
              Exportar PDF
            </button>
            <button
              onClick={onExportExcel}
              disabled={exporting}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
              data-ui="export-excel-btn"
            >
              <FileSpreadsheet className="w-4 h-4" />
              Exportar Excel
            </button>
          </>
        )}
      </div>
    </Card>
  );
}
