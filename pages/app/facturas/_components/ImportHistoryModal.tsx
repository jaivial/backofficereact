import React, { useCallback, useMemo, useState } from "react";
import {
  History,
  X,
  CheckCircle,
  XCircle,
  AlertCircle,
  Trash2,
  FileText,
  Clock,
} from "lucide-react";
import type { ImportResult, ImportHistoryEntry } from "../../../../api/import-types";

type ImportHistoryModalProps = {
  open: boolean;
  onClose: () => void;
};

const STORAGE_KEY = "invoice_import_history";

export function ImportHistoryModal({ open, onClose }: ImportHistoryModalProps) {
  const [history, setHistory] = useState<ImportHistoryEntry[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // Add new entry to history
  const addToHistory = useCallback((result: ImportResult, filename: string) => {
    const newEntry: ImportHistoryEntry = {
      id: Date.now(),
      filename,
      total_rows: result.totalRows,
      success_count: result.successCount,
      error_count: result.errorCount,
      status: result.successCount === result.totalRows ? "completed" : result.successCount > 0 ? "partial" : "failed",
      errors: result.errors.map((e) => ({
        row: e.row,
        field: e.field,
        message: e.message,
        value: e.value,
      })),
      created_at: result.timestamp,
    };

    const updatedHistory = [newEntry, ...history].slice(0, 50); // Keep last 50
    setHistory(updatedHistory);

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedHistory));
    } catch {
      // localStorage not available
    }
  }, [history]);

  // Export the function for external use
  (window as unknown as { addImportToHistory: typeof addToHistory }).addImportToHistory = addToHistory;

  const clearHistory = useCallback(() => {
    setHistory([]);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // localStorage not available
    }
  }, []);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("es-ES", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusIcon = (status: ImportHistoryEntry["status"]) => {
    switch (status) {
      case "completed":
        return <CheckCircle size={16} className="status-completed" />;
      case "partial":
        return <AlertCircle size={16} className="status-partial" />;
      case "failed":
        return <XCircle size={16} className="status-failed" />;
    }
  };

  const getStatusLabel = (status: ImportHistoryEntry["status"]) => {
    switch (status) {
      case "completed":
        return "Completado";
      case "partial":
        return "Parcial";
      case "failed":
        return "Fallido";
    }
  };

  if (!open) return null;

  return (
    <div data-testid="import-history-overlay" className="bo-modal-overlay" onClick={onClose} data-slot="import-history-overlay">
      <div data-testid="import-history-modal" className="bo-modal-content bo-importHistory" onClick={(e) => e.stopPropagation()} data-slot="import-history-modal">
        <div data-testid="import-history-header" className="bo-modal-header" data-slot="import-history-header">
          <div data-testid="importHistoryModal-modal-title" className="bo-modal-title" data-slot="importHistoryModal-modal-title">
            <History size={20} />
            <span data-testid="importHistoryModal-nes" data-slot="importHistoryModal-nes">Historial de importaciones</span>
          </div>
          <button className="bo-btn bo-btn--ghost bo-btn--sm" onClick={onClose} aria-label="Cerrar" data-testid="import-history-close-btn">
            <X size={18} />
          </button>
        </div>

        <div data-testid="import-history-body" className="bo-modal-body" data-slot="import-history-body">
          {history.length === 0 ? (
            <div data-testid="import-history-empty" className="bo-importHistoryEmpty" data-slot="import-history-empty">
              <FileText size={48} />
              <p data-testid="importHistoryModal-ias" data-slot="importHistoryModal-ias">No hay importaciones previas</p>
              <span data-testid="importHistoryModal-qui" data-slot="importHistoryModal-qui">El historial de importaciones aparecera aqui</span>
            </div>
          ) : (
            <div data-testid="import-history-list" className="bo-importHistoryList" data-slot="import-history-list">
              {history.map((entry) => (
                <div data-testid="import-history-item" key={entry.id} className="bo-importHistoryItem" data-slot="import-history-item">
                  <div data-testid="import-history-item-header" className="bo-importHistoryItemHeader" data-slot="import-history-item-header">
                    <div data-testid="importHistoryModal-importHistoryItemFile" className="bo-importHistoryItemFile" data-slot="importHistoryModal-importHistoryItemFile">
                      <FileText size={16} />
                      <span data-testid="importHistoryModal-importHistoryItemFilename" className="bo-importHistoryItemFilename" data-slot="importHistoryModal-importHistoryItemFilename">{entry.filename}</span>
                    </div>
                    <div data-testid="importHistoryModal-div" className={`bo-importHistoryItemStatus ${entry.status}`} data-slot="importHistoryModal-div">
                      {getStatusIcon(entry.status)}
                      <span data-testid="importHistoryModal-tus" data-slot="importHistoryModal-tus">{getStatusLabel(entry.status)}</span>
                    </div>
                  </div>

                  <div data-testid="import-history-item-meta" className="bo-importHistoryItemMeta" data-slot="import-history-item-meta">
                    <span data-testid="importHistoryModal-importHistoryItemDate" className="bo-importHistoryItemDate" data-slot="importHistoryModal-importHistoryItemDate">
                      <Clock size={12} />
                      {formatDate(entry.created_at)}
                    </span>
                    <span data-testid="importHistoryModal-importHistoryItemStats" className="bo-importHistoryItemStats" data-slot="importHistoryModal-importHistoryItemStats">
                      {entry.success_count > 0 && (
                        <span data-testid="importHistoryModal-success" className="stat success" data-slot="importHistoryModal-success">{entry.success_count} ok</span>
                      )}
                      {entry.error_count > 0 && (
                        <span data-testid="importHistoryModal-error" className="stat error" data-slot="importHistoryModal-error">{entry.error_count} errores</span>
                      )}
                      <span data-testid="importHistoryModal-total" className="stat total" data-slot="importHistoryModal-total">{entry.total_rows} total</span>
                    </span>
                  </div>

                  {entry.errors.length > 0 && (
                    <div data-testid="import-history-item-errors" className="bo-importHistoryItemErrors" data-slot="import-history-item-errors">
                      <details>
                        <summary>
                          Ver errores ({entry.errors.length})
                        </summary>
                        <div data-testid="import-history-item-errors-list" className="bo-importHistoryItemErrorsList" data-slot="import-history-item-errors-list">
                          {entry.errors.slice(0, 10).map((err, i) => (
                            <div data-testid="importHistoryModal-importHistoryErrorItem" key={i} className="bo-importHistoryErrorItem" data-slot="importHistoryModal-importHistoryErrorItem">
                              Fila {err.row}: {err.message}
                            </div>
                          ))}
                          {entry.errors.length > 10 && (
                            <div data-testid="importHistoryModal-more" className="bo-importHistoryErrorItem more" data-slot="importHistoryModal-more">
                              ...y {entry.errors.length - 10} errores mas
                            </div>
                          )}
                        </div>
                      </details>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {history.length > 0 && (
          <div data-testid="import-history-footer" className="bo-modal-footer" data-slot="import-history-footer">
            <button className="bo-btn bo-btn--ghost" onClick={clearHistory} data-testid="import-history-clear-btn">
              <Trash2 size={16} />
              Limpiar historial
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default ImportHistoryModal;
