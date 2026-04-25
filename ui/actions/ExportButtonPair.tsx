import React from "react";
import { cn } from "../shadcn/utils";

type ExportButtonPairProps = {
  onExportPdf: () => void;
  onExportExcel: () => void;
  pdfLabel?: string;
  excelLabel?: string;
  className?: string;
};

export function ExportButtonPair({
  onExportPdf,
  onExportExcel,
  pdfLabel = "Exportar PDF",
  excelLabel = "Exportar Excel",
  className,
}: ExportButtonPairProps) {
  return (
    <div className={cn("flex gap-2", className)}>
      <button
        type="button"
        className="bo-btn bo-btn--danger bo-btn--sm"
        onClick={onExportPdf}
      >
        {pdfLabel}
      </button>
      <button
        type="button"
        className="bo-btn bo-btn--success bo-btn--sm"
        onClick={onExportExcel}
      >
        {excelLabel}
      </button>
    </div>
  );
}
