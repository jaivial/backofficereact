import React, { useMemo, useState, useCallback } from "react";
import { Paperclip, PencilLine, FolderOpen, Trash2, ArrowUpDown, ArrowUp, ArrowDown, FileText, SearchX, Plus, X, Eye, Printer, CreditCard, Calendar, AlertTriangle, MessageSquare, Mail, Tag, Combine } from "lucide-react";
import type { Invoice, InvoiceStatus, InvoiceAttachment, PaymentMethod, CurrencyCode, InvoiceCategory, InvoiceDepositType } from "../../../../api/types";
import { CURRENCY_SYMBOLS } from "../../../../api/types";
import type { SortField, SortDirection, InvoiceTableProps } from "../types/table";
import { DEPOSIT_CONFIG } from "../types/table";
import { INVOICE_STATUS_CONFIG, PAYMENT_METHOD_LABELS, CATEGORY_CONFIG, ALL_INVOICE_STATUSES } from "../types/invoice";
import { DropdownMenu } from "../../../../ui/inputs/DropdownMenu";
import { ConfirmDialog } from "../../../../ui/overlays/ConfirmDialog";
import { AttachmentsModal } from "./AttachmentsModal";
import { MergeInvoicesModal } from "./MergeInvoicesModal";

function formatPrice(price: number, currency: CurrencyCode = "EUR"): string {
  const symbol = CURRENCY_SYMBOLS[currency] || "€";
  return `${symbol}${price.toFixed(2)}`;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// Calculate days overdue for an invoice
function getDaysOverdue(invoiceDate: string): number {
  const invoiceDateObj = new Date(invoiceDate);
  const today = new Date();
  const diffTime = today.getTime() - invoiceDateObj.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}


function StatusBadge({ status }: { status: InvoiceStatus }) {
  const config = INVOICE_STATUS_CONFIG[status] || { label: status, className: "" };
  return <span className={`bo-badge ${config.className}`}>{config.label}</span>;
}

function StatusCell({ invoice, onStatusChange, onStatusChangeConfirm }: {
  invoice: Invoice;
  onStatusChange: (invoice: Invoice, newStatus: InvoiceStatus) => void;
  onStatusChangeConfirm: (invoice: Invoice, newStatus: InvoiceStatus) => void;
}) {
  const currentConfig = INVOICE_STATUS_CONFIG[invoice.status] || { label: invoice.status, className: "" };

  const statusOptions = ALL_INVOICE_STATUSES.map((status) => ({
    id: status,
    label: INVOICE_STATUS_CONFIG[status].label,
    tone: "default" as const,
    onSelect: () => {
      if (status !== invoice.status) {
        onStatusChangeConfirm(invoice, status);
      }
    },
  }));

  return (
    <div className="bo-tableStatusCell" data-slot="invoiceTable-tableStatusCell">
      <DropdownMenu
        label={`Cambiar estado de ${invoice.customer_name}`}
        items={statusOptions}
        triggerContent={
          <span className={`bo-badge ${currentConfig.className} bo-statusBadge--clickable`} data-slot="invoiceTable-span">
            {currentConfig.label}
          </span>
        }
        triggerClassName="bo-statusTrigger"
      />
    </div>
  );
}

function ReservationBadge({ isReservation }: { isReservation: boolean }) {
  return (
    <span className={`bo-badge ${isReservation ? "bo-badge--info" : "bo-badge--muted"}`} data-slot="invoiceTable-span">
      {isReservation ? "Reserva" : "Sin reserva"}
    </span>
  );
}

function SplitBadge({ isSplitChild, isSplitParent, percentage }: { isSplitChild?: boolean; isSplitParent?: boolean; percentage?: number | null }) {
  if (!isSplitChild && !isSplitParent) return null;

  if (isSplitChild) {
    return (
      <span className="bo-badge bo-badge--warning" title={`Factura分裂 - Porcentaje: ${percentage || 0}%`} data-slot="invoiceTable-badge--warning">
        Factura分裂
      </span>
    );
  }

  return (
    <span className="bo-badge bo-badge--info" title="Factura dividida" data-slot="invoiceTable-badge--info">
     分裂 padre
    </span>
  );
}


function CategoryBadge({ category }: { category?: InvoiceCategory }) {
  if (!category) return null;
  const config = CATEGORY_CONFIG[category] || { label: category, className: "bo-badge--muted" };
  return <span className={`bo-badge ${config.className}`}>{config.label}</span>;
}

function CreditNoteBadge({ invoice }: { invoice: Invoice }) {
  if (!invoice.is_credit_note) return null;
  return (
    <div className="bo-creditNoteBadge" data-slot="invoiceTable-creditNoteBadge">
      <span className="bo-badge bo-badge--warning" title="Nota de credito" data-slot="invoiceTable-badge--warning">
        Nota de credito
      </span>
      {invoice.original_invoice_number && (
        <span className="bo-creditNoteRef" title={`Factura original: ${invoice.original_invoice_number}`} data-slot="invoiceTable-creditNoteRef">
          de {invoice.original_invoice_number}
        </span>
      )}
    </div>
  );
}

function DepositBadge({ invoice }: { invoice: Invoice }) {
  if (!invoice.deposit_type) return null;
  const config = DEPOSIT_CONFIG[invoice.deposit_type] || { label: invoice.deposit_type, className: "bo-badge--muted" };
  const remainingBalance = invoice.remaining_balance ?? ((invoice.total ?? invoice.amount) - (invoice.deposit_amount ?? 0));
  const isPaidOff = remainingBalance <= 0;

  return (
    <div className="bo-depositBadge" data-slot="invoiceTable-depositBadge">
      <span className={`bo-badge ${config.className}`} title={invoice.deposit_type === "advance" ? "Anticipo" : "Seña"} data-slot="invoiceTable-span">
        {config.label}
      </span>
      {invoice.deposit_amount !== undefined && invoice.deposit_amount !== null && (
        <span className="bo-depositAmount" title={`Pagado: ${formatPrice(invoice.deposit_amount, invoice.currency)}`} data-slot="invoiceTable-depositAmount">
          {formatPrice(invoice.deposit_amount, invoice.currency)}
        </span>
      )}
      {invoice.final_invoice_number && (
        <span className="bo-depositRef" title={`Factura final: ${invoice.final_invoice_number}`} data-slot="invoiceTable-depositRef">
          Final: {invoice.final_invoice_number}
        </span>
      )}
    </div>
  );
}

function TagsList({ tags }: { tags?: string[] }) {
  if (!tags || tags.length === 0) return null;
  return (
    <div className="bo-tagsList" data-slot="invoiceTable-tagsList">
      {tags.slice(0, 3).map((tag, index) => (
        <span key={index} className="bo-tagItem bo-tagItem--sm" data-slot="invoiceTable-tagItem--sm">
          <Tag size={10} />
          {tag}
        </span>
      ))}
      {tags.length > 3 && (
        <span className="bo-tagItem bo-tagItem--sm bo-tagItem--more" data-slot="invoiceTable-tagItem--more">+{tags.length - 3}</span>
      )}
    </div>
  );
}

function PaymentProgressCell({ invoice }: { invoice: Invoice }) {
  const totalAmount = invoice.total || invoice.amount;
  const paidAmount = invoice.paid_amount || 0;
  const remaining = totalAmount - paidAmount;
  const percentPaid = totalAmount > 0 ? (paidAmount / totalAmount) * 100 : 0;
  const isFullyPaid = remaining <= 0;

  return (
    <div className="bo-paymentProgressCell" data-slot="invoiceTable-paymentProgressCell">
      <span className={`bo-paymentProgressText ${isFullyPaid ? "is-paid" : ""}`} data-slot="invoiceTable-span">
        {formatPrice(paidAmount, invoice.currency)} / {formatPrice(totalAmount, invoice.currency)}
      </span>
      <div className="bo-paymentProgressBar" data-slot="invoiceTable-paymentProgressBar">
        <div
          className={`bo-paymentProgressFill ${isFullyPaid ? "is-complete" : ""}`}
          style={{ width: `${Math.min(percentPaid, 100)}%` }}
          data-slot="invoice-table-payment-progress-fill"
        />
      </div>
    </div>
  );
}

function SortIcon({ field, currentField, direction }: { field: SortField; currentField: SortField | null; direction: SortDirection }) {
  if (currentField !== field) {
    return <ArrowUpDown size={14} className="bo-tableSortIcon bo-tableSortIcon--inactive" />;
  }
  if (direction === "asc") {
    return <ArrowUp size={14} className="bo-tableSortIcon bo-tableSortIcon--active" />;
  }
  return <ArrowDown size={14} className="bo-tableSortIcon bo-tableSortIcon--active" />;
}

function SortableHeader({ field, label, currentField, sortDirection, onSort }: { field: SortField; label: string; currentField: SortField | null; sortDirection: SortDirection; onSort: (field: SortField) => void }) {
  return (
    <button
      type="button"
      className="bo-tableSortBtn"
      onClick={() => onSort(field)}
      aria-label={`Ordenar por ${label}`}
      aria-sort={currentField === field ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}
      data-testid={`invoice-sort-${field}`}
    >
      {label}
      <SortIcon field={field} currentField={currentField} direction={sortDirection} />
    </button>
  );
}

// Skeleton components for table loading with shimmer effect
function TableSkeletonRow() {
  return (
    <tr className="bo-tableRow" data-slot="invoice-table-row">
      <td data-label="" data-slot="invoice-table-cell">
        <div className="bo-skeleton bo-skeleton--sm" style={{ width: "20px" }} data-slot="invoiceTable-skeleton--sm" />
      </td>
      <td data-label="N. Factura" data-slot="invoice-table-cell">
        <div className="bo-skeleton bo-skeleton--sm" style={{ width: "60px" }} data-slot="invoiceTable-skeleton--sm" />
      </td>
      <td data-label="Cliente" data-slot="invoice-table-cell">
        <div className="bo-tableCustomer" data-slot="invoiceTable-tableCustomer">
          <div className="bo-skeleton bo-skeleton--md" style={{ width: "120px" }} data-slot="invoiceTable-skeleton--md" />
          <div className="bo-skeleton bo-skeleton--sm" style={{ width: "80px", marginTop: "4px" }} data-slot="invoiceTable-skeleton--sm" />
        </div>
      </td>
      <td data-label="Email" data-slot="invoice-table-cell">
        <div className="bo-skeleton bo-skeleton--sm" style={{ width: "140px" }} data-slot="invoiceTable-skeleton--sm" />
      </td>
      <td data-label="Importe" data-slot="invoice-table-cell">
        <div className="bo-skeleton bo-skeleton--md" style={{ width: "80px" }} data-slot="invoiceTable-skeleton--md" />
      </td>
      <td data-label="Moneda" data-slot="invoice-table-cell">
        <div className="bo-skeleton bo-skeleton--sm" style={{ width: "50px" }} data-slot="invoiceTable-skeleton--sm" />
      </td>
      <td data-label="Fecha" data-slot="invoice-table-cell">
        <div className="bo-skeleton bo-skeleton--sm" style={{ width: "70px" }} data-slot="invoiceTable-skeleton--sm" />
      </td>
      <td data-label="Estado" data-slot="invoice-table-cell">
        <div className="bo-skeleton bo-skeleton--sm" style={{ width: "60px", height: "22px" }} data-slot="invoiceTable-skeleton--sm" />
      </td>
      <td data-label="Tipo" data-slot="invoice-table-cell">
        <div className="bo-skeleton bo-skeleton--sm" style={{ width: "70px", height: "22px" }} data-slot="invoiceTable-skeleton--sm" />
      </td>
      <td data-label="" data-slot="invoice-table-cell"></td>
      <td data-label="" data-slot="invoice-table-cell">
        <div className="bo-tableActions" data-slot="invoiceTable-tableActions">
          <div className="bo-skeleton bo-skeleton--sm" style={{ width: "28px", height: "28px" }} data-slot="invoiceTable-skeleton--sm" />
          <div className="bo-skeleton bo-skeleton--sm" style={{ width: "28px", height: "28px" }} data-slot="invoiceTable-skeleton--sm" />
          <div className="bo-skeleton bo-skeleton--sm" style={{ width: "28px", height: "28px" }} data-slot="invoiceTable-skeleton--sm" />
        </div>
      </td>
    </tr>
  );
}

function TableSkeleton() {
  return (
    <div className="bo-tableWrap" data-slot="invoice-table-wrap">
      <div className="bo-tableScroll" data-slot="invoice-table-scroll">
        <table className="bo-table bo-table--facturas" aria-label="Cargando facturas..." data-slot="invoice-table">
          <thead data-slot="invoice-thead">
            <tr data-slot="invoice-table-row">
              <th className="col-selection" data-slot="invoice-table-header"></th>
              <th className="col-invoice_number" data-slot="invoice-table-header">N. Factura</th>
              <th className="col-customer_name" data-slot="invoice-table-header">Cliente</th>
              <th className="col-customer_email" data-slot="invoice-table-header">Email</th>
              <th className="col-amount" data-slot="invoice-table-header">Importe</th>
              <th className="col-currency" data-slot="invoice-table-header">Moneda</th>
              <th className="col-payment_progress" data-slot="invoice-table-header">Pagado</th>
              <th className="col-invoice_date" data-slot="invoice-table-header">Fecha</th>
              <th className="col-status" data-slot="invoice-table-header">Estado</th>
              <th className="col-is_reservation" data-slot="invoice-table-header">Tipo</th>
              <th className="col-attachment" data-slot="invoice-table-header"></th>
              <th className="col-actions" data-slot="invoice-table-header"></th>
            </tr>
          </thead>
          <tbody data-slot="invoice-tbody">
            {Array.from({ length: 5 }).map((_, index) => (
              <TableSkeletonRow key={index} />
            ))}
          </tbody>
        </table>
      </div>
      <div className="bo-pager is-solo" data-slot="invoice-pager">
        <div className="bo-pagerText" aria-live="polite" data-slot="invoiceTable-pagerText">
          <span className="bo-skeleton bo-skeleton--sm" style={{ width: "100px", display: "inline-block" }} data-slot="invoiceTable-skeleton--sm" />
          <span className="bo-srOnly" data-slot="invoiceTable-srOnly">Cargando...</span>
        </div>
      </div>
    </div>
  );
}

export function InvoiceTable({ invoices, loading, page, totalPages, total, sortField, sortDirection, onSort, hasFilters, onCreateNew, onEdit, onDuplicate, onSplit, onDelete, onDownloadPdf, onSendEmail, onSendWhatsApp, onPageChange, onStatusChange, onBulkStatusChange, onBulkDelete, onBulkPrint, onBulkMerge, onBulkSendEmail, onPrintAllVisible, onPreview, onViewCustomerHistory, onShowHistory, onViewNotes, onRegisterPayment, onSendReminder, onShowReminderHistory, onManageTemplates, onCreateCreditNote, onRemoveAttachment, onDownloadAllAttachments, onMergeInvoices }: InvoiceTableProps) {
  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkStatusConfirmOpen, setBulkStatusConfirmOpen] = useState(false);
  const [pendingBulkStatus, setPendingBulkStatus] = useState<InvoiceStatus | null>(null);

  // State for status change confirmation
  const [statusConfirmOpen, setStatusConfirmOpen] = useState(false);
  const [pendingStatusInvoice, setPendingStatusInvoice] = useState<Invoice | null>(null);
  const [pendingNewStatus, setPendingNewStatus] = useState<InvoiceStatus | null>(null);

  // Bulk delete confirmation state
  const [bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen] = useState(false);

  // Merge modal state
  const [mergeModalOpen, setMergeModalOpen] = useState(false);
  const [invoicesToMerge, setInvoicesToMerge] = useState<Invoice[]>([]);

  // Attachments modal state
  const [attachmentsModalOpen, setAttachmentsModalOpen] = useState(false);
  const [selectedInvoiceAttachments, setSelectedInvoiceAttachments] = useState<InvoiceAttachment[]>([]);
  const [selectedInvoiceNumber, setSelectedInvoiceNumber] = useState<string | undefined>(undefined);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<number | undefined>(undefined);
  const [removingAttachment, setRemovingAttachment] = useState(false);

  // Handle open attachments modal
  const handleOpenAttachments = useCallback((invoice: Invoice) => {
    setSelectedInvoiceAttachments(invoice.attachments || []);
    setSelectedInvoiceNumber(invoice.invoice_number);
    setSelectedInvoiceId(invoice.id);
    setAttachmentsModalOpen(true);
  }, []);

  // Handle remove attachment
  const handleRemoveAttachment = useCallback(async (attachmentId: number) => {
    if (!onRemoveAttachment || selectedInvoiceId === undefined) return;
    setRemovingAttachment(true);
    try {
      await onRemoveAttachment(selectedInvoiceId, attachmentId);
      setSelectedInvoiceAttachments(prev => prev.filter(a => a.id !== attachmentId));
    } finally {
      setRemovingAttachment(false);
    }
  }, [onRemoveAttachment, selectedInvoiceId]);

  // Handle download all attachments
  const handleDownloadAllAttachmentsCallback = useCallback(async () => {
    if (onDownloadAllAttachments) {
      await onDownloadAllAttachments(selectedInvoiceAttachments);
    } else {
      for (const attachment of selectedInvoiceAttachments) {
        window.open(attachment.url, "_blank");
      }
    }
  }, [onDownloadAllAttachments, selectedInvoiceAttachments]);

  // Handle close attachments modal
  const handleCloseAttachments = useCallback(() => {
    setAttachmentsModalOpen(false);
    setSelectedInvoiceAttachments([]);
    setSelectedInvoiceNumber(undefined);
    setSelectedInvoiceId(undefined);
  }, []);

  // Handle individual checkbox toggle
  const handleToggleSelect = useCallback((id: number) => {
    setSelectedIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  }, []);

  // Handle select all toggle
  const handleSelectAll = useCallback(() => {
    if (selectedIds.size === invoices.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(invoices.map((inv) => inv.id)));
    }
  }, [invoices, selectedIds]);

  // Handle bulk status change request
  const handleBulkStatusChangeRequest = useCallback((newStatus: InvoiceStatus) => {
    const hasEnviadaSelected = invoices
      .filter((inv) => selectedIds.has(inv.id))
      .some((inv) => inv.status === "enviada");

    // If any selected invoice has "enviada" status and we're changing to a different status, show confirmation
    if (hasEnviadaSelected && newStatus !== "enviada") {
      setPendingBulkStatus(newStatus);
      setBulkStatusConfirmOpen(true);
    } else {
      const selectedInvoices = invoices.filter((inv) => selectedIds.has(inv.id));
      onBulkStatusChange(selectedInvoices, newStatus);
      setSelectedIds(new Set());
    }
  }, [invoices, selectedIds, onBulkStatusChange]);

  const handleConfirmBulkStatusChange = useCallback(() => {
    if (pendingBulkStatus) {
      const selectedInvoices = invoices.filter((inv) => selectedIds.has(inv.id));
      onBulkStatusChange(selectedInvoices, pendingBulkStatus);
      setSelectedIds(new Set());
    }
    setBulkStatusConfirmOpen(false);
    setPendingBulkStatus(null);
  }, [invoices, selectedIds, pendingBulkStatus, onBulkStatusChange]);

  const handleCancelBulkStatusChange = useCallback(() => {
    setBulkStatusConfirmOpen(false);
    setPendingBulkStatus(null);
  }, []);

  // Handle bulk delete request
  const handleBulkDeleteRequest = useCallback(() => {
    setBulkDeleteConfirmOpen(true);
  }, []);

  const handleConfirmBulkDelete = useCallback(() => {
    const selectedInvoices = invoices.filter((inv) => selectedIds.has(inv.id));
    onBulkDelete(selectedInvoices);
    setSelectedIds(new Set());
    setBulkDeleteConfirmOpen(false);
  }, [invoices, selectedIds, onBulkDelete]);

  const handleCancelBulkDelete = useCallback(() => {
    setBulkDeleteConfirmOpen(false);
  }, []);

  // Handle bulk merge - open merge modal
  const handleBulkMergeRequest = useCallback((invoicesToMergeParam: Invoice[]) => {
    setInvoicesToMerge(invoicesToMergeParam);
    setMergeModalOpen(true);
  }, []);

  // Clear selection
  const handleClearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  // Check if all items on current page are selected
  const allSelected = invoices.length > 0 && selectedIds.size === invoices.length;
  const someSelected = selectedIds.size > 0;

  // Handle status change request - shows confirmation for irreversible changes
  const handleStatusChangeConfirm = (invoice: Invoice, newStatus: InvoiceStatus) => {
    // "enviada" is considered irreversible - going back from "enviada" to other states needs confirmation
    if (invoice.status === "enviada" && newStatus !== "enviada") {
      setPendingStatusInvoice(invoice);
      setPendingNewStatus(newStatus);
      setStatusConfirmOpen(true);
    } else {
      onStatusChange(invoice, newStatus);
    }
  };

  const handleConfirmStatusChange = () => {
    if (pendingStatusInvoice && pendingNewStatus) {
      onStatusChange(pendingStatusInvoice, pendingNewStatus);
    }
    setStatusConfirmOpen(false);
    setPendingStatusInvoice(null);
    setPendingNewStatus(null);
  };

  const handleCancelStatusChange = () => {
    setStatusConfirmOpen(false);
    setPendingStatusInvoice(null);
    setPendingNewStatus(null);
  };

  const columns = useMemo(
    () => [
      { key: "selection", label: "", visible: true, priority: 0, sortable: false },
      { key: "invoice_number", label: "N. Factura", visible: true, priority: 1, sortable: false },
      { key: "customer_name", label: "Cliente", visible: true, priority: 1, sortable: false },
      { key: "customer_email", label: "Email", visible: true, priority: 2, sortable: false },
      { key: "amount", label: "Importe", visible: true, priority: 1, sortable: true, sortField: "amount" as SortField },
      { key: "currency", label: "Moneda", visible: true, priority: 2, sortable: false },
      { key: "payment_progress", label: "Pagado", visible: true, priority: 1, sortable: false },
      { key: "invoice_date", label: "Fecha", visible: true, priority: 1, sortable: true, sortField: "invoice_date" as SortField },
      { key: "due_date", label: "Vencimiento", visible: true, priority: 2, sortable: false },
      { key: "payment_date", label: "F. Pago", visible: true, priority: 2, sortable: false },
      { key: "payment_method", label: "Metodo", visible: true, priority: 2, sortable: false },
      { key: "status", label: "Estado", visible: true, priority: 1, sortable: false },
      { key: "is_reservation", label: "Tipo", visible: true, priority: 2, sortable: false },
      { key: "deposit", label: "Deposito", visible: true, priority: 2, sortable: false },
      { key: "attachment", label: "", visible: true, priority: 3, sortable: false },
      { key: "actions", label: "", visible: true, priority: 3, sortable: false },
    ],
    [],
  );

  const showPagerBtns = totalPages > 1;

  // Calculate totals for the footer
  const totals = useMemo(() => {
    const displayedCount = invoices.length;
    const totalAmount = invoices.reduce((sum, invoice) => sum + invoice.amount, 0);
    return { displayedCount, totalAmount };
  }, [invoices]);

  // Status options for bulk status change dropdown
  const bulkStatusOptions = ALL_INVOICE_STATUSES.map((status) => ({
    id: status,
    label: INVOICE_STATUS_CONFIG[status].label,
    tone: "default" as const,
    onSelect: () => handleBulkStatusChangeRequest(status),
  }));

  if (loading) {
    return <TableSkeleton />;
  }

  if (!invoices.length) {
    // Check if this is the first time (no invoices at all) or filtered results
    const isFirstTime = total === 0 && !hasFilters;

    if (isFirstTime) {
      // Empty state for no invoices at all
      return (
        <div className="bo-emptyTable" role="status" aria-live="polite" data-slot="invoiceTable-emptyTable">
          <div className="bo-emptyTableIcon" data-slot="invoiceTable-emptyTableIcon">
            <FileText size={24} />
          </div>
          <h3 className="bo-emptyTitle" data-slot="invoiceTable-emptyTitle">No hay facturas todavia</h3>
          <p className="bo-emptyDesc" data-slot="invoiceTable-emptyDesc">
            Crea tu primera factura para comenzar a gestionar tus ingresos.
          </p>
          <div className="bo-emptyActions" data-slot="invoiceTable-emptyActions">
            <button
              className="bo-btn bo-btn--primary bo-btn--sm"
              type="button"
              onClick={onCreateNew}
              data-testid="invoice-create-btn"
            >
              <Plus size={16} />
              Crear primera factura
            </button>
          </div>
        </div>
      );
    }

    // Empty state for no search results
    return (
      <div className="bo-emptySearch" role="status" aria-live="polite" data-slot="invoiceTable-emptySearch">
        <div className="bo-emptySearchIcon" data-slot="invoiceTable-emptySearchIcon">
          <SearchX size={28} />
        </div>
        <h3 className="bo-emptyTitle" data-slot="invoiceTable-emptyTitle">No se encontraron facturas</h3>
        <p className="bo-emptyDesc" data-slot="invoiceTable-emptyDesc">
          No hay resultados para los filtros aplicados. Intenta ajustar los criterios de busqueda o limpiar los filtros.
        </p>
      </div>
    );
  }

  return (
    <div className="bo-tableWrap" data-slot="invoiceTable-tableWrap">
      {/* Bulk Actions Bar */}
      {someSelected && (
        <div className="bo-bulkBar" role="region" aria-live="polite" data-slot="invoiceTable-bulkBar">
          <div className="bo-bulkBarContent" data-slot="invoiceTable-bulkBarContent">
            <div className="bo-bulkBarInfo" data-slot="invoiceTable-bulkBarInfo">
              <span className="bo-bulkBarCount" data-slot="invoiceTable-bulkBarCount">{selectedIds.size} elemento{selectedIds.size !== 1 ? "s" : ""} seleccionado{selectedIds.size !== 1 ? "s" : ""}</span>
            </div>
            <div className="bo-bulkBarActions" data-slot="invoiceTable-bulkBarActions">
              <button
                className="bo-btn bo-btn--primary bo-btn--sm"
                type="button"
                onClick={() => {
                  const selectedInvoices = invoices.filter((inv) => selectedIds.has(inv.id));
                  onBulkPrint(selectedInvoices);
                }}
                data-testid="invoice-bulk-print-btn"
              >
                <Printer size={16} />
                Imprimir
              </button>
              <button
                className="bo-btn bo-btn--primary bo-btn--sm"
                type="button"
                onClick={() => {
                  const selectedInvoices = invoices.filter((inv) => selectedIds.has(inv.id));
                  onBulkSendEmail(selectedInvoices);
                }}
                data-testid="invoice-bulk-email-btn"
              >
                <Mail size={16} />
                Enviar todas
              </button>
              <DropdownMenu
                label="Cambiar estado"
                items={bulkStatusOptions}
                triggerContent={
                  <button className="bo-btn bo-btn--secondary bo-btn--sm" type="button" data-testid="invoice-bulk-status-btn">
                    Cambiar estado
                  </button>
                }
                triggerClassName="bo-bulkAction"
              />
              <button
                className="bo-btn bo-btn--secondary bo-btn--sm"
                type="button"
                onClick={() => {
                  const selectedInvoices = invoices.filter((inv) => selectedIds.has(inv.id));
                  handleBulkMergeRequest(selectedInvoices);
                }}
                data-testid="invoice-bulk-merge-btn"
              >
                <Combine size={16} />
                Fusionar
              </button>
              <button
                className="bo-btn bo-btn--danger bo-btn--sm"
                type="button"
                onClick={handleBulkDeleteRequest}
                data-testid="invoice-bulk-delete-btn"
              >
                Eliminar
              </button>
              <button
                className="bo-btn bo-btn--ghost bo-btn--sm"
                type="button"
                onClick={handleClearSelection}
                aria-label="Limpiar selección"
                data-testid="invoice-clear-selection-btn"
              >
                <X size={16} />
                Limpiar
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Print All Visible Bar - shown when there are invoices but nothing is selected */}
      {!someSelected && invoices.length > 0 && (
        <div className="bo-bulkBar" role="region" aria-live="polite" data-slot="invoiceTable-bulkBar">
          <div className="bo-bulkBarContent" data-slot="invoiceTable-bulkBarContent">
            <div className="bo-bulkBarInfo" data-slot="invoiceTable-bulkBarInfo">
              <span className="bo-bulkBarCount" data-slot="invoiceTable-bulkBarCount">{invoices.length} facturas en esta pagina</span>
            </div>
            <div className="bo-bulkBarActions" data-slot="invoiceTable-bulkBarActions">
              <button
                className="bo-btn bo-btn--primary bo-btn--sm"
                type="button"
                onClick={onPrintAllVisible}
                data-testid="invoice-print-all-visible-btn"
              >
                <Printer size={16} />
                Imprimir todas las visibles
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="bo-tableScroll" data-slot="invoice-table-scroll">
        <table className="bo-table bo-table--facturas" aria-label="Tabla de facturas" data-testid="invoice-table" data-slot="invoice-table">
          <thead data-slot="invoice-thead">
            <tr data-slot="invoice-table-row">
              {columns.map((col) => (
                <th key={col.key} className={`col-${col.key}`} data-slot="invoice-table-header">
                  {col.key === "selection" ? (
                    <label className="bo-checkboxContainer bo-checkboxContainer--header" data-slot="invoiceTable-checkboxContainer--header">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={handleSelectAll}
                        aria-label={allSelected ? "Deseleccionar todos" : "Seleccionar todos"}
                        data-testid="invoice-select-all-checkbox"
                      />
                      <span className="bo-checkboxMark" data-slot="invoiceTable-checkboxMark"></span>
                    </label>
                  ) : "sortField" in col && col.sortable ? (
                    <SortableHeader
                      field={col.sortField as SortField}
                      label={col.label}
                      currentField={sortField}
                      sortDirection={sortDirection}
                      onSort={onSort}
                    />
                  ) : (
                    col.label
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody data-slot="invoice-tbody">
            {invoices.map((invoice, idx) => {
              // Calculate overdue status - based on due_date if available, otherwise invoice_date
              const effectiveDueDate = invoice.due_date || invoice.invoice_date;
              const isOverdue = (invoice.status === "pendiente" || invoice.status === "enviada") && !invoice.payment_date && new Date(effectiveDueDate) < new Date(new Date().toDateString());
              const daysOverdue = isOverdue ? getDaysOverdue(effectiveDueDate) : 0;

              return (
              <tr key={invoice.id} className={`bo-tableRow${selectedIds.has(invoice.id) ? " is-selected" : ""}${isOverdue ? " bo-tableRow--overdue" : ""}`} data-slot={`invoice-table-row-${invoice.id}`}>
                <td className={`col-selection`} data-label="" data-slot="invoice-table-cell">
                  <label className="bo-checkboxContainer" data-slot="invoiceTable-checkboxContainer">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(invoice.id)}
                      onChange={() => handleToggleSelect(invoice.id)}
                      aria-label={`Seleccionar factura ${invoice.invoice_number || invoice.id}`}
                      data-testid={`invoice-select-checkbox-${invoice.id}`}
                    />
                    <span className="bo-checkboxMark" data-slot="invoiceTable-checkboxMark"></span>
                  </label>
                </td>
                <td className={`col-invoice_number`} data-label="N. Factura" data-slot="invoice-table-cell">
                  {invoice.invoice_number || "-"}
                </td>
                <td className={`col-customer_name`} data-label="Cliente" data-slot="invoice-table-cell">
                  <div className="bo-tableCustomer" data-slot="invoiceTable-tableCustomer">
                    <button
                      type="button"
                      className="bo-tableCustomerName bo-tableCustomerName--link"
                      onClick={() => onViewCustomerHistory(invoice.customer_name + (invoice.customer_surname ? ` ${invoice.customer_surname}` : ""), invoice.customer_email)}
                      title="Ver historial del cliente"
                      data-testid={`invoice-view-customer-btn-${invoice.id}`}
                    >
                      {invoice.customer_name}
                    </button>
                    {invoice.customer_surname && (
                      <span className="bo-tableCustomerSurname" data-slot="invoiceTable-tableCustomerSurname"> {invoice.customer_surname}</span>
                    )}
                  </div>
                </td>
                <td className={`col-customer_email`} data-label="Email" data-slot="invoice-table-cell">{invoice.customer_email}</td>
                <td className={`col-amount`} data-label="Importe" data-slot="invoice-table-cell">{formatPrice(invoice.amount, invoice.currency)}</td>
                <td className={`col-currency`} data-label="Moneda" data-slot="invoice-table-cell">
                  <span className="bo-badge bo-badge--muted" data-slot="invoiceTable-badge--muted">{invoice.currency || "EUR"}</span>
                </td>
                <td className={`col-payment_progress`} data-label="Pagado" data-slot="invoice-table-cell">
                  <PaymentProgressCell invoice={invoice} />
                </td>
                <td className={`col-invoice_date`} data-label="Fecha" data-slot="invoice-table-cell">{formatDate(invoice.invoice_date)}</td>
                <td className={`col-due_date`} data-label="Vencimiento" data-slot="invoice-table-cell">
                  {invoice.due_date ? (
                    <span
                      className={`bo-dueDate ${new Date(invoice.due_date) < new Date(new Date().toDateString()) && (invoice.status === "pendiente" || invoice.status === "enviada") && !invoice.payment_date ? "bo-dueDate--overdue" : ""}`}
                      data-slot="invoice-table-due-date"                      title={isOverdue ? `Vencida hace ${daysOverdue} dias` : "Fecha de vencimiento"}
                    >
                      {formatDate(invoice.due_date)}
                    </span>
                  ) : (
                    <span className="bo-mutedText" data-slot="invoiceTable-mutedText">-</span>
                  )}
                </td>
                <td className={`col-payment_date`} data-label="F. Pago" data-slot="invoice-table-cell">
                  {invoice.payment_date ? (
                    <span className="bo-paymentDate" title="Fecha de pago" data-slot="invoiceTable-paymentDate">
                      <Calendar size={12} />
                      {formatDate(invoice.payment_date)}
                    </span>
                  ) : isOverdue ? (
                    <span className="bo-daysOverdue" title={`${daysOverdue} dias de retraso`} data-slot="invoiceTable-daysOverdue">
                      <AlertTriangle size={12} />
                      {daysOverdue} dias
                    </span>
                  ) : (
                    <span className="bo-mutedText" data-slot="invoiceTable-mutedText">-</span>
                  )}
                </td>
                <td className={`col-payment_method`} data-label="Metodo" data-slot="invoice-table-cell">
                  {invoice.payment_method ? (
                    <span className="bo-paymentMethod" title={PAYMENT_METHOD_LABELS[invoice.payment_method]} data-slot="invoiceTable-paymentMethod">
                      <CreditCard size={12} />
                      {PAYMENT_METHOD_LABELS[invoice.payment_method]}
                    </span>
                  ) : (
                    <span className="bo-mutedText" data-slot="invoiceTable-mutedText">-</span>
                  )}
                </td>
                <td className={`col-status`} data-label="Estado" data-slot="invoice-table-cell">
                  <StatusCell
                    invoice={invoice}
                    onStatusChange={onStatusChange}
                    onStatusChangeConfirm={handleStatusChangeConfirm}
                  />
                </td>
                <td className={`col-is_reservation`} data-label="Tipo" data-slot="invoice-table-cell">
                  <ReservationBadge isReservation={Boolean(invoice.is_reservation)} />
                  <SplitBadge isSplitChild={invoice.is_split_child} isSplitParent={invoice.is_split_parent} percentage={invoice.split_percentage} />
                </td>
                <td className={`col-deposit`} data-label="Deposito" data-slot="invoice-table-cell">
                  <DepositBadge invoice={invoice} />
                </td>
                <td className={`col-category`} data-label="Categoria" data-slot="invoice-table-cell">
                  <CreditNoteBadge invoice={invoice} />
                  <CategoryBadge category={invoice.category} />
                  <TagsList tags={invoice.tags} />
                </td>
                <td className={`col-attachment`} data-label="" data-slot="invoice-table-cell">
                  {(invoice.attachments && invoice.attachments.length > 0) || invoice.account_image_url || invoice.internal_notes ? (
                    <div className="bo-tableAttachmentCell" data-slot="invoiceTable-tableAttachmentCell">
                      {invoice.attachments && invoice.attachments.length > 0 && (
                        <button
                          className="bo-btn bo-btn--ghost bo-btn--sm bo-btn--attachment"
                          type="button"
                          onClick={() => handleOpenAttachments(invoice)}
                          title={`Ver adjuntos (${invoice.attachments.length})`}
                          aria-label={`Ver ${invoice.attachments.length} adjuntos`}
                          data-testid={`invoice-view-attachments-btn-${invoice.id}`}
                        >
                          <FolderOpen size={14} />
                          {invoice.attachments.length > 1 && (
                            <span className="bo-tableAttachmentCount" data-slot="invoiceTable-tableAttachmentCount">{invoice.attachments.length}</span>
                          )}
                        </button>
                      )}
                      {invoice.account_image_url && (
                        <span className="bo-tableAttachment" title="Imagen adjunta" data-slot="invoiceTable-tableAttachment">
                          <Paperclip size={14} />
                        </span>
                      )}
                      {invoice.internal_notes && (
                        <span className="bo-tableAttachment bo-tableNotesIndicator" title="Notas internas" data-slot="invoiceTable-tableNotesIndicator">
                          <MessageSquare size={14} />
                        </span>
                      )}
                    </div>
                  ) : null}
                </td>
                <td className={`col-actions`} data-slot="invoice-table-cell">
                  <div className="bo-tableActions" data-slot="invoiceTable-tableActions">
                    <DropdownMenu
                      label={`Acciones de factura ${invoice.invoice_number || invoice.id}`}
                      menuMinWidthPx={200}
                      menuClassName="bo-panel bo-invoiceFilters bo-menu--panel"
                      items={[
                        {
                          id: "view",
                          label: "Ver detalles",
                          icon: <Eye size={16} />,
                          onSelect: () => onPreview(invoice),
                        },
                        {
                          id: "edit",
                          label: "Editar",
                          icon: <PencilLine size={16} />,
                          onSelect: () => onEdit(invoice),
                        },
                        {
                          id: "register-payment",
                          label: "Registrar pago",
                          icon: <CreditCard size={16} />,
                          onSelect: () => onRegisterPayment(invoice),
                        },
                        ...(invoice.customer_email
                          ? [{
                              id: "send-email",
                              label: invoice.status === "enviada" ? "Reenviar email" : "Enviar email",
                              icon: <Mail size={16} />,
                              onSelect: () => onSendEmail(invoice),
                            }]
                          : []),
                        {
                          id: "delete",
                          label: "Borrar",
                          icon: <Trash2 size={16} />,
                          tone: "danger" as const,
                          onSelect: () => onDelete(invoice),
                        },
                      ]}
                    />
                  </div>
                </td>
              </tr>
              );
            })}
          </tbody>
          <tfoot className="bo-tableFooter" data-slot="invoice-tfoot">
            <tr data-slot="invoice-table-row">
              <td className="col-selection" data-label="" data-slot="invoice-table-cell">
              </td>
              <td className="col-invoice_number" data-label="N. Factura" data-slot="invoice-table-cell">
                <strong>Total</strong>
              </td>
              <td className="col-customer_name" data-label="Cliente" data-slot="invoice-table-cell">
                {totals.displayedCount} de {total} facturas
              </td>
              <td className="col-customer_email" data-label="Email" data-slot="invoice-table-cell"></td>
              <td className="col-amount" data-label="Importe" data-slot="invoice-table-cell">
                <strong>{formatPrice(totals.totalAmount)}</strong>
              </td>
              <td className="col-currency" data-label="Moneda" data-slot="invoice-table-cell"></td>
              <td className="col-payment_progress" data-label="Pagado" data-slot="invoice-table-cell"></td>
              <td className="col-invoice_date" data-label="Fecha" data-slot="invoice-table-cell"></td>
              <td className="col-due_date" data-label="Vencimiento" data-slot="invoice-table-cell"></td>
              <td className="col-payment_date" data-label="F. Pago" data-slot="invoice-table-cell"></td>
              <td className="col-payment_method" data-label="Metodo" data-slot="invoice-table-cell"></td>
              <td className="col-status" data-label="Estado" data-slot="invoice-table-cell"></td>
              <td className="col-is_reservation" data-label="Tipo" data-slot="invoice-table-cell"></td>
              <td className="col-deposit" data-label="Deposito" data-slot="invoice-table-cell"></td>
              <td className="col-attachment" data-label="" data-slot="invoice-table-cell"></td>
              <td className="col-actions" data-label="" data-slot="invoice-table-cell"></td>
            </tr>
          </tfoot>
        </table>
      </div>
      <div className={`bo-pager${showPagerBtns ? "" : " is-solo"}`} aria-label="Paginación" data-slot="invoiceTable-paginaci-n">
        <div className="bo-pagerText" data-slot="invoiceTable-pagerText">
          Página {page} de {totalPages} · {total} resultados
        </div>
        {showPagerBtns ? (
          <div className="bo-pagerBtns" data-slot="invoiceTable-pagerBtns">
            <button className="bo-btn bo-btn--ghost" type="button" onClick={() => onPageChange(page - 1)} disabled={loading || page <= 1} data-testid="invoice-pagination-prev">
              Anterior
            </button>
            <button className="bo-btn bo-btn--ghost" type="button" onClick={() => onPageChange(page + 1)} disabled={loading || page >= totalPages} data-testid="invoice-pagination-next">
              Siguiente
            </button>
          </div>
        ) : null}
      </div>

      {/* Status Change Confirmation Dialog */}
      <ConfirmDialog
        open={statusConfirmOpen}
        title="Cambiar estado"
        message={`¿Estás seguro de que quieres cambiar el estado de "${pendingStatusInvoice?.customer_name}" de "Enviada" a "${pendingNewStatus ? INVOICE_STATUS_CONFIG[pendingNewStatus].label : ''}"? Esta acción podría afectar el seguimiento de la factura.`}
        confirmText="Cambiar"
        cancelText="Cancelar"
        danger
        onClose={handleCancelStatusChange}
        onConfirm={handleConfirmStatusChange}
      />

      {/* Bulk Status Change Confirmation Dialog */}
      <ConfirmDialog
        open={bulkStatusConfirmOpen}
        title="Cambiar estado"
        message={`¿Estás seguro de que quieres cambiar el estado de ${selectedIds.size} facturas de "Enviada" a "${pendingBulkStatus ? INVOICE_STATUS_CONFIG[pendingBulkStatus].label : ''}"? Esta acción podría afectar el seguimiento de las facturas.`}
        confirmText="Cambiar"
        cancelText="Cancelar"
        danger
        onClose={handleCancelBulkStatusChange}
        onConfirm={handleConfirmBulkStatusChange}
      />

      {/* Bulk Delete Confirmation Dialog */}
      <ConfirmDialog
        open={bulkDeleteConfirmOpen}
        title="Eliminar facturas"
        message={`¿Estás seguro de que quieres eliminar ${selectedIds.size} facturas? Esta acción no se puede deshacer.`}
        confirmText="Eliminar"
        cancelText="Cancelar"
        danger
        onClose={handleCancelBulkDelete}
        onConfirm={handleConfirmBulkDelete}
      />

      {/* Attachments Modal */}
      <AttachmentsModal
        open={attachmentsModalOpen}
        onClose={handleCloseAttachments}
        attachments={selectedInvoiceAttachments}
        invoiceNumber={selectedInvoiceNumber}
        onRemoveAttachment={onRemoveAttachment ? handleRemoveAttachment : undefined}
        onDownloadAll={handleDownloadAllAttachmentsCallback}
        isRemoving={removingAttachment}
      />

      {/* Merge Invoices Modal */}
      <MergeInvoicesModal
        open={mergeModalOpen}
        invoices={invoicesToMerge}
        onClose={() => setMergeModalOpen(false)}
        onMerge={async (input) => {
          if (onMergeInvoices) {
            await onMergeInvoices(input);
            setSelectedIds(new Set());
            setMergeModalOpen(false);
          }
        }}
      />
    </div>
  );
}
