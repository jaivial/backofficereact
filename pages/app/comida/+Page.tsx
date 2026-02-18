import React, { useCallback, useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { usePageContext } from "vike-react/usePageContext";

import { createClient } from "../../../api/client";
import type { FoodItem, Vino } from "../../../api/types";
import { useErrorToast } from "../../../ui/feedback/useErrorToast";
import { useToasts } from "../../../ui/feedback/useToasts";
import { ConfirmDialog } from "../../../ui/overlays/ConfirmDialog";
import { FoodFilters } from "./_components/FoodFilters";
import { FoodItemCard } from "./_components/FoodItemCard";
import { FoodItemModal } from "./_components/FoodItemModal";
import { WineModal } from "./_components/WineModal";

type FoodType = "platos" | "bebidas" | "cafes" | "vinos";

const FOOD_TABS: { type: FoodType; labelKey: string }[] = [
  { type: "platos", labelKey: "food.tabs.platos" },
  { type: "bebidas", labelKey: "food.tabs.bebidas" },
  { type: "cafes", labelKey: "food.tabs.cafes" },
  { type: "vinos", labelKey: "food.tabs.vinos" },
];

type PageData = {
  error: string | null;
};

interface FoodListResult {
  success: boolean;
  items?: FoodItem[];
  message?: string;
}

interface VinosResult {
  success: boolean;
  vinos?: Vino[];
  message?: string;
}

function formatEuro(price: number): string {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(price);
}

export default function Page() {
  const pageContext = usePageContext();
  const data = pageContext.data as PageData;
  const api = useMemo(() => createClient({ baseUrl: "" }), []);
  const { pushToast } = useToasts();
  const reduceMotion = useReducedMotion();

  const [activeTab, setActiveTab] = useState<FoodType>("platos");
  const [items, setItems] = useState<FoodItem[]>([]);
  const [vinos, setVinos] = useState<Vino[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [tipoFilter, setTipoFilter] = useState("");
  const [activeFilter, setActiveFilter] = useState<"all" | "active" | "inactive">("all");

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<FoodItem | Vino | null>(null);

  // Delete confirmation
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; item: FoodItem | Vino | null }>({
    open: false,
    item: null,
  });

  useErrorToast(data.error);

  // Load data when tab changes
  useEffect(() => {
    if (activeTab === "vinos") {
      loadVinos();
    } else {
      loadItems();
    }
  }, [activeTab]);

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const params: { tipo?: string; active?: number; search?: string } = {};
      if (tipoFilter) params.tipo = tipoFilter;
      if (activeFilter !== "all") params.active = activeFilter === "active" ? 1 : 0;
      if (search) params.search = search;

      let res: FoodListResult;
      if (activeTab === "cafes") {
        res = await api.cafes.list(params) as FoodListResult;
      } else if (activeTab === "bebidas") {
        res = await api.bebidas.list(params) as FoodListResult;
      } else {
        res = await api.platos.list(params) as FoodListResult;
      }

      if (res.success && res.items) {
        setItems(res.items);
      } else {
        pushToast({ kind: "error", title: "Error", message: res.message || "Error cargando datos" });
        setItems([]);
      }
    } catch {
      pushToast({ kind: "error", title: "Error", message: "Error de conexión" });
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [activeTab, api, activeFilter, search, tipoFilter, pushToast]);

  const loadVinos = useCallback(async () => {
    setLoading(true);
    try {
      const params: { tipo?: string; active?: number } = {};
      if (tipoFilter) params.tipo = tipoFilter;
      if (activeFilter !== "all") params.active = activeFilter === "active" ? 1 : 0;

      const res = await api.vinos.list(params) as VinosResult;
      if (res.success && res.vinos) {
        setVinos(res.vinos);
      } else {
        pushToast({ kind: "error", title: "Error", message: res.message || "Error cargando vinos" });
        setVinos([]);
      }
    } catch {
      pushToast({ kind: "error", title: "Error", message: "Error de conexión" });
      setVinos([]);
    } finally {
      setLoading(false);
    }
  }, [api, activeFilter, search, tipoFilter, pushToast]);

  // Reload when filters change
  useEffect(() => {
    if (activeTab !== "vinos") {
      loadItems();
    } else {
      loadVinos();
    }
  }, [activeFilter, search, tipoFilter]);

  const handleCreate = useCallback(() => {
    setEditingItem(null);
    setModalOpen(true);
  }, []);

  const handleEdit = useCallback((item: FoodItem | Vino) => {
    setEditingItem(item);
    setModalOpen(true);
  }, []);

  const handleDelete = useCallback((item: FoodItem | Vino) => {
    setDeleteConfirm({ open: true, item });
  }, []);

  const confirmDelete = useCallback(async () => {
    const item = deleteConfirm.item;
    if (!item) return;

    try {
      let res;
      if (activeTab === "vinos") {
        res = await api.vinos.delete(item.num);
      } else if (activeTab === "cafes") {
        res = await api.cafes.delete(item.num);
      } else if (activeTab === "bebidas") {
        res = await api.bebidas.delete(item.num);
      } else {
        res = await api.platos.delete(item.num);
      }

      if (res.success) {
        pushToast({ kind: "success", title: "Eliminado" });
        if (activeTab === "vinos") {
          setVinos((prev) => prev.filter((v) => v.num !== item.num));
        } else {
          setItems((prev) => prev.filter((i) => i.num !== item.num));
        }
      } else {
        pushToast({ kind: "error", title: "Error", message: res.message || "No se pudo eliminar" });
      }
    } catch {
      pushToast({ kind: "error", title: "Error", message: "Error de conexión" });
    } finally {
      setDeleteConfirm({ open: false, item: null });
    }
  }, [activeTab, api, deleteConfirm.item, pushToast]);

  const handleToggleActive = useCallback(async (item: FoodItem | Vino) => {
    try {
      let res;
      if (activeTab === "vinos") {
        // Vinos doesn't have toggle, use patch
        res = await api.vinos.patch(item.num, { active: !item.active });
      } else if (activeTab === "cafes") {
        res = await api.cafes.toggle(item.num);
      } else if (activeTab === "bebidas") {
        res = await api.bebidas.toggle(item.num);
      } else {
        res = await api.platos.toggle(item.num);
      }

      if (res.success) {
        if (activeTab === "vinos") {
          setVinos((prev) => prev.map((v) => (v.num === item.num ? { ...v, active: !v.active } : v)));
        } else {
          setItems((prev) => prev.map((i) => (i.num === item.num ? { ...i, active: !i.active } : i)));
        }
      } else {
        pushToast({ kind: "error", title: "Error", message: res.message || "No se pudo cambiar estado" });
      }
    } catch {
      pushToast({ kind: "error", title: "Error", message: "Error de conexión" });
    }
  }, [activeTab, api, pushToast]);

  const handleSave = useCallback((savedItem: FoodItem | Vino) => {
    if (activeTab === "vinos") {
      if (editingItem) {
        setVinos((prev) => prev.map((v) => (v.num === savedItem.num ? { ...v, ...savedItem } : v)));
      } else {
        setVinos((prev) => [savedItem as Vino, ...prev]);
      }
    } else {
      if (editingItem) {
        setItems((prev) => prev.map((i) => (i.num === savedItem.num ? { ...i, ...savedItem } : i)));
      } else {
        setItems((prev) => [savedItem as FoodItem, ...prev]);
      }
    }
    setModalOpen(false);
    setEditingItem(null);
  }, [activeTab, editingItem]);

  const resetFilters = useCallback(() => {
    setSearch("");
    setTipoFilter("");
    setActiveFilter("all");
  }, []);

  const filteredItems = useMemo(() => {
    let list: (FoodItem | Vino)[] = activeTab === "vinos" ? vinos : items;
    return list;
  }, [activeTab, items, vinos]);

  const uniqueTipos = useMemo(() => {
    const tipos = new Set<string>();
    filteredItems.forEach((item) => {
      if (item.tipo) tipos.add(item.tipo);
    });
    return Array.from(tipos).sort();
  }, [filteredItems]);

  const getTipoOptions = useMemo(() => {
    return [
      { value: "", label: "Todos los tipos" },
      ...uniqueTipos.map((t) => ({ value: t, label: t })),
    ];
  }, [uniqueTipos]);

  return (
    <div className="bo-foodPage">
      <section className="bo-foodPage-hero">
        <div className="bo-container">
          <h1 className="bo-pageTitle">Gestion de Carta</h1>
          <p className="bo-pageSubtitle">Administra los platos, bebidas, cafes y vinos del restaurante</p>
        </div>
      </section>

      <section className="bo-foodPage-content">
        <div className="bo-container">
          {/* Tabs */}
          <div className="bo-foodTabsSticky" role="tablist" aria-label="Categorias de comida">
            <div className="bo-foodTabs">
              {FOOD_TABS.map((tab) => {
                const active = tab.type === activeTab;
                return (
                  <button
                    key={tab.type}
                    type="button"
                    className={active ? "bo-foodTab is-active" : "bo-foodTab"}
                    onClick={() => setActiveTab(tab.type)}
                    role="tab"
                    aria-selected={active}
                  >
                    {active ? (
                      <motion.span
                        className="bo-foodTabBubble"
                        layoutId="foodTabBubble"
                        transition={
                          reduceMotion
                            ? { duration: 0 }
                            : { type: "spring", stiffness: 260, damping: 30, mass: 1.15 }
                        }
                      />
                    ) : null}
                    <span className="bo-foodTabLabel">{tab.labelKey}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Filters */}
          <FoodFilters
            search={search}
            onSearchChange={setSearch}
            tipoFilter={tipoFilter}
            onTipoChange={setTipoFilter}
            tipoOptions={getTipoOptions}
            activeFilter={activeFilter}
            onActiveChange={setActiveFilter}
            onReset={resetFilters}
            count={filteredItems.length}
          />

          {/* Loading state */}
          {loading ? (
            <div className="bo-foodLoading">
              <div className="bo-spinner" />
              <span>Cargando...</span>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="bo-foodEmpty">
              <p>No hay elementos {activeFilter !== "all" ? "con ese filtro" : "creados todavia"}.</p>
              <p>Haz clic en el boton + para crear el primero.</p>
            </div>
          ) : (
            <div className="bo-foodGrid" role="list">
              {filteredItems.map((item) => (
                <FoodItemCard
                  key={item.num}
                  item={item}
                  foodType={activeTab}
                  onEdit={() => handleEdit(item)}
                  onDelete={() => handleDelete(item)}
                  onToggle={() => handleToggleActive(item)}
                />
              ))}
            </div>
          )}

          {/* FAB */}
          <button
            className="bo-foodFab"
            type="button"
            aria-label={`Crear ${activeTab}`}
            onClick={handleCreate}
          >
            <span>+</span>
          </button>
        </div>
      </section>

      {/* Create/Edit Modal */}
      {modalOpen && (
        activeTab === "vinos" ? (
          <WineModal
            open={modalOpen}
            wine={editingItem as Vino | null}
            onClose={() => setModalOpen(false)}
            onSave={handleSave}
          />
        ) : (
          <FoodItemModal
            open={modalOpen}
            item={editingItem as FoodItem | null}
            foodType={activeTab}
            onClose={() => setModalOpen(false)}
            onSave={handleSave}
          />
        )
      )}

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={deleteConfirm.open}
        title="Eliminar elemento"
        message={
          deleteConfirm.item
            ? `Eliminar "${deleteConfirm.item.nombre}"? Esta accion no se puede deshacer.`
            : ""
        }
        confirmText="Eliminar"
        danger
        onClose={() => setDeleteConfirm({ open: false, item: null })}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
