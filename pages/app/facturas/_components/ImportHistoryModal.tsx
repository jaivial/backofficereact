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
import type { ImportResult, ImportHistoryEntry } from "../../../api/import-types";

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
    <div className="bo-modal-overlay" onClick={onClose}>
      <div className="bo-modal-content bo-importHistory" onClick={(e) => e.stopPropagation()}>
        <div className="bo-modal-header">
          <div className="bo-modal-title">
            <History size={20} />
            <span>Historial de importaciones</span>
          </div>
          <button className="bo-btn bo-btn--ghost bo-btn--sm" onClick={onClose} aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>

        <div className="bo-modal-body">
          {history.length === 0 ? (
            <div className="bo-importHistoryEmpty">
              <FileText size={48} />
              <p>No hay importaciones previas</p>
              <span>El historial de importaciones aparecera aqui</span>
            </div>
          ) : (
            <div className="bo-importHistoryList">
              {history.map((entry) => (
                <div key={entry.id} className="bo-importHistoryItem">
                  <div className="bo-importHistoryItemHeader">
                    <div className="bo-importHistoryItemFile">
                      <FileText size={16} />
                      <span className="bo-importHistoryItemFilename">{entry.filename}</span>
                    </div>
                    <div className={`bo-importHistoryItemStatus ${entry.status}`}>
                      {getStatusIcon(entry.status)}
                      <span>{getStatusLabel(entry.status)}</span>
                    </div>
                  </div>

                  <div className="bo-importHistoryItemMeta">
                    <span className="bo-importHistoryItemDate">
                      <Clock size={12} />
                      {formatDate(entry.created_at)}
                    </span>
                    <span className="bo-importHistoryItemStats">
                      {entry.success_count > 0 && (
                        <span className="stat success">{entry.success_count} ok</span>
                      )}
                      {entry.error_count > 0 && (
                        <span className="stat error">{entry.error_count} errores</span>
                      )}
                      <span className="stat total">{entry.total_rows} total</span>
                    </span>
                  </div>

                  {entry.errors.length > 0 && (
                    <div className="bo-importHistoryItemErrors">
                      <details>
                        <summary>
                          Ver errores ({entry.errors.length})
                        </summary>
                        <div className="bo-importHistoryItemErrorsList">
                          {entry.errors.slice(0, 10).map((err, i) => (
                            <div key={i} className="bo-importHistoryErrorItem">
                              Fila {err.row}: {err.message}
                            </div>
                          ))}
                          {entry.errors.length > 10 && (
                            <div className="bo-importHistoryErrorItem more">
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
          <div className="bo-modal-footer">
            <button className="bo-btn bo-btn--ghost" onClick={clearHistory}>
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
