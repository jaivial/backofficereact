import React, { useCallback, useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { usePageContext } from "vike-react/usePageContext";
import { navigate } from "vike/client/router";

import { Breadcrumbs } from "../../../../ui/nav/Breadcrumbs";
import { SimpleTabs } from "../../../../ui/nav/SimpleTabs";
import { InlineAlert } from "../../../../ui/feedback/InlineAlert";
import { LoadingSpinner } from "../../../../ui/feedback/LoadingSpinner";
import { EmptyState } from "../../../../ui/feedback/EmptyState";

import { fetchItemById, fetchWarehouses, type StockItem, type Warehouse } from "./stockItemApi";
import { HistoryTab } from "./tabs/HistoryTab";
import { WasteTab } from "./tabs/WasteTab";
import { TargetsTab } from "./tabs/TargetsTab";
import { CostTab } from "./tabs/CostTab";
import { SettingsTab } from "./tabs/SettingsTab";

type TabId = "historial" | "merma" | "objetivos" | "coste" | "ajustes";

const TABS: { id: TabId; label: string }[] = [
  { id: "historial", label: "Historial" },
  { id: "merma", label: "Merma" },
  { id: "objetivos", label: "Objetivos" },
  { id: "coste", label: "Coste" },
  { id: "ajustes", label: "Ajustes" },
];

function deductionLabel(deductionSource: string): string {
  if (deductionSource === "PRODUCTION") return "Elaboración";
  if (deductionSource === "SALE") return "Venta";
  return "Manual";
}

export function StockItemDetail() {
  const pageContext = usePageContext();
  const id = Number(pageContext.urlParsed.search.id || "");
  const [item, setItem] = useState<StockItem | null>(null);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<TabId>("historial");

  const load = useCallback(async () => {
    if (!Number.isFinite(id) || id <= 0) {
      setError("ID de artículo no válido");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const [found, warehouseData] = await Promise.all([fetchItemById(id), fetchWarehouses()]);
      if (!found) {
        setError("Artículo no encontrado");
        setLoading(false);
        return;
      }
      setItem(found);
      setWarehouses(warehouseData);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo cargar el artículo");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  const refreshItem = useCallback(async () => {
    if (!Number.isFinite(id) || id <= 0) return;
    try {
      const found = await fetchItemById(id);
      if (found) setItem(found);
    } catch {
      /* keep current item on transient refresh error */
    }
  }, [id]);

  return (
    <main className="bo-stockPage" data-ui="stock-item-page">
      <div className="bo-container" data-slot="stock-item-container">
        <Breadcrumbs items={[{ label: "Stock", href: "/app/stock" }, { label: item?.name || "Artículo" }]} />

        <header className="bo-stockHero" data-ui="stock-item-header">
          <div className="bo-stockHeroTitles" data-ui="stock-item-heading">
            <button
              type="button"
              className="bo-stockIconBtn"
              aria-label="Volver al stock"
              onClick={() => navigate("/app/stock")}
              data-testid="stock-item-back"
            >
              <ArrowLeft size={18} aria-hidden="true" data-ui="stock-item-back-icon" />
            </button>
            <div data-ui="stock-item-titles">
              <h1 className="bo-pageTitle" data-ui="stock-item-title">{item?.name || "Artículo"}</h1>
              <p className="bo-pageSubtitle" data-ui="stock-item-subtitle">
                {item ? `${item.displayUnit.label} · ${deductionLabel(item.deductionSource)}` : "Cargando…"}
              </p>
            </div>
          </div>
        </header>

        {error ? <InlineAlert kind="error" title="Error" message={error} /> : null}

        {loading ? (
          <LoadingSpinner centered size="sm" label="Cargando artículo…" />
        ) : !item ? (
          <EmptyState
            title="Artículo no encontrado"
            description="El artículo solicitado no existe o fue eliminado."
            data-ui="stock-item-empty"
          />
        ) : (
          <>
            <div className="bo-stockTabsRow" data-ui="stock-item-tabs">
              <SimpleTabs items={TABS} activeId={tab} onChange={(value) => setTab(value as TabId)} aria-label="Secciones del artículo" />
            </div>
            <div className="bo-stockStack" data-ui="stock-item-content">
              {tab === "historial" ? <HistoryTab item={item} /> : null}
              {tab === "merma" ? <WasteTab item={item} warehouses={warehouses} onChanged={refreshItem} /> : null}
              {tab === "objetivos" ? <TargetsTab item={item} warehouses={warehouses} onChanged={refreshItem} /> : null}
              {tab === "coste" ? <CostTab item={item} onChanged={refreshItem} /> : null}
              {tab === "ajustes" ? <SettingsTab item={item} onChanged={refreshItem} onDeleted={() => navigate("/app/stock")} /> : null}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
