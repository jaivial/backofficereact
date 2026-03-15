import React, { useCallback, useMemo, useState } from "react";
import { Check, RefreshCcw } from "lucide-react";
import { usePageContext } from "vike-react/usePageContext";

import { createClient } from "../../../../../api/client";
import type { Member, MemberStats } from "../../../../../api/types";
import type { Data } from "./+data";
import { useErrorToast } from "../../../../../ui/feedback/useErrorToast";
import { useToasts } from "../../../../../ui/feedback/useToasts";
import { DatePicker } from "../../../../../ui/inputs/DatePicker";
import { Button } from "../../../../../ui/actions/Button";
import { applyLiveToStats, formatElapsedHHMMSS, useMemberLive } from "../_shared/realtime";

function parseHours(v: string): number | null {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

function todayISO(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default function Page() {
  const pageContext = usePageContext();
  const data = (pageContext.data ?? {
    memberId: 0,
    member: null,
    initialStats: null,
    date: todayISO(),
    error: null,
  }) as Data;
  const api = useMemo(() => createClient({ baseUrl: "" }), []);
  const { pushToast } = useToasts();

  const [member, setMember] = useState<Member | null>(data.member);
  const [stats, setStats] = useState<MemberStats | null>(data.initialStats);
  const [date, setDate] = useState(data.date || todayISO());
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
        <div className="rounded-bo-lg bg-bo-surface shadow-bo-soft">
          <div className="flex items-end justify-between pb-2 px-4 pt-4">
            <div className="text-bo-sm font-bold text-bo-text">Miembro no disponible</div>
            <div className="text-bo-xs text-bo-faint">No se pudo cargar el contrato del miembro solicitado.</div>
          </div>
        </div>
      ) : (
        <div className="rounded-bo-lg bg-bo-surface shadow-bo-soft">
          <div className="bo-panelHead bo-memberStatsHead">
            <div>
              <div className="text-bo-sm font-bold text-bo-text">Configuracion de contrato</div>
              <div className="text-bo-xs text-bo-faint">Ajusta horas semanales y seguimiento del periodo.</div>
            </div>
            <div className="bo-memberStatsControls">
              <label className="grid gap-2 bo-memberControl">
                <span className="text-bo-sm font-semibold text-bo-muted">Fecha</span>
                <DatePicker
                  value={date}
                  onChange={(nextDate) => {
                    setDate(nextDate);
                    void reloadStats(nextDate);
                  }}
                />
              </label>
              <button className="w-9 h-9 rounded-bo-sm border border-bo-border bg-white/5 text-bo-muted inline-flex items-center justify-center cursor-pointer hover:bg-white/10 transition-colors bo-memberRefreshBtn" type="button" onClick={() => void reloadStats(date)} disabled={loading} aria-label="Recargar contrato">
                <RefreshCcw size={14} className={`bo-memberRefreshIcon${loading ? " is-spinning" : ""}`} />
              </button>
            </div>
          </div>

          <div className="p-4 bo-memberContractBody">
            <label className="grid gap-2">
              <span className="text-bo-sm font-semibold text-bo-muted">Horas de contrato semanales</span>
              <input
                id="weeklyContractHours"
                className="h-10 rounded-bo-md border border-bo-border bg-white/5 text-bo-text px-3 outline-none min-w-0 transition-colors"
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
              <div className="grid grid-cols-[120px_1fr] gap-2">
                <div className="text-bo-sm text-bo-muted">Esperadas en periodo</div>
                <div className="text-bo-sm text-bo-text">{(statsLive?.summary.expectedHours ?? 0).toFixed(2)} h</div>
              </div>
              <div className="grid grid-cols-[120px_1fr] gap-2">
                <div className="text-bo-sm text-bo-muted">Trabajadas en periodo</div>
                <div className="text-bo-sm text-bo-text">{(statsLive?.summary.workedHours ?? 0).toFixed(2)} h</div>
              </div>
              <div className="grid grid-cols-[120px_1fr] gap-2">
                <div className="text-bo-sm text-bo-muted">Cumplimiento semanal</div>
                <div className="text-bo-sm text-bo-text">{(statsLive?.summary.weeklyProgressPercent ?? 0).toFixed(2)}%</div>
              </div>
              {liveEntry ? (
                <div className="grid grid-cols-[120px_1fr] gap-2">
                  <div className="text-bo-sm text-bo-muted">Fichando ahora</div>
                  <div className="text-bo-sm text-bo-text">{formatElapsedHHMMSS(liveEntry, tick)}</div>
                </div>
              ) : null}
            </div>

            <div className="bo-memberSaveInline">
              <Button variant="primary" type="button" onClick={onSave} disabled={saving}>
                <Check size={14} strokeWidth={1.8} />
                {saving ? "Guardando..." : "Guardar contrato"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
