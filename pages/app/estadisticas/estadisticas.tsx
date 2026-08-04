import React, { useCallback, useMemo, useState } from "react";
import { usePageContext } from "vike-react/usePageContext";

import { createClient } from "../../../api/client";
import type { AnalyticsOverview, AnalyticsOverviewParams } from "../../../api/types";
import type { Data } from "./+data";
import { AnalyticsDashboard } from "./functionalComponents/AnalyticsDashboard/AnalyticsDashboard";

const EMPTY_DATA: Data = {
  params: { from: "", to: "", granularity: "day", compare: "previous" },
  overview: null,
  error: null,
};

export default function Page() {
  const pageContext = usePageContext();
  const initialData = (pageContext.data ?? EMPTY_DATA) as Data;
  const api = useMemo(() => createClient({ baseUrl: "" }), []);
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
    <AnalyticsDashboard
      overview={overview}
      params={params}
      loading={loading}
      error={error}
      onParamsChange={handleParamsChange}
      onRefresh={handleRefresh}
      data-ui="estadisticas-page-dashboard"
    />
  );
}
