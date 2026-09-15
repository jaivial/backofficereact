import React, { useMemo, useState, useCallback } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Paperclip, PencilLine, FolderOpen, Trash2, ArrowUpDown, ArrowUp, ArrowDown, FileText, SearchX, Plus, X, Eye, Printer, CreditCard, Calendar, AlertTriangle, MessageSquare, Mail, Tag, Combine, Check } from "lucide-react";
import type { Invoice, InvoiceStatus, InvoiceAttachment, PaymentMethod, InvoiceCategory, InvoiceDepositType } from "../../../../api/types";
import type { SortField, SortDirection, InvoiceTableProps } from "../types/table";
import { DEPOSIT_CONFIG } from "../types/table";
import { INVOICE_STATUS_CONFIG, PAYMENT_METHOD_LABELS, CATEGORY_CONFIG, ALL_INVOICE_STATUSES } from "../types/invoice";
import { INVOICE_COLUMNS } from "./invoiceColumns";
import { DropdownMenu } from "../../../../ui/inputs/DropdownMenu";
import { ConfirmDialog } from "../../../../ui/overlays/ConfirmDialog";
import { AttachmentsModal } from "./AttachmentsModal";
import { MergeInvoicesModal } from "./MergeInvoicesModal";
import { formatDate, formatPrice } from "../utils";

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
  return <span data-testid="StatusBadge-span-3" className={`bo-badge ${config.className}`}>{config.label}</span>;
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
    <div data-testid="invoiceTable-tableStatusCell" className="bo-tableStatusCell" data-slot="invoiceTable-tableStatusCell">
      <DropdownMenu
        label={`Cambiar estado de ${invoice.customer_name}`}
        items={statusOptions}
        triggerContent={
          <span data-testid="invoiceTable-span" className={`bo-badge ${currentConfig.className} bo-statusBadge--clickable`} data-slot="invoiceTable-span">
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
    <span data-testid="invoiceTable-span-2" className={`bo-badge ${isReservation ? "bo-badge--info" : "bo-badge--muted"}`} data-slot="invoiceTable-span">
      {isReservation ? "Reserva" : "Sin reserva"}
    </span>
  );
}

function SplitBadge({ isSplitChild, isSplitParent, percentage }: { isSplitChild?: boolean; isSplitParent?: boolean; percentage?: number | null }) {
  if (!isSplitChild && !isSplitParent) return null;

  if (isSplitChild) {
    return (
      <span data-testid="invoiceTable-badge-warning" className="bo-badge bo-badge--warning" title={`Factura分裂 - Porcentaje: ${percentage || 0}%`} data-slot="invoiceTable-badge--warning">
        Factura分裂
      </span>
    );
  }

  return (
    <span data-testid="invoiceTable-badge-info" className="bo-badge bo-badge--info" title="Factura dividida" data-slot="invoiceTable-badge--info">
     分裂 padre
    </span>
  );
}


function CategoryBadge({ category }: { category?: InvoiceCategory }) {
  if (!category) return null;
  const config = CATEGORY_CONFIG[category] || { label: category, className: "bo-badge--muted" };
  return <span data-testid="CategoryBadge-span" className={`bo-badge ${config.className}`}>{config.label}</span>;
}

