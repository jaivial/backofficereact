import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, Plus } from "lucide-react";
import { usePageContext } from "vike-react/usePageContext";

import { createClient } from "../../../../api/client";
import type { FoodItem, Vino } from "../../../../api/types";
import { useErrorToast } from "../../../../ui/feedback/useErrorToast";
import { useToasts } from "../../../../ui/feedback/useToasts";
import { ConfirmDialog } from "../../../../ui/overlays/ConfirmDialog";
import { FoodFilters } from "../_components/FoodFilters";
import { FoodItemCard } from "../_components/FoodItemCard";
import { FoodItemModal } from "../_components/FoodItemModal";
import { WineModal } from "../_components/WineModal";

type FoodType = "platos" | "bebidas" | "cafes" | "vinos";

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

const FOOD_COPY: Record<FoodType, { title: string; subtitle: string }> = {
  platos: { title: "Platos", subtitle: "Gestion de platos principales y especialidades" },
  bebidas: { title: "Bebidas", subtitle: "Gestion de refrescos y bebidas" },
  cafes: { title: "Cafes", subtitle: "Gestion de cafes e infusiones" },
  vinos: { title: "Vinos", subtitle: "Gestion de bodega y anadas" },
};

function normalizeFoodType(input: string): FoodType | null {
  const key = input.trim().toLowerCase();
  if (key === "platos" || key === "bebidas" || key === "cafes" || key === "vinos") return key;
  return null;
}

