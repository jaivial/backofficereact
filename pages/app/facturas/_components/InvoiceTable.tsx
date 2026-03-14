import React, { useMemo, useState, useCallback } from "react";
import { Copy, Paperclip, PencilLine, FolderOpen, Trash2, FileDown, ArrowUpDown, ArrowUp, ArrowDown, FileText, SearchX, Plus, Check, X, Eye, History, Printer, CreditCard, Calendar, AlertTriangle, Bell, BellOff, MessageSquare, Mail, Tag, Combine, Scissors, Receipt, MessageCircle } from "lucide-react";
import type { Invoice, InvoiceStatus, InvoiceAttachment, PaymentMethod, CurrencyCode, InvoiceCategory, InvoiceDepositType } from "../../../../api/types";
import { CURRENCY_SYMBOLS, INVOICE_CATEGORY_OPTIONS, INVOICE_DEPOSIT_TYPE_OPTIONS } from "../../../../api/types";
import { DropdownMenu } from "../../../../ui/inputs/DropdownMenu";
import { ConfirmDialog } from "../../../../ui/overlays/ConfirmDialog";
import { AttachmentsModal } from "./AttachmentsModal";
import { MergeInvoicesModal } from "./MergeInvoicesModal";

type SortField = "amount" | "invoice_date";
type SortDirection = "asc" | "desc";

type InvoiceTableProps = {
  invoices: Invoice[];
  loading: boolean;
  page: number;
  totalPages: number;
  total: number;
  sortField: SortField | null;
  sortDirection: SortDirection;
  onSort: (field: SortField) => void;
  hasFilters: boolean;
  onCreateNew: () => void;
  onEdit: (invoice: Invoice) => void;
  onDuplicate: (invoice: Invoice) => void;
  onSplit: (invoice: Invoice) => void;
  onDelete: (invoice: Invoice) => void;
  onDownloadPdf: (invoice: Invoice) => void;
  onSendEmail: (invoice: Invoice) => void;
  onSendWhatsApp: (invoice: Invoice) => void;
  onPageChange: (page: number) => void;
  onStatusChange: (invoice: Invoice, newStatus: InvoiceStatus) => void;
  onBulkStatusChange: (invoices: Invoice[], newStatus: InvoiceStatus) => void;
  onBulkDelete: (invoices: Invoice[]) => void;
  onBulkPrint: (invoices: Invoice[]) => void;
  onBulkMerge: (invoices: Invoice[]) => void;
  onBulkSendEmail: (invoices: Invoice[]) => void;
  onPrintAllVisible: () => void;
  onPreview: (invoice: Invoice) => void;
  onViewCustomerHistory: (customerName: string, customerEmail: string) => void;
  onShowHistory: (invoice: Invoice) => void;
  onViewNotes: (invoice: Invoice) => void;
  onRegisterPayment: (invoice: Invoice) => void;
  onSendReminder: (invoice: Invoice) => void;
  onShowReminderHistory: (invoice: Invoice) => void;
  onManageTemplates: () => void;
  onCreateCreditNote?: (invoice: Invoice) => void;
  onRemoveAttachment?: (invoiceId: number, attachmentId: number) => Promise<void>;
  onDownloadAllAttachments?: (attachments: InvoiceAttachment[]) => Promise<void>;
  onMergeInvoices?: (input: { invoice_ids: number[]; delete_originals: boolean }) => Promise<void>;
};

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

// Payment method labels
const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  efectivo: "Efectivo",
  tarjeta: "Tarjeta",
  transferencia: "Transferencia",
  bizum: "Bizum",
  cheque: "Cheque",
};

const INVOICE_STATUS_CONFIG: Record<InvoiceStatus, { label: string; style: React.CSSProperties }> = {
  borrador: { label: "Borrador", style: { backgroundColor: "color-mix(in srgb, var(--bo-faint) 20%, transparent)", color: "var(--bo-muted)" } },
  solicitada: { label: "Solicitada", style: { backgroundColor: "color-mix(in srgb, var(--bo-color-warning) 20%, transparent)", color: "var(--bo-color-warning)" } },
  pendiente: { label: "Pendiente", style: { backgroundColor: "color-mix(in srgb, var(--bo-color-info) 20%, transparent)", color: "var(--bo-color-info)" } },
  enviada: { label: "Enviada", style: { backgroundColor: "color-mix(in srgb, var(--bo-color-success) 20%, transparent)", color: "var(--bo-color-success)" } },
  pagada: { label: "Pagada", style: { backgroundColor: "color-mix(in srgb, var(--bo-color-success) 20%, transparent)", color: "var(--bo-color-success)" } },
};

