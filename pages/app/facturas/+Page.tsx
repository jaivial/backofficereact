import React, { useCallback, useEffect, useMemo, useState } from "react";
import { usePageContext } from "vike-react/usePageContext";
import { createClient } from "../../../api/client";
import type { Invoice, InvoiceListParams, InvoiceStatus, InvoiceInput } from "../../../api/types";
import { useErrorToast } from "../../../ui/feedback/useErrorToast";
import { useToasts } from "../../../ui/feedback/useToasts";
import { FileText, PlusCircle } from "lucide-react";
import { Tabs, type TabItem } from "../../../ui/nav/Tabs";
import { Panel } from "../../../ui/shell/Panel";
import { InvoiceFilters } from "./_components/InvoiceFilters";
import { InvoiceTable } from "./_components/InvoiceTable";
import { InvoiceForm } from "./_components/InvoiceForm";
import { SendEmailModal } from "./_components/SendEmailModal";
import { SendWhatsAppModal } from "./_components/SendWhatsAppModal";
import { BatchSendModal } from "./_components/BatchSendModal";
import { InvoiceDetailsModal } from "./_components/InvoiceDetailsModal";

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

  const error = data.error;
  const [invoices, setInvoices] = useState<Invoice[]>(data.invoices || []);
  const [total, setTotal] = useState(data.total);
  const [page, setPage] = useState(data.page);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("resumen");

  // Filters state
  const [searchText, setSearchText] = useState("");
  const [searchBy, setSearchBy] = useState<"name" | "email" | "invoice_number">("name");
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

  // Invoice details modal state
  const [detailsInvoice, setDetailsInvoice] = useState<Invoice | null>(null);

  // Batch send modal state
  const [batchSendInvoices, setBatchSendInvoices] = useState<Invoice[]>([]);
  const [batchSendOpen, setBatchSendOpen] = useState(false);

  useErrorToast(error);

  // Read URL params on mount for tab and invoice id
  useEffect(() => {
    const tab = getUrlParam("tab");
    const idStr = getUrlParam("id");
    if (tab === "añadir") {
      setActiveTab("añadir");
      setIsCreatingNew(true);
      if (idStr) {
        const id = Number(idStr);
        if (id && !Number.isNaN(id)) {
          const found = invoices.find((inv) => inv.id === id);
          if (found) setEditingInvoice(found);
        }
      }
    }
  }, []); // ponytail: run once on mount; invoices from SSR data

  // Fetch invoices with filters
  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    try {
      const params: InvoiceListParams = {
        search: searchText || undefined,
        search_by: searchBy,
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

  const handleSearchByChange = useCallback((value: "name" | "email" | "invoice_number") => {
    setSearchBy(value);
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

  // ── URL param helpers ──
  const getUrlParam = (key: string): string | null => {
    if (typeof window === "undefined") return null;
    return new URLSearchParams(window.location.search).get(key);
  };

  const updateUrl = (params: Record<string, string>) => {
    const q = new URLSearchParams(window.location.search);
    for (const [k, v] of Object.entries(params)) {
      if (v) q.set(k, v); else q.delete(k);
    }
    const url = `${window.location.pathname}?${q.toString()}`;
    window.history.replaceState(null, "", url);
  };

  // Handle create new invoice
  const handleCreateNew = useCallback(() => {
    setEditingInvoice(null);
    setIsCreatingNew(true);
    setActiveTab("añadir");
    updateUrl({ tab: "añadir", id: "" });
  }, []);

  // Handle edit existing invoice
  const handleEditInvoice = useCallback((invoice: Invoice) => {
    setEditingInvoice(invoice);
    setIsCreatingNew(true);
    setActiveTab("añadir");
    updateUrl({ tab: "añadir", id: String(invoice.id) });
  }, []);

  // Handle cancel edit
  const handleCancelEdit = useCallback(() => {
    setEditingInvoice(null);
    setIsCreatingNew(false);
    updateUrl({ tab: "resumen", id: "" });
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
  const handleSendEmail = useCallback(async (invoice: Invoice) => {
    // Check email settings before opening modal
    try {
      const res = await api.config.getEmailProviderConfig();
      if (res.success) {
        const data = res as any;
        if (data.isComplete === false) {
          const fields = (data.missingFields || []).join(", ");
          pushToast({
            kind: "error",
            title: "Email no configurado",
            message: `Faltan campos: ${fields || "configuraci\u00f3n de email incompleta"}. Ve a Ajustes \u2192 Email para configurarlo.`,
          });
          return;
        }
      }
    } catch {
      // If check fails, allow modal to open anyway
    }
    setEmailInvoice(invoice);
  }, [api, pushToast]);

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
  const handleSendWhatsApp = useCallback(async (invoice: Invoice) => {
    // Check email settings before opening modal
    try {
      const res = await api.config.getEmailProviderConfig();
      if (res.success) {
        const data = res as any;
        if (data.isComplete === false) {
          const fields = (data.missingFields || []).join(", ");
          pushToast({
            kind: "error",
            title: "Email no configurado",
            message: `Faltan campos: ${fields || "configuraci\u00f3n de email incompleta"}. Ve a Ajustes \u2192 Email para configurarlo.`,
          });
          return;
        }
      }
    } catch {
      // If check fails, allow modal to open anyway
    }
    setWhatsappInvoice(invoice);
  }, [api, pushToast]);

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
    <div className="bo-facturasPage" data-slot="facturas-facturasPage">
      <style>{`@media (max-width: 768px) {
        /* ── Table cards ── */
        .bo-table--facturas thead{display:none}
        .bo-table--facturas,.bo-table--facturas tbody,.bo-tableWrap .bo-tableScroll{display:block}
        .bo-table--facturas tbody tr{display:flex;flex-wrap:wrap;align-items:center;gap:0;padding:14px;border:1px solid var(--bo-border);border-radius:14px;margin-bottom:10px;background:var(--bo-surface);position:relative}
        .bo-table--facturas tbody td{padding:2px 0;text-align:left}
        .bo-table--facturas tbody td::before{display:none}

        /* Card rows: full-width elements */
        .bo-table--facturas td.col-selection{display:none!important}
        .bo-table--facturas td.col-customer_name{width:calc(100% - 90px);font-weight:720;font-size:15px;order:1;padding:0 0 2px}
        .bo-table--facturas td.col-status{width:80px;text-align:right;order:2;padding:0 0 2px}
        .bo-table--facturas td.col-amount{width:100%;font-weight:780;font-size:20px;color:var(--bo-accent);order:3;padding:0 0 8px}
        .bo-table--facturas td.col-invoice_date{order:4;font-size:12px;color:var(--bo-muted);padding:0 8px 6px 0}
        .bo-table--facturas td.col-payment_progress{width:100%;order:5;padding:4px 0}
        .bo-table--facturas td.col-actions{width:100%;order:99;display:flex;justify-content:flex-end;padding-top:10px;margin-top:6px;border-top:1px solid var(--bo-border);gap:4px}

        /* Hide noise + low-value cells */
        .bo-table--facturas td.col-customer_email,.bo-table--facturas td.col-currency,.bo-table--facturas td.col-payment_date,.bo-table--facturas td.col-payment_method,.bo-table--facturas td.col-is_reservation,.bo-table--facturas td.col-deposit,.bo-table--facturas td.col-category,.bo-table--facturas td.col-attachment,.bo-table--facturas td.col-invoice_number,.bo-table--facturas td.col-due_date{display:none}



        /* ── Strip table wrapper on mobile ── */
        .bo-tableWrap{background:transparent!important;border:none!important;border-radius:0!important;margin-top:0!important;padding:0!important}
        .bo-tableScroll{overflow:visible!important}
        .bo-table--facturas{border:none!important;background:transparent!important}
        /* ── tfoot: hidden on mobile ── */
        .bo-table--facturas tfoot{display:none!important}
        /* ── Pager ── */
        .bo-pager{flex-direction:column;align-items:stretch;gap:8px;padding:10px 14px;background:var(--bo-surface);border:1px solid var(--bo-border);border-radius:12px}
        .bo-pager .bo-pagerText{text-align:center;font-size:12px;color:var(--bo-faint)}
        .bo-pager .bo-pagerBtns{justify-content:center;gap:8px}
        .bo-pager .bo-pagerBtns .bo-btn{flex:1}
        .bo-bulkBar{flex-wrap:wrap;gap:8px}
        .bo-bulkBar .bo-bulkBarInfo{width:100%}

        /* ── Form container ── */
        .bo-facturasFormContainer{padding:0 8px!important}
        /* ── Form ── */
        .bo-invoiceFormTopGrid{flex-direction:column;gap:var(--bo-space-4)}
        .bo-invoiceFormHeader{flex-direction:column;align-items:stretch}
        .bo-invoiceFormHeaderActions{width:100%}
        .bo-invoiceFormHeaderActions .bo-btn{flex:1}
        .bo-lineItemsTableHeader{display:none}
        .bo-lineItemsTableRow{grid-template-columns:1fr!important;gap:8px;padding:12px;border:1px solid var(--bo-border);border-radius:12px;margin-bottom:8px;background:var(--bo-surface)}
        .bo-lineItemCell{display:flex;align-items:center;justify-content:space-between;padding:4px 0}
        .bo-lineItemCell::before{content:attr(data-label);font-size:11px;font-weight:650;color:var(--bo-muted);text-transform:uppercase;letter-spacing:.03em;margin-right:12px;flex-shrink:0}
        .bo-lineItemCell--actions{justify-content:flex-end;padding-top:8px;margin-top:4px;border-top:1px solid var(--bo-border)}
        .bo-lineItemCell--actions::before{display:none}
        .bo-invoiceFormActions{flex-direction:column;gap:10px}
        .bo-invoiceFormActions .bo-btn{width:100%}

        /* ── Modals ── */
        .bo-modal,.bo-modal-content{width:calc(100vw - 24px)!important;max-width:none!important;max-height:85vh;border-radius:16px 16px 0 0;margin-top:auto}
        .bo-modalOverlay,.bo-modal-overlay{align-items:flex-end;padding:0}
        .bo-modalHead,.bo-modalHeader{padding:4px 4px 8px}
        .bo-modalX{width:40px;height:40px;border-radius:14px}
        .bo-modalActions{flex-direction:column;gap:8px}
        .bo-modalActions .bo-btn{width:100%}
        .bo-modalBody{max-height:60vh;overflow-y:auto;-webkit-overflow-scrolling:touch}
        .bo-invoicePreviewGrid{grid-template-columns:1fr!important}
      }
      @media (max-width: 520px) {
        /* Field pairs stay in rows down to 520px; collapse below that. */
        .bo-invoiceFormRow,.bo-invoiceFormRow--single,.bo-invoiceFormRow--singleCenter,.bo-invoiceFormRow--phoneDni,.bo-invoiceFormRow--amount,.bo-invoiceFormRow--reservation,.bo-invoiceFormRow--iva{grid-template-columns:1fr!important}
      }`}</style>
      <Tabs tabs={TABS} activeId={activeTab} ariaLabel="Facturas" className="bo-tabs--reservas bo-tabs--facturas" onNavigate={onNavigateTab} />
      {activeTab === "resumen" ? (
        <div role="tabpanel" id="panel-resumen" aria-labelledby="tab-resumen" data-slot="facturas-div">
        <div className="bo-facturasSummary" data-slot="facturas-facturasSummary">
          <InvoiceFilters
            searchText={searchText}
            searchBy={searchBy}
            onSearchByChange={handleSearchByChange}
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
            onPreview={(inv) => setDetailsInvoice(inv)}
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
        <div role="tabpanel" id="panel-añadir" aria-labelledby="tab-añadir" data-slot="facturas-div">
        <div className="bo-formContainer" data-slot="facturas-formContainer">
          <div className="bo-container bo-facturasFormContainer" data-slot="facturas-facturasFormContainer">
            <Panel bodyClassName="bo-facturasFormPanelBody" className="bo-facturasFormPanel" data-slot="facturas-facturasFormPanel">
                <InvoiceForm
                  invoice={editingInvoice}
                  onSave={handleSaveInvoice}
                  onCancel={handleCancelEdit}
                  searchReservations={searchReservations}
                />
            </Panel>
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

      {/* Invoice Details Modal */}
      <InvoiceDetailsModal
        open={!!detailsInvoice}
        invoice={detailsInvoice}
        onClose={() => setDetailsInvoice(null)}
        onSendEmail={(inv) => {
          setDetailsInvoice(null);
          handleSendEmail(inv);
        }}
        onSendWhatsApp={(inv) => {
          setDetailsInvoice(null);
          handleSendWhatsApp(inv);
        }}
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
