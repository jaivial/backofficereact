import React, { useCallback, useMemo, useState } from "react";
import { usePageContext } from "vike-react/usePageContext";
import { useAtomValue } from "jotai";
import { sessionAtom } from "../../../state/atoms";
import { createClient } from "../../../api/client";
import type { Invoice, InvoiceListParams, InvoiceStatus, InvoiceInput } from "../../../api/types";
import { useErrorToast } from "../../../ui/feedback/useErrorToast";
import { useToasts } from "../../../ui/feedback/useToasts";
import { FileText, PlusCircle } from "lucide-react";
import { Tabs, type TabItem } from "../../../ui/nav/Tabs";
import { InvoiceFilters } from "./_components/InvoiceFilters";
import { InvoiceTable } from "./_components/InvoiceTable";
import { InvoiceForm } from "./_components/InvoiceForm";
import { SendEmailModal } from "./_components/SendEmailModal";
import { SendWhatsAppModal } from "./_components/SendWhatsAppModal";
import { BatchSendModal } from "./_components/BatchSendModal";

type PageData = {
  invoices: Invoice[];
  total: number;
  page: number;
  limit: number;
  error: string | null;
};

const INVOICE_STATUS_OPTIONS: { value: InvoiceStatus | ""; label: string }[] = [
  { value: "", label: "Todos" },
  { value: "borrador", label: "Borrador" },
  { value: "solicitada", label: "Solicitada" },
  { value: "pendiente", label: "Pendiente" },
  { value: "enviada", label: "Enviada" },
];

const INVOICE_SORT_OPTIONS: { value: string; label: string }[] = [
  { value: "date_desc", label: "Fecha mas reciente" },
  { value: "date_asc", label: "Fecha mas antigua" },
  { value: "amount_desc", label: "Importe mayor" },
  { value: "amount_asc", label: "Importe menor" },
];

