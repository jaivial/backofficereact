import React, { useCallback, useMemo, useState } from "react";
import { RefreshCw, Plus, Play, Pause, Eye, Edit, Trash2, Clock, Calendar, AlertCircle, CheckCircle, XCircle } from "lucide-react";
import { usePageContext } from "vike-react/usePageContext";
import { useToasts } from "../../../../ui/feedback/useToasts";
import { createClient } from "../../../../api/client";
import type { Data } from "./+data";
import { RECURRING_FREQUENCY_OPTIONS } from "../../../../api/recurring-types";
import { CURRENCY_SYMBOLS } from "../../../../api/types";

export default function RecurringInvoicesPage() {
  const pageContext = usePageContext();
  const data = pageContext.data as Data;
  const { pushToast } = useToasts();
  const api = useMemo(() => createClient({ baseUrl: "" }), []);
  const [isLoading, setIsLoading] = useState(false);

  const handleToggleActive = useCallback(async (id: number, currentStatus: boolean) => {
    setIsLoading(true);
    try {
      const res = await api.recurringInvoices.toggleActive(id);
      if (res.success) {
        pushToast({
          kind: "success",
          title: currentStatus ? "Facturación pausada" : "Facturación reactivada",
          message: currentStatus
            ? "La facturación recurrente ha sido pausada"
            : "La facturación recurrente ha sido reactivada",
        });
        // Refresh page
        window.location.reload();
      } else {
        pushToast({
          kind: "error",
          title: "Error",
          message: res.message || "No se pudo actualizar el estado",
        });
      }
    } catch (err) {
      pushToast({
        kind: "error",
        title: "Error",
        message: err instanceof Error ? err.message : "Error al actualizar el estado",
      });
    } finally {
      setIsLoading(false);
    }
  }, [api, pushToast]);

  const handleGenerateNow = useCallback(async (id: number) => {
    setIsLoading(true);
    try {
      const res = await api.recurringInvoices.generateInvoice(id);
      if (res.success) {
        pushToast({
          kind: "success",
          title: "Factura generada",
          message: `Se ha generado la factura #${res.invoice_id}`,
        });
        // Refresh page
        window.location.reload();
      } else {
        pushToast({
          kind: "error",
          title: "Error",
          message: res.message || "No se pudo generar la factura",
        });
      }
    } catch (err) {
      pushToast({
        kind: "error",
        title: "Error",
        message: err instanceof Error ? err.message : "Error al generar la factura",
      });
    } finally {
      setIsLoading(false);
    }
  }, [api, pushToast]);

  const handleDelete = useCallback(async (id: number) => {
    if (!confirm("¿Estás seguro de que quieres eliminar esta facturación recurrente?")) {
      return;
    }

    setIsLoading(true);
    try {
      const res = await api.recurringInvoices.delete(id);
      if (res.success) {
        pushToast({
          kind: "success",
          title: "Eliminado",
          message: "La facturación recurrente ha sido eliminada",
        });
        // Refresh page
        window.location.reload();
      } else {
        pushToast({
          kind: "error",
          title: "Error",
          message: res.message || "No se pudo eliminar",
        });
      }
    } catch (err) {
      pushToast({
        kind: "error",
        title: "Error",
        message: err instanceof Error ? err.message : "Error al eliminar",
      });
    } finally {
      setIsLoading(false);
    }
  }, [api, pushToast]);

  const navigate = useCallback((href: string) => {
    window.location.href = href;
  }, []);

  const getFrequencyLabel = (frequency: string) => {
    return RECURRING_FREQUENCY_OPTIONS.find(f => f.value === frequency)?.label || frequency;
  };

  const getStatusBadge = (isActive: boolean) => {
    if (isActive) {
      return (
        <span className="bo-recurringStatus bo-recurringStatus--active" data-slot="recurrentes-recurringStatus--active">
          <CheckCircle size={12}>
          Activa
        </span>
      );
    }
    return (
      <span className="bo-recurringStatus bo-recurringStatus--paused" data-slot="recurrentes-recurringStatus--paused">
        <Pause size={12}>
        Pausada
      </span>
    );
  };

  return (
    <div className="bo-recurringInvoicesPage" data-testid="facturas-recurrentes-page">
      <div className="bo-pageHeader" data-testid="facturas-recurrentes-header">
        <div className="bo-pageHeaderTitle" data-testid="facturas-recurrentes-title">
          <RefreshCw size={24}>
          <h1 data-slot="recurrentes-nte">Facturación Recurrente</h1>
        </div>
        <div className="bo-pageHeaderActions" data-testid="facturas-recurrentes-header-actions">
          <button
            className="bo-btn bo-btn--primary"
            onClick={() => navigate("/app/facturas/crear?recurring=true")}
            data-testid="facturas-recurrentes-nueva-btn"
          >
            <Plus size={16}>
            Nueva Facturación Recurrente
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="bo-recurringStats" data-testid="facturas-recurrentes-stats">
        <div className="bo-recurringStatCard" data-testid="facturas-recurrentes-total-stat">
          <div className="bo-recurringStatCardValue" data-slot="recurrentes-recurringStatCardValue">{data.total}</div>
          <div className="bo-recurringStatCardLabel" data-slot="recurrentes-recurringStatCardLabel">Total</div>
        </div>
        <div className="bo-recurringStatCard bo-recurringStatCard--active" data-testid="facturas-recurrentes-activas-stat">
          <div className="bo-recurringStatCardValue" data-slot="recurrentes-recurringStatCardValue">{data.activeCount}</div>
          <div className="bo-recurringStatCardLabel" data-slot="recurrentes-recurringStatCardLabel">Activas</div>
        </div>
        <div className="bo-recurringStatCard bo-recurringStatCard--paused" data-testid="facturas-recurrentes-pausadas-stat">
          <div className="bo-recurringStatCardValue" data-slot="recurrentes-recurringStatCardValue">{data.pausedCount}</div>
          <div className="bo-recurringStatCardLabel" data-slot="recurrentes-recurringStatCardLabel">Pausadas</div>
        </div>
      </div>

      {data.error && (
        <div className="bo-alert bo-alert--error" data-testid="facturas-recurrentes-error-alert">
          <AlertCircle size={16}>
          {data.error}
        </div>
      )}

      {/* Recurring Invoices List */}
      <div className="bo-recurringList" data-testid="facturas-recurrentes-list">
        {data.recurringInvoices.length === 0 ? (
          <div className="bo-emptyState" data-testid="facturas-recurrentes-empty-state">
            <RefreshCw size={48}>
            <h3 data-slot="recurrentes-nte">No hay facturación recurrente</h3>
            <p data-slot="recurrentes-ras">Crea tu primera facturación recurrente para automatizar la creación de facturas.</p>
            <button
              className="bo-btn bo-btn--primary"
              onClick={() => navigate("/app/facturas/crear?recurring=true")}
              data-testid="facturas-recurrentes-crear-btn"
            >
              <Plus size={16}>
              Crear Facturación Recurrente
            </button>
          </div>
        ) : (
          <div className="bo-tableContainer" data-testid="facturas-recurrentes-table-container" data-slot="recurring-table-wrap">
            <table className="bo-table" data-testid="facturas-recurrentes-table" data-slot="recurring-table">
              <thead data-slot="recurring-thead">
                <tr data-slot="recurring-table-row">
                  <th data-slot="recurring-table-header">Cliente</th>
                  <th data-slot="recurring-table-header">Importe</th>
                  <th data-slot="recurring-table-header">Frecuencia</th>
                  <th data-slot="recurring-table-header">Próxima facturación</th>
                  <th data-slot="recurring-table-header">Facturas</th>
                  <th data-slot="recurring-table-header">Estado</th>
                  <th data-slot="recurring-table-header">Acciones</th>
                </tr>
              </thead>
              <tbody data-slot="recurring-tbody">
                {data.recurringInvoices.map((item) => (
                  <tr key={item.id} data-testid={`facturas-recurrentes-row-${item.id}`} data-slot={`recurring-table-row-${item.id}`}>
                    <td data-slot="recurring-table-cell">
                      <div className="bo-recurringCustomer" data-testid="facturas-recurrentes-customer">
                        <div className="bo-recurringCustomerName" data-slot="recurrentes-recurringCustomerName">{item.customer_name}</div>
                        <div className="bo-recurringCustomerEmail" data-slot="recurrentes-recurringCustomerEmail">{item.customer_email}</div>
                      </div>
                    </td>
                    <td data-slot="recurring-table-cell">
                      <div className="bo-recurringAmount" data-testid="facturas-recurrentes-amount">
                        {CURRENCY_SYMBOLS[item.currency] || "€"}{item.amount.toFixed(2)}
                      </div>
                    </td>
                    <td data-slot="recurring-table-cell">
                      <span className="bo-recurringFrequency" data-testid="facturas-recurrentes-frequency">
                        {getFrequencyLabel(item.frequency)}
                      </span>
                    </td>
                    <td data-slot="recurring-table-cell">
                      <div className="bo-recurringNextDate" data-testid="facturas-recurrentes-next-date">
                        <Calendar size={14}>
                        {item.next_billing_date}
                      </div>
                    </td>
                    <td data-slot="recurring-table-cell">
                      <div className="bo-recurringCount" data-testid="facturas-recurrentes-count">
                        <span className="bo-recurringCountValue" data-slot="recurrentes-recurringCountValue">{item.invoice_count}</span>
                        <span className="bo-recurringCountLabel" data-slot="recurrentes-recurringCountLabel">facturas</span>
                      </div>
                    </td>
                    <td data-slot="recurring-table-cell">
                      {getStatusBadge(item.is_active)}
                    </td>
                    <td data-slot="recurring-table-cell">
                      <div className="bo-recurringActions" data-testid="facturas-recurrentes-actions">
                        <button
                          className="bo-btn bo-btn--ghost bo-btn--sm"
                          onClick={() => handleGenerateNow(item.id)}
                          disabled={isLoading || !item.is_active}
                          title="Generar factura ahora"
                          data-testid={`facturas-recurrentes-generate-btn-${item.id}`}
                        >
                          <RefreshCw size={14}>
                        </button>
                        <button
                          className="bo-btn bo-btn--ghost bo-btn--sm"
                          onClick={() => handleToggleActive(item.id, item.is_active)}
                          disabled={isLoading}
                          title={item.is_active ? "Pausar" : "Reanudar"}
                          data-testid={`facturas-recurrentes-toggle-btn-${item.id}`}
                        >
                          {item.is_active ? <Pause size={14}> : <Play size={14}>}
                        </button>
                        <button
                          className="bo-btn bo-btn--ghost bo-btn--sm"
                          onClick={() => navigate(`/app/facturas/${item.id}`)}
                          title="Ver detalles"
                          data-testid={`facturas-recurrentes-view-btn-${item.id}`}
                        >
                          <Eye size={14}>
                        </button>
                        <button
                          className="bo-btn bo-btn--ghost bo-btn--sm bo-btn--danger"
                          onClick={() => handleDelete(item.id)}
                          disabled={isLoading}
                          title="Eliminar"
                          data-testid={`facturas-recurrentes-delete-btn-${item.id}`}
                        >
                          <Trash2 size={14}>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {data.total > data.limit && (
        <div className="bo-pagination" data-testid="facturas-recurrentes-pagination">
          <div className="bo-paginationInfo" data-testid="facturas-recurrentes-pagination-info">
            Mostrando {((data.page - 1) * data.limit) + 1} - {Math.min(data.page * data.limit, data.total)} de {data.total}
          </div>
          <div className="bo-paginationControls" data-testid="facturas-recurrentes-pagination-controls">
            <button
              className="bo-btn bo-btn--ghost"
              disabled={data.page <= 1}
              onClick={() => navigate(`/app/facturas/recurrentes?page=${data.page - 1}`)}
              data-testid="facturas-recurrentes-previous-btn"
            >
              Anterior
            </button>
            <button
              className="bo-btn bo-btn--ghost"
              disabled={data.page * data.limit >= data.total}
              onClick={() => navigate(`/app/facturas/recurrentes?page=${data.page + 1}`)}
              data-testid="facturas-recurrentes-next-btn"
            >
              Siguiente
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
