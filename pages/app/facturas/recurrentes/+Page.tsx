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
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-bo-xs font-medium bo-badge--success">
          <CheckCircle size={12} />
          Activa
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-bo-xs font-medium bo-badge--warning">
        <Pause size={12} />
        Pausada
      </span>
    );
  };

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2.5">
          <RefreshCw size={24} className="text-mutedText" />
          <h1 className="text-2xl font-bold m-0">Facturación Recurrente</h1>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[rgba(185,168,255,0.30)] bg-[rgba(185,168,255,0.16)] text-bo-text text-sm font-bold transition-all hover:border-[rgba(185,168,255,0.40)] hover:bg-[rgba(185,168,255,0.24)] disabled:opacity-55 disabled:cursor-not-allowed mx-auto"
            onClick={() => navigate("/app/facturas/crear?recurring=true")}
          >
            <Plus size={16} />
            Nueva Facturación Recurrente
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 grid-gap-4">
        <div className="rounded-bo-md bg-bo-surface-2 border border-white/6 shadow-bo-soft p-3">
          <div className="font-bold text-2xl">{data.total}</div>
          <div className="text-bo-xs text-bo-muted">Total</div>
        </div>
        <div className="rounded-bo-md bg-bo-surface-2 border border-white/6 shadow-bo-soft p-3">
          <div className="font-bold text-2xl text-success">{data.activeCount}</div>
          <div className="text-bo-xs text-bo-muted">Activas</div>
        </div>
        <div className="rounded-bo-md bg-bo-surface-2 border border-white/6 shadow-bo-soft p-3">
          <div className="font-bold text-2xl text-warning">{data.pausedCount}</div>
          <div className="text-bo-xs text-bo-muted">Pausadas</div>
        </div>
      </div>

      {data.error && (
        <div className="bo-alert bo-alert--error">
          <AlertCircle size={16} />
          {data.error}
        </div>
      )}

      {/* Recurring Invoices List */}
      <div className="flex flex-col gap-bo-4 p-4">
        {data.recurringInvoices.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-bo-muted text-center gap-3">
            <RefreshCw size={48} className="text-mutedText mb-4" />
            <h3 className="bo-h4 mb-2">No hay facturación recurrente</h3>
            <p className="text-mutedText mb-4 max-w-sm">Crea tu primera facturación recurrente para automatizar la creación de facturas.</p>
            <button
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[rgba(185,168,255,0.30)] bg-[rgba(185,168,255,0.16)] text-bo-text text-sm font-bold transition-all hover:border-[rgba(185,168,255,0.40)] hover:bg-[rgba(185,168,255,0.24)] disabled:opacity-55 disabled:cursor-not-allowed mx-auto"
              onClick={() => window.location.href = "/app/facturas/crear?recurring=true"}
            >
              <Plus size={16} />
              Crear Facturación Recurrente
            </button>
          </div>
        ) : (
          <div className="max-h-[300px] overflow-y-auto border border-bo-border rounded-bo-sm">
            <table className="w-full border-collapse text-bo-sm">
              <thead>
                <tr className="bo-tableHeader">
                  <th className="p-3 text-left font-semibold text-bo-faint">Cliente</th>
                  <th className="p-3 text-left font-semibold text-bo-faint">Importe</th>
                  <th className="p-3 text-left font-semibold text-bo-faint">Frecuencia</th>
                  <th className="p-3 text-left font-semibold text-bo-faint">Próxima facturación</th>
                  <th className="p-3 text-left font-semibold text-bo-faint">Facturas</th>
                  <th className="p-3 text-left font-semibold text-bo-faint">Estado</th>
                  <th className="p-3 text-left font-semibold text-bo-faint">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {data.recurringInvoices.map((item) => (
                  <tr key={item.id} className="bo-tableRow">
                    <td className="p-3 text-bo-text">
                      <div className="bo-stack gap-1">
                        <span className="font-medium">{item.customer_name}</span>
                        <span className="text-xs text-mutedText">{item.customer_email}</span>
                      </div>
                    </td>
                    <td className="p-3 text-bo-text">
                      <span className="font-medium">
                        {CURRENCY_SYMBOLS[item.currency] || "€"}{item.amount.toFixed(2)}
                      </span>
                    </td>
                    <td className="p-3 text-bo-text">
                      <span>{getFrequencyLabel(item.frequency)}</span>
                    </td>
                    <td className="p-3 text-bo-text">
                      <div className="flex gap-bo-4 gap-1">
                        <Calendar size={14} className="text-mutedText" />
                        {item.next_billing_date}
                      </div>
                    </td>
                    <td className="p-3 text-bo-text">
                      <div className="flex gap-bo-4 gap-1">
                        <span className="font-semibold">{item.invoice_count}</span>
                        <span className="text-mutedText">facturas</span>
                      </div>
                    </td>
                    <td className="p-3 text-bo-text">
                      {getStatusBadge(item.is_active)}
                    </td>
                    <td className="p-3 text-bo-text">
                      <div className="flex gap-bo-4" style={{ gap: "var(--bo-space-1)" }}>
                        <button
                          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.03] text-bo-text transition-all hover:bg-white/[0.06]"
                          onClick={() => handleGenerateNow(item.id)}
                          disabled={isLoading || !item.is_active}
                          title="Generar factura ahora"
                        >
                          <RefreshCw size={14} />
                        </button>
                        <button
                          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.03] text-bo-text transition-all hover:bg-white/[0.06]"
                          onClick={() => handleToggleActive(item.id, item.is_active)}
                          disabled={isLoading}
                          title={item.is_active ? "Pausar" : "Reanudar"}
                        >
                          {item.is_active ? <Pause size={14} /> : <Play size={14} />}
                        </button>
                        <button
                          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.03] text-bo-text transition-all hover:bg-white/[0.06]"
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
        <div className="flex items-center justify-between gap-3 border-t border-bo-border mt-4 pt-4">
          <div className="text-bo-sm text-bo-muted">
            Mostrando {((data.page - 1) * data.limit) + 1} - {Math.min(data.page * data.limit, data.total)} de {data.total}
          </div>
          <div className="flex items-center gap-2">
            <button
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-white/[0.06] bg-transparent text-bo-text text-sm font-bold transition-all hover:bg-white/[0.04]"
              disabled={data.page <= 1}
              onClick={() => window.location.href = `/app/facturas/recurrentes?page=${data.page - 1}`}
            >
              Anterior
            </button>
            <button
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-white/[0.06] bg-transparent text-bo-text text-sm font-bold transition-all hover:bg-white/[0.04]"
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
