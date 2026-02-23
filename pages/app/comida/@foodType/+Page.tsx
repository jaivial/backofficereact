import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, Plus } from "lucide-react";
import { usePageContext } from "vike-react/usePageContext";

import { createClient } from "../../../../api/client";
import type { FoodCategory, FoodItem, Vino } from "../../../../api/types";
import type { Data } from "./+data";
import { useErrorToast } from "../../../../ui/feedback/useErrorToast";
import { LoadingSpinner } from "../../../../ui/feedback/LoadingSpinner";
import { useToasts } from "../../../../ui/feedback/useToasts";
import { ConfirmDialog } from "../../../../ui/overlays/ConfirmDialog";
import { Select } from "../../../../ui/inputs/Select";
import { FoodCategoryModal } from "../_components/FoodCategoryModal";
import { FoodFilters } from "../_components/FoodFilters";
import { FoodItemCard } from "../_components/FoodItemCard";
import { FoodItemModal } from "../_components/FoodItemModal";
import { FOOD_TYPE_LABELS, FOOD_TYPE_SINGULAR, FOOD_TYPE_TIPO_OPTIONS, type FoodType } from "../_components/foodTypes";
import { WineModal } from "../_components/WineModal";

type ListItem = FoodItem | Vino;
type ActiveFilter = "all" | "active" | "inactive";
type SuplementoFilter = "all" | "yes" | "no";

const PAGE_SIZE_OPTIONS = [
  { value: "12", label: "12 / pagina" },
  { value: "24", label: "24 / pagina" },
  { value: "48", label: "48 / pagina" },
];

function normalizePostres(postres: Array<{ num: number; descripcion: string; alergenos?: string[]; active: boolean; precio?: number }>): FoodItem[] {
  return postres.map((postre) => ({
    num: postre.num,
    tipo: "POSTRE",
    nombre: postre.descripcion,
    precio: Number(postre.precio ?? 0),
    descripcion: postre.descripcion,
    titulo: "",
    suplemento: 0,
    alergenos: Array.isArray(postre.alergenos) ? postre.alergenos : [],
    active: !!postre.active,
    has_foto: false,
  }));
}

