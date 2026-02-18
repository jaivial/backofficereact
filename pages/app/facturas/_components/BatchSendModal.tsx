import React, { useCallback, useState, useEffect, useMemo } from "react";
import { X, Send, Loader2, Mail, User, FileText, AlertCircle, CheckCircle, XCircle, RotateCcw, Check } from "lucide-react";
import { Modal } from "../../../../ui/overlays/Modal";
import { useToasts } from "../../../../ui/feedback/useToasts";
import type { Invoice } from "../../../../api/types";
import { createClient } from "../../../../api/client";

interface BatchSendModalProps {
  open: boolean;
  invoices: Invoice[];
  onClose: () => void;
  onSent: (invoices: Invoice[]) => void;
}

// Default subject and message templates
const DEFAULT_SUBJECT = "Factura {invoice_number} - {restaurant_name}";
const DEFAULT_MESSAGE = `Estimado/a {customer_name},

Adjuntamos la factura {invoice_number} por importe de {total}.

Puede ver y descargar su factura en el siguiente enlace:
{invoice_link}

Quedamos a su disposicion para cualquier consulta.

Un saludo,

{restaurant_name}`;

interface SendResult {
  invoiceId: number;
  invoiceNumber: string;
  customerName: string;
  customerEmail: string;
  success: boolean;
  error?: string;
}

type SendStatus = "idle" | "sending" | "completed" | "retrying";