function normalizedSearchValue(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

export default function Page() {
  const pageContext = usePageContext();
  const data = pageContext.data as PageData;
  const api = useMemo(() => createClient({ baseUrl: "" }), []);
  const { pushToast } = useToasts();
  const session = useAtomValue(sessionAtom);
  const currentUserId = session?.user?.id;

  const error = data.error;
  const [invoices, setInvoices] = useState<Invoice[]>(data.invoices || []);
  const [total, setTotal] = useState(data.total);
  const [page, setPage] = useState(data.page);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("resumen");

  // Filters state
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | "">("");
  const [dateType, setDateType] = useState<"invoice_date" | "reservation_date">("invoice_date");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [isReservation, setIsReservation] = useState<boolean | null>(null);
  const [sortBy, setSortBy] = useState<"amount_asc" | "amount_desc" | "date_asc" | "date_desc">("date_desc");

  // Editing invoice state
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);

  // Send email modal state
  const [emailInvoice, setEmailInvoice] = useState<Invoice | null>(null);

  // Send WhatsApp modal state
  const [whatsappInvoice, setWhatsappInvoice] = useState<Invoice | null>(null);

  // Batch send modal state
  const [batchSendInvoices, setBatchSendInvoices] = useState<Invoice[]>([]);
  const [batchSendOpen, setBatchSendOpen] = useState(false);

  useErrorToast(error);

  // Fetch invoices with filters
  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    try {
      const params: InvoiceListParams = {
        search: searchText || undefined,
        status: statusFilter || undefined,
        date_type: dateType,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        is_reservation: isReservation ?? undefined,
        sort: sortBy,
        page: page,
        limit: data.limit,
      };

      const res = await api.invoices.list(params);
      if (res.success) {
        setInvoices(res.invoices);
        setTotal(res.total);
      } else {
        pushToast({ kind: "error", title: "Error", message: res.message || "No se pudieron cargar las facturas" });
      }
    } finally {
      setLoading(false);
    }
  }, [api, searchText, statusFilter, dateType, dateFrom, dateTo, isReservation, sortBy, page, data.limit, pushToast]);

  const resetFilters = useCallback(() => {
    setSearchText("");
    setStatusFilter("");
    setDateType("invoice_date");
    setDateFrom("");
    setDateTo("");
    setIsReservation(null);
    setSortBy("date_desc");
    setPage(1);
  }, []);

  const handleSearchChange = useCallback((value: string) => {
    setSearchText(value);
    setPage(1);
  }, []);

  const handleStatusFilterChange = useCallback((value: InvoiceStatus | "") => {
    setStatusFilter(value);
    setPage(1);
  }, []);

  const handleDateTypeChange = useCallback((value: "invoice_date" | "reservation_date") => {
    setDateType(value);
    setPage(1);
  }, []);

  const handleDateFromChange = useCallback((value: string) => {
    setDateFrom(value);
    setPage(1);
  }, []);

  const handleDateToChange = useCallback((value: string) => {
    setDateTo(value);
    setPage(1);
  }, []);

  const handleIsReservationChange = useCallback((value: boolean | null) => {
    setIsReservation(value);
    setPage(1);
  }, []);

  const handleSortByChange = useCallback((value: string) => {
    setSortBy(value as "amount_asc" | "amount_desc" | "date_asc" | "date_desc");
    setPage(1);
  }, []);

  const hasFilters = useMemo(
    () =>
      searchText.trim().length > 0 ||
      statusFilter !== "" ||
      dateFrom !== "" ||
      dateTo !== "" ||
      isReservation !== null ||
      sortBy !== "date_desc",
    [searchText, statusFilter, dateFrom, dateTo, isReservation, sortBy],
  );

  const summaryText = useMemo(() => `${invoices.length} de ${total} facturas`, [invoices.length, total]);

  const totalPages = useMemo(() => Math.ceil(total / data.limit), [total, data.limit]);

  const handlePageChange = useCallback((newPage: number) => {
    setPage(newPage);
  }, []);

  // Handle create new invoice
  const handleCreateNew = useCallback(() => {
    setEditingInvoice(null);
    setIsCreatingNew(true);
    setActiveTab("añadir");
  }, []);

  // Handle edit existing invoice
  const handleEditInvoice = useCallback((invoice: Invoice) => {
    setEditingInvoice(invoice);
    setIsCreatingNew(true);
    setActiveTab("añadir");
  }, []);

  // Handle cancel edit
  const handleCancelEdit = useCallback(() => {
    setEditingInvoice(null);
    setIsCreatingNew(false);
  }, []);

  // Handle save invoice
  const handleSaveInvoice = useCallback(
    async (input: InvoiceInput, shouldSend: boolean = false) => {
      try {
        let res;
        let invoiceId: number | undefined;
        
        if (editingInvoice) {
          res = await api.invoices.update(editingInvoice.id, input);
          invoiceId = editingInvoice.id;
        } else {
          res = await api.invoices.create(input);
          if (!res.success) {
            pushToast({ kind: "error", title: "Error", message: "No se pudo crear la factura" });
            return;
          }
          invoiceId = "id" in res ? res.id : undefined;
        }

        if (res.success) {
          if (shouldSend && invoiceId) {
            const sendRes = await api.invoices.send(invoiceId);
            if (sendRes.success) {
              pushToast({ kind: "success", title: "Factura enviada", message: "La factura ha sido enviada correctamente" });
            } else {
              pushToast({ kind: "error", title: "Error", message: "No se pudo enviar la factura" });
            }
          } else {
            pushToast({ kind: "success", title: "Guardado", message: shouldSend ? "Factura enviada correctamente" : "Factura guardada correctamente" });
          }
        } else {
          pushToast({ kind: "error", title: "Error", message: "No se pudo guardar la factura" });
        }

        setEditingInvoice(null);
        setIsCreatingNew(false);
        fetchInvoices();
      } catch (e) {
        pushToast({ kind: "error", title: "Error", message: e instanceof Error ? e.message : "Error desconocido" });
      }
    },
    [api, editingInvoice, pushToast, fetchInvoices],
  );

  // Search reservations for auto-fill
  const searchReservations = useCallback(
    async (params: { date_from?: string; date_to?: string; name?: string; phone?: string; party_size?: number; time?: string }) => {
      const res = await api.invoices.searchReservations(params);
      if (res.success) {
        return res.reservations;
      }
      return [];
    },
    [api],
  );

  // Handle send email - opens the send email modal
  const handleSendEmail = useCallback((invoice: Invoice) => {
    setEmailInvoice(invoice);
  }, []);

  // Handle email sent - updates the invoice in the list
  const handleEmailSent = useCallback((updatedInvoice: Invoice) => {
    setInvoices((prev) =>
      prev.map((inv) => (inv.id === updatedInvoice.id ? { ...inv, status: updatedInvoice.status } : inv))
    );
    setEmailInvoice(null);
  }, []);

  // Handle close email modal
  const handleCloseEmail = useCallback(() => {
    setEmailInvoice(null);
  }, []);

  // Handle send WhatsApp - opens the send WhatsApp modal
  const handleSendWhatsApp = useCallback((invoice: Invoice) => {
    setWhatsappInvoice(invoice);
  }, []);

  // Handle WhatsApp sent - updates the invoice in the list
  const handleWhatsAppSent = useCallback((updatedInvoice: Invoice) => {
    setInvoices((prev) =>
      prev.map((inv) => (inv.id === updatedInvoice.id ? { ...inv, status: updatedInvoice.status } : inv))
    );
    setWhatsappInvoice(null);
  }, []);

  // Handle close WhatsApp modal
  const handleCloseWhatsApp = useCallback(() => {
    setWhatsappInvoice(null);
  }, []);

  // Handle bulk send email - opens the batch send modal
  const handleBulkSendEmail = useCallback((invoices: Invoice[]) => {
    setBatchSendInvoices(invoices);
    setBatchSendOpen(true);
  }, []);

  // Handle batch email sent - updates invoices in the list
  const handleBatchEmailSent = useCallback((updatedInvoices: Invoice[]) => {
    setInvoices((prev) =>
      prev.map((inv) => {
        const updated = updatedInvoices.find((u) => u.id === inv.id);
        if (updated) {
          return { ...inv, status: updated.status };
        }
        return inv;
      })
    );
  }, []);

  // Handle close batch send modal
  const handleCloseBatchSend = useCallback(() => {
    setBatchSendOpen(false);
    setBatchSendInvoices([]);
  }, []);

  // Filtered/sorted invoices (client-side is handled by API, just display)
  const filteredInvoices = useMemo(() => {
    return invoices;
  }, [invoices]);

  const TABS = useMemo<TabItem[]>(
    () => [
      { id: "resumen", label: "Resumen", href: "/app/facturas?tab=resumen", icon: <FileText className="bo-ico" /> },
      { id: "añadir", label: "Añadir", href: "/app/facturas?tab=añadir", icon: <PlusCircle className="bo-ico" /> },
    ],
    [],
  );

  const onNavigateTab = useCallback((_href: string, id: string) => {
    if (id === "añadir") {
      handleCreateNew();
      return;
    }
    setActiveTab(id);
  }, [handleCreateNew]);

  

  return (
    <div className="bo-facturasPage">
      <Tabs tabs={TABS} activeId={activeTab} ariaLabel="Facturas" className="bo-tabs--reservas bo-tabs--facturas" onNavigate={onNavigateTab} />
      {activeTab === "resumen" ? (
        <div role="tabpanel" id="panel-resumen" aria-labelledby="tab-resumen">
        <div className="bo-facturasSummary">
          <InvoiceFilters
            searchText={searchText}
            statusFilter={statusFilter}
            dateType={dateType}
            dateFrom={dateFrom}
            dateTo={dateTo}
            isReservation={isReservation}
            sortBy={sortBy}
            hasFilters={hasFilters}
            summaryText={summaryText}
            statusOptions={INVOICE_STATUS_OPTIONS}
            sortOptions={INVOICE_SORT_OPTIONS}
            onSearchChange={handleSearchChange}
            onStatusFilterChange={handleStatusFilterChange}
            onDateTypeChange={handleDateTypeChange}
            onDateFromChange={handleDateFromChange}
            onDateToChange={handleDateToChange}
            onIsReservationChange={handleIsReservationChange}
            onSortByChange={handleSortByChange}
            onResetFilters={resetFilters}
            onApplyFilters={fetchInvoices}
          />

          <InvoiceTable
            invoices={filteredInvoices}
            loading={loading}
            page={page}
            totalPages={totalPages}
            total={total}
            sortField={null}
            sortDirection="desc"
            onSort={() => {}}
            hasFilters={hasFilters}
            onCreateNew={handleCreateNew}
            onEdit={handleEditInvoice}
            onDuplicate={() => {}}
            onSplit={() => {}}
            onDelete={() => {}}
            onDownloadPdf={() => {}}
            onSendEmail={handleSendEmail}
            onSendWhatsApp={handleSendWhatsApp}
            onPageChange={handlePageChange}
            onStatusChange={() => {}}
            onBulkStatusChange={() => {}}
            onBulkDelete={() => {}}
            onBulkPrint={() => {}}
            onBulkMerge={() => {}}
            onBulkSendEmail={handleBulkSendEmail}
            onPrintAllVisible={() => {}}
            onPreview={() => {}}
            onViewCustomerHistory={() => {}}
            onShowHistory={() => {}}
            onViewNotes={() => {}}
            onRegisterPayment={() => {}}
            onSendReminder={() => {}}
            onShowReminderHistory={() => {}}
            onManageTemplates={() => {}}
          />
        </div>
      </div>
      ) : null}

      {activeTab === "añadir" ? (
        <div role="tabpanel" id="panel-añadir" aria-labelledby="tab-añadir">
        <div className="bo-formContainer">
          <div className="bo-container bo-facturasFormContainer">
            <div className="bo-panel bo-facturasFormPanel">
              <div className="bo-panelBody bo-facturasFormPanelBody">
                <InvoiceForm
                  invoice={editingInvoice}
                  onSave={handleSaveInvoice}
                  onCancel={handleCancelEdit}
                  searchReservations={searchReservations}
                  currentUserId={currentUserId}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
      ) : null}

      {/* Send Email Modal */}
      <SendEmailModal
        open={!!emailInvoice}
        invoice={emailInvoice}
        onClose={handleCloseEmail}
        onSent={handleEmailSent}
      />

      {/* Send WhatsApp Modal */}
      <SendWhatsAppModal
        open={!!whatsappInvoice}
        invoice={whatsappInvoice}
        onClose={handleCloseWhatsApp}
        onSent={handleWhatsAppSent}
      />

      {/* Batch Send Modal */}
      <BatchSendModal
        open={batchSendOpen}
        invoices={batchSendInvoices}
        onClose={handleCloseBatchSend}
        onSent={handleBatchEmailSent}
      />
    </div>
  );
}