export default function Page() {
  const pageContext = usePageContext();
  const data = pageContext.data as Data;
  const api = useMemo(() => createClient({ baseUrl: "" }), []);
  const { pushToast } = useToasts();
  useErrorToast(data.error);

  const foodType = data.foodType as FoodType;

  const [items, setItems] = useState<ListItem[]>(data.items || []);
  const [categories, setCategories] = useState<FoodCategory[]>(data.categories || []);
  const [page, setPage] = useState(data.page || 1);
  const [pageSize, setPageSize] = useState(data.pageSize || 24);
  const [total, setTotal] = useState(data.total || 0);

  const [search, setSearch] = useState(data.filters?.search || "");
  const [tipoFilter, setTipoFilter] = useState(data.filters?.tipo || "");
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>(data.filters?.active || "all");
  const [categoryFilter, setCategoryFilter] = useState(data.filters?.category || "");
  const [alergenoFilter, setAlergenoFilter] = useState(data.filters?.alergeno || "");
  const [suplementoFilter, setSuplementoFilter] = useState<SuplementoFilter>(data.filters?.suplemento || "all");

  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ListItem | null>(null);
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [categoryBusy, setCategoryBusy] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; item: ListItem | null }>({ open: false, item: null });

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [pageSize, total]);
  const showPagerBtns = totalPages > 1;

  const tipoOptions = useMemo(() => {
    const byValue = new Map<string, string>();
    FOOD_TYPE_TIPO_OPTIONS[foodType].forEach((option) => {
      byValue.set(option.value, option.label);
    });
    items.forEach((item) => {
      const value = String(item.tipo || "").trim();
      if (!value || byValue.has(value)) return;
      byValue.set(value, value);
    });
    const ordered = Array.from(byValue.entries())
      .sort((a, b) => a[1].localeCompare(b[1]))
      .map(([value, label]) => ({ value, label }));
    return [{ value: "", label: "Todos los tipos" }, ...ordered];
  }, [foodType, items]);

  const categoryOptions = useMemo(() => {
    const options = [{ value: "", label: "Todas las categorias" }];
    categories.forEach((category) => {
      options.push({ value: String(category.id), label: category.name });
    });
    return options;
  }, [categories]);

  const alergenoOptions = useMemo(() => {
    const values = new Set<string>();
    items.forEach((item) => {
      const food = item as FoodItem;
      if (Array.isArray(food.alergenos)) {
        food.alergenos.forEach((alergeno) => {
          const normalized = String(alergeno || "").trim();
          if (normalized) values.add(normalized);
        });
      }
    });
    return [{ value: "", label: "Todos los alergenos" }, ...Array.from(values).sort().map((value) => ({ value, label: value }))];
  }, [items]);

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const activeParam = activeFilter === "all" ? undefined : activeFilter === "active" ? 1 : 0;
      const suplementoParam = suplementoFilter === "all" ? undefined : suplementoFilter === "yes" ? 1 : 0;

      if (foodType === "vinos") {
        const res = await api.comida.vinos.list({
          tipo: tipoFilter || undefined,
          active: activeParam,
          q: search || undefined,
          page,
          pageSize,
        });
        if (!res.success) throw new Error(res.message || "Error cargando vinos");
        setItems(Array.isArray(res.vinos) ? res.vinos : []);
        setTotal(Number(res.total ?? res.vinos?.length ?? 0));
        return;
      }

      if (foodType === "postres") {
        const res = await api.comida.postres.list({
          active: activeParam,
          search: search || undefined,
          page,
          limit: pageSize,
        });
        if (!res.success) throw new Error(res.message || "Error cargando postres");
        const normalized = normalizePostres(Array.isArray((res as any).postres) ? (res as any).postres : []);
        setItems(normalized);
        setTotal(Number((res as any).total ?? normalized.length));
        return;
      }

      const targetApi = foodType === "platos"
        ? api.comida.platos
        : foodType === "bebidas"
          ? api.comida.bebidas
          : api.comida.cafes;

      const res = await targetApi.list({
        tipo: tipoFilter || undefined,
        active: activeParam,
        q: search || undefined,
        page,
        pageSize,
        category: categoryFilter || undefined,
        alergeno: alergenoFilter || undefined,
        suplemento: suplementoParam,
      });
      if (!res.success) throw new Error(res.message || "Error cargando elementos");
      setItems(Array.isArray(res.items) ? res.items : []);
      setTotal(Number(res.total ?? res.items?.length ?? 0));
    } catch (err) {
      pushToast({
        kind: "error",
        title: "Error",
        message: err instanceof Error ? err.message : "No se pudo cargar la lista",
      });
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [
    activeFilter,
    alergenoFilter,
    api.comida.bebidas,
    api.comida.cafes,
    api.comida.platos,
    api.comida.postres,
    api.comida.vinos,
    categoryFilter,
    foodType,
    page,
    pageSize,
    pushToast,
    search,
    suplementoFilter,
    tipoFilter,
  ]);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  useEffect(() => {
    if (foodType !== "platos") return;
    let cancelled = false;
    void api.comida.platos.categories.list()
      .then((res) => {
        if (cancelled || !res.success) return;
        setCategories(Array.isArray(res.categories) ? res.categories : []);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [api.comida.platos.categories, foodType]);

  const onResetFilters = useCallback(() => {
    setSearch("");
    setTipoFilter("");
    setActiveFilter("all");
    setCategoryFilter("");
    setAlergenoFilter("");
    setSuplementoFilter("all");
    setPage(1);
  }, []);

  const onOpenCreate = useCallback(() => {
    setEditingItem(null);
    setModalOpen(true);
  }, []);

  const onOpenEdit = useCallback((item: ListItem) => {
    setEditingItem(item);
    setModalOpen(true);
  }, []);

  const onOpenDetail = useCallback((item: ListItem) => {
    window.location.assign(`/app/comida/${foodType}/${item.num}`);
  }, [foodType]);

  const onSaveItem = useCallback((saved: ListItem) => {
    setModalOpen(false);
    setEditingItem(null);
    setItems((prev) => {
      const exists = prev.some((item) => item.num === saved.num);
      if (exists) return prev.map((item) => (item.num === saved.num ? saved : item));
      return [saved, ...prev];
    });
    setTotal((prev) => prev + (items.some((item) => item.num === saved.num) ? 0 : 1));
    void loadItems();
  }, [items, loadItems]);

  const onCreateCategory = useCallback(async (name: string) => {
    setCategoryBusy(true);
    try {
      const res = await api.comida.platos.categories.create({ name });
      if (!res.success) {
        pushToast({ kind: "error", title: "Error", message: res.message || "No se pudo crear la categoria" });
        return;
      }
      const created = (res as any).category as FoodCategory | undefined;
      if (created) setCategories((prev) => [created, ...prev.filter((c) => c.id !== created.id)]);
      setCategoryModalOpen(false);
      pushToast({ kind: "success", title: "Categoria creada" });
    } catch {
      pushToast({ kind: "error", title: "Error", message: "Error de conexion" });
    } finally {
      setCategoryBusy(false);
    }
  }, [api.comida.platos.categories, pushToast]);

  const onDeleteConfirm = useCallback(async () => {
    const item = deleteConfirm.item;
    if (!item) return;
    setProcessing(true);
    try {
      const res = foodType === "vinos"
        ? await api.comida.vinos.delete(item.num)
        : foodType === "postres"
          ? await api.comida.postres.delete(item.num)
          : foodType === "platos"
            ? await api.comida.platos.delete(item.num)
            : foodType === "bebidas"
              ? await api.comida.bebidas.delete(item.num)
              : await api.comida.cafes.delete(item.num);
      if (!res.success) {
        pushToast({ kind: "error", title: "Error", message: res.message || "No se pudo eliminar" });
        return;
      }
      setDeleteConfirm({ open: false, item: null });
      setItems((prev) => prev.filter((entry) => entry.num !== item.num));
      setTotal((prev) => Math.max(0, prev - 1));
      pushToast({ kind: "success", title: "Eliminado" });
      void loadItems();
    } catch {
      pushToast({ kind: "error", title: "Error", message: "Error de conexion" });
    } finally {
      setProcessing(false);
    }
  }, [
    api.comida.bebidas,
    api.comida.cafes,
    api.comida.platos,
    api.comida.postres,
    api.comida.vinos,
    deleteConfirm.item,
    foodType,
    loadItems,
    pushToast,
  ]);

  const onToggle = useCallback(async (item: ListItem) => {
    setProcessing(true);
    try {
      const res = foodType === "vinos"
        ? await api.comida.vinos.patch(item.num, { active: !item.active })
        : foodType === "postres"
          ? await api.comida.postres.patch(item.num, { active: !item.active })
          : foodType === "platos"
            ? await api.comida.platos.toggle(item.num)
            : foodType === "bebidas"
              ? await api.comida.bebidas.toggle(item.num)
              : await api.comida.cafes.toggle(item.num);
      if (!res.success) {
        pushToast({ kind: "error", title: "Error", message: res.message || "No se pudo cambiar el estado" });
        return;
      }
      setItems((prev) => prev.map((entry) => (entry.num === item.num ? { ...entry, active: !entry.active } : entry)));
    } catch {
      pushToast({ kind: "error", title: "Error", message: "Error de conexion" });
    } finally {
      setProcessing(false);
    }
  }, [api.comida.bebidas, api.comida.cafes, api.comida.platos, api.comida.postres, api.comida.vinos, foodType, pushToast]);

  const listLabel = FOOD_TYPE_LABELS[foodType];
  const singularLabel = FOOD_TYPE_SINGULAR[foodType];

  return (
    <section aria-label={`Carta ${listLabel}`} className="bo-foodPage">
      <div className="bo-container">
        <button className="bo-menuBackBtn" type="button" onClick={() => window.location.assign("/app/comida")}>
          <ChevronLeft size={16} />
          Volver a tipos de carta
        </button>

        <div className="bo-foodPage-hero">
          <h1 className="bo-pageTitle">{listLabel}</h1>
          <p className="bo-pageSubtitle">Gestiona {listLabel.toLowerCase()} con filtros, paginacion y alta rapida.</p>
        </div>

        <FoodFilters
          foodType={foodType}
          search={search}
          onSearchChange={(value) => {
            setSearch(value);
            setPage(1);
          }}
          tipoFilter={tipoFilter}
          onTipoChange={(value) => {
            setTipoFilter(value);
            setPage(1);
          }}
          tipoOptions={tipoOptions}
          activeFilter={activeFilter}
          onActiveChange={(value) => {
            setActiveFilter(value);
            setPage(1);
          }}
          categoryFilter={categoryFilter}
          onCategoryChange={(value) => {
            setCategoryFilter(value);
            setPage(1);
          }}
          categoryOptions={categoryOptions}
          alergenoFilter={alergenoFilter}
          onAlergenoChange={(value) => {
            setAlergenoFilter(value);
            setPage(1);
          }}
          alergenoOptions={alergenoOptions}
          suplementoFilter={suplementoFilter}
          onSuplementoChange={(value) => {
            setSuplementoFilter(value);
            setPage(1);
          }}
          onReset={onResetFilters}
          count={total}
        />

        {loading ? (
          <div className="bo-foodLoading">
            <LoadingSpinner centered size="sm" label="Cargando..." />
          </div>
        ) : items.length === 0 ? (
          <div className="bo-foodEmpty">
            <p>No hay {listLabel.toLowerCase()} con estos filtros.</p>
            <p>Usa el boton + para anadir el primer {singularLabel}.</p>
          </div>
        ) : (
          <div className="bo-foodGrid" role="list">
            {items.map((item) => (
              <FoodItemCard
                key={item.num}
                item={item}
                foodType={foodType}
                busy={processing}
                onOpen={() => onOpenDetail(item)}
                onEdit={() => onOpenEdit(item)}
                onDelete={() => setDeleteConfirm({ open: true, item })}
                onToggle={() => {
                  void onToggle(item);
                }}
              />
            ))}
          </div>
        )}

        <div className={`bo-pager${showPagerBtns ? "" : " is-solo"}`} aria-label="Paginacion">
          <div className="bo-pagerText">
            Pagina {page} de {totalPages} · {total} resultados
          </div>
          <div className="bo-foodPagerExtras">
            <Select
              value={String(pageSize)}
              onChange={(value) => {
                const next = Number(value);
                setPageSize(Number.isFinite(next) ? next : 24);
                setPage(1);
              }}
              options={PAGE_SIZE_OPTIONS}
              ariaLabel="Elementos por pagina"
              size="sm"
            />
            {showPagerBtns ? (
              <div className="bo-pagerBtns">
                <button className="bo-btn bo-btn--ghost" type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1 || loading}>
                  Anterior
                </button>
                <button className="bo-btn bo-btn--ghost" type="button" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages || loading}>
                  Siguiente
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <button className="bo-menuFab" type="button" aria-label={`Anadir ${singularLabel}`} onClick={onOpenCreate}>
        <Plus size={24} />
      </button>

      {foodType === "vinos" ? (
        <WineModal
          open={modalOpen}
          wine={editingItem as Vino | null}
          onClose={() => {
            if (!processing) setModalOpen(false);
          }}
          onSave={onSaveItem}
        />
      ) : (
        <FoodItemModal
          open={modalOpen}
          item={editingItem as FoodItem | null}
          foodType={foodType}
          categoryOptions={foodType === "platos" ? categoryOptions.slice(1) : []}
          onRequestCreateCategory={foodType === "platos" ? () => setCategoryModalOpen(true) : undefined}
          onClose={() => {
            if (!processing) setModalOpen(false);
          }}
          onSave={onSaveItem}
        />
      )}

      <FoodCategoryModal
        open={foodType === "platos" && categoryModalOpen}
        busy={categoryBusy}
        onClose={() => {
          if (!categoryBusy) setCategoryModalOpen(false);
        }}
        onCreate={onCreateCategory}
      />

      <ConfirmDialog
        open={deleteConfirm.open}
        title="Eliminar elemento"
        message={deleteConfirm.item ? `Eliminar "${deleteConfirm.item.nombre}"? Esta accion no se puede deshacer.` : ""}
        confirmText="Eliminar"
        danger
        onClose={() => {
          if (!processing) setDeleteConfirm({ open: false, item: null });
        }}
        onConfirm={() => {
          void onDeleteConfirm();
        }}
      />
    </section>
  );
}
