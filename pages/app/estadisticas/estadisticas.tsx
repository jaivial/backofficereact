import React, { useCallback, useMemo, useState } from "react";
import { usePageContext } from "vike-react/usePageContext";
import { TrendingUp, Users } from "lucide-react";

import { createClient } from "../../../api/client";
import type { AnalyticsOverview, AnalyticsOverviewParams } from "../../../api/types";
import { SimpleTabs } from "../../../ui/nav/SimpleTabs";
import type { Data } from "./+data";
import { AffluenceDashboard } from "./functionalComponents/AffluenceDashboard/AffluenceDashboard";
import { AnalyticsDashboard } from "./functionalComponents/AnalyticsDashboard/AnalyticsDashboard";

/** Afluencia (client flow, full booking history) and Ventas (financial analytics). */
type EstadisticasTab = "afluencia" | "ventas";

const EMPTY_DATA: Data = {
  params: { from: "", to: "", granularity: "day", compare: "previous" },
  overview: null,
  error: null,
};

export default function Page() {
  const pageContext = usePageContext();
  const initialData = (pageContext.data ?? EMPTY_DATA) as Data;
  const api = useMemo(() => createClient({ baseUrl: "" }), []);
  const [activeTab, setActiveTab] = useState<EstadisticasTab>("afluencia");
  const [params, setParams] = useState<AnalyticsOverviewParams>(initialData.params);
  const [overview, setOverview] = useState<AnalyticsOverview | null>(initialData.overview);
  const [error, setError] = useState<string | null>(initialData.error);
  const [loading, setLoading] = useState(false);

  const loadOverview = useCallback(
    async (nextParams: AnalyticsOverviewParams) => {
      setLoading(true);
      setError(null);
      try {
        const response = await api.analytics.getOverview(nextParams);
        if (!response.success) {
          setOverview(null);
          setError(response.message);
          return;
        }
        setOverview(response);
      } catch (loadError) {
        setOverview(null);
        setError(loadError instanceof Error ? loadError.message : "Error cargando estadisticas");
      } finally {
        setLoading(false);
      }
    },
    [api.analytics],
  );

  const handleParamsChange = useCallback(
    (nextParams: AnalyticsOverviewParams) => {
      setParams(nextParams);
      void loadOverview(nextParams);
    },
    [loadOverview],
  );

  const handleRefresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.analytics.refresh({ from: params.from, to: params.to });
      if (!response.success) {
        setError(response.message);
        return;
      }
      await loadOverview(params);
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : "Error actualizando estadisticas");
    } finally {
      setLoading(false);
    }
  }, [api.analytics, loadOverview, params]);

  return (
    <div className="flex flex-col" data-testid="estadisticas-tabs-root" data-ui="estadisticas-tabs-root">
      <div className="bo-estadisticasTabsBar mx-auto w-full max-w-screen-2xl px-0 pt-1 sm:px-6 sm:pt-4 xl:px-8" data-ui="estadisticas-tabs-bar">
        <SimpleTabs
          items={[
            { id: "afluencia", label: "Afluencia", title: "Afluencia de clientes", icon: <Users size={17} strokeWidth={1.8} /> },
            { id: "ventas", label: "Ventas", title: "Estadísticas de ventas", icon: <TrendingUp size={17} strokeWidth={1.8} /> },
          ]}
          activeId={activeTab}
          onChange={(id) => setActiveTab(id as EstadisticasTab)}
          aria-label="Pestañas de estadísticas"
        />
      </div>
      {activeTab === "afluencia" ? (
        <AffluenceDashboard data-ui="estadisticas-page-affluence" />
      ) : (
        <AnalyticsDashboard
          overview={overview}
          params={params}
          loading={loading}
          error={error}
          onParamsChange={handleParamsChange}
          onRefresh={handleRefresh}
          data-ui="estadisticas-page-dashboard"
        />
      )}
    </div>
  );
}