export default function Page() {
  const pageContext = usePageContext();
  const data = (pageContext.data as PageData) || { error: null };
  const api = useMemo(() => createClient({ baseUrl: "" }), []);
  const { pushToast } = useToasts();

  const routeName = String((pageContext as any).routeParams?.name ?? "");
  const routeType = useMemo(() => normalizeFoodType(routeName), [routeName]);
  const foodType = routeType ?? "platos";
  const copy = FOOD_COPY[foodType];

  const [items, setItems] = useState<FoodItem[]>([]);
  const [vinos, setVinos] = useState<Vino[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [tipoFilter, setTipoFilter] = useState("");
  const [activeFilter, setActiveFilter] = useState<"all" | "active" | "inactive">("all");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<FoodItem | Vino | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; item: FoodItem | Vino | null }>({
    open: false,
    item: null,
  });

  useErrorToast(data.error);

  useEffect(() => {
    if (routeType) return;
    window.location.replace("/app/comida");
  }, [routeType]);

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const params: { tipo?: string; active?: number; search?: string } = {};
      if (tipoFilter) params.tipo = tipoFilter;
      if (activeFilter !== "all") params.active = activeFilter === "active" ? 1 : 0;
      if (search) params.search = search;

      let res: FoodListResult;
      if (foodType === "cafes") {
        res = await api.menus.cafes.list(params) as FoodListResult;
      } else if (foodType === "bebidas") {
        res = await api.menus.bebidas.list(params) as FoodListResult;
      } else {
        res = await api.menus.platos.list(params) as FoodListResult;
      }

      if (res.success && res.items) {
        setItems(res.items);
      } else {
        pushToast({ kind: "error", title: "Error", message: res.message || "Error cargando datos" });
        setItems([]);
      }
    } catch {
      pushToast({ kind: "error", title: "Error", message: "Error de conexion" });
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [activeFilter, api, foodType, pushToast, search, tipoFilter]);

  const loadVinos = useCallback(async () => {
    setLoading(true);
    try {
      const params: { tipo?: string; active?: number } = {};
      if (tipoFilter) params.tipo = tipoFilter;
      if (activeFilter !== "all") params.active = activeFilter === "active" ? 1 : 0;

      const res = await api.menus.vinos.list(params) as VinosResult;
      if (res.success && res.vinos) {
        setVinos(res.vinos);
      } else {
        pushToast({ kind: "error", title: "Error", message: res.message || "Error cargando vinos" });
        setVinos([]);
      }
    } catch {
      pushToast({ kind: "error", title: "Error", message: "Error de conexion" });
      setVinos([]);
    } finally {
      setLoading(false);
    }
  }, [activeFilter, api, pushToast, tipoFilter]);

  useEffect(() => {
    if (foodType === "vinos") {
      loadVinos();
    } else {
      loadItems();
    }
  }, [foodType, loadItems, loadVinos]);

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
      if (foodType === "vinos") {
        res = await api.menus.vinos.delete(item.num);
      } else if (foodType === "cafes") {
        res = await api.menus.cafes.delete(item.num);
      } else if (foodType === "bebidas") {
        res = await api.menus.bebidas.delete(item.num);
      } else {
        res = await api.menus.platos.delete(item.num);
      }

      if (res.success) {
        pushToast({ kind: "success", title: "Eliminado" });
        if (foodType === "vinos") {
          setVinos((prev) => prev.filter((v) => v.num !== item.num));
        } else {
          setItems((prev) => prev.filter((i) => i.num !== item.num));
        }
      } else {
        pushToast({ kind: "error", title: "Error", message: res.message || "No se pudo eliminar" });
      }
    } catch {
      pushToast({ kind: "error", title: "Error", message: "Error de conexion" });
    } finally {
      setDeleteConfirm({ open: false, item: null });
    }
  }, [api, deleteConfirm.item, foodType, pushToast]);

  const handleToggleActive = useCallback(async (item: FoodItem | Vino) => {
    try {
      let res;
      if (foodType === "vinos") {
        res = await api.menus.vinos.patch(item.num, { active: !item.active });
      } else if (foodType === "cafes") {
        res = await api.menus.cafes.toggle(item.num, !item.active);
      } else if (foodType === "bebidas") {
        res = await api.menus.bebidas.toggle(item.num, !item.active);
      } else {
        res = await api.menus.platos.toggle(item.num, !item.active);
      }

      if (res.success) {
        if (foodType === "vinos") {
          setVinos((prev) => prev.map((v) => (v.num === item.num ? { ...v, active: !v.active } : v)));
        } else {
          setItems((prev) => prev.map((i) => (i.num === item.num ? { ...i, active: !i.active } : i)));
        }
      } else {
        pushToast({ kind: "error", title: "Error", message: res.message || "No se pudo cambiar estado" });
      }
    } catch {
      pushToast({ kind: "error", title: "Error", message: "Error de conexion" });
    }
  }, [api, foodType, pushToast]);

  const handleSave = useCallback((savedItem: FoodItem | Vino) => {
    if (foodType === "vinos") {
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
  }, [editingItem, foodType]);

  const resetFilters = useCallback(() => {
    setSearch("");
    setTipoFilter("");
    setActiveFilter("all");
  }, []);

  const filteredItems = useMemo(() => (foodType === "vinos" ? vinos : items), [foodType, items, vinos]);

  const uniqueTipos = useMemo(() => {
    const tipos = new Set<string>();
    filteredItems.forEach((item) => {
      if (item.tipo) tipos.add(item.tipo);
    });
    return Array.from(tipos).sort();
  }, [filteredItems]);

  const tipoOptions = useMemo(() => {
    return [{ value: "", label: "Todos los tipos" }, ...uniqueTipos.map((tipo) => ({ value: tipo, label: tipo }))];
  }, [uniqueTipos]);

  const goBackToCategories = useCallback(() => {
    window.location.href = "/app/comida";
  }, []);

  if (!routeType) return null;

  return (
    <div className="bo-foodPage">
      <section className="bo-foodPage-content">
        <div className="bo-container">
          <div className="bo-foodCategoryTop">
            <button className="bo-menuBackBtn" type="button" onClick={goBackToCategories}>
              <ChevronLeft size={16} />
              Categorias
            </button>
            <div>
              <h1 className="bo-pageTitle">{copy.title}</h1>
              <p className="bo-pageSubtitle">{copy.subtitle}</p>
            </div>
          </div>

          <FoodFilters
            foodType={foodType}
            search={search}
            onSearchChange={setSearch}
            tipoFilter={tipoFilter}
            onTipoChange={setTipoFilter}
            tipoOptions={tipoOptions}
            activeFilter={activeFilter}
            onActiveChange={setActiveFilter}
            categoryFilter=""
            onCategoryChange={(_value) => {}}
            categoryOptions={[{ value: "", label: "Todas las categorias" }]}
            alergenoFilter=""
            onAlergenoChange={(_value) => {}}
            alergenoOptions={[{ value: "", label: "Todos los alergenos" }]}
            suplementoFilter="all"
            onSuplementoChange={(_value) => {}}
            onReset={resetFilters}
            count={filteredItems.length}
          />

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
                  foodType={foodType}
                  onOpen={() => window.location.assign(`/app/comida/${foodType}/${item.num}`)}
                  onEdit={() => handleEdit(item)}
                  onDelete={() => handleDelete(item)}
                  onToggle={() => handleToggleActive(item)}
                />
              ))}
            </div>
          )}

          <button className="bo-menuFab" type="button" aria-label={`Crear ${foodType}`} onClick={handleCreate}>
            <Plus size={26} />
          </button>
        </div>
      </section>

      {modalOpen && (
        foodType === "vinos" ? (
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
            foodType={foodType}
            onClose={() => setModalOpen(false)}
            onSave={handleSave}
          />
        )
      )}

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
