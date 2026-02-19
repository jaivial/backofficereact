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
        <span className="bo-recurringStatus bo-recurringStatus--active">
          <CheckCircle size={12} />
          Activa
        </span>
      );
    }
    return (
      <span className="bo-recurringStatus bo-recurringStatus--paused">
        <Pause size={12} />
        Pausada
      </span>
    );
  };

  return (
    <div className="bo-recurringInvoicesPage">
      <div className="bo-pageHeader">
        <div className="bo-pageHeaderTitle">
          <RefreshCw size={24} />
          <h1>Facturación Recurrente</h1>
        </div>
        <div className="bo-pageHeaderActions">
          <button
            className="bo-btn bo-btn--primary"
            onClick={() => navigate("/app/facturas/crear?recurring=true")}
          >
            <Plus size={16} />
            Nueva Facturación Recurrente
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="bo-recurringStats">
        <div className="bo-recurringStatCard">
          <div className="bo-recurringStatCardValue">{data.total}</div>
          <div className="bo-recurringStatCardLabel">Total</div>
        </div>
        <div className="bo-recurringStatCard bo-recurringStatCard--active">
          <div className="bo-recurringStatCardValue">{data.activeCount}</div>
          <div className="bo-recurringStatCardLabel">Activas</div>
        </div>
        <div className="bo-recurringStatCard bo-recurringStatCard--paused">
          <div className="bo-recurringStatCardValue">{data.pausedCount}</div>
          <div className="bo-recurringStatCardLabel">Pausadas</div>
        </div>
      </div>

      {data.error && (
        <div className="bo-alert bo-alert--error">
          <AlertCircle size={16} />
          {data.error}
        </div>
      )}

      {/* Recurring Invoices List */}
      <div className="bo-recurringList">
        {data.recurringInvoices.length === 0 ? (
          <div className="bo-emptyState">
            <RefreshCw size={48} />
            <h3>No hay facturación recurrente</h3>
            <p>Crea tu primera facturación recurrente para automatizar la creación de facturas.</p>
            <button
              className="bo-btn bo-btn--primary"
              onClick={() => navigate("/app/facturas/crear?recurring=true")}
            >
              <Plus size={16} />
              Crear Facturación Recurrente
            </button>
          </div>
        ) : (
          <div className="bo-tableContainer">
            <table className="bo-table">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Importe</th>
                  <th>Frecuencia</th>
                  <th>Próxima facturación</th>
                  <th>Facturas</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {data.recurringInvoices.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <div className="bo-recurringCustomer">
                        <div className="bo-recurringCustomerName">{item.customer_name}</div>
                        <div className="bo-recurringCustomerEmail">{item.customer_email}</div>
                      </div>
                    </td>
                    <td>
                      <div className="bo-recurringAmount">
                        {CURRENCY_SYMBOLS[item.currency] || "€"}{item.amount.toFixed(2)}
                      </div>
                    </td>
                    <td>
                      <span className="bo-recurringFrequency">
                        {getFrequencyLabel(item.frequency)}
                      </span>
                    </td>
                    <td>
                      <div className="bo-recurringNextDate">
                        <Calendar size={14} />
                        {item.next_billing_date}
                      </div>
                    </td>
                    <td>
                      <div className="bo-recurringCount">
                        <span className="bo-recurringCountValue">{item.invoice_count}</span>
                        <span className="bo-recurringCountLabel">facturas</span>
                      </div>
                    </td>
                    <td>
                      {getStatusBadge(item.is_active)}
                    </td>
                    <td>
                      <div className="bo-recurringActions">
                        <button
                          className="bo-btn bo-btn--ghost bo-btn--sm"
                          onClick={() => handleGenerateNow(item.id)}
                          disabled={isLoading || !item.is_active}
                          title="Generar factura ahora"
                        >
                          <RefreshCw size={14} />
                        </button>
                        <button
                          className="bo-btn bo-btn--ghost bo-btn--sm"
                          onClick={() => handleToggleActive(item.id, item.is_active)}
                          disabled={isLoading}
                          title={item.is_active ? "Pausar" : "Reanudar"}
                        >
                          {item.is_active ? <Pause size={14} /> : <Play size={14} />}
                        </button>
                        <button
                          className="bo-btn bo-btn--ghost bo-btn--sm"
                          onClick={() => navigate(`/app/facturas/${item.id}`)}
                          title="Ver detalles"
                        >
                          <Eye size={14} />
                        </button>
                        <button
                          className="bo-btn bo-btn--ghost bo-btn--sm bo-btn--danger"
                          onClick={() => handleDelete(item.id)}
                          disabled={isLoading}
                          title="Eliminar"
                        >
                          <Trash2 size={14} />
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
        <div className="bo-pagination">
          <div className="bo-paginationInfo">
            Mostrando {((data.page - 1) * data.limit) + 1} - {Math.min(data.page * data.limit, data.total)} de {data.total}
          </div>
          <div className="bo-paginationControls">
            <button
              className="bo-btn bo-btn--ghost"
              disabled={data.page <= 1}
              onClick={() => navigate(`/app/facturas/recurrentes?page=${data.page - 1}`)}
            >
              Anterior
            </button>
            <button
              className="bo-btn bo-btn--ghost"
              disabled={data.page * data.limit >= data.total}
              onClick={() => navigate(`/app/facturas/recurrentes?page=${data.page + 1}`)}
            >
              Siguiente
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
