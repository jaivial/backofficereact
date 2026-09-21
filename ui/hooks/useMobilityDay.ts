import { useCallback, useEffect, useState } from "react";

import { createClient } from "../../api/client";
import type { MobilityDayConfig } from "../../api/types";

type API = ReturnType<typeof createClient>;

/**
 * Effective "problemas de movilidad" question for one date: the per-day
 * override when it exists, else the global default. The day always wins over
 * the global setting.
 *
 * Observation point: `mobility_day.effective` — shared by the day config
 * panel and the booking editor. Coordination id: mobility_day_override_v1
 * (backend `/api/admin/config/mobility-day`, preact booking wizard).
 */
export function useMobilityDay(api: API, date: string) {
  const [config, setConfig] = useState<MobilityDayConfig | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!date) return;
    let cancelled = false;
    void api.config
      .getMobilityDay(date)
      .then((res) => {
        if (cancelled || !res.success) return;
        setConfig(res as unknown as MobilityDayConfig);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [api, date]);

  // Optimistic toggle: the override always records the concrete day choice,
  // which then shadows the global default for this date only.
  const setEnabled = useCallback(
    async (enabled: boolean) => {
      const previous = config;
      setBusy(true);
      setConfig((cur) => (cur ? { ...cur, mobility_enabled: enabled, effective: enabled } : cur));
      try {
        const res = await api.config.setMobilityDay(date, enabled);
        if (!res.success) {
          setConfig(previous);
          return false;
        }
        setConfig(res as unknown as MobilityDayConfig);
        return true;
      } catch {
        setConfig(previous);
        return false;
      } finally {
        setBusy(false);
      }
    },
    [api, config, date],
  );

  return {
    enabled: Boolean(config?.effective),
    override: config?.mobility_enabled ?? null,
    busy,
    setEnabled,
  };
}
