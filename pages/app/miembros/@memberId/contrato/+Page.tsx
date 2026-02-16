import React, { useCallback, useMemo, useState } from "react";
import { Check, RefreshCcw } from "lucide-react";
import { usePageContext } from "vike-react/usePageContext";

import { createClient } from "../../../../../api/client";
import type { Member, MemberStats } from "../../../../../api/types";
import type { Data } from "./+data";
import { useErrorToast } from "../../../../../ui/feedback/useErrorToast";
import { useToasts } from "../../../../../ui/feedback/useToasts";
import { DatePicker } from "../../../../../ui/inputs/DatePicker";
import { applyLiveToStats, formatElapsedHHMMSS, useMemberLive } from "../_shared/realtime";

function parseHours(v: string): number | null {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

export default function Page() {
  const pageContext = usePageContext();
  const data = pageContext.data as Data;
  const api = useMemo(() => createClient({ baseUrl: "" }), []);
  const { pushToast } = useToasts();

  const [member, setMember] = useState<Member | null>(data.member);
  const [stats, setStats] = useState<MemberStats | null>(data.initialStats);
  const [date, setDate] = useState(data.date);
  const [weeklyContractHours, setWeeklyContractHours] = useState(String(data.member?.weeklyContractHours ?? 40));
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(data.error);
  useErrorToast(error);

  const { liveEntry, tick, liveHours } = useMemberLive(member?.id);
  const statsLive = useMemo(() => applyLiveToStats(stats, liveEntry, liveHours, date), [date, liveEntry, liveHours, stats]);

  const reloadStats = useCallback(
    async (nextDate: string) => {
      if (!data.memberId) return;
      setLoading(true);
      setError(null);
      try {
        const res = await api.members.getStats(data.memberId, { view: "weekly", date: nextDate });
        if (res.success) setStats(res);
        else setError(res.message || "Error cargando contrato");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error cargando contrato");
      } finally {
        setLoading(false);
      }
    },
    [api.members, data.memberId],
  );

  const onSave = useCallback(async () => {
    if (!member) return;
    const parsed = parseHours(weeklyContractHours);
    if (parsed === null) {
      setError("Las horas de contrato deben ser un numero >= 0");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const res = await api.members.patch(member.id, { weeklyContractHours: parsed });
      if (!res.success) {
        setError(res.message || "No se pudo guardar");
        return;
      }
      setMember(res.member);
      setWeeklyContractHours(String(res.member.weeklyContractHours));
      pushToast({ kind: "success", title: "Contrato guardado" });
      void reloadStats(date);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }, [api.members, date, member, pushToast, reloadStats, weeklyContractHours]);

  return (
    <section aria-label="Contrato del miembro" className="bo-content-grid bo-memberDetailPage">
      {!member ? (
        <div className="bo-panel">
          <div className="bo-panelHead">
            <div className="bo-panelTitle">Miembro no disponible</div>
            <div className="bo-panelMeta">No se pudo cargar el contrato del miembro solicitado.</div>
          </div>
        </div>
      ) : (
        <div className="bo-panel">
          <div className="bo-panelHead bo-memberStatsHead">
            <div>
              <div className="bo-panelTitle">Configuracion de contrato</div>
              <div className="bo-panelMeta">Ajusta horas semanales y seguimiento del periodo.</div>
            </div>
            <div className="bo-memberStatsControls">
              <label className="bo-field bo-memberControl">
                <span className="bo-label">Fecha</span>
                <DatePicker
                  value={date}
                  onChange={(nextDate) => {
                    setDate(nextDate);
                    void reloadStats(nextDate);
                  }}
                />
              </label>
              <button className="bo-actionBtn bo-memberRefreshBtn" type="button" onClick={() => void reloadStats(date)} disabled={loading} aria-label="Recargar contrato">
                <RefreshCcw size={14} className={`bo-memberRefreshIcon${loading ? " is-spinning" : ""}`} />
              </button>
            </div>
          </div>

          <div className="bo-panelBody bo-memberContractBody">
            <label className="bo-field">
              <span className="bo-label">Horas de contrato semanales</span>
              <input
                id="weeklyContractHours"
                className="bo-input"
                type="number"
                min={0}
                step={0.25}
                value={weeklyContractHours}
                disabled={saving}
                onChange={(e) => setWeeklyContractHours(e.target.value)}
              />
            </label>
            <div className="bo-memberContractNote">Este valor se usa para calcular cumplimiento semanal y progreso del periodo.</div>

            <div className="bo-kvGrid">
              <div className="bo-kv">
                <div className="bo-kvLabel">Esperadas en periodo</div>
                <div className="bo-kvValue">{(statsLive?.summary.expectedHours ?? 0).toFixed(2)} h</div>
              </div>
              <div className="bo-kv">
                <div className="bo-kvLabel">Trabajadas en periodo</div>
                <div className="bo-kvValue">{(statsLive?.summary.workedHours ?? 0).toFixed(2)} h</div>
              </div>
              <div className="bo-kv">
                <div className="bo-kvLabel">Cumplimiento semanal</div>
                <div className="bo-kvValue">{(statsLive?.summary.weeklyProgressPercent ?? 0).toFixed(2)}%</div>
              </div>
              {liveEntry ? (
                <div className="bo-kv">
                  <div className="bo-kvLabel">Fichando ahora</div>
                  <div className="bo-kvValue">{formatElapsedHHMMSS(liveEntry, tick)}</div>
                </div>
              ) : null}
            </div>

            <div className="bo-memberSaveInline">
              <button className="bo-btn bo-btn--primary" type="button" onClick={onSave} disabled={saving}>
                <Check size={14} strokeWidth={1.8} />
                {saving ? "Guardando..." : "Guardar contrato"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