function CreditNoteBadge({ invoice }: { invoice: Invoice }) {
  if (!invoice.is_credit_note) return null;
  return (
    <div data-testid="invoiceTable-creditNoteBadge" className="bo-creditNoteBadge" data-slot="invoiceTable-creditNoteBadge">
      <span data-testid="invoiceTable-badge-warning-2" className="bo-badge bo-badge--warning" title="Nota de credito" data-slot="invoiceTable-badge--warning">
        Nota de credito
      </span>
      {invoice.original_invoice_number && (
        <span data-testid="invoiceTable-creditNoteRef" className="bo-creditNoteRef" title={`Factura original: ${invoice.original_invoice_number}`} data-slot="invoiceTable-creditNoteRef">
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
    <div data-testid="invoiceTable-depositBadge" className="bo-depositBadge" data-slot="invoiceTable-depositBadge">
      <span data-testid="invoiceTable-span-3" className={`bo-badge ${config.className}`} title={invoice.deposit_type === "advance" ? "Anticipo" : "Seña"} data-slot="invoiceTable-span">
        {config.label}
      </span>
      {invoice.deposit_amount !== undefined && invoice.deposit_amount !== null && (
        <span data-testid="invoiceTable-depositAmount" className="bo-depositAmount" title={`Pagado: ${formatPrice(invoice.deposit_amount, invoice.currency)}`} data-slot="invoiceTable-depositAmount">
          {formatPrice(invoice.deposit_amount, invoice.currency)}
        </span>
      )}
      {invoice.final_invoice_number && (
        <span data-testid="invoiceTable-depositRef" className="bo-depositRef" title={`Factura final: ${invoice.final_invoice_number}`} data-slot="invoiceTable-depositRef">
          Final: {invoice.final_invoice_number}
        </span>
      )}
    </div>
  );
}

function TagsList({ tags }: { tags?: string[] }) {
  if (!tags || tags.length === 0) return null;
  return (
    <div data-testid="invoiceTable-tagsList" className="bo-tagsList" data-slot="invoiceTable-tagsList">
      {tags.slice(0, 3).map((tag, index) => (
        <span data-testid="invoiceTable-tagItem-sm" key={index} className="bo-tagItem bo-tagItem--sm" data-slot="invoiceTable-tagItem--sm">
          <Tag size={10} />
          {tag}
        </span>
      ))}
      {tags.length > 3 && (
        <span data-testid="invoiceTable-tagItem-more" className="bo-tagItem bo-tagItem--sm bo-tagItem--more" data-slot="invoiceTable-tagItem--more">+{tags.length - 3}</span>
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
    <div data-testid="invoiceTable-paymentProgressCell" className="bo-paymentProgressCell" data-slot="invoiceTable-paymentProgressCell">
      <span data-testid="invoiceTable-span-4" className={`bo-paymentProgressText ${isFullyPaid ? "is-paid" : ""}`} data-slot="invoiceTable-span">
        {formatPrice(paidAmount, invoice.currency)} / {formatPrice(totalAmount, invoice.currency)}
      </span>
      <div data-testid="invoiceTable-paymentProgressBar" className="bo-paymentProgressBar" data-slot="invoiceTable-paymentProgressBar">
        <div data-testid="invoice-table-payment-progress-fill"
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

function SortableHeader({ field, label, icon: Icon, currentField, sortDirection, onSort }: { field: SortField; label: string; icon?: React.ComponentType<{ size?: number; className?: string }>; currentField: SortField | null; sortDirection: SortDirection; onSort: (field: SortField) => void }) {
  return (
    <button
      type="button"
      className="bo-tableSortBtn"
      onClick={() => onSort(field)}
      aria-label={`Ordenar por ${label}`}
      aria-sort={currentField === field ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}
      data-testid={`invoice-sort-${field}`}
    >
      {Icon ? <Icon size={14} className="bo-tableColIcon" /> : null}
      {label}
      <SortIcon field={field} currentField={currentField} direction={sortDirection} />
    </button>
  );
}

// Skeleton components for table loading with shimmer effect
function TableSkeletonRow() {
  return (
    <tr data-testid="invoice-table-row" className="bo-tableRow" data-slot="invoice-table-row">
      <td data-testid="invoice-table-cell" data-label="" data-slot="invoice-table-cell">
        <div data-testid="invoiceTable-skeleton-sm" className="bo-skeleton bo-skeleton--sm" style={{ width: "20px" }} data-slot="invoiceTable-skeleton--sm" />
      </td>
      <td data-testid="invoice-table-cell-2" data-label="N. Factura" data-slot="invoice-table-cell">
        <div data-testid="invoiceTable-skeleton-sm-2" className="bo-skeleton bo-skeleton--sm" style={{ width: "60px" }} data-slot="invoiceTable-skeleton--sm" />
      </td>
      <td data-testid="invoice-table-cell-3" data-label="Cliente" data-slot="invoice-table-cell">
        <div data-testid="invoiceTable-tableCustomer" className="bo-tableCustomer" data-slot="invoiceTable-tableCustomer">
          <div data-testid="invoiceTable-skeleton-md" className="bo-skeleton bo-skeleton--md" style={{ width: "120px" }} data-slot="invoiceTable-skeleton--md" />
          <div data-testid="invoiceTable-skeleton-sm-3" className="bo-skeleton bo-skeleton--sm" style={{ width: "80px", marginTop: "4px" }} data-slot="invoiceTable-skeleton--sm" />
        </div>
      </td>
      <td data-testid="invoice-table-cell-4" data-label="Email" data-slot="invoice-table-cell">
        <div data-testid="invoiceTable-skeleton-sm-4" className="bo-skeleton bo-skeleton--sm" style={{ width: "140px" }} data-slot="invoiceTable-skeleton--sm" />
      </td>
      <td data-testid="invoice-table-cell-5" data-label="Importe" data-slot="invoice-table-cell">
        <div data-testid="invoiceTable-skeleton-md-2" className="bo-skeleton bo-skeleton--md" style={{ width: "80px" }} data-slot="invoiceTable-skeleton--md" />
      </td>
      <td data-testid="invoice-table-cell-6" data-label="Moneda" data-slot="invoice-table-cell">
        <div data-testid="invoiceTable-skeleton-sm-5" className="bo-skeleton bo-skeleton--sm" style={{ width: "50px" }} data-slot="invoiceTable-skeleton--sm" />
      </td>
      <td data-testid="invoice-table-cell-7" data-label="Fecha" data-slot="invoice-table-cell">
        <div data-testid="invoiceTable-skeleton-sm-6" className="bo-skeleton bo-skeleton--sm" style={{ width: "70px" }} data-slot="invoiceTable-skeleton--sm" />
      </td>
      <td data-testid="invoice-table-cell-8" data-label="Estado" data-slot="invoice-table-cell">
        <div data-testid="invoiceTable-skeleton-sm-7" className="bo-skeleton bo-skeleton--sm" style={{ width: "60px", height: "22px" }} data-slot="invoiceTable-skeleton--sm" />
      </td>
      <td data-testid="invoice-table-cell-9" data-label="Tipo" data-slot="invoice-table-cell">
        <div data-testid="invoiceTable-skeleton-sm-8" className="bo-skeleton bo-skeleton--sm" style={{ width: "70px", height: "22px" }} data-slot="invoiceTable-skeleton--sm" />
      </td>
      <td data-testid="invoice-table-cell-10" data-label="" data-slot="invoice-table-cell"></td>
      <td data-testid="invoice-table-cell-11" data-label="" data-slot="invoice-table-cell">
        <div data-testid="invoiceTable-tableActions" className="bo-tableActions" data-slot="invoiceTable-tableActions">
          <div data-testid="invoiceTable-skeleton-sm-9" className="bo-skeleton bo-skeleton--sm" style={{ width: "28px", height: "28px" }} data-slot="invoiceTable-skeleton--sm" />
          <div data-testid="invoiceTable-skeleton-sm-10" className="bo-skeleton bo-skeleton--sm" style={{ width: "28px", height: "28px" }} data-slot="invoiceTable-skeleton--sm" />
          <div data-testid="invoiceTable-skeleton-sm-11" className="bo-skeleton bo-skeleton--sm" style={{ width: "28px", height: "28px" }} data-slot="invoiceTable-skeleton--sm" />
        </div>
      </td>
    </tr>
  );
}

function TableSkeleton() {
  return (
    <div data-testid="invoice-table-wrap" className="bo-tableWrap bo-tableWrap--facturas" data-slot="invoice-table-wrap">
      <div data-testid="invoice-table-scroll" className="bo-tableScroll" data-slot="invoice-table-scroll">
        <table data-testid="invoice-table-2" className="bo-table bo-table--facturas" aria-label="Cargando facturas..." data-slot="invoice-table">
          <thead data-testid="invoice-thead" data-slot="invoice-thead">
            <tr data-testid="invoice-table-row-2" data-slot="invoice-table-row">
              <th data-testid="invoice-table-header" className="col-selection" data-slot="invoice-table-header"></th>
              <th data-testid="invoice-table-header-2" className="col-invoice_number" data-slot="invoice-table-header">N. Factura</th>
              <th data-testid="invoice-table-header-3" className="col-customer_name" data-slot="invoice-table-header">Cliente</th>
              <th data-testid="invoice-table-header-4" className="col-customer_email" data-slot="invoice-table-header">Email</th>
              <th data-testid="invoice-table-header-5" className="col-amount" data-slot="invoice-table-header">Importe</th>
              <th data-testid="invoice-table-header-6" className="col-currency" data-slot="invoice-table-header">Moneda</th>
              <th data-testid="invoice-table-header-7" className="col-payment_progress" data-slot="invoice-table-header">Pagado</th>
              <th data-testid="invoice-table-header-8" className="col-invoice_date" data-slot="invoice-table-header">Fecha</th>
              <th data-testid="invoice-table-header-9" className="col-status" data-slot="invoice-table-header">Estado</th>
              <th data-testid="invoice-table-header-10" className="col-is_reservation" data-slot="invoice-table-header">Tipo</th>
              <th data-testid="invoice-table-header-11" className="col-attachment" data-slot="invoice-table-header"></th>
              <th data-testid="invoice-table-header-12" className="col-actions" data-slot="invoice-table-header"></th>
            </tr>
          </thead>
          <tbody data-testid="invoice-tbody" data-slot="invoice-tbody">
            {Array.from({ length: 5 }).map((_, index) => (
              <TableSkeletonRow key={index} />
            ))}
          </tbody>
        </table>
      </div>
      <div data-testid="invoice-pager" className="bo-pager is-solo" data-slot="invoice-pager">
        <div data-testid="invoiceTable-pagerText" className="bo-pagerText" aria-live="polite" data-slot="invoiceTable-pagerText">
          <span data-testid="invoiceTable-skeleton-sm-12" className="bo-skeleton bo-skeleton--sm" style={{ width: "100px", display: "inline-block" }} data-slot="invoiceTable-skeleton--sm" />
          <span data-testid="invoiceTable-srOnly" className="bo-srOnly" data-slot="invoiceTable-srOnly">Cargando...</span>
        </div>
      </div>
    </div>
  );
}

export function InvoiceTable({ invoices, visibleColumns, loading, page, totalPages, total, sortField, sortDirection, onSort, hasFilters, onCreateNew, onEdit, onDuplicate, onSplit, onDelete, onDownloadPdf, onSendEmail, onSendWhatsApp, onPageChange, onStatusChange, onBulkStatusChange, onBulkDelete, onBulkPrint, onBulkMerge, onBulkSendEmail, onPrintAllVisible, onPreview, onViewCustomerHistory, onShowHistory, onViewNotes, onRegisterPayment, onSendReminder, onShowReminderHistory, onManageTemplates, onCreateCreditNote, onRemoveAttachment, onDownloadAllAttachments, onMergeInvoices }: InvoiceTableProps) {
  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkStatusConfirmOpen, setBulkStatusConfirmOpen] = useState(false);
  const [pendingBulkStatus, setPendingBulkStatus] = useState<InvoiceStatus | null>(null);
  const reduceMotion = useReducedMotion();

  // Shared motion for the bulk bars: subtle enter (opacity + small y + blur),
  // softer exit. Coordination id: facturas_bulkbar_motion_v1
  const bulkBarMotion = {
    initial: reduceMotion ? { opacity: 0 } : { opacity: 0, y: -12, filter: "blur(4px)" },
    animate: reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, filter: "blur(0px)" },
    exit: reduceMotion
      ? { opacity: 0, transition: { duration: 0 } }
      : { opacity: 0, y: -12, filter: "blur(4px)", transition: { duration: 0.15, ease: "easeOut" as const } },
    transition: { duration: 0.2, ease: "easeOut" as const },
  };

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

  // Data columns from the single source of truth, filtered by the user's
  // visible-columns preference. selection/attachment/actions are utility
  // columns and always render.
  // Coordination id: facturas_columns_preference_v1
  const visibleSet = useMemo(() => new Set(visibleColumns), [visibleColumns]);
  const dataColumns = useMemo(() => INVOICE_COLUMNS.filter((col) => visibleSet.has(col.id)), [visibleSet]);

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
        <div data-testid="invoiceTable-emptyTable" className="bo-emptyTable" role="status" aria-live="polite" data-slot="invoiceTable-emptyTable">
          <div data-testid="invoiceTable-emptyTableIcon" className="bo-emptyTableIcon" data-slot="invoiceTable-emptyTableIcon">
            <FileText size={24} />
          </div>
          <h3 data-testid="invoiceTable-emptyTitle" className="bo-emptyTitle" data-slot="invoiceTable-emptyTitle">No hay facturas todavia</h3>
          <p data-testid="invoiceTable-emptyDesc" className="bo-emptyDesc" data-slot="invoiceTable-emptyDesc">
            Crea tu primera factura para comenzar a gestionar tus ingresos.
          </p>
          <div data-testid="invoiceTable-emptyActions" className="bo-emptyActions" data-slot="invoiceTable-emptyActions">
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
      <div data-testid="invoiceTable-emptySearch" className="bo-emptySearch" role="status" aria-live="polite" data-slot="invoiceTable-emptySearch">
        <div data-testid="invoiceTable-emptySearchIcon" className="bo-emptySearchIcon" data-slot="invoiceTable-emptySearchIcon">
          <SearchX size={28} />
        </div>
        <h3 data-testid="invoiceTable-emptyTitle-2" className="bo-emptyTitle" data-slot="invoiceTable-emptyTitle">No se encontraron facturas</h3>
        <p data-testid="invoiceTable-emptyDesc-2" className="bo-emptyDesc" data-slot="invoiceTable-emptyDesc">
          No hay resultados para los filtros aplicados. Intenta ajustar los criterios de busqueda o limpiar los filtros.
        </p>
      </div>
    );
  }

  return (
    <div data-testid="invoiceTable-tableWrap" className="bo-tableWrap bo-tableWrap--facturas" data-slot="invoiceTable-tableWrap">
      {/* Bulk Actions Bar — accent-tinted so the toolbar reads as the static
          cue for the selected rows (facturas_bulkbar_motion_v1). */}
      <AnimatePresence initial={false}>
        {someSelected && (
        <motion.div
          key="bulk-selected"
          {...bulkBarMotion}
          data-testid="invoiceTable-bulkBar"
          className="bo-bulkBar bo-bulkBar--selected"
          role="region"
          aria-live="polite"
          data-slot="invoiceTable-bulkBar"
        >
          <div data-testid="invoiceTable-bulkBarContent" className="bo-bulkBarContent" data-slot="invoiceTable-bulkBarContent">
            <div data-testid="invoiceTable-bulkBarInfo" className="bo-bulkBarInfo" data-slot="invoiceTable-bulkBarInfo">
              <span data-testid="invoiceTable-bulkBarIcon" className="bo-bulkBarBadge" aria-hidden="true" data-slot="invoiceTable-bulkBarIcon">
                <Check size={14} strokeWidth={2} />
              </span>
              <span data-testid="invoiceTable-bulkBarCount" className="bo-bulkBarCount" data-slot="invoiceTable-bulkBarCount">{selectedIds.size} elemento{selectedIds.size !== 1 ? "s" : ""} seleccionado{selectedIds.size !== 1 ? "s" : ""}</span>
            </div>
            <div data-testid="invoiceTable-bulkBarActions" className="bo-bulkBarActions" data-slot="invoiceTable-bulkBarActions">
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
              {/* Destructive actions sit apart: a divider keeps the safe and
                  danger clusters optically separated. */}
              <span data-testid="invoiceTable-bulkBarDivider" className="bo-bulkBarDivider" aria-hidden="true" data-slot="invoiceTable-bulkBarDivider" />
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
        </motion.div>
        )}
      </AnimatePresence>
      {/* Print All Visible Bar - shown when there are invoices but nothing is selected */}
      <AnimatePresence initial={false}>
        {!someSelected && invoices.length > 0 && (
        <motion.div
          key="bulk-print"
          {...bulkBarMotion}
          data-testid="invoiceTable-bulkBar-2"
          className="bo-bulkBar"
          role="region"
          aria-live="polite"
          data-slot="invoiceTable-bulkBar"
        >
          <div data-testid="invoiceTable-bulkBarContent-2" className="bo-bulkBarContent" data-slot="invoiceTable-bulkBarContent">
            <div data-testid="invoiceTable-bulkBarInfo-2" className="bo-bulkBarInfo" data-slot="invoiceTable-bulkBarInfo">
              <span data-testid="invoiceTable-bulkBarCount-2" className="bo-bulkBarCount" data-slot="invoiceTable-bulkBarCount">{invoices.length} facturas en esta pagina</span>
            </div>
            <div data-testid="invoiceTable-bulkBarActions-2" className="bo-bulkBarActions" data-slot="invoiceTable-bulkBarActions">
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
        </motion.div>
        )}
      </AnimatePresence>
      <div data-testid="invoice-table-scroll-2" className="bo-tableScroll" data-slot="invoice-table-scroll">
        <table className="bo-table bo-table--facturas" aria-label="Tabla de facturas" data-testid="invoice-table" data-slot="invoice-table">
          <thead data-testid="invoice-thead-2" data-slot="invoice-thead">
            <tr data-testid="invoice-table-row-3" data-slot="invoice-table-row">
              <th data-testid="invoice-table-header-sel" className="col-selection" data-slot="invoice-table-header">
                <label data-testid="invoiceTable-checkboxContainer-header" className="bo-checkboxContainer bo-checkboxContainer--header" data-slot="invoiceTable-checkboxContainer--header">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={handleSelectAll}
                    aria-label={allSelected ? "Deseleccionar todos" : "Seleccionar todos"}
                    data-testid="invoice-select-all-checkbox"
                  />
                  <span data-testid="invoiceTable-checkboxMark" className="bo-checkboxMark" data-slot="invoiceTable-checkboxMark"></span>
                </label>
              </th>
              {dataColumns.map((col) => (
                <th data-testid={`invoice-table-header-${col.id}`} key={col.id} className={`col-${col.id}`} data-slot="invoice-table-header">
                  <SortableHeader
                    field={col.id}
                    label={col.label}
                    icon={col.icon}
                    currentField={sortField}
                    sortDirection={sortDirection}
                    onSort={onSort}
                  />
                </th>
              ))}
              <th data-testid="invoice-table-header-att" className="col-attachment" data-slot="invoice-table-header">
                <span data-testid="invoiceTable-attachmentHeaderLabel" className="bo-srOnly" data-slot="invoiceTable-attachmentHeaderLabel">Adjuntos</span>
              </th>
              <th data-testid="invoice-table-header-act" className="col-actions" data-slot="invoice-table-header">
                <span data-testid="invoiceTable-actionsHeaderLabel" className="bo-srOnly" data-slot="invoiceTable-actionsHeaderLabel">Acciones</span>
              </th>
            </tr>
          </thead>
          <tbody data-testid="invoice-tbody-2" data-slot="invoice-tbody">
            {invoices.map((invoice, idx) => {
              // Calculate overdue status - based on due_date if available, otherwise invoice_date
              const effectiveDueDate = invoice.due_date || invoice.invoice_date;
              const isOverdue = (invoice.status === "pendiente" || invoice.status === "enviada") && !invoice.payment_date && new Date(effectiveDueDate) < new Date(new Date().toDateString());
              const daysOverdue = isOverdue ? getDaysOverdue(effectiveDueDate) : 0;

              return (
              <tr data-testid="InvoiceTable-tr" key={invoice.id} className={`bo-tableRow bo-tableRow--clickable${selectedIds.has(invoice.id) ? " is-selected" : ""}${isOverdue ? " bo-tableRow--overdue" : ""}`} onClick={() => onPreview(invoice)} data-slot={`invoice-table-row-${invoice.id}`}>
                <td data-testid="invoice-table-cell-12" className={`col-selection`} data-label="" onClick={(e) => e.stopPropagation()} data-slot="invoice-table-cell">
                  <label data-testid="invoiceTable-checkboxContainer" className="bo-checkboxContainer" data-slot="invoiceTable-checkboxContainer">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(invoice.id)}
                      onChange={() => handleToggleSelect(invoice.id)}
                      aria-label={`Seleccionar factura ${invoice.invoice_number || invoice.id}`}
                      data-testid={`invoice-select-checkbox-${invoice.id}`}
                    />
                    <span data-testid="invoiceTable-checkboxMark-2" className="bo-checkboxMark" data-slot="invoiceTable-checkboxMark"></span>
                  </label>
                </td>
                {visibleSet.has("invoice_number") && (
                <td data-testid="invoice-table-cell-13" className={`col-invoice_number`} data-label="N. Factura" data-slot="invoice-table-cell">
                  {invoice.invoice_number || "-"}
                </td>
                )}
                {visibleSet.has("customer_name") && (
                <td data-testid="invoice-table-cell-14" className={`col-customer_name`} data-label="Cliente" data-slot="invoice-table-cell">
                  <div data-testid="invoiceTable-tableCustomer-2" className="bo-tableCustomer" data-slot="invoiceTable-tableCustomer">
                    <button
                      type="button"
                      className="bo-tableCustomerName bo-tableCustomerName--link"
                      onClick={(e) => { e.stopPropagation(); onViewCustomerHistory(invoice.customer_name + (invoice.customer_surname ? ` ${invoice.customer_surname}` : ""), invoice.customer_email); }}
                      title="Ver historial del cliente"
                      data-testid={`invoice-view-customer-btn-${invoice.id}`}
                    >
                      {invoice.customer_name}
                    </button>
                    {invoice.customer_surname && (
                      <span data-testid="invoiceTable-tableCustomerSurname" className="bo-tableCustomerSurname" data-slot="invoiceTable-tableCustomerSurname"> {invoice.customer_surname}</span>
                    )}
                  </div>
                </td>
                )}
                {visibleSet.has("customer_email") && (
                <td data-testid="invoice-table-cell-15" className={`col-customer_email`} data-label="Email" data-slot="invoice-table-cell">{invoice.customer_email}</td>
                )}
                {visibleSet.has("amount") && (
                <td data-testid="invoice-table-cell-16" className={`col-amount`} data-label="Importe" data-slot="invoice-table-cell">{formatPrice(invoice.amount, invoice.currency)}</td>
                )}
                {visibleSet.has("currency") && (
                <td data-testid="invoice-table-cell-17" className={`col-currency`} data-label="Moneda" data-slot="invoice-table-cell">
                  <span data-testid="invoiceTable-badge-muted" className="bo-badge bo-badge--muted" data-slot="invoiceTable-badge--muted">{invoice.currency || "EUR"}</span>
                </td>
                )}
                {visibleSet.has("payment_progress") && (
                <td data-testid="invoice-table-cell-18" className={`col-payment_progress`} data-label="Pagado" data-slot="invoice-table-cell">
                  <PaymentProgressCell invoice={invoice} />
                </td>
                )}
                {visibleSet.has("invoice_date") && (
                <td data-testid="invoice-table-cell-19" className={`col-invoice_date`} data-label="Fecha" data-slot="invoice-table-cell">{formatDate(invoice.invoice_date)}</td>
                )}
                {visibleSet.has("due_date") && (
                <td data-testid="invoice-table-cell-20" className={`col-due_date`} data-label="Vencimiento" data-slot="invoice-table-cell">
                  {invoice.due_date ? (
                    <span data-testid="invoice-table-due-date"
                      className={`bo-dueDate ${new Date(invoice.due_date) < new Date(new Date().toDateString()) && (invoice.status === "pendiente" || invoice.status === "enviada") && !invoice.payment_date ? "bo-dueDate--overdue" : ""}`}
                      data-slot="invoice-table-due-date"                      title={isOverdue ? `Vencida hace ${daysOverdue} dias` : "Fecha de vencimiento"}
                    >
                      {formatDate(invoice.due_date)}
                    </span>
                  ) : (
                    <span data-testid="invoiceTable-mutedText" className="bo-mutedText" data-slot="invoiceTable-mutedText">-</span>
                  )}
                </td>
                )}
                {visibleSet.has("payment_date") && (
                <td data-testid="invoice-table-cell-21" className={`col-payment_date`} data-label="F. Pago" data-slot="invoice-table-cell">
                  {invoice.payment_date ? (
                    <span data-testid="invoiceTable-paymentDate" className="bo-paymentDate" title="Fecha de pago" data-slot="invoiceTable-paymentDate">
                      <Calendar size={12} />
                      {formatDate(invoice.payment_date)}
                    </span>
                  ) : isOverdue ? (
                    <span data-testid="invoiceTable-daysOverdue" className="bo-daysOverdue" title={`${daysOverdue} dias de retraso`} data-slot="invoiceTable-daysOverdue">
                      <AlertTriangle size={12} />
                      {daysOverdue} dias
                    </span>
                  ) : (
                    <span data-testid="invoiceTable-mutedText-2" className="bo-mutedText" data-slot="invoiceTable-mutedText">-</span>
                  )}
                </td>
                )}
                {visibleSet.has("payment_method") && (
                <td data-testid="invoice-table-cell-22" className={`col-payment_method`} data-label="Metodo" data-slot="invoice-table-cell">
                  {invoice.payment_method ? (
                    <span data-testid="invoiceTable-paymentMethod" className="bo-paymentMethod" title={PAYMENT_METHOD_LABELS[invoice.payment_method]} data-slot="invoiceTable-paymentMethod">
                      <CreditCard size={12} />
                      {PAYMENT_METHOD_LABELS[invoice.payment_method]}
                    </span>
                  ) : (
                    <span data-testid="invoiceTable-mutedText-3" className="bo-mutedText" data-slot="invoiceTable-mutedText">-</span>
                  )}
                </td>
                )}
                {visibleSet.has("status") && (
                <td data-testid="invoice-table-cell-23" className={`col-status`} data-label="Estado" onClick={(e) => e.stopPropagation()} data-slot="invoice-table-cell">
                  <StatusCell
                    invoice={invoice}
                    onStatusChange={onStatusChange}
                    onStatusChangeConfirm={handleStatusChangeConfirm}
                  />
                </td>
                )}
                {visibleSet.has("is_reservation") && (
                <td data-testid="invoice-table-cell-24" className={`col-is_reservation`} data-label="Tipo" data-slot="invoice-table-cell">
                  <ReservationBadge isReservation={Boolean(invoice.is_reservation)} />
                  <SplitBadge isSplitChild={invoice.is_split_child} isSplitParent={invoice.is_split_parent} percentage={invoice.split_percentage} />
                </td>
                )}
                {visibleSet.has("deposit") && (
                <td data-testid="invoice-table-cell-25" className={`col-deposit`} data-label="Deposito" data-slot="invoice-table-cell">
                  <DepositBadge invoice={invoice} />
                </td>
                )}
                {visibleSet.has("category") && (
                <td data-testid="invoice-table-cell-26" className={`col-category`} data-label="Categoria" data-slot="invoice-table-cell">
                  <CreditNoteBadge invoice={invoice} />
                  <CategoryBadge category={invoice.category} />
                  <TagsList tags={invoice.tags} />
                </td>
                )}
                <td data-testid="invoice-table-cell-27" className={`col-attachment`} data-label="" onClick={(e) => e.stopPropagation()} data-slot="invoice-table-cell">
                  {(invoice.attachments && invoice.attachments.length > 0) || invoice.account_image_url || invoice.internal_notes ? (
                    <div data-testid="invoiceTable-tableAttachmentCell" className="bo-tableAttachmentCell" data-slot="invoiceTable-tableAttachmentCell">
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
                            <span data-testid="invoiceTable-tableAttachmentCount" className="bo-tableAttachmentCount" data-slot="invoiceTable-tableAttachmentCount">{invoice.attachments.length}</span>
                          )}
                        </button>
                      )}
                      {invoice.account_image_url && (
                        <span data-testid="invoiceTable-tableAttachment" className="bo-tableAttachment" title="Imagen adjunta" data-slot="invoiceTable-tableAttachment">
                          <Paperclip size={14} />
                        </span>
                      )}
                      {invoice.internal_notes && (
                        <span data-testid="invoiceTable-tableNotesIndicator" className="bo-tableAttachment bo-tableNotesIndicator" title="Notas internas" data-slot="invoiceTable-tableNotesIndicator">
                          <MessageSquare size={14} />
                        </span>
                      )}
                    </div>
                  ) : null}
                </td>
                <td data-testid="invoice-table-cell-28" className={`col-actions`} data-label="Acciones" onClick={(e) => e.stopPropagation()} data-slot="invoice-table-cell">
                  <div data-testid="invoiceTable-tableActions-2" className="bo-tableActions" data-slot="invoiceTable-tableActions">
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
          <tfoot data-testid="invoice-tfoot" className="bo-tableFooter" data-slot="invoice-tfoot">
            <tr data-testid="invoice-table-row-4" data-slot="invoice-table-row">
              <td data-testid="invoice-table-cell-29" className="col-selection" data-label="" data-slot="invoice-table-cell">
              </td>
              {visibleSet.has("invoice_number") && (
              <td data-testid="invoice-table-cell-30" className="col-invoice_number" data-label="N. Factura" data-slot="invoice-table-cell">
                <strong data-testid="InvoiceTable-strong">Total</strong>
              </td>
              )}
              {visibleSet.has("customer_name") && (
              <td data-testid="invoice-table-cell-31" className="col-customer_name" data-label="Cliente" data-slot="invoice-table-cell">
                {totals.displayedCount} de {total} facturas
              </td>
              )}
              {visibleSet.has("customer_email") && (
              <td data-testid="invoice-table-cell-32" className="col-customer_email" data-label="Email" data-slot="invoice-table-cell"></td>
              )}
              {visibleSet.has("amount") && (
              <td data-testid="invoice-table-cell-33" className="col-amount" data-label="Importe" data-slot="invoice-table-cell">
                <strong data-testid="InvoiceTable-strong-2">{formatPrice(totals.totalAmount)}</strong>
              </td>
              )}
              {visibleSet.has("currency") && (
              <td data-testid="invoice-table-cell-34" className="col-currency" data-label="Moneda" data-slot="invoice-table-cell"></td>
              )}
              {visibleSet.has("payment_progress") && (
              <td data-testid="invoice-table-cell-35" className="col-payment_progress" data-label="Pagado" data-slot="invoice-table-cell"></td>
              )}
              {visibleSet.has("invoice_date") && (
              <td data-testid="invoice-table-cell-36" className="col-invoice_date" data-label="Fecha" data-slot="invoice-table-cell"></td>
              )}
              {visibleSet.has("due_date") && (
              <td data-testid="invoice-table-cell-37" className="col-due_date" data-label="Vencimiento" data-slot="invoice-table-cell"></td>
              )}
              {visibleSet.has("payment_date") && (
              <td data-testid="invoice-table-cell-38" className="col-payment_date" data-label="F. Pago" data-slot="invoice-table-cell"></td>
              )}
              {visibleSet.has("payment_method") && (
              <td data-testid="invoice-table-cell-39" className="col-payment_method" data-label="Metodo" data-slot="invoice-table-cell"></td>
              )}
              {visibleSet.has("status") && (
              <td data-testid="invoice-table-cell-40" className="col-status" data-label="Estado" data-slot="invoice-table-cell"></td>
              )}
              {visibleSet.has("is_reservation") && (
              <td data-testid="invoice-table-cell-41" className="col-is_reservation" data-label="Tipo" data-slot="invoice-table-cell"></td>
              )}
              {visibleSet.has("deposit") && (
              <td data-testid="invoice-table-cell-42" className="col-deposit" data-label="Deposito" data-slot="invoice-table-cell"></td>
              )}
              {visibleSet.has("category") && (
              <td data-testid="invoice-table-cell-43" className="col-category" data-label="Categoria" data-slot="invoice-table-cell"></td>
              )}
              <td data-testid="invoice-table-cell-44" className="col-attachment" data-label="" data-slot="invoice-table-cell"></td>
              <td data-testid="invoice-table-cell-45" className="col-actions" data-label="" data-slot="invoice-table-cell"></td>
            </tr>
          </tfoot>
        </table>
      </div>
      <div data-testid="invoiceTable-paginaci-n" className={`bo-pager${showPagerBtns ? "" : " is-solo"}`} aria-label="Paginación" data-slot="invoiceTable-paginaci-n">
        <div data-testid="invoiceTable-pagerText-2" className="bo-pagerText" data-slot="invoiceTable-pagerText">
          Página {page} de {totalPages} · {total} resultados
        </div>
        {showPagerBtns ? (
          <div data-testid="invoiceTable-pagerBtns" className="bo-pagerBtns" data-slot="invoiceTable-pagerBtns">
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
