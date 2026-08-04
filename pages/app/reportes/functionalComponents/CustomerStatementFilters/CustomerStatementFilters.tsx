import React from "react";
import { RefreshCw, User, Receipt, FileText, FileSpreadsheet } from "lucide-react";
import { Card } from "../../../../../ui/shell/Card";

interface Customer {
  name: string;
  email?: string;
  dni_cif?: string;
}

interface CustomerStatementFiltersProps {
  selectedCustomer: string;
  statementDateFrom: string;
  statementDateTo: string;
  customers: Customer[];
  customersLoading: boolean;
  customerLoading: boolean;
  customerStatement: object | null;
  exporting: boolean;
  onCustomerChange: (value: string) => void;
  onDateFromChange: (value: string) => void;
  onDateToChange: (value: string) => void;
  onLoadCustomers: () => void;
  onGenerate: () => void;
  onExportPDF: () => void;
  onExportCSV: () => void;
}

export function CustomerStatementFilters({
  selectedCustomer,
  statementDateFrom,
  statementDateTo,
  customers,
  customersLoading,
  customerLoading,
  customerStatement,
  exporting,
  onCustomerChange,
  onDateFromChange,
  onDateToChange,
  onLoadCustomers,
  onGenerate,
  onExportPDF,
  onExportCSV,
}: CustomerStatementFiltersProps) {
  return (
    <Card variant="tailwind" padding className="mb-6" data-ui="customer-statement-filters">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4" data-ui="filters-grid">
        <div data-ui="customer-select-wrapper">
          <label className="block text-sm font-medium text-[var(--bo-text)] mb-1" htmlFor="customer-select" data-slot="customerStatementFilters-mb-1">Cliente</label>
          <select
            id="customer-select"
            value={selectedCustomer}
            onChange={(e) => onCustomerChange(e.target.value)}
            className="bo-input w-full"
            data-ui="customer-select"
          >
            <option value="">Seleccionar cliente...</option>
            {customers.map((c) => (
              <option key={c.name} value={c.name}>
                {c.name} {c.dni_cif ? `(${c.dni_cif})` : ""}
              </option>
            ))}
          </select>
        </div>

        <div data-ui="date-from-wrapper">
          <label className="block text-sm font-medium text-[var(--bo-text)] mb-1" htmlFor="statement-date-from" data-slot="customerStatementFilters-mb-1">Desde</label>
          <input
            id="statement-date-from"
            type="date"
            value={statementDateFrom}
            onChange={(e) => onDateFromChange(e.target.value)}
            className="bo-input w-full"
            data-ui="statement-date-from"
          />
        </div>

        <div data-ui="date-to-wrapper">
          <label className="block text-sm font-medium text-[var(--bo-text)] mb-1" htmlFor="statement-date-to" data-slot="customerStatementFilters-mb-1">Hasta</label>
          <input
            id="statement-date-to"
            type="date"
            value={statementDateTo}
            onChange={(e) => onDateToChange(e.target.value)}
            className="bo-input w-full"
            data-ui="statement-date-to"
          />
        </div>

        <div className="flex items-end" data-ui="load-customers-btn-wrapper">
          <button
            onClick={onLoadCustomers}
            disabled={customersLoading}
            className="bo-btn bo-btn--secondary flex items-center gap-2 disabled:opacity-50"
            data-ui="load-customers-btn"
          >
            {customersLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <User className="w-4 h-4" />}
            Cargar Clientes
          </button>
        </div>
      </div>

      <div className="flex gap-2 mt-4" data-ui="actions">
        <button
          onClick={onGenerate}
          disabled={customerLoading || !selectedCustomer}
          className="bo-btn bo-btn--primary flex items-center gap-2 disabled:opacity-50"
          data-ui="generate-btn"
        >
          {customerLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Receipt className="w-4 h-4" />}
          Generar Estado de Cuenta
        </button>

        {customerStatement && (
          <>
            <button
              onClick={onExportPDF}
              disabled={exporting}
              className="bo-btn bo-btn--danger flex items-center gap-2 disabled:opacity-50"
              data-ui="export-pdf-btn"
            >
              <FileText className="w-4 h-4" />
              Exportar PDF
            </button>
            <button
              onClick={onExportCSV}
              disabled={exporting}
              className="bo-btn bo-btn--success flex items-center gap-2 disabled:opacity-50"
              data-ui="export-csv-btn"
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