export function BatchSendModal({ open, invoices, onClose, onSent }: BatchSendModalProps) {
  const { pushToast } = useToasts();
  const [status, setStatus] = useState<SendStatus>("idle");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [results, setResults] = useState<SendResult[]>([]);
  const [retryingIds, setRetryingIds] = useState<Set<number>>(new Set());

  // Form fields
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [showPreview, setShowPreview] = useState(false);

  // Filter invoices that have email
  const validInvoices = useMemo(() => {
    return invoices.filter((inv) => inv.customer_email);
  }, [invoices]);

  const invalidInvoices = useMemo(() => {
    return invoices.filter((inv) => !inv.customer_email);
  }, [invoices]);

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setSubject(DEFAULT_SUBJECT);
      setMessage(DEFAULT_MESSAGE);
      setStatus("idle");
      setCurrentIndex(0);
      setResults([]);
      setRetryingIds(new Set());
      setShowPreview(false);
    }
  }, [open]);

  // Generate preview with replaced variables (using first invoice as sample)
  const previewContent = useMemo(() => {
    if (validInvoices.length === 0) return { subject: "", message: "" };

    const sampleInvoice = validInvoices[0];
    const invoiceNumber = sampleInvoice.invoice_number || String(sampleInvoice.id);
    const customerName = `${sampleInvoice.customer_name}${sampleInvoice.customer_surname ? ` ${sampleInvoice.customer_surname}` : ""}`;
    const totalAmount = `${(sampleInvoice.total || sampleInvoice.amount).toFixed(2)} €`;

    const subjectPreview = subject
      .replace(/{invoice_number}/g, invoiceNumber)
      .replace(/{customer_name}/g, customerName)
      .replace(/{total}/g, totalAmount)
      .replace(/{restaurant_name}/g, "Villa Carmen");

    const messagePreview = message
      .replace(/{invoice_number}/g, invoiceNumber)
      .replace(/{customer_name}/g, customerName)
      .replace(/{total}/g, totalAmount)
      .replace(/{restaurant_name}/g, "Villa Carmen")
      .replace(/{invoice_link}/g, "[Ver factura en ligne]");

    return { subject: subjectPreview, message: messagePreview };
  }, [validInvoices, subject, message]);

  // Process sending - sends one invoice at a time
  const processQueue = useCallback(async () => {
    setStatus("sending");
    const api = createClient({ baseUrl: "" });

    const newResults: SendResult[] = [...results];

    for (let i = currentIndex; i < validInvoices.length; i++) {
      const invoice = validInvoices[i];
      setCurrentIndex(i);

      try {
        const res = await api.invoices.sendWithCustomization(invoice.id, {
          subject: previewContent.subject || undefined,
          message: previewContent.message || undefined,
        });

        newResults.push({
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoice_number || String(invoice.id),
          customerName: invoice.customer_name,
          customerEmail: invoice.customer_email || "",
          success: res.success,
          error: res.success ? undefined : res.message,
        });

        setResults([...newResults]);

        // Update invoice status in list if successful
        if (res.success) {
          onSent([invoice]);
        }
      } catch (e) {
        newResults.push({
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoice_number || String(invoice.id),
          customerName: invoice.customer_name,
          customerEmail: invoice.customer_email || "",
          success: false,
          error: e instanceof Error ? e.message : "Error desconocido",
        });
        setResults([...newResults]);
      }
    }

    setStatus("completed");
  }, [validInvoices, currentIndex, results, previewContent, onSent]);

  // Retry failed invoices
  const retryFailed = useCallback(async () => {
    const failedInvoices = results.filter((r) => !r.success && !retryingIds.has(r.invoiceId));
    if (failedInvoices.length === 0) return;

    setStatus("retrying");
    const api = createClient({ baseUrl: "" });

    const newResults = [...results];
    setRetryingIds(new Set(failedInvoices.map((f) => f.invoiceId)));

    for (const failed of failedInvoices) {
      const invoice = validInvoices.find((inv) => inv.id === failed.invoiceId);
      if (!invoice) continue;

      try {
        const res = await api.invoices.sendWithCustomization(invoice.id, {
          subject: previewContent.subject || undefined,
          message: previewContent.message || undefined,
        });

        const resultIndex = newResults.findIndex((r) => r.invoiceId === failed.invoiceId);
        if (resultIndex !== -1) {
          newResults[resultIndex] = {
            ...newResults[resultIndex],
            success: res.success,
            error: res.success ? undefined : res.message,
          };
        }

        setResults([...newResults]);

        if (res.success) {
          onSent([invoice]);
        }
      } catch (e) {
        const resultIndex = newResults.findIndex((r) => r.invoiceId === failed.invoiceId);
        if (resultIndex !== -1) {
          newResults[resultIndex] = {
            ...newResults[resultIndex],
            success: false,
            error: e instanceof Error ? e.message : "Error desconocido",
          };
        }
        setResults([...newResults]);
      }
    }

    setRetryingIds(new Set());
    setStatus("completed");
  }, [results, retryingIds, validInvoices, previewContent, onSent]);

  // Calculate summary
  const summary = useMemo(() => {
    const sent = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;
    const pending = validInvoices.length - results.length;
    return { sent, failed, pending, total: validInvoices.length };
  }, [results, validInvoices]);

  const progress = useMemo(() => {
    if (validInvoices.length === 0) return 0;
    return (results.length / validInvoices.length) * 100;
  }, [results, validInvoices]);

  const handleClose = useCallback(() => {
    if (status !== "sending") {
      onClose();
    }
  }, [status, onClose]);

  if (!open) return null;

  const isProcessing = status === "sending" || status === "retrying";
  const isCompleted = status === "completed";

  return (
    <Modal open={open} onClose={handleClose} title="Enviar facturas por email" widthPx={600}>
      <div className="bo-batchSendModal">
        {/* Warning for invoices without email */}
        {invalidInvoices.length > 0 && (
          <div className="bo-batchSendWarning">
            <AlertCircle size={16} />
            <span>
              {invalidInvoices.length} factura{invalidInvoices.length !== 1 ? "s" : ""} sin email no se
              enviara{invalidInvoices.length !== 1 ? "n" : ""}
            </span>
          </div>
        )}

        {isCompleted ? (
          /* Completion State */
          <div className="bo-batchSendComplete">
            <div className="bo-batchSendSummary">
              <div className="bo-batchSendSummaryItem bo-batchSendSummaryItem--success">
                <CheckCircle size={24} />
                <span className="bo-batchSendSummaryCount">{summary.sent}</span>
                <span className="bo-batchSendSummaryLabel">Enviadas</span>
              </div>
              {summary.failed > 0 && (
                <div className="bo-batchSendSummaryItem bo-batchSendSummaryItem--error">
                  <XCircle size={24} />
                  <span className="bo-batchSendSummaryCount">{summary.failed}</span>
                  <span className="bo-batchSendSummaryLabel">Fallidas</span>
                </div>
              )}
            </div>

            {/* Results List */}
            <div className="bo-batchSendResults">
              <h4>Detalles</h4>
              <div className="bo-batchSendResultsList">
                {results.map((result) => (
                  <div
                    key={result.invoiceId}
                    className={`bo-batchSendResultItem ${result.success ? "is-success" : "is-error"}`}
                  >
                    {result.success ? (
                      <CheckCircle size={16} className="bo-batchSendResultIcon" />
                    ) : (
                      <XCircle size={16} className="bo-batchSendResultIcon" />
                    )}
                    <span className="bo-batchSendResultNumber">{result.invoiceNumber}</span>
                    <span className="bo-batchSendResultCustomer">{result.customerName}</span>
                    <span className="bo-batchSendResultEmail">{result.customerEmail}</span>
                    {!result.success && (
                      <span className="bo-batchSendResultError" title={result.error}>
                        {result.error}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Retry Button */}
            {summary.failed > 0 && (
              <div className="bo-batchSendRetry">
                <button
                  type="button"
                  className="bo-btn bo-btn--primary"
                  onClick={retryFailed}
                  disabled={isProcessing}
                >
                  {isProcessing ? (
                    <>
                      <Loader2 size={16} className="bo-spin" />
                      Reintentando...
                    </>
                  ) : (
                    <>
                      <RotateCcw size={16} />
                      Reintentar envio fallido{summary.failed !== 1 ? "s" : ""}
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Close Button */}
            <div className="bo-batchSendActions">
              <button type="button" className="bo-btn bo-btn--secondary" onClick={onClose}>
                Cerrar
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Progress State */}
            {(isProcessing || results.length > 0) && (
              <div className="bo-batchSendProgress">
                <div className="bo-batchSendProgressHeader">
                  <span>
                    Enviando factura {currentIndex + 1} de {validInvoices.length}...
                  </span>
                  <span className="bo-batchSendProgressPercent">{Math.round(progress)}%</span>
                </div>
                <div className="bo-batchSendProgressBar">
                  <div
                    className="bo-batchSendProgressFill"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                {results.length > 0 && (
                  <div className="bo-batchSendProgressStats">
                    <span className="bo-batchSendProgressStat bo-batchSendProgressStat--success">
                      <Check size={14} /> {summary.sent} enviadas
                    </span>
                    {summary.failed > 0 && (
                      <span className="bo-batchSendProgressStat bo-batchSendProgressStat--error">
                        <X size={14} /> {summary.failed} fallidas
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Configuration Form */}
            {!isProcessing && results.length === 0 && (
              <>
                <div className="bo-batchSendInfo">
                  <Mail size={20} />
                  <div>
                    <strong>{validInvoices.length} facturas</strong> seran enviadas por email
                  </div>
                </div>

                <div className="bo-batchSendForm">
                  <div className="bo-field">
                    <label className="bo-label">Asunto</label>
                    <input
                      className="bo-input"
                      type="text"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      placeholder="Asunto del email"
                    />
                    <span className="bo-fieldHint">
                      Variables: {"{invoice_number}"}, {"{customer_name}"}, {"{total}"}, {"{restaurant_name}"},{" "}
                      {"{invoice_link}"}
                    </span>
                  </div>

                  <div className="bo-field">
                    <div className="bo-fieldHeader">
                      <label className="bo-label">Mensaje</label>
                      <button
                        type="button"
                        className="bo-btn bo-btn--ghost bo-btn--sm"
                        onClick={() => setShowPreview(!showPreview)}
                      >
                        {showPreview ? "Editar" : "Vista previa"}
                      </button>
                    </div>
                    {showPreview ? (
                      <div className="bo-sendEmailPreview">{previewContent.message}</div>
                    ) : (
                      <textarea
                        className="bo-textarea"
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        rows={8}
                        placeholder="Cuerpo del mensaje..."
                      />
                    )}
                  </div>
                </div>
              </>
            )}

            {/* Actions */}
            <div className="bo-batchSendActions">
              <button
                type="button"
                className="bo-btn bo-btn--secondary"
                onClick={handleClose}
                disabled={isProcessing}
              >
                Cancelar
              </button>
              {!isProcessing && results.length === 0 && (
                <button
                  type="button"
                  className="bo-btn bo-btn--primary"
                  onClick={processQueue}
                  disabled={validInvoices.length === 0}
                >
                  <Send size={16} />
                  Enviar {validInvoices.length} factura{validInvoices.length !== 1 ? "s" : ""}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
