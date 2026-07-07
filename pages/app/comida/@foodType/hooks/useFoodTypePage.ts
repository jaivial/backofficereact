import { useCallback, useEffect, useMemo, useState } from "react";

import { createClient } from "../../../../../api/client";
import type { FoodCategory, FoodItem, Vino } from "../../../../../api/types";
import type { ActiveFilter, ListItem, SuplementoFilter } from "../types";
import type { FoodType } from "../../_components/foodTypes";
import { normalizePostres, buildDeleteApiCall, buildToggleApiCall, buildTargetApi } from "../helpers";
import { useComidaAIUnified, type ComidaAIWSMessage } from "../../_components/hooks/useComidaAIUnified";
import { useToasts } from "../../../../../ui/feedback/useToasts";
import type { Data } from "../+data";

interface UseFoodTypePageOptions {
  data: Data;
}

export function useFoodTypePage({ data }: UseFoodTypePageOptions) {
  const { pushToast } = useToasts();
  const api = useMemo(() => createClient({ baseUrl: "" }), []);

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

  const foodType = data.foodType;

  // Page visibility state (only for cafes/bebidas)
  const [pageActive, setPageActive] = useState(true);
  const [pageVisibilityLoading, setPageVisibilityLoading] = useState(false);
  const showPageVisibilityToggle = foodType === "cafes" || foodType === "bebidas";

  // Local UI toggle: show/hide the dish card image media block on the list page.
  // No persistence — resets to true on every mount, like an accordion/filter.
  const [showImages, setShowImages] = useState(true);

  // Wire WebSocket for real-time AI image generation status
  const handleAIWSEvent = useCallback(
    (event: ComidaAIWSMessage) => {
      if (!event.item_id) return;
      if (event.type === "comida_ai_started") {
        setItems((prev) =>
          prev.map((item) =>
            item.num === event.item_id ? { ...item, ai_generating: true } as ListItem : item,
          ),
        );
      }
      if (event.type === "comida_ai_completed") {
        setItems((prev) =>
          prev.map((item) =>
            item.num === event.item_id
              ? { ...item, ai_generating: false, foto_url: event.foto_url } as ListItem
              : item,
          ),
        );
      }
      if (event.type === "comida_ai_failed") {
        setItems((prev) =>
          prev.map((item) =>
            item.num === event.item_id ? { ...item, ai_generating: false } as ListItem : item,
          ),
        );
      }
    },
    [],
  );

  useComidaAIUnified({ scope: "list", onEvent: handleAIWSEvent });

  useEffect(() => {
    if (!showPageVisibilityToggle) return;
    const load = async () => {
      try {
        const res = await api.settings.getPageVisibility();
        if (res.success) {
          setPageActive(foodType === "cafes" ? Boolean(res.cafe_page_active) : Boolean(res.bebidas_page_active));
        }
      } catch {
        // ignore
      }
    };
    void load();
  }, [api.settings, foodType, showPageVisibilityToggle]);

  const togglePageActive = useCallback(async (checked: boolean) => {
    setPageVisibilityLoading(true);
    try {
      const payload = foodType === "cafes" ? { cafe_page_active: checked } : { bebidas_page_active: checked };
      const res = await api.settings.setPageVisibility(payload);
      if (res.success) {
        setPageActive(checked);
        pushToast({ kind: "success", title: checked ? "Pagina activada" : "Pagina desactivada" });
      } else {
        pushToast({ kind: "error", title: "Error", message: res.message || "No se pudo actualizar" });
      }
    } catch {
      pushToast({ kind: "error", title: "Error", message: "No se pudo actualizar la visibilidad" });
    } finally {
      setPageVisibilityLoading(false);
    }
  }, [api.settings, foodType, pushToast]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [pageSize, total]);
  const showPagerBtns = totalPages > 1;

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

      const targetApi = buildTargetApi(foodType, api);

      const res = await targetApi.list({
        tipo: tipoFilter || undefined,
        active: activeParam,
        q: search || undefined,
        page,
        pageSize,
        category: categoryFilter || undefined,
        alergeno: alergenoFilter || undefined,
        suplemento: suplementoParam,
      } as any);
      if (!res.success) throw new Error(res.message || "Error cargando elementos");
      setItems(Array.isArray((res as any).items) ? (res as any).items : []);
      setTotal(Number((res as any).total ?? (res as any).items?.length ?? 0));
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
    if (foodType !== "platos" && foodType !== "bebidas") return;
    let cancelled = false;
    void (foodType === "bebidas" ? api.comida.bebidas.categories : api.comida.platos.categories)
      .list()
      .then((res) => {
        if (cancelled || !res.success) return;
        setCategories(Array.isArray(res.categories) ? res.categories : []);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [api.comida.platos.categories, api.comida.bebidas.categories, foodType]);

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
    if (foodType === "vinos") {
      window.location.assign(`/app/comida/vinos/new`);
      return;
    }
    window.location.assign(`/app/comida/${foodType}/new`);
  }, [foodType]);

  const onOpenEdit = useCallback((item: ListItem) => {
    if (foodType === "vinos") {
      window.location.assign(`/app/comida/vinos/${item.num}`);
      return;
    }
    window.location.assign(`/app/comida/${foodType}/${item.num}`);
  }, [foodType]);

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
      const res = await buildDeleteApiCall(foodType, api, item);
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
  }, [api, deleteConfirm.item, foodType, loadItems, pushToast]);

  const onToggle = useCallback(async (item: ListItem) => {
    setProcessing(true);
    try {
      const res = await buildToggleApiCall(foodType, api, item);
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
  }, [api, foodType, pushToast]);

  return {
    pageActive,
    pageVisibilityLoading,
    showPageVisibilityToggle,
    showImages,
    setShowImages,
    setPage,
    pageSize,
    setPageSize,
    total,
    search,
    setSearch,
    tipoFilter,
    setTipoFilter,
    activeFilter,
    setActiveFilter,
    categoryFilter,
    setCategoryFilter,
    alergenoFilter,
    setAlergenoFilter,
    suplementoFilter,
    setSuplementoFilter,
    loading,
    processing,
    modalOpen,
    setModalOpen,
    editingItem,
    setEditingItem,
    categoryModalOpen,
    setCategoryModalOpen,
    categoryBusy,
    deleteConfirm,
    setDeleteConfirm,
    pageActive,
    pageVisibilityLoading,
    showPageVisibilityToggle,
    foodType,
    totalPages,
    showPagerBtns,
    // Handlers
    togglePageActive,
    loadItems,
    onResetFilters,
    onOpenCreate,
    onOpenEdit,
    onOpenDetail,
    onSaveItem,
    onCreateCategory,
    onDeleteConfirm,
    onToggle,
  };
}