const ALL_STATUSES: InvoiceStatus[] = ["borrador", "solicitada", "pendiente", "enviada", "pagada"];

function StatusBadge({ status }: { status: InvoiceStatus }) {
  const config = INVOICE_STATUS_CONFIG[status] || { label: status, style: {} };
  return <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium" style={config.style}>{config.label}</span>;
}

function StatusCell({ invoice, onStatusChange, onStatusChangeConfirm }: {
  invoice: Invoice;
  onStatusChange: (invoice: Invoice, newStatus: InvoiceStatus) => void;
  onStatusChangeConfirm: (invoice: Invoice, newStatus: InvoiceStatus) => void;
}) {
  const currentConfig = INVOICE_STATUS_CONFIG[invoice.status] || { label: invoice.status, style: {} };

  const statusOptions = ALL_STATUSES.map((status) => ({
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
    <div className="bo-flex bo-items-center">
      <DropdownMenu
        label={`Cambiar estado de ${invoice.customer_name}`}
        items={statusOptions}
        triggerContent={
          <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium cursor-pointer hover:opacity-80" style={currentConfig.style}>
            {currentConfig.label}
          </span>
        }
        triggerClassName="cursor-pointer"
      />
    </div>
  );
}

function ReservationBadge({ isReservation }: { isReservation: boolean }) {
  return (
    <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium" style={isReservation ? { backgroundColor: "color-mix(in srgb, var(--bo-color-info) 20%, transparent)", color: "var(--bo-color-info)" } : { backgroundColor: "color-mix(in srgb, var(--bo-faint) 20%, transparent)", color: "var(--bo-muted)" }}>
      {isReservation ? "Reserva" : "Sin reserva"}
    </span>
  );
}

function SplitBadge({ isSplitChild, isSplitParent, percentage }: { isSplitChild?: boolean; isSplitParent?: boolean; percentage?: number | null }) {
  if (!isSplitChild && !isSplitParent) return null;

  if (isSplitChild) {
    return (
      <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium" style={{ backgroundColor: "color-mix(in srgb, var(--bo-color-warning) 20%, transparent)", color: "var(--bo-color-warning)" }} title={`Factura分裂 - Porcentaje: ${percentage || 0}%`}>
        Factura分裂
      </span>
    );
  }

  return (
    <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium" style={{ backgroundColor: "color-mix(in srgb, var(--bo-color-info) 20%, transparent)", color: "var(--bo-color-info)" }} title="Factura dividida">
     分裂 padre
    </span>
  );
}

const CATEGORY_CONFIG: Record<InvoiceCategory, { label: string; style: React.CSSProperties }> = {
  reserva: { label: "Reserva", style: { backgroundColor: "color-mix(in srgb, var(--bo-color-info) 20%, transparent)", color: "var(--bo-color-info)" } },
  productos: { label: "Productos", style: { backgroundColor: "color-mix(in srgb, var(--bo-color-success) 20%, transparent)", color: "var(--bo-color-success)" } },
  servicios: { label: "Servicios", style: { backgroundColor: "color-mix(in srgb, var(--bo-color-warning) 20%, transparent)", color: "var(--bo-color-warning)" } },
  otros: { label: "Otros", style: { backgroundColor: "color-mix(in srgb, var(--bo-faint) 20%, transparent)", color: "var(--bo-muted)" } },
  nota_credito: { label: "Nota de credito", style: { backgroundColor: "color-mix(in srgb, var(--bo-color-warning) 20%, transparent)", color: "var(--bo-color-warning)" } },
};

function CategoryBadge({ category }: { category?: InvoiceCategory }) {
  if (!category) return null;
  const config = CATEGORY_CONFIG[category] || { label: category, style: {} };
  return <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium" style={config.style}>{config.label}</span>;
}

function CreditNoteBadge({ invoice }: { invoice: Invoice }) {
  if (!invoice.is_credit_note) return null;
  return (
    <div className="bo-flex bo-flex-col bo-gap-1">
      <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium" style={{ backgroundColor: "color-mix(in srgb, var(--bo-color-warning) 20%, transparent)", color: "var(--bo-color-warning)" }} title="Nota de credito">
        Nota de credito
      </span>
      {invoice.original_invoice_number && (
        <span className="text-xs text-muted-foreground" title={`Factura original: ${invoice.original_invoice_number}`}>
          de {invoice.original_invoice_number}
        </span>
      )}
    </div>
  );
}

const DEPOSIT_CONFIG: Record<InvoiceDepositType, { label: string; style: React.CSSProperties }> = {
  advance: { label: "Anticipo", style: { backgroundColor: "color-mix(in srgb, var(--bo-color-info) 20%, transparent)", color: "var(--bo-color-info)" } },
  deposit: { label: "Seña", style: { backgroundColor: "color-mix(in srgb, var(--bo-color-warning) 20%, transparent)", color: "var(--bo-color-warning)" } },
};

function DepositBadge({ invoice }: { invoice: Invoice }) {
  if (!invoice.deposit_type) return null;
  const config = DEPOSIT_CONFIG[invoice.deposit_type] || { label: invoice.deposit_type, style: {} };
  const remainingBalance = invoice.remaining_balance ?? ((invoice.total ?? invoice.amount) - (invoice.deposit_amount ?? 0));
  const isPaidOff = remainingBalance <= 0;

  return (
    <div className="bo-flex bo-flex-col bo-gap-1">
      <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium" style={config.style} title={invoice.deposit_type === "advance" ? "Anticipo" : "Seña"}>
        {config.label}
      </span>
      {invoice.deposit_amount !== undefined && invoice.deposit_amount !== null && (
        <span className="text-xs text-muted-foreground" title={`Pagado: ${formatPrice(invoice.deposit_amount, invoice.currency)}`}>
          {formatPrice(invoice.deposit_amount, invoice.currency)}
        </span>
      )}
      {invoice.final_invoice_number && (
        <span className="text-xs text-muted-foreground" title={`Factura final: ${invoice.final_invoice_number}`}>
          Final: {invoice.final_invoice_number}
        </span>
      )}
    </div>
  );
}

function TagsList({ tags }: { tags?: string[] }) {
  if (!tags || tags.length === 0) return null;
  return (
    <div className="bo-flex bo-flex-wrap bo-gap-1">
      {tags.slice(0, 3).map((tag, index) => (
        <span key={index} className="inline-flex items-center gap-1 rounded bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">
          <Tag size={10} />
          {tag}
        </span>
      ))}
      {tags.length > 3 && (
        <span className="inline-flex items-center rounded bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">+{tags.length - 3}</span>
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
    <div className="bo-flex bo-flex-col bo-gap-1">
      <span className={`text-xs ${isFullyPaid ? "" : ""}`} style={isFullyPaid ? { color: "var(--bo-color-success)" } : {}}>
        {formatPrice(paidAmount, invoice.currency)} / {formatPrice(totalAmount, invoice.currency)}
      </span>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
        <div
          className="h-full transition-all duration-300"
          style={{ width: `${Math.min(percentPaid, 100)}%`, backgroundColor: isFullyPaid ? "var(--bo-color-success)" : "var(--bo-accent)" }}
        />
      </div>
    </div>
  );
}

function SortIcon({ field, currentField, direction }: { field: SortField; currentField: SortField | null; direction: SortDirection }) {
  if (currentField !== field) {
    return <ArrowUpDown size={14} className="text-muted-foreground opacity-50" />;
  }
  if (direction === "asc") {
    return <ArrowUp size={14} className="text-primary" />;
  }
  return <ArrowDown size={14} className="text-primary" />;
}

function SortableHeader({ field, label, currentField, sortDirection, onSort }: { field: SortField; label: string; currentField: SortField | null; sortDirection: SortDirection; onSort: (field: SortField) => void }) {
  return (
    <button
      type="button"
      className="inline-flex items-center gap-1 text-left font-medium transition-colors hover:text-primary"
      onClick={() => onSort(field)}
      aria-label={`Ordenar por ${label}`}
      aria-sort={currentField === field ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}
    >
      {label}
      <SortIcon field={field} currentField={currentField} direction={sortDirection} />
    </button>
  );
}

// Skeleton components for table loading with shimmer effect
function TableSkeletonRow() {
  return (
    <tr className="border-b border-border">
      <td data-label="">
        <div className="h-4 w-5 animate-pulse rounded bg-muted" />
      </td>
      <td data-label="N. Factura">
        <div className="h-4 w-[60px] animate-pulse rounded bg-muted" />
      </td>
      <td data-label="Cliente">
        <div className="bo-flex bo-flex-col bo-gap-1">
          <div className="h-4 w-[120px] animate-pulse rounded bg-muted" />
          <div className="h-3 w-[80px] animate-pulse rounded bg-muted" />
        </div>
      </td>
      <td data-label="Email">
        <div className="h-4 w-[140px] animate-pulse rounded bg-muted" />
      </td>
      <td data-label="Importe">
        <div className="h-4 w-[80px] animate-pulse rounded bg-muted" />
      </td>
      <td data-label="Moneda">
        <div className="h-4 w-[50px] animate-pulse rounded bg-muted" />
      </td>
      <td data-label="Fecha">
        <div className="h-4 w-[70px] animate-pulse rounded bg-muted" />
      </td>
      <td data-label="Estado">
        <div className="h-5 w-[60px] animate-pulse rounded-full bg-muted" />
      </td>
      <td data-label="Tipo">
        <div className="h-5 w-[70px] animate-pulse rounded-full bg-muted" />
      </td>
      <td data-label=""></td>
      <td data-label="">
        <div className="bo-flex bo-gap-1">
          <div className="h-7 w-7 animate-pulse rounded bg-muted" />
          <div className="h-7 w-7 animate-pulse rounded bg-muted" />
          <div className="h-7 w-7 animate-pulse rounded bg-muted" />
        </div>
      </td>
    </tr>
  );
}

function TableSkeleton() {
  return (
    <div className="overflow-x-auto">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse" aria-label="Cargando facturas...">
          <thead>
            <tr>
              <th className="w-10"></th>
              <th className="text-left">N. Factura</th>
              <th className="text-left">Cliente</th>
              <th className="text-left">Email</th>
              <th className="text-left">Importe</th>
              <th className="text-left">Moneda</th>
              <th className="text-left">Fecha</th>
              <th className="text-left">Estado</th>
              <th className="text-left">Tipo</th>
              <th className="w-10"></th>
              <th className="w-24"></th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 5 }).map((_, index) => (
              <TableSkeletonRow key={index} />
            ))}
          </tbody>
        </table>
      </div>
      <div className="bo-flex bo-justify-center" style={{ padding: "var(--bo-space-4) 0" }}>
        <div className="text-sm text-muted-foreground" aria-live="polite">
          <span className="inline-block w-[100px] animate-pulse rounded bg-muted h-4" />
          <span className="sr-only">Cargando...</span>
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
  const bulkStatusOptions = ALL_STATUSES.map((status) => ({
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
        <div className="flex flex-col items-center justify-center py-12 text-center" role="status" aria-live="polite">
          <div className="mb-4 rounded-full bg-muted p-3">
            <FileText size={24} className="text-muted-foreground" />
          </div>
          <h3 className="mb-2 text-lg font-semibold">No hay facturas todavia</h3>
          <p className="mb-6 max-w-md text-sm text-muted-foreground">
            Crea tu primera factura para comenzar a gestionar tus ingresos.
          </p>
          <div className="bo-flex bo-gap-2">
            <button
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              type="button"
              onClick={onCreateNew}
            >
              <Plus size={16} />
              Crear primera factura
            </button>
          </div>
        </div>
    );
  }

  return (
      <div className="flex flex-col items-center justify-center py-12 text-center" role="status" aria-live="polite">
        <div className="mb-4 rounded-full bg-muted p-3">
          <SearchX size={28} className="text-muted-foreground" />
        </div>
        <h3 className="mb-2 text-lg font-semibold">No se encontraron facturas</h3>
        <p className="max-w-md text-sm text-muted-foreground">
          No hay resultados para los filtros aplicados. Intenta ajustar los criterios de busqueda o limpiar los filtros.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      {/* Bulk Actions Bar */}
      {someSelected && (
        <div className="flex items-center justify-between border-b border-border bg-muted/30 px-4 py-3" role="region" aria-live="polite">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{selectedIds.size} elemento{selectedIds.size !== 1 ? "s" : ""} seleccionado{selectedIds.size !== 1 ? "s" : ""}</span>
          </div>
          <div className="bo-flex bo-gap-2">
            <button
              className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              type="button"
              onClick={() => {
                const selectedInvoices = invoices.filter((inv) => selectedIds.has(inv.id));
                onBulkPrint(selectedInvoices);
              }}
            >
              <Printer size={16} />
              Imprimir
            </button>
            <button
              className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              type="button"
              onClick={() => {
                const selectedInvoices = invoices.filter((inv) => selectedIds.has(inv.id));
                onBulkSendEmail(selectedInvoices);
              }}
            >
              <Mail size={16} />
              Enviar todas
            </button>
              <DropdownMenu
                label="Cambiar estado"
                items={bulkStatusOptions}
                triggerContent={
                  <button className="inline-flex items-center rounded-md bg-secondary px-3 py-1.5 text-sm font-medium text-secondary-foreground hover:bg-secondary/80" type="button">
                    Cambiar estado
                  </button>
                }
                triggerClassName="bo-bulkAction"
              />
              <button
                className="inline-flex items-center rounded-md bg-secondary px-3 py-1.5 text-sm font-medium text-secondary-foreground hover:bg-secondary/80"
                type="button"
                onClick={() => {
                  const selectedInvoices = invoices.filter((inv) => selectedIds.has(inv.id));
                  handleBulkMergeRequest(selectedInvoices);
                }}
              >
                <Combine size={16} />
                Fusionar
              </button>
              <button
                className="inline-flex items-center gap-2 rounded-md bg-destructive px-3 py-1.5 text-sm font-medium text-destructive-foreground hover:bg-destructive/90"
                type="button"
                onClick={handleBulkDeleteRequest}
              >
                Eliminar
              </button>
              <button
                className="inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium hover:bg-muted"
                type="button"
                onClick={handleClearSelection}
                aria-label="Limpiar selección"
              >
                <X size={16} />
                Limpiar
              </button>
            </div>
          </div>
      )}
      {/* Print All Visible Bar - shown when there are invoices but nothing is selected */}
      {!someSelected && invoices.length > 0 && (
        <div className="flex items-center justify-between border-b border-border bg-muted/30 px-4 py-3" role="region" aria-live="polite">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{invoices.length} facturas en esta pagina</span>
          </div>
          <div className="bo-flex bo-gap-2">
            <button
              className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              type="button"
              onClick={onPrintAllVisible}
            >
              <Printer size={16} />
              Imprimir todas las visibles
            </button>
          </div>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm" aria-label="Tabla de facturas">
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col.key} className={`col-${col.key}`}>
                  {col.key === "selection" ? (
                    <label className="bo-checkboxContainer bo-checkboxContainer--header">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={handleSelectAll}
                        aria-label={allSelected ? "Deseleccionar todos" : "Seleccionar todos"}
                      />
                      <span className="bo-checkboxMark"></span>
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
          <tbody>
            {invoices.map((invoice) => {
              // Calculate overdue status - based on due_date if available, otherwise invoice_date
              const effectiveDueDate = invoice.due_date || invoice.invoice_date;
              const isOverdue = (invoice.status === "pendiente" || invoice.status === "enviada") && !invoice.payment_date && new Date(effectiveDueDate) < new Date(new Date().toDateString());
              const daysOverdue = isOverdue ? getDaysOverdue(effectiveDueDate) : 0;

              return (
              <tr key={invoice.id} className={`bo-tableRow${selectedIds.has(invoice.id) ? " is-selected" : ""}${isOverdue ? " bo-tableRow--overdue" : ""}`}>
                <td className={`col-selection`} data-label="">
                  <label className="bo-checkboxContainer">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(invoice.id)}
                      onChange={() => handleToggleSelect(invoice.id)}
                      aria-label={`Seleccionar factura ${invoice.invoice_number || invoice.id}`}
                    />
                    <span className="bo-checkboxMark"></span>
                  </label>
                </td>
                <td className={`col-invoice_number`} data-label="N. Factura">
                  {invoice.invoice_number || "-"}
                </td>
                <td className={`col-customer_name`} data-label="Cliente">
                  <div className="bo-tableCustomer">
                    <button
                      type="button"
                      className="bo-tableCustomerName bo-tableCustomerName--link"
                      onClick={() => onViewCustomerHistory(invoice.customer_name + (invoice.customer_surname ? ` ${invoice.customer_surname}` : ""), invoice.customer_email)}
                      title="Ver historial del cliente"
                    >
                      {invoice.customer_name}
                    </button>
                    {invoice.customer_surname && (
                      <span className="bo-tableCustomerSurname"> {invoice.customer_surname}</span>
                    )}
                  </div>
                </td>
                <td className={`col-customer_email`} data-label="Email">{invoice.customer_email}</td>
                <td className={`col-amount`} data-label="Importe">{formatPrice(invoice.amount, invoice.currency)}</td>
                <td className={`col-currency`} data-label="Moneda">
                  <span className="bo-badge bo-badge--muted">{invoice.currency || "EUR"}</span>
                </td>
                <td className={`col-payment_progress`} data-label="Pagado">
                  <PaymentProgressCell invoice={invoice} />
                </td>
                <td className={`col-invoice_date`} data-label="Fecha">{formatDate(invoice.invoice_date)}</td>
                <td className={`col-due_date`} data-label="Vencimiento">
                  {invoice.due_date ? (
                    <span
                      className={`bo-dueDate ${new Date(invoice.due_date) < new Date(new Date().toDateString()) && (invoice.status === "pendiente" || invoice.status === "enviada") && !invoice.payment_date ? "bo-dueDate--overdue" : ""}`}
                      title={isOverdue ? `Vencida hace ${daysOverdue} dias` : "Fecha de vencimiento"}
                    >
                      {formatDate(invoice.due_date)}
                    </span>
                  ) : (
                    <span className="bo-mutedText">-</span>
                  )}
                </td>
                <td className={`col-payment_date`} data-label="F. Pago">
                  {invoice.payment_date ? (
                    <span className="bo-paymentDate" title="Fecha de pago">
                      <Calendar size={12} />
                      {formatDate(invoice.payment_date)}
                    </span>
                  ) : isOverdue ? (
                    <span className="bo-daysOverdue" title={`${daysOverdue} dias de retraso`}>
                      <AlertTriangle size={12} />
                      {daysOverdue} dias
                    </span>
                  ) : (
                    <span className="bo-mutedText">-</span>
                  )}
                </td>
                <td className={`col-payment_method`} data-label="Metodo">
                  {invoice.payment_method ? (
                    <span className="bo-paymentMethod" title={PAYMENT_METHOD_LABELS[invoice.payment_method]}>
                      <CreditCard size={12} />
                      {PAYMENT_METHOD_LABELS[invoice.payment_method]}
                    </span>
                  ) : (
                    <span className="bo-mutedText">-</span>
                  )}
                </td>
                <td className={`col-status`} data-label="Estado">
                  <StatusCell
                    invoice={invoice}
                    onStatusChange={onStatusChange}
                    onStatusChangeConfirm={handleStatusChangeConfirm}
                  />
                </td>
                <td className={`col-is_reservation`} data-label="Tipo">
                  <ReservationBadge isReservation={Boolean(invoice.is_reservation)} />
                  <SplitBadge isSplitChild={invoice.is_split_child} isSplitParent={invoice.is_split_parent} percentage={invoice.split_percentage} />
                </td>
                <td className={`col-deposit`} data-label="Deposito">
                  <DepositBadge invoice={invoice} />
                </td>
                <td className={`col-category`} data-label="Categoria">
                  <CreditNoteBadge invoice={invoice} />
                  <CategoryBadge category={invoice.category} />
                  <TagsList tags={invoice.tags} />
                </td>
                <td className={`col-attachment`} data-label="">
                  {(invoice.attachments && invoice.attachments.length > 0) || invoice.account_image_url || invoice.internal_notes ? (
                    <div className="bo-tableAttachmentCell">
                      {invoice.attachments && invoice.attachments.length > 0 && (
                        <button
                          className="inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium hover:bg-muted bo-btn--attachment"
                          type="button"
                          onClick={() => handleOpenAttachments(invoice)}
                          title={`Ver adjuntos (${invoice.attachments.length})`}
                          aria-label={`Ver ${invoice.attachments.length} adjuntos`}
                        >
                          <FolderOpen size={14} />
                          {invoice.attachments.length > 1 && (
                            <span className="bo-tableAttachmentCount">{invoice.attachments.length}</span>
                          )}
                        </button>
                      )}
                      {invoice.account_image_url && (
                        <span className="bo-tableAttachment" title="Imagen adjunta">
                          <Paperclip size={14} />
                        </span>
                      )}
                      {invoice.internal_notes && (
                        <span className="bo-tableAttachment bo-tableNotesIndicator" title="Notas internas">
                          <MessageSquare size={14} />
                        </span>
                      )}
                    </div>
                  ) : null}
                </td>
                <td className={`col-actions`}>
                  <div className="bo-tableActions">
                    <button
                      className="inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium hover:bg-muted"
                      type="button"
                      onClick={() => onPreview(invoice)}
                      aria-label={`Ver detalles de factura ${invoice.id}`}
                      title="Ver detalles"
                    >
                      <Eye size={14} />
                    </button>
                    <button
                      className="inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium hover:bg-muted"
                      type="button"
                      onClick={() => onEdit(invoice)}
                      aria-label={`Editar factura ${invoice.id}`}
                      title="Editar"
                    >
                      <PencilLine size={14} />
                    </button>
                    <button
                      className="inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium hover:bg-muted"
                      type="button"
                      onClick={() => onShowHistory(invoice)}
                      aria-label={`Ver historial de factura ${invoice.id}`}
                      title="Historial"
                    >
                      <History size={14} />
                    </button>
                    <button
                      className="inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium hover:bg-muted"
                      type="button"
                      onClick={() => onViewNotes(invoice)}
                      aria-label={`Ver notas internas de factura ${invoice.id}`}
                      title="Ver notas"
                    >
                      <MessageSquare size={14} />
                    </button>
                    {/* Reminder button - only show for pending/sent invoices */}
                    {(invoice.status === "pendiente" || invoice.status === "enviada") && (
                      <>
                        <button
                          className={`inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium hover:bg-muted ${invoice.has_reminder_sent ? "bo-btn--warning" : ""}`}
                          type="button"
                          onClick={() => onSendReminder(invoice)}
                          aria-label={`Enviar recordatorio de pago a ${invoice.customer_name}`}
                          title={invoice.has_reminder_sent ? "Enviar otro recordatorio" : "Enviar recordatorio de pago"}
                        >
                          {invoice.has_reminder_sent ? <BellOff size={14} /> : <Bell size={14} />}
                        </button>
                        {(invoice.reminders_count && invoice.reminders_count > 0) && (
                          <button
                            className="inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium hover:bg-muted"
                            type="button"
                            onClick={() => onShowReminderHistory(invoice)}
                            aria-label={`Ver historial de recordatorios de factura ${invoice.id}`}
                            title="Historial de recordatorios"
                          >
                            <Bell size={14} />
                          </button>
                        )}
                      </>
                    )}
                    {/* Marcar como pagada quick action - only show for non-paid invoices */}
                    {(invoice.status === "pendiente" || invoice.status === "enviada") && (
                      <button
                        className="inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium hover:bg-muted bo-btn--success"
                        type="button"
                        onClick={() => onStatusChange(invoice, "pagada")}
                        aria-label={`Marcar como pagada la factura ${invoice.id}`}
                        title="Marcar como pagada"
                      >
                        <Check size={14} />
                      </button>
                    )}
                    <button
                      className="inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium hover:bg-muted"
                      type="button"
                      onClick={() => onRegisterPayment(invoice)}
                      aria-label={`Registrar pago de factura ${invoice.id}`}
                      title="Registrar pago"
                    >
                      <CreditCard size={14} />
                    </button>
                    <button
                      className="inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium hover:bg-muted"
                      type="button"
                      onClick={() => onDuplicate(invoice)}
                      aria-label={`Duplicar factura ${invoice.id}`}
                      title="Duplicar"
                    >
                      <Copy size={14} />
                    </button>
                    {/* Create Credit Note button - only show for sent/paid invoices that are not credit notes */}
                    {!invoice.is_credit_note && (invoice.status === "enviada" || invoice.status === "pagada") && onCreateCreditNote && (
                      <button
                        className="inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium hover:bg-muted"
                        type="button"
                        onClick={() => onCreateCreditNote(invoice)}
                        aria-label={`Crear nota de credito para factura ${invoice.id}`}
                        title="Crear nota de credito"
                      >
                        <Receipt size={14} />
                      </button>
                    )}
                    {/* Split button - only show for invoices that are not already split children */}
                    {!invoice.is_split_child && (
                      <button
                        className="inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium hover:bg-muted"
                        type="button"
                        onClick={() => onSplit(invoice)}
                        aria-label={`Dividir factura ${invoice.id}`}
                        title="Dividir factura"
                      >
                        <Scissors size={14} />
                      </button>
                    )}
                    {invoice.pdf_url && (
                      <button
                        className="inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium hover:bg-muted"
                        type="button"
                        onClick={() => onDownloadPdf(invoice)}
                        aria-label={`Descargar PDF de factura ${invoice.id}`}
                        title="Descargar PDF"
                      >
                        <FileDown size={14} />
                      </button>
                    )}
                    {invoice.customer_email && (
                      <button
                        className="inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium hover:bg-muted"
                        type="button"
                        onClick={() => onSendEmail(invoice)}
                        aria-label={`Enviar email de factura ${invoice.id}`}
                        title={invoice.status === "enviada" ? "Reenviar email" : "Enviar email"}
                      >
                        <Mail size={14} />
                      </button>
                    )}
                    {invoice.customer_phone && (
                      <button
                        className="inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium hover:bg-muted"
                        type="button"
                        onClick={() => onSendWhatsApp(invoice)}
                        aria-label={`Enviar WhatsApp de factura ${invoice.id}`}
                        title={invoice.status === "enviada" ? "Reenviar WhatsApp" : "Enviar WhatsApp"}
                      >
                        <MessageCircle size={14} />
                      </button>
                    )}
                    <button
                      className="inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium hover:bg-muted bo-btn--danger"
                      type="button"
                      onClick={() => onDelete(invoice)}
                      aria-label={`Eliminar factura ${invoice.id}`}
                      title="Eliminar"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
              );
            })}
          </tbody>
          <tfoot className="bo-tableFooter">
            <tr>
              <td className="col-selection" data-label=""></td>
              <td className="col-invoice_number" data-label="N. Factura">
                <strong>Total</strong>
              </td>
              <td className="col-customer_name" data-label="Cliente">
                {totals.displayedCount} de {total} facturas
              </td>
              <td className="col-customer_email" data-label="Email"></td>
              <td className="col-amount" data-label="Importe">
                <strong>{formatPrice(totals.totalAmount)}</strong>
              </td>
              <td className="col-currency" data-label="Moneda"></td>
              <td className="col-payment_progress" data-label="Pagado"></td>
              <td className="col-invoice_date" data-label="Fecha"></td>
              <td className="col-due_date" data-label="Vencimiento"></td>
              <td className="col-payment_date" data-label="F. Pago"></td>
              <td className="col-payment_method" data-label="Metodo"></td>
              <td className="col-status" data-label="Estado"></td>
              <td className="col-is_reservation" data-label="Tipo"></td>
              <td className="col-deposit" data-label="Deposito"></td>
              <td className="col-attachment" data-label=""></td>
              <td className="col-actions" data-label=""></td>
            </tr>
          </tfoot>
        </table>
      </div>
      <div className={`bo-pager${showPagerBtns ? "" : " is-solo"}`} aria-label="Paginación">
        <div className="bo-pagerText">
          Página {page} de {totalPages} · {total} resultados
        </div>
        {showPagerBtns ? (
          <div className="bo-pagerBtns">
            <button className="bo-btn bo-btn--ghost" type="button" onClick={() => onPageChange(page - 1)} disabled={loading || page <= 1}>
              Anterior
            </button>
            <button className="bo-btn bo-btn--ghost" type="button" onClick={() => onPageChange(page + 1)} disabled={loading || page >= totalPages}>
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
