import React, { useCallback, useMemo, useState, useRef } from "react";
import {
  Upload,
  FileSpreadsheet,
  ArrowRight,
  ArrowLeft,
  Check,
  AlertCircle,
  X,
  Download,
  Trash2,
  Eye,
  RefreshCw,
  ChevronDown,
  AlertTriangle,
  Clock,
  CheckCircle,
  XCircle,
  FileText,
  Settings,
} from "lucide-react";
import { useToasts } from "../../../ui/feedback/useToasts";
import { Select } from "../../../ui/inputs/Select";
import {
  type ImportColumnMapping,
  type ImportFieldType,
  type ParsedInvoiceRow,
  type ValidationError,
  type ImportSettings,
  type ImportResult,
  IMPORT_FIELD_OPTIONS,
  COLUMN_SUGGESTIONS,
  DEFAULT_IMPORT_SETTINGS,
  STATUS_MAPPING,
  PAYMENT_METHOD_MAPPING,
  CATEGORY_MAPPING,
  CURRENCY_MAPPING,
} from "../../../api/import-types";
import type { InvoiceInput, InvoiceStatus, PaymentMethod, InvoiceCategory, CurrencyCode } from "../../../api/types";
import type { createClient } from "../../../api/client";

type ImportWizardProps = {
  open: boolean;
  onClose: () => void;
  onImportComplete: (result: ImportResult) => void;
  api: ReturnType<typeof createClient>;
  settings?: Partial<ImportSettings>;
};

type WizardStep = "upload" | "mapping" | "preview" | "importing" | "complete";

interface ParsedCSVData {
  headers: string[];
  rows: string[][];
  filename: string;
}

