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
        <span className="bo-badge bo-badge--success">
          <CheckCircle size={12} />
          Activa
        </span>
      );
    }
    return (
      <span className="bo-badge bo-badge--warning">
        <Pause size={12} />
        Pausada
      </span>
    );
  };

  return (
    <div className="bo-stack p-4">
      <div className="bo-toolbar">
        <div className="bo-toolbarLeft">
          <RefreshCw size={24} className="text-mutedText" />
          <h1 className="bo-h3 m-0">Facturación Recurrente</h1>
        </div>
        <div className="bo-toolbarRight">
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
      <div className="grid grid-cols-3 grid-gap-4">
        <div className="bo-card">
          <div className="bo-statValue text-2xl bo-font-bold">{data.total}</div>
          <div className="bo-statLabel">Total</div>
        </div>
        <div className="bo-card">
          <div className="bo-statValue text-2xl bo-font-bold text-success">{data.activeCount}</div>
          <div className="bo-statLabel">Activas</div>
        </div>
        <div className="bo-card">
          <div className="bo-statValue text-2xl bo-font-bold text-warning">{data.pausedCount}</div>
          <div className="bo-statLabel">Pausadas</div>
        </div>
      </div>

      {data.error && (
        <div className="bo-alert bo-alert--error">
          <AlertCircle size={16} />
          {data.error}
        </div>
      )}

      {/* Recurring Invoices List */}
      <div className="bo-stack">
        {data.recurringInvoices.length === 0 ? (
          <div className="bo-emptyState">
            <RefreshCw size={48} className="text-mutedText bo-mb-4" />
            <h3 className="bo-h4 bo-mb-2">No hay facturación recurrente</h3>
            <p className="text-mutedText bo-mb-4 bo-max-w-sm">Crea tu primera facturación recurrente para automatizar la creación de facturas.</p>
            <button
              className="bo-btn bo-btn--primary"
              onClick={() => window.location.href = "/app/facturas/crear?recurring=true"}
            >
              <Plus size={16} />
              Crear Facturación Recurrente
            </button>
          </div>
        ) : (
          <div className="bo-tableWrapper">
            <table className="bo-table">
              <thead>
                <tr className="bo-tableHeader">
                  <th className="bo-tableHeaderCell">Cliente</th>
                  <th className="bo-tableHeaderCell">Importe</th>
                  <th className="bo-tableHeaderCell">Frecuencia</th>
                  <th className="bo-tableHeaderCell">Próxima facturación</th>
                  <th className="bo-tableHeaderCell">Facturas</th>
                  <th className="bo-tableHeaderCell">Estado</th>
                  <th className="bo-tableHeaderCell">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {data.recurringInvoices.map((item) => (
                  <tr key={item.id} className="bo-tableRow">
                    <td className="bo-tableCell">
                      <div className="bo-stack gap-1">
                        <span className="bo-weight-medium">{item.customer_name}</span>
                        <span className="text-xs text-mutedText">{item.customer_email}</span>
                      </div>
                    </td>
                    <td className="bo-tableCell">
                      <span className="bo-weight-medium">
                        {CURRENCY_SYMBOLS[item.currency] || "€"}{item.amount.toFixed(2)}
                      </span>
                    </td>
                    <td className="bo-tableCell">
                      <span>{getFrequencyLabel(item.frequency)}</span>
                    </td>
                    <td className="bo-tableCell">
                      <div className="bo-row gap-1">
                        <Calendar size={14} className="text-mutedText" />
                        {item.next_billing_date}
                      </div>
                    </td>
                    <td className="bo-tableCell">
                      <div className="bo-row gap-1">
                        <span className="bo-weight-semibold">{item.invoice_count}</span>
                        <span className="text-mutedText">facturas</span>
                      </div>
                    </td>
                    <td className="bo-tableCell">
                      {getStatusBadge(item.is_active)}
                    </td>
                    <td className="bo-tableCell">
                      <div className="bo-row" style={{ gap: "var(--bo-space-1)" }}>
                        <button
                          className="bo-btnIcon"
                          onClick={() => handleGenerateNow(item.id)}
                          disabled={isLoading || !item.is_active}
                          title="Generar factura ahora"
                        >
                          <RefreshCw size={14} />
                        </button>
                        <button
                          className="bo-btnIcon"
                          onClick={() => handleToggleActive(item.id, item.is_active)}
                          disabled={isLoading}
                          title={item.is_active ? "Pausar" : "Reanudar"}
                        >
                          {item.is_active ? <Pause size={14} /> : <Play size={14} />}
                        </button>
                        <button
                          className="bo-btnIcon"
                          onClick={() => window.location.href = `/app/facturas/${item.id}`}
                          title="Ver detalles"
                        >
                          <Eye size={14} />
                        </button>
                        <button
                          className="bo-btnIcon text-danger"
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
          <div className="bo-paginationButtons">
            <button
              className="bo-btn bo-btn--ghost"
              disabled={data.page <= 1}
              onClick={() => window.location.href = `/app/facturas/recurrentes?page=${data.page - 1}`}
            >
              Anterior
            </button>
            <button
              className="bo-btn bo-btn--ghost"
              disabled={data.page * data.limit >= data.total}
              onClick={() => window.location.href = `/app/facturas/recurrentes?page=${data.page + 1}`}
            >
              Siguiente
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