export function ImportWizard({ open, onClose, onImportComplete, api, settings = {} }: ImportWizardProps) {
  const { pushToast } = useToasts();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Merge default settings with provided settings
  const importSettings: ImportSettings = useMemo(
    () => ({ ...DEFAULT_IMPORT_SETTINGS, ...settings }),
    [settings]
  );

  // Wizard state
  const [currentStep, setCurrentStep] = useState<WizardStep>("upload");
  const [parsedData, setParsedData] = useState<ParsedCSVData | null>(null);
  const [columnMapping, setColumnMapping] = useState<ImportColumnMapping>({});
  const [previewRows, setPreviewRows] = useState<ParsedInvoiceRow[]>([]);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // File upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Settings state
  const [localSettings, setLocalSettings] = useState<ImportSettings>(importSettings);

  // Reset state when closing
  const handleClose = useCallback(() => {
    setCurrentStep("upload");
    setParsedData(null);
    setColumnMapping({});
    setPreviewRows([]);
    setImportResult(null);
    setSelectedFile(null);
    setLocalSettings(importSettings);
    onClose();
  }, [onClose, importSettings]);

  // Parse CSV file
  const parseCSV = useCallback((file: File): Promise<ParsedCSVData> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const text = e.target?.result as string;
          const lines = text.split(/\r?\n/).filter((line) => line.trim());

          if (lines.length === 0) {
            reject(new Error("El archivo esta vacio"));
            return;
          }

          // Parse headers
          const parseRow = (row: string): string[] => {
            const result: string[] = [];
            let current = "";
            let inQuotes = false;

            for (let i = 0; i < row.length; i++) {
              const char = row[i];
              if (char === '"') {
                if (inQuotes && row[i + 1] === '"') {
                  current += '"';
                  i++;
                } else {
                  inQuotes = !inQuotes;
                }
              } else if (char === "," && !inQuotes) {
                result.push(current.trim());
                current = "";
              } else {
                current += char;
              }
            }
            result.push(current.trim());
            return result;
          };

          const headers = parseRow(lines[0]);
          const startIndex = localSettings.skipHeaderRow ? 1 : 0;
          const rows = lines.slice(startIndex).map(parseRow);

          resolve({
            headers,
            rows,
            filename: file.name,
          });
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(new Error("Error al leer el archivo"));
      reader.readAsText(file);
    });
  }, [localSettings.skipHeaderRow]);

  // Auto-detect column mappings
  const autoDetectMapping = useCallback((headers: string[]): ImportColumnMapping => {
    const mapping: ImportColumnMapping = {};
    headers.forEach((header) => {
      const normalizedHeader = header.toLowerCase().trim();
      const suggestedField = COLUMN_SUGGESTIONS[normalizedHeader];
      if (suggestedField) {
        mapping[header] = suggestedField;
      } else {
        mapping[header] = "ignore";
      }
    });
    return mapping;
  }, []);

  // Validate a single row
  const validateRow = useCallback((
    rowData: Record<string, string>,
    mapping: ImportColumnMapping,
    settings: ImportSettings,
    rowNumber: number
  ): ParsedInvoiceRow => {
    const errors: ValidationError[] = [];
    const mappedData: Partial<InvoiceInput> = {};

    // Get required fields
    const requiredFields = IMPORT_FIELD_OPTIONS.filter((f) => f.required).map((f) => f.value);

    // Process each mapped column
    Object.entries(mapping).forEach(([header, fieldType]) => {
      if (fieldType === "ignore") return;

      const rawValue = rowData[header]?.trim() || "";

      // Check required fields
      if (requiredFields.includes(fieldType) && !rawValue) {
        errors.push({
          row: rowNumber,
          field: fieldType,
          message: `El campo es obligatorio`,
          value: rawValue,
        });
        return;
      }

      // Skip empty optional fields
      if (!rawValue) return;

      // Parse and validate based on field type
      switch (fieldType) {
        case "customer_name":
          mappedData.customer_name = rawValue;
          break;

        case "customer_surname":
          mappedData.customer_surname = rawValue;
          break;

        case "customer_email":
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(rawValue)) {
            errors.push({
              row: rowNumber,
              field: fieldType,
              message: `Email invalido`,
              value: rawValue,
            });
          } else {
            mappedData.customer_email = rawValue;
          }
          break;

        case "customer_dni_cif":
          mappedData.customer_dni_cif = rawValue;
          break;

        case "customer_phone":
          mappedData.customer_phone = rawValue;
          break;

        case "customer_address_street":
          mappedData.customer_address_street = rawValue;
          break;

        case "customer_address_number":
          mappedData.customer_address_number = rawValue;
          break;

        case "customer_address_postal_code":
          mappedData.customer_address_postal_code = rawValue;
          break;

        case "customer_address_city":
          mappedData.customer_address_city = rawValue;
          break;

        case "customer_address_province":
          mappedData.customer_address_province = rawValue;
          break;

        case "customer_address_country":
          mappedData.customer_address_country = rawValue;
          break;

        case "amount":
          const amount = parseFloat(rawValue.replace(",", "."));
          if (isNaN(amount) || amount < 0) {
            errors.push({
              row: rowNumber,
              field: fieldType,
              message: `Importe invalido`,
              value: rawValue,
            });
          } else {
            mappedData.amount = amount;
          }
          break;

        case "iva_rate":
          const ivaRate = parseFloat(rawValue.replace(",", "."));
          if (isNaN(ivaRate) || ivaRate < 0 || ivaRate > 100) {
            errors.push({
              row: rowNumber,
              field: fieldType,
              message: `Tasa IVA invalida`,
              value: rawValue,
            });
          } else {
            mappedData.iva_rate = ivaRate;
          }
          break;

        case "iva_amount":
          const ivaAmount = parseFloat(rawValue.replace(",", "."));
          if (isNaN(ivaAmount) || ivaAmount < 0) {
            errors.push({
              row: rowNumber,
              field: fieldType,
              message: `Importe IVA invalido`,
              value: rawValue,
            });
          } else {
            mappedData.iva_amount = ivaAmount;
          }
          break;

        case "total":
          const total = parseFloat(rawValue.replace(",", "."));
          if (isNaN(total) || total < 0) {
            errors.push({
              row: rowNumber,
              field: fieldType,
              message: `Total invalido`,
              value: rawValue,
            });
          } else {
            mappedData.total = total;
          }
          break;

        case "currency":
          const normalizedCurrency = rawValue.toLowerCase();
          if (CURRENCY_MAPPING[normalizedCurrency]) {
            mappedData.currency = CURRENCY_MAPPING[normalizedCurrency];
          } else {
            mappedData.currency = settings.defaultCurrency;
          }
          break;

        case "invoice_number":
          mappedData.invoice_number = rawValue;
          break;

        case "invoice_date":
          // Try to parse various date formats
          const parsedDate = parseDate(rawValue, settings.dateFormat);
          if (parsedDate) {
            mappedData.invoice_date = parsedDate;
          } else {
            errors.push({
              row: rowNumber,
              field: fieldType,
              message: `Formato de fecha invalido`,
              value: rawValue,
            });
          }
          break;

        case "payment_method":
          const normalizedMethod = rawValue.toLowerCase();
          if (PAYMENT_METHOD_MAPPING[normalizedMethod]) {
            mappedData.payment_method = PAYMENT_METHOD_MAPPING[normalizedMethod];
          } else {
            mappedData.payment_method = settings.defaultPaymentMethod || undefined;
          }
          break;

        case "payment_date":
          const parsedPaymentDate = parseDate(rawValue, settings.dateFormat);
          if (parsedPaymentDate) {
            mappedData.payment_date = parsedPaymentDate;
          }
          break;

        case "status":
          const normalizedStatus = rawValue.toLowerCase();
          if (STATUS_MAPPING[normalizedStatus]) {
            mappedData.status = STATUS_MAPPING[normalizedStatus];
          } else {
            mappedData.status = settings.defaultStatus;
          }
          break;

        case "is_reservation":
          mappedData.is_reservation = rawValue.toLowerCase() === "si" || rawValue.toLowerCase() === "yes" || rawValue === "1" || rawValue.toLowerCase() === "true";
          break;

        case "reservation_date":
          const parsedReservationDate = parseDate(rawValue, settings.dateFormat);
          if (parsedReservationDate) {
            mappedData.reservation_date = parsedReservationDate;
          }
          break;

        case "reservation_customer_name":
          mappedData.reservation_customer_name = rawValue;
          break;

        case "reservation_party_size":
          const partySize = parseInt(rawValue);
          if (!isNaN(partySize) && partySize > 0) {
            mappedData.reservation_party_size = partySize;
          }
          break;

        case "internal_notes":
          mappedData.internal_notes = rawValue;
          break;

        case "category":
          const normalizedCategory = rawValue.toLowerCase();
          if (CATEGORY_MAPPING[normalizedCategory]) {
            mappedData.category = CATEGORY_MAPPING[normalizedCategory];
          } else {
            mappedData.category = settings.defaultCategory;
          }
          break;

        case "tags":
          mappedData.tags = rawValue.split(/[,;]/).map((t) => t.trim()).filter(Boolean);
          break;
      }
    });

    // Calculate totals if not provided
    if (mappedData.amount && mappedData.iva_rate && !mappedData.iva_amount) {
      mappedData.iva_amount = (mappedData.amount * mappedData.iva_rate) / 100;
    }
    if (mappedData.amount && mappedData.iva_amount && !mappedData.total) {
      mappedData.total = mappedData.amount + mappedData.iva_amount;
    }

    // Set defaults for missing fields
    if (!mappedData.status) mappedData.status = settings.defaultStatus;
    if (!mappedData.category) mappedData.category = settings.defaultCategory;
    if (!mappedData.currency) mappedData.currency = settings.defaultCurrency;
    if (!mappedData.iva_rate) mappedData.iva_rate = settings.defaultIvaRate;
    if (mappedData.is_reservation === undefined) mappedData.is_reservation = false;

    const isValid = errors.length === 0;
    return {
      rowNumber,
      data: rowData,
      mappedData,
      status: isValid ? "valid" : "error",
      errors,
    };
  }, []);

  // Helper function to parse dates
  function parseDate(dateStr: string, format: string): string | null {
    // Try common formats
    const formats = [
      // YYYY-MM-DD
      /^(\d{4})-(\d{1,2})-(\d{1,2})$/,
      // DD/MM/YYYY
      /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,
      // DD-MM-YYYY
      /^(\d{1,2})-(\d{1,2})-(\d{4})$/,
      // DD.MM.YYYY
      /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/,
    ];

    for (const formatRegex of formats) {
      const match = dateStr.match(formatRegex);
      if (match) {
        if (format.startsWith("YYYY")) {
          // YYYY-MM-DD format
          return `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`;
        } else {
          // DD/MM/YYYY format
          return `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`;
        }
      }
    }

    // Try native Date parsing as fallback
    const parsed = new Date(dateStr);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString().split("T")[0];
    }

    return null;
  }

  // Handle file selection
  const handleFileSelect = useCallback(async (file: File) => {
    const validExtensions = [".csv", ".txt"];
    const ext = file.name.toLowerCase().substring(file.name.lastIndexOf("."));

    if (!validExtensions.includes(ext)) {
      pushToast({ kind: "error", title: "Tipo de archivo invalido", message: "Solo se admiten archivos CSV" });
      return;
    }

    setSelectedFile(file);
    setIsProcessing(true);

    try {
      const data = await parseCSV(file);
      setParsedData(data);

      // Auto-detect mappings
      const autoMapping = autoDetectMapping(data.headers);
      setColumnMapping(autoMapping);

      // Validate all rows
      const validatedRows = data.rows.map((row, index) => {
        const rowData: Record<string, string> = {};
        data.headers.forEach((header, i) => {
          rowData[header] = row[i] || "";
        });
        return validateRow(rowData, autoMapping, localSettings, index + (localSettings.skipHeaderRow ? 2 : 1));
      });

      setPreviewRows(validatedRows);
      setCurrentStep("mapping");
    } catch (error) {
      pushToast({
        kind: "error",
        title: "Error al procesar archivo",
        message: error instanceof Error ? error.message : "Error desconocido",
      });
    } finally {
      setIsProcessing(false);
    }
  }, [parseCSV, autoDetectMapping, validateRow, localSettings, pushToast]);

  // Handle drag and drop
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  }, [handleFileSelect]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  }, [handleFileSelect]);

  // Update mapping for a column
  const handleMappingChange = useCallback((header: string, fieldType: ImportFieldType) => {
    setColumnMapping((prev) => ({
      ...prev,
      [header]: fieldType,
    }));
  }, []);

  // Re-validate rows with new mapping
  const handleValidate = useCallback(() => {
    if (!parsedData) return;

    setIsProcessing(true);
    const validatedRows = parsedData.rows.map((row, index) => {
      const rowData: Record<string, string> = {};
      parsedData.headers.forEach((header, i) => {
        rowData[header] = row[i] || "";
      });
      return validateRow(rowData, columnMapping, localSettings, index + (localSettings.skipHeaderRow ? 2 : 1));
    });

    setPreviewRows(validatedRows);
    setCurrentStep("preview");
    setIsProcessing(false);
  }, [parsedData, columnMapping, localSettings, validateRow]);

  // Go back to mapping step
  const handleBackToMapping = useCallback(() => {
    setCurrentStep("mapping");
  }, []);

  // Go to preview step
  const handleGoToPreview = useCallback(() => {
    setCurrentStep("preview");
  }, []);

  // Perform the import
  const handleImport = useCallback(async () => {
    const validRows = previewRows.filter((row) => row.status === "valid");

    if (validRows.length === 0) {
      pushToast({ kind: "error", title: "No hay facturas validas", message: "No se pueden importar facturas sin datos validos" });
      return;
    }

    setCurrentStep("importing");
    setIsProcessing(true);

    const errors: ValidationError[] = [];
    const importedIds: number[] = [];
    let successCount = 0;

    try {
      // Process in batches
      const batchSize = 10;
      for (let i = 0; i < validRows.length; i += batchSize) {
        const batch = validRows.slice(i, i + batchSize);

        await Promise.all(
          batch.map(async (row) => {
            try {
              const input: InvoiceInput = {
                customer_name: row.mappedData.customer_name!,
                customer_surname: row.mappedData.customer_surname,
                customer_email: row.mappedData.customer_email!,
                customer_dni_cif: row.mappedData.customer_dni_cif,
                customer_phone: row.mappedData.customer_phone,
                customer_address_street: row.mappedData.customer_address_street,
                customer_address_number: row.mappedData.customer_address_number,
                customer_address_postal_code: row.mappedData.customer_address_postal_code,
                customer_address_city: row.mappedData.customer_address_city,
                customer_address_province: row.mappedData.customer_address_province,
                customer_address_country: row.mappedData.customer_address_country,
                amount: row.mappedData.amount!,
                currency: row.mappedData.currency || "EUR",
                iva_rate: row.mappedData.iva_rate,
                iva_amount: row.mappedData.iva_amount,
                total: row.mappedData.total,
                payment_method: row.mappedData.payment_method,
                invoice_number: row.mappedData.invoice_number,
                invoice_date: row.mappedData.invoice_date!,
                payment_date: row.mappedData.payment_date,
                status: row.mappedData.status || "borrador",
                is_reservation: row.mappedData.is_reservation || false,
                reservation_date: row.mappedData.reservation_date,
                reservation_customer_name: row.mappedData.reservation_customer_name,
                reservation_party_size: row.mappedData.reservation_party_size,
                internal_notes: row.mappedData.internal_notes,
                category: row.mappedData.category,
                tags: row.mappedData.tags,
              };

              const res = await api.invoices.create(input);
              if (res.success && res.id) {
                importedIds.push(res.id);
                successCount++;
              } else {
                errors.push({
                  row: row.rowNumber,
                  field: "general",
                  message: res.message || "Error al crear la factura",
                  value: "",
                });
              }
            } catch (error) {
              errors.push({
                row: row.rowNumber,
                field: "general",
                message: error instanceof Error ? error.message : "Error desconocido",
                value: "",
              });
            }
          })
        );
      }

      const result: ImportResult = {
        success: successCount > 0,
        totalRows: previewRows.length,
        successCount,
        errorCount: errors.length,
        errors,
        importedIds,
        timestamp: new Date().toISOString(),
      };

      setImportResult(result);
      setCurrentStep("complete");
      onImportComplete(result);

      if (successCount > 0) {
        pushToast({
          kind: "success",
          title: "Importacion completada",
          message: `${successCount} facturas importadas correctamente`,
        });
      }
    } catch (error) {
      pushToast({
        kind: "error",
        title: "Error en la importacion",
        message: error instanceof Error ? error.message : "Error desconocido",
      });
    } finally {
      setIsProcessing(false);
    }
  }, [previewRows, api, pushToast, onImportComplete]);

  // Download sample CSV
  const handleDownloadSample = useCallback(() => {
    const headers = [
      "NombreCliente",
      "Apellidos",
      "Email",
      "DNI",
      "Telefono",
      "Direccion",
      "Ciudad",
      "Provincia",
      "Importe",
      "IVA",
      "Total",
      "FechaFactura",
      "MetodoPago",
      "Estado",
      "Categoria",
    ];

    const sampleData = [
      ["Juan", "Garcia Lopez", "juan@ejemplo.com", "12345678A", "612345678", "Calle Mayor 123", "Madrid", "Madrid", "100.00", "21", "121.00", "2024-01-15", "tarjeta", "pendiente", "reserva"],
      ["Maria", "Rodriguez", "maria@ejemplo.com", "87654321B", "654987321", "Avenida Barcelona 45", "Barcelona", "Barcelona", "250.50", "21", "303.11", "2024-01-16", "transferencia", "pagada", "productos"],
    ];

    const csvContent = [headers.join(","), ...sampleData.map((row) => row.join(","))].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "ejemplo_facturas.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, []);

  // Stats for preview
  const stats = useMemo(() => {
    const valid = previewRows.filter((r) => r.status === "valid").length;
    const errors = previewRows.filter((r) => r.status === "error").length;
    return { valid, errors, total: previewRows.length };
  }, [previewRows]);

  if (!open) return null;

  return (
    <div className="bo-modal-overlay" onClick={handleClose}>
      <div className="bo-modal-content bo-importWizard" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="bo-modal-header">
          <div className="bo-modal-title">
            <FileSpreadsheet size={20} />
            <span>Importar facturas desde CSV</span>
          </div>
          <button className="bo-btn bo-btn--ghost bo-btn--sm" onClick={handleClose} aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>

        {/* Progress Steps */}
        <div className="bo-importWizardSteps">
          <div className={`bo-importWizardStep ${currentStep === "upload" ? "active" : ""} ${["mapping", "preview", "importing", "complete"].includes(currentStep) ? "completed" : ""}`}>
            <div className="bo-importWizardStepNumber">1</div>
            <div className="bo-importWizardStepLabel">Subir archivo</div>
          </div>
          <div className="bo-importWizardStepConnector" />
          <div className={`bo-importWizardStep ${currentStep === "mapping" ? "active" : ""} ${["preview", "importing", "complete"].includes(currentStep) ? "completed" : ""}`}>
            <div className="bo-importWizardStepNumber">2</div>
            <div className="bo-importWizardStepLabel">Mapear columnas</div>
          </div>
          <div className="bo-importWizardStepConnector" />
          <div className={`bo-importWizardStep ${currentStep === "preview" ? "active" : ""} ${["importing", "complete"].includes(currentStep) ? "completed" : ""}`}>
            <div className="bo-importWizardStepNumber">3</div>
            <div className="bo-importWizardStepLabel">Validar y previsualizar</div>
          </div>
          <div className="bo-importWizardStepConnector" />
          <div className={`bo-importWizardStep ${currentStep === "complete" ? "active" : ""}`}>
            <div className="bo-importWizardStepNumber">4</div>
            <div className="bo-importWizardStepLabel">Completado</div>
          </div>
        </div>

        {/* Body */}
        <div className="bo-modal-body bo-importWizardBody">
          {/* Step 1: Upload */}
          {currentStep === "upload" && (
            <div className="bo-importWizardUpload">
              <div
                className={`bo-importWizardDropzone ${isDragging ? "dragging" : ""} ${selectedFile ? "has-file" : ""}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.txt"
                  onChange={handleInputChange}
                  style={{ display: "none" }}
                />
                {isProcessing ? (
                  <RefreshCw className="spinning" size={48} />
                ) : selectedFile ? (
                  <>
                    <FileSpreadsheet size={48} />
                    <p className="bo-importWizardFilename">{selectedFile.name}</p>
                    <p className="bo-importWizardHint">Haz clic para cambiar el archivo</p>
                  </>
                ) : (
                  <>
                    <Upload size={48} />
                    <p className="bo-importWizardHint">Arrastra un archivo CSV aqui</p>
                    <p className="bo-importWizardSubhint">o haz clic para seleccionar</p>
                  </>
                )}
              </div>

              <div className="bo-importWizardActions">
                <button className="bo-btn bo-btn--outline" onClick={handleDownloadSample}>
                  <Download size={16} />
                  Descargar ejemplo CSV
                </button>
              </div>

              {/* Settings */}
              <div className="bo-importWizardSettings">
                <h4>
                  <Settings size={16} />
                  Configuracion de importacion
                </h4>
                <div className="bo-importWizardSettingsGrid">
                  <div className="bo-importWizardSetting">
                    <label>Estado por defecto</label>
                    <select
                      value={localSettings.defaultStatus}
                      onChange={(e) => setLocalSettings((s) => ({ ...s, defaultStatus: e.target.value as InvoiceStatus }))}
                    >
                      <option value="borrador">Borrador</option>
                      <option value="solicitada">Solicitada</option>
                      <option value="pendiente">Pendiente</option>
                      <option value="enviada">Enviada</option>
                      <option value="pagada">Pagada</option>
                    </select>
                  </div>
                  <div className="bo-importWizardSetting">
                    <label>Categoria por defecto</label>
                    <select
                      value={localSettings.defaultCategory}
                      onChange={(e) => setLocalSettings((s) => ({ ...s, defaultCategory: e.target.value as InvoiceCategory }))}
                    >
                      <option value="reserva">Reserva</option>
                      <option value="productos">Productos</option>
                      <option value="servicios">Servicios</option>
                      <option value="otros">Otros</option>
                    </select>
                  </div>
                  <div className="bo-importWizardSetting">
                    <label>IVA por defecto (%)</label>
                    <input
                      type="number"
                      value={localSettings.defaultIvaRate}
                      onChange={(e) => setLocalSettings((s) => ({ ...s, defaultIvaRate: parseFloat(e.target.value) || 21 }))}
                      min="0"
                      max="100"
                    />
                  </div>
                  <div className="bo-importWizardSetting">
                    <label>
                      <input
                        type="checkbox"
                        checked={localSettings.skipHeaderRow}
                        onChange={(e) => setLocalSettings((s) => ({ ...s, skipHeaderRow: e.target.checked }))}
                      />
                      Omitir primera fila (encabezados)
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Mapping */}
          {currentStep === "mapping" && parsedData && (
            <div className="bo-importWizardMapping">
              <div className="bo-importWizardMappingHeader">
                <h4>Mapear columnas del archivo a campos de factura</h4>
                <p className="bo-importWizardHint">
                  Columnas detectadas: {parsedData.headers.length} | Filas: {parsedData.rows.length}
                </p>
              </div>

              <div className="bo-importWizardMappingTable">
                <table>
                  <thead>
                    <tr>
                      <th>Columna del archivo</th>
                      <th>Ejemplo de valor</th>
                      <th>Campo de factura</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedData.headers.map((header) => {
                      const firstValue = parsedData.rows[0]?.[parsedData.headers.indexOf(header)] || "";
                      return (
                        <tr key={header}>
                          <td className="bo-importWizardColumnName">{header}</td>
                          <td className="bo-importWizardColumnValue">{firstValue}</td>
                          <td>
                            <select
                              value={columnMapping[header] || "ignore"}
                              onChange={(e) => handleMappingChange(header, e.target.value as ImportFieldType)}
                            >
                              <option value="ignore">Ignorar</option>
                              {IMPORT_FIELD_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                  {opt.label} {opt.required ? "*" : ""}
                                </option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="bo-importWizardMappingActions">
                <p className="bo-importWizardRequiredNote">* Campos obligatorios</p>
              </div>
            </div>
          )}

          {/* Step 3: Preview */}
          {currentStep === "preview" && (
            <div className="bo-importWizardPreview">
              {/* Stats */}
              <div className="bo-importWizardStats">
                <div className="bo-importWizardStat valid">
                  <CheckCircle size={20} />
                  <span className="bo-importWizardStatValue">{stats.valid}</span>
                  <span className="bo-importWizardStatLabel">Validas</span>
                </div>
                <div className="bo-importWizardStat error">
                  <AlertCircle size={20} />
                  <span className="bo-importWizardStatValue">{stats.errors}</span>
                  <span className="bo-importWizardStatLabel">Con errores</span>
                </div>
                <div className="bo-importWizardStat total">
                  <FileText size={20} />
                  <span className="bo-importWizardStatValue">{stats.total}</span>
                  <span className="bo-importWizardStatLabel">Total</span>
                </div>
              </div>

              {/* Error summary */}
              {stats.errors > 0 && (
                <div className="bo-importWizardErrorSummary">
                  <AlertTriangle size={16} />
                  <span>
                    {stats.errors} fila(s) tienen errores y no se importaran. Puedes revisar los errores abajo.
                  </span>
                </div>
              )}

              {/* Preview table */}
              <div className="bo-importWizardPreviewTable">
                <table>
                  <thead>
                    <tr>
                      <th>Fila</th>
                      <th>Cliente</th>
                      <th>Email</th>
                      <th>Importe</th>
                      <th>Fecha</th>
                      <th>Estado</th>
                      <th>Errores</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.slice(0, 50).map((row) => (
                      <tr key={row.rowNumber} className={row.status === "error" ? "row-error" : "row-valid"}>
                        <td>{row.rowNumber}</td>
                        <td>{row.mappedData.customer_name || "-"}</td>
                        <td>{row.mappedData.customer_email || "-"}</td>
                        <td>{row.mappedData.amount?.toFixed(2) || "-"}</td>
                        <td>{row.mappedData.invoice_date || "-"}</td>
                        <td>
                          <span className={`bo-importWizardStatusBadge ${row.status}`}>
                            {row.status === "valid" ? "Valido" : "Error"}
                          </span>
                        </td>
                        <td>
                          {row.errors.length > 0 && (
                            <div className="bo-importWizardErrors">
                              {row.errors.map((err, i) => (
                                <div key={i} className="bo-importWizardErrorItem">
                                  {err.field}: {err.message}
                                </div>
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {previewRows.length > 50 && (
                  <p className="bo-importWizardPreviewNote">Mostrando las primeras 50 filas de {previewRows.length}</p>
                )}
              </div>
            </div>
          )}

          {/* Step 4: Importing */}
          {currentStep === "importing" && (
            <div className="bo-importWizardImporting">
              <RefreshCw className="spinning" size={64} />
              <h3>Importando facturas...</h3>
              <p>Por favor, espera mientras se importan las facturas</p>
            </div>
          )}

          {/* Step 5: Complete */}
          {currentStep === "complete" && importResult && (
            <div className="bo-importWizardComplete">
              {importResult.successCount > 0 ? (
                <CheckCircle className="success-icon" size={64} />
              ) : (
                <XCircle className="error-icon" size={64} />
              )}

              <h3>
                {importResult.successCount > 0 ? "Importacion completada" : "Importacion fallida"}
              </h3>

              <div className="bo-importWizardResultStats">
                <div className="bo-importWizardResultStat">
                  <span className="bo-importWizardResultStatValue">{importResult.successCount}</span>
                  <span className="bo-importWizardResultStatLabel">Facturas importadas</span>
                </div>
                {importResult.errorCount > 0 && (
                  <div className="bo-importWizardResultStat error">
                    <span className="bo-importWizardResultStatValue">{importResult.errorCount}</span>
                    <span className="bo-importWizardResultStatLabel">Errores</span>
                  </div>
                )}
              </div>

              {importResult.errors.length > 0 && (
                <div className="bo-importWizardResultErrors">
                  <h4>Errores:</h4>
                  <div className="bo-importWizardResultErrorsList">
                    {importResult.errors.slice(0, 10).map((err, i) => (
                      <div key={i} className="bo-importWizardResultErrorItem">
                        Fila {err.row}: {err.message}
                      </div>
                    ))}
                    {importResult.errors.length > 10 && (
                      <div className="bo-importWizardResultErrorItem more">
                        ...y {importResult.errors.length - 10} errores mas
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bo-modal-footer bo-importWizardFooter">
          {currentStep === "upload" && (
            <button className="bo-btn bo-btn--ghost" onClick={handleClose}>
              Cancelar
            </button>
          )}

          {currentStep === "mapping" && (
            <>
              <button className="bo-btn bo-btn--ghost" onClick={() => setCurrentStep("upload")}>
                <ArrowLeft size={16} />
                Volver
              </button>
              <button className="bo-btn bo-btn--primary" onClick={handleGoToPreview} disabled={isProcessing}>
                Validar y previsualizar
                <ArrowRight size={16} />
              </button>
            </>
          )}

          {currentStep === "preview" && (
            <>
              <button className="bo-btn bo-btn--ghost" onClick={handleBackToMapping}>
                <ArrowLeft size={16} />
                Volver
              </button>
              <button className="bo-btn bo-btn--primary" onClick={handleImport} disabled={stats.valid === 0 || isProcessing}>
                Importar {stats.valid} facturas
                <Check size={16} />
              </button>
            </>
          )}

          {currentStep === "complete" && (
            <button className="bo-btn bo-btn--primary" onClick={handleClose}>
              Cerrar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default ImportWizard;
