import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Bean,
  Camera,
  CircleDot,
  Coffee,
  Egg,
  Fish,
  FlaskConical,
  GlassWater,
  LeafyGreen,
  Loader2,
  Milk,
  Nut,
  Plus,
  Upload,
  X,
  Save,
  Shell,
  Shrimp,
  Sprout,
  UtensilsCrossed,
  Wheat,
  Wine,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { usePageContext } from "vike-react/usePageContext";

import { createClient } from "../../../../../api/client";
import type { FoodItem, Vino } from "../../../../../api/types";
import type { Data } from "./+data";
import { useErrorToast } from "../../../../../ui/feedback/useErrorToast";
import { Select } from "../../../../../ui/inputs/Select";
import { useToasts } from "../../../../../ui/feedback/useToasts";
import { Modal } from "../../../../../ui/overlays/Modal";
import { Switch } from "../../../../../ui/shadcn/Switch";
import { Breadcrumbs } from "../../../../../ui/nav/Breadcrumbs";
import type { BreadcrumbItem } from "../../../../../ui/nav/Breadcrumbs";
import { FOOD_TYPE_LABELS, FOOD_TYPE_SINGULAR, type FoodType } from "../../_components/foodTypes";
import { WineDetailEditor } from "./functionalComponents/WineDetailEditor/WineDetailEditor";
import { BeverageCategoryModal } from "../../_components/BeverageCategoryModal";
import { compressImageToWebP, isValidImageFile } from "../../../../../lib/imageCompressor";
import { useComidaAIWebSocket, type ComidaAIWSMessage } from "./functionalComponents/FoodDetailImageEditor/hooks/useComidaAIWebSocket";

type HeroBadge = {
  id: string;
  label: string;
  className: string;
};

type DetailFact = {
  id: string;
  label: string;
  value: string;
};

const FOOD_TYPE_ICONS: Record<FoodType, LucideIcon> = {
  platos: UtensilsCrossed,
  bebidas: GlassWater,
  cafes: Coffee,
  vinos: Wine,
  postres: UtensilsCrossed,
};

const AI_ADVISOR_FOOD_TYPES = new Set<FoodType>(["bebidas", "cafes"]);

const CARD_ALLERGENS = [
  { key: "Gluten", icon: Wheat },
  { key: "Crustaceos", icon: Shrimp },
  { key: "Huevos", icon: Egg },
  { key: "Pescado", icon: Fish },
  { key: "Cacahuetes", icon: Nut },
  { key: "Soja", icon: Bean },
  { key: "Leche", icon: Milk },
  { key: "Frutos de cascara", icon: Nut },
  { key: "Apio", icon: LeafyGreen },
  { key: "Mostaza", icon: Sprout },
  { key: "Sesamo", icon: CircleDot },
  { key: "Sulfitos", icon: FlaskConical },
  { key: "Altramuces", icon: Bean },
  { key: "Moluscos", icon: Shell },
] as const;

const CARD_ALLERGEN_KEYS = new Set<string>(CARD_ALLERGENS.map((item) => item.key));

const ALLERGEN_ALIAS_TO_CARD: Record<string, string> = {
  gluten: "Gluten",
  crustaceos: "Crustaceos",
  huevos: "Huevos",
  pescado: "Pescado",
  cacahuetes: "Cacahuetes",
  soja: "Soja",
  lacteos: "Leche",
  leche: "Leche",
  "frutos secos": "Frutos de cascara",
  frutos_secos: "Frutos de cascara",
  "frutos de cascara": "Frutos de cascara",
  apio: "Apio",
  mostaza: "Mostaza",
  sesamo: "Sesamo",
  sulfitos: "Sulfitos",
  altramuces: "Altramuces",
  moluscos: "Moluscos",
};

function normalizeToken(value: string): string {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function formatEuro(value: number): string {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(Number(value || 0));
}

function parseDecimalInput(value: string): number | null {
  const normalized = String(value || "").trim().replace(",", ".");
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function toMoneyInput(value: number | null | undefined): string {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed.toFixed(2) : "0.00";
}

function getEmptyDescription(foodType: FoodType): string {
  if (foodType === "platos") return "Este plato todavia no tiene una descripcion visible en carta.";
  if (foodType === "vinos") return "Este vino todavia no tiene una descripcion visible en carta.";
  if (foodType === "postres") return "Este postre todavia no tiene una descripcion visible en carta.";
  if (foodType === "cafes") return "Este cafe todavia no tiene una descripcion visible en carta.";
  return "Este elemento todavia no tiene una descripcion visible en carta.";
}

function normalizeToCardAllergens(values: string[]): string[] {
  const set = new Set<string>();
  const unknown: string[] = [];
  values.forEach((raw) => {
    const trimmed = String(raw || "").trim();
    if (!trimmed || trimmed === "[]") return;
    const normalized = normalizeToken(trimmed);
    const mapped = ALLERGEN_ALIAS_TO_CARD[normalized];
    if (mapped) {
      set.add(mapped);
      return;
    }
    if (CARD_ALLERGEN_KEYS.has(trimmed)) {
      set.add(trimmed);
      return;
    }
    unknown.push(trimmed);
  });
  const ordered = CARD_ALLERGENS.map((item) => item.key).filter((key) => set.has(key));
  const unknownDedup = Array.from(new Set(unknown));
  return [...ordered, ...unknownDedup];
}

function areAllergenSetsEqual(a: string[], b: string[]): boolean {
  const left = normalizeToCardAllergens(a);
  const right = normalizeToCardAllergens(b);
  if (left.length !== right.length) return false;
  const leftNorm = left.map(normalizeToken).sort();
  const rightNorm = right.map(normalizeToken).sort();
  return leftNorm.every((value, idx) => value === rightNorm[idx]);
}

export default function Page() {
  const pageContext = usePageContext();
  const data = pageContext.data as Data;
  useErrorToast(data.error);
  const api = useMemo(() => createClient({ baseUrl: "" }), []);
  const { pushToast } = useToasts();

  const [itemState, setItemState] = useState<typeof data.item>(data.item);
  const [categories, setCategories] = useState<Array<{ value: string; label: string }>>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [savingQuick, setSavingQuick] = useState(false);
  const [quickName, setQuickName] = useState("");
  const [quickTitulo, setQuickTitulo] = useState("");
  const [quickTipo, setQuickTipo] = useState("");
  const [quickPrecio, setQuickPrecio] = useState("");
  const [quickSuplemento, setQuickSuplemento] = useState("");
  const [quickHasSuplemento, setQuickHasSuplemento] = useState(false);
  const [quickCategoria, setQuickCategoria] = useState("");
  const [quickDescripcion, setQuickDescripcion] = useState("");
  const [quickActive, setQuickActive] = useState(false);
  const [quickAllergens, setQuickAllergens] = useState<string[]>([]);
  const [allergenModalOpen, setAllergenModalOpen] = useState(false);
  const [allergenDraft, setAllergenDraft] = useState<string[]>([]);
  const [savingAllergens, setSavingAllergens] = useState(false);
  const [bebidaCatModalOpen, setBebidaCatModalOpen] = useState(false);

  // Image handling state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [showAIAdvisor, setShowAIAdvisor] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [pendingAIEnhance, setPendingAIEnhance] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);

  const item = itemState;
  const foodType = data.foodType;
  const isPlate = foodType === "platos";
  const isCafe = foodType === "cafes";
  const isBebida = foodType === "bebidas";
  const isWine = foodType === "vinos";
  const supportsQuickEditor = isPlate || isCafe || isBebida;

  // WebSocket for AI events
  const itemNum = item ? (item as FoodItem).num : null;
  const showAdvisorForType = AI_ADVISOR_FOOD_TYPES.has(foodType);

  useComidaAIWebSocket({
    itemNum,
    onEvent: useCallback((msg: ComidaAIWSMessage) => {
      if (msg.type === "comida_ai_started" && msg.item_id === itemNum) {
        setAiGenerating(true);
      } else if (msg.type === "comida_ai_completed" && msg.item_id === itemNum) {
        setAiGenerating(false);
        if (msg.foto_url) {
          setItemState((prev) => prev ? { ...prev, foto_url: msg.foto_url } : prev);
        }
        pushToast({ kind: "success", title: "IA aplicada", message: "Imagen mejorada con IA" });
      } else if (msg.type === "comida_ai_failed" && msg.item_id === itemNum) {
        setAiGenerating(false);
        pushToast({ kind: "error", title: "Error IA", message: msg.message || "Error al mejorar la imagen" });
      }
    }, [itemNum, pushToast]),
  });

  const onWineSave = useCallback((saved: Vino) => {
    setItemState(saved);
  }, []);

  if (isWine) {
    return (
      <WineDetailEditor
        vino={data.item as Vino | null}
        isNew={!!data.isNew}
        onSave={onWineSave}
      />
    );
  }

  const syncQuickFromItem = useCallback((nextItem: FoodItem | null) => {
    if (!nextItem) {
      setQuickName("");
      setQuickTitulo("");
      setQuickTipo("");
      setQuickPrecio("0.00");
      setQuickSuplemento("0.00");
      setQuickHasSuplemento(false);
      setQuickCategoria("");
      setQuickDescripcion("");
      setQuickActive(false);
      setQuickAllergens([]);
      return;
    }
    const suplementoValue = Number(nextItem.suplemento || 0);
    setQuickName(String(nextItem.nombre || ""));
    setQuickTitulo(String(nextItem.titulo || ""));
    setQuickTipo(String(nextItem.tipo || ""));
    setQuickPrecio(toMoneyInput(nextItem.precio));
    setQuickSuplemento(toMoneyInput(suplementoValue));
    setQuickHasSuplemento(suplementoValue > 0.001);
    setQuickCategoria(nextItem.category_id ? String(nextItem.category_id) : String(nextItem.categoria || ""));
    setQuickDescripcion(String(nextItem.descripcion || ""));
    setQuickActive(!!nextItem.active);
    setQuickAllergens(normalizeToCardAllergens(Array.isArray(nextItem.alergenos) ? nextItem.alergenos : []));
  }, []);

  useEffect(() => {
    setItemState(data.item);
  }, [data.item]);

  useEffect(() => {
    if (!supportsQuickEditor) return;
    syncQuickFromItem(item as FoodItem | null);
  }, [supportsQuickEditor, item, syncQuickFromItem]);

  useEffect(() => {
    if (!isPlate && !isBebida) return;
    let active = true;
    setCategoriesLoading(true);
    const targetCategories = isBebida
      ? api.comida.bebidas.categories
      : api.comida.platos.categories;
    void targetCategories.list()
      .then((res) => {
        if (!active || !res.success) return;
        const mapped = (res.categories || [])
          .map((category) => ({
            value: String(category.id),
            label: String(category.name || "").trim(),
          }))
          .filter((category) => category.label.length > 0);
        setCategories(mapped);
      })
      .catch(() => {
        if (!active) return;
        setCategories([]);
      })
      .finally(() => {
        if (!active) return;
        setCategoriesLoading(false);
      });
    return () => {
      active = false;
    };
  }, [api.comida.platos.categories, api.comida.bebidas.categories, isPlate, isBebida]);

  const currentPlate = useMemo(() => (isPlate && item ? (item as FoodItem) : null), [isPlate, item]);
  const currentFoodItem = useMemo(
    () => (supportsQuickEditor && item ? (item as FoodItem) : null),
    [supportsQuickEditor, item],
  );
  const currentCategoryValue = useMemo(() => {
    if (!currentPlate && !isBebida) return "";
    const foodItem = (currentPlate || (isBebida ? currentFoodItem : null)) as FoodItem | null;
    if (!foodItem) return "";
    return foodItem.category_id ? String(foodItem.category_id) : String(foodItem.categoria || "");
  }, [currentPlate, currentFoodItem, isBebida]);
  const quickPriceNumber = useMemo(() => parseDecimalInput(quickPrecio), [quickPrecio]);
  const quickSuppNumber = useMemo(() => parseDecimalInput(quickSuplemento), [quickSuplemento]);
  const quickSuppEffectiveNumber = useMemo(
    () => (quickHasSuplemento ? quickSuppNumber : 0),
    [quickHasSuplemento, quickSuppNumber],
  );
  const quickCategoryLabel = useMemo(
    () => categories.find((entry) => entry.value === quickCategoria)?.label || quickCategoria,
    [categories, quickCategoria],
  );
  const quickCategoryOptions = useMemo(() => {
    const options = [...categories];
    if (quickCategoria && !options.some((entry) => entry.value === quickCategoria)) {
      options.unshift({ value: quickCategoria, label: quickCategoria });
    }
    return options;
  }, [categories, quickCategoria]);
  const quickTipoOptions = useMemo(() => {
    const base = [
      { value: "ENTRANTE", label: "Entrante" },
      { value: "PRINCIPAL", label: "Principal" },
      { value: "ARROZ", label: "Arroz" },
      { value: "POSTRE", label: "Postre" },
    ];
    if (quickTipo && !base.some((option) => option.value === quickTipo)) {
      return [{ value: quickTipo, label: quickTipo }, ...base];
    }
    return base;
  }, [quickTipo]);
  const quickCategorySelectOptions = useMemo(
    () => [{ value: "", label: "Sin categoria" }, ...quickCategoryOptions],
    [quickCategoryOptions],
  );
  const quickDirty = useMemo(() => {
    if (!currentFoodItem) return false;
    const epsilon = 0.001;
    const categoryCheck = (isPlate || isBebida) ? quickCategoria.trim() !== currentCategoryValue.trim() : false;
    return (
      quickName.trim() !== String(currentFoodItem.nombre || "").trim()
      || quickTitulo.trim() !== String(currentFoodItem.titulo || "").trim()
      || (isPlate ? quickTipo.trim() !== String(currentFoodItem.tipo || "").trim() : false)
      || quickDescripcion.trim() !== String(currentFoodItem.descripcion || "").trim()
      || categoryCheck
      || quickActive !== !!currentFoodItem.active
      || !areAllergenSetsEqual(quickAllergens, Array.isArray(currentFoodItem.alergenos) ? currentFoodItem.alergenos : [])
      || quickPriceNumber === null
      || quickSuppEffectiveNumber === null
      || Math.abs(quickPriceNumber - Number(currentFoodItem.precio || 0)) > epsilon
      || Math.abs(quickSuppEffectiveNumber - Number(currentFoodItem.suplemento || 0)) > epsilon
    );
  }, [
    currentCategoryValue,
    currentFoodItem,
    isPlate,
    quickActive,
    quickAllergens,
    quickCategoria,
    quickDescripcion,
    quickName,
    quickPrecio,
    quickPriceNumber,
    quickSuppEffectiveNumber,
    quickTitulo,
    quickTipo,
  ]);
  const quickCanSave = useMemo(() => {
    if (!currentFoodItem || savingQuick) return false;
    if (!quickDirty) return false;
    if (quickName.trim().length === 0) return false;
    if (quickPriceNumber === null || quickPriceNumber < 0) return false;
    if (quickSuppEffectiveNumber === null || quickSuppEffectiveNumber < 0) return false;
    return true;
  }, [currentFoodItem, quickDirty, quickName, quickPriceNumber, quickSuppEffectiveNumber, savingQuick]);

  const title = useMemo(() => {
    if (!item) return "Detalle no disponible";
    return item.nombre || `Elemento #${data.foodId}`;
  }, [data.foodId, item]);
  const TypeIcon = FOOD_TYPE_ICONS[foodType];

  const breadcrumbs = useMemo<BreadcrumbItem[]>(() => {
    const items: BreadcrumbItem[] = [
      { label: "Carta", href: "/app/comida" },
      { label: FOOD_TYPE_LABELS[foodType], href: `/app/comida/${foodType}` },
    ];
    if (data.isNew) {
      items.push({ label: `Nuevo ${FOOD_TYPE_SINGULAR[foodType]}` });
    } else if (item) {
      items.push({ label: item.nombre || `#${data.foodId}` });
    } else if (data.foodId) {
      items.push({ label: `#${data.foodId}` });
    }
    return items;
  }, [data.foodId, data.isNew, foodType, item]);
  const detailKeyFacts = useMemo<DetailFact[]>(() => {
    if (!item) return [];

    const facts: DetailFact[] = [
      { id: "type", label: "Tipo", value: item.tipo || "-" },
      { id: "state", label: "Estado", value: item.active ? "Activo" : "Inactivo" },
      { id: "price", label: "Precio base", value: formatEuro(item.precio) },
    ];

    const food = item as FoodItem;
    const normalizedAllergens = foodType === "platos"
      ? quickAllergens
      : normalizeToCardAllergens(Array.isArray(food.alergenos) ? food.alergenos : []);
    facts.push(
      { id: "category", label: "Categoria", value: food.categoria || "-" },
      { id: "extra", label: "Suplemento", value: formatEuro(food.suplemento || 0) },
      { id: "allergens", label: "Alergenos", value: normalizedAllergens.length > 0 ? `${normalizedAllergens.length} declarados` : "Sin declarar" },
    );
    return facts;
  }, [foodType, item, quickAllergens]);

  const heroBadges = useMemo<HeroBadge[]>(() => {
    if (!item) return [];
    const badges: HeroBadge[] = [
      {
        id: "state",
        label: item.active ? "Activo" : "Inactivo",
        className: item.active ? "bo-badge--active" : "bo-badge--inactive",
      },
    ];

    if (item.tipo) badges.push({ id: "tipo", label: item.tipo, className: "bo-badge--lila" });

    const food = item as FoodItem;
    if (food.categoria) badges.push({ id: "categoria", label: food.categoria, className: "bo-badge--cyan" });
    if (foodType === "platos" && Number(food.suplemento || 0) > 0) {
      badges.push({ id: "extra", label: `+${formatEuro(food.suplemento || 0)}`, className: "bo-badge--yellow" });
    }

    return badges;
  }, [foodType, item]);

  const allergenList = useMemo<string[]>(() => {
    if (!item) return [];
    if (isPlate) return quickAllergens.filter((a) => a.trim().length > 0);
    const alergenos = Array.isArray((item as FoodItem).alergenos) ? (item as FoodItem).alergenos : [];
    return normalizeToCardAllergens(alergenos).filter((a) => a.trim().length > 0);
  }, [isPlate, item, quickAllergens]);

  const imageUrl = useMemo(() => {
    if (!item) return "";
    return String(item.foto_url || "").trim();
  }, [item]);

  const descriptionValue = useMemo(() => {
    if (!item) return "";
    return String(item.descripcion || "").trim();
  }, [item]);
  const hasDescription = descriptionValue.length > 0;
  const descriptionFallback = useMemo(() => getEmptyDescription(foodType), [foodType]);

  const onQuickSave = useCallback(async () => {
    if (!currentFoodItem || !quickCanSave) return;
    const precioNumber = parseDecimalInput(quickPrecio);
    const suplementoNumber = quickHasSuplemento ? parseDecimalInput(quickSuplemento) : 0;
    if (precioNumber === null || precioNumber < 0) {
      pushToast({ kind: "error", title: "Error", message: "Precio invalido" });
      return;
    }
    if (quickHasSuplemento && (suplementoNumber === null || suplementoNumber < 0)) {
      pushToast({ kind: "error", title: "Error", message: "Suplemento invalido" });
      return;
    }
    const patch: Record<string, unknown> = {
      nombre: quickName.trim(),
      titulo: quickTitulo.trim(),
      tipo: isPlate ? (quickTipo.trim() || currentFoodItem.tipo || "PRINCIPAL") : currentFoodItem.tipo || (isCafe ? "CAFE" : isBebida ? "REFRESCO" : ""),
      precio: precioNumber,
      suplemento: suplementoNumber ?? 0,
      descripcion: quickDescripcion.trim(),
      active: quickActive,
      alergenos: quickAllergens,
    };
    if (isPlate || isBebida) {
      const categoryValue = quickCategoria.trim();
      if (!categoryValue) {
        patch.category_id = null;
        patch.categoria = "";
      } else {
        const parsedCategoryId = Number(categoryValue);
        if (Number.isFinite(parsedCategoryId) && parsedCategoryId > 0) patch.category_id = parsedCategoryId;
        else patch.categoria = categoryValue;
      }
    }

    setSavingQuick(true);
    try {
      const itemNum = currentFoodItem.num;
      let res: { success: boolean; message?: string };
      let fresh: { success: boolean; item?: FoodItem | null };

      if (isPlate) {
        res = await api.comida.platos.patch(itemNum, patch as any);
        fresh = res.success ? await api.comida.platos.get(itemNum) : { success: false };
      } else if (isCafe) {
        res = await api.comida.cafes.patch(itemNum, patch as any);
        fresh = res.success ? await api.comida.cafes.get(itemNum) : { success: false };
      } else if (isBebida) {
        res = await api.comida.bebidas.patch(itemNum, patch as any);
        fresh = res.success ? await api.comida.bebidas.get(itemNum) : { success: false };
      } else {
        return;
      }

      if (!res.success) {
        pushToast({ kind: "error", title: "Error", message: res.message || "No se pudieron guardar los cambios" });
        return;
      }
      if (fresh.success && fresh.item) {
        setItemState(fresh.item);
        syncQuickFromItem(fresh.item);
      } else {
        const fallbackItem: FoodItem = {
          ...currentFoodItem,
          nombre: String((patch.nombre as string | undefined) ?? currentFoodItem.nombre),
          titulo: String((patch.titulo as string | undefined) ?? currentFoodItem.titulo ?? ""),
          tipo: String((patch.tipo as string | undefined) ?? currentFoodItem.tipo),
          precio: Number((patch.precio as number | undefined) ?? currentFoodItem.precio ?? 0),
          suplemento: Number((patch.suplemento as number | undefined) ?? currentFoodItem.suplemento ?? 0),
          descripcion: String((patch.descripcion as string | undefined) ?? currentFoodItem.descripcion ?? ""),
          active: Boolean(patch.active),
          category_id: typeof patch.category_id === "number" ? patch.category_id as number : null,
          categoria: (isPlate || isBebida) ? quickCategoryLabel || "" : currentFoodItem.categoria || "",
          alergenos: Array.isArray(patch.alergenos) ? patch.alergenos as string[] : currentFoodItem.alergenos,
        };
        setItemState(fallbackItem);
        syncQuickFromItem(fallbackItem);
      }
      const toastTitle = isPlate ? "Plato actualizado" : isCafe ? "Cafe actualizado" : "Bebida actualizada";
      pushToast({ kind: "success", title: toastTitle });
    } catch {
      pushToast({ kind: "error", title: "Error", message: "Error de conexion" });
    } finally {
      setSavingQuick(false);
    }
  }, [
    api.comida.bebidas,
    api.comida.cafes,
    api.comida.platos,
    currentFoodItem,
    isBebida,
    isCafe,
    isPlate,
    pushToast,
    quickActive,
    quickAllergens,
    quickCanSave,
    quickCategoria,
    quickDescripcion,
    quickHasSuplemento,
    quickName,
    quickPrecio,
    quickSuplemento,
    quickTitulo,
    quickTipo,
    syncQuickFromItem,
  ]);

  useEffect(() => {
    if (!supportsQuickEditor) return;
    const onKeyDown = (event: KeyboardEvent) => {
      const saveCombo = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s";
      if (!saveCombo) return;
      event.preventDefault();
      if (!quickCanSave) return;
      void onQuickSave();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onQuickSave, quickCanSave, supportsQuickEditor]);

  const openAllergenModal = useCallback(() => {
    setAllergenDraft(quickAllergens);
    setAllergenModalOpen(true);
  }, [quickAllergens]);

  const onToggleAllergenAndPersist = useCallback(async (key: string) => {
    if (!currentFoodItem || savingAllergens) return;
    const prevDraft = normalizeToCardAllergens(allergenDraft);
    const prevAllergens = quickAllergens;
    const nextDraft = prevDraft.includes(key)
      ? prevDraft.filter((value) => value !== key)
      : normalizeToCardAllergens([...prevDraft, key]);
    const unknownExisting = prevAllergens.filter((value) => !CARD_ALLERGEN_KEYS.has(value));
    const nextAllergens = normalizeToCardAllergens([...nextDraft, ...unknownExisting]);

    setAllergenDraft(nextDraft);
    setQuickAllergens(nextAllergens);
    setItemState((prev) => (prev ? { ...prev, alergenos: nextAllergens } as FoodItem : prev));

    setSavingAllergens(true);
    try {
      const itemNum = currentFoodItem.num;
      let res: { success: boolean; message?: string };
      if (isPlate) {
        res = await api.comida.platos.patch(itemNum, { alergenos: nextAllergens });
      } else if (isCafe) {
        res = await api.comida.cafes.patch(itemNum, { alergenos: nextAllergens });
      } else if (isBebida) {
        res = await api.comida.bebidas.patch(itemNum, { alergenos: nextAllergens });
      } else {
        return;
      }
      if (!res.success) {
        setAllergenDraft(prevDraft);
        setQuickAllergens(prevAllergens);
        setItemState((prev) => (prev ? { ...prev, alergenos: prevAllergens } as FoodItem : prev));
        pushToast({ kind: "error", title: "Error", message: res.message || "No se pudieron guardar los alergenos" });
      }
    } catch {
      setAllergenDraft(prevDraft);
      setQuickAllergens(prevAllergens);
      setItemState((prev) => (prev ? { ...prev, alergenos: prevAllergens } as FoodItem : prev));
      pushToast({ kind: "error", title: "Error", message: "Error de conexion" });
    } finally {
      setSavingAllergens(false);
    }
  }, [allergenDraft, api.comida.bebidas, api.comida.cafes, api.comida.platos, currentFoodItem, isBebida, isCafe, isPlate, pushToast, quickAllergens, savingAllergens]);

  const handleBebidaCatAdd = useCallback(async (name: string) => {
    const res = await api.comida.bebidas.categories.create({ name });
    if (!res.success) throw new Error(res.message || "No se pudo crear la categoria");
    return { id: (res as any).category?.id ?? 0, name, slug: (res as any).category?.slug ?? "" };
  }, [api.comida.bebidas.categories]);

  const handleBebidaCatOptimistic = useCallback((category: { value: string; label: string }) => {
    setCategories((prev) => {
      if (prev.some((c) => c.value === category.value)) return prev;
      return [...prev, category];
    });
    setQuickCategoria(category.value);
  }, []);

  // Image selection handler
  const handleImageSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!isValidImageFile(file)) {
      pushToast({ kind: "error", title: "Error", message: "Tipo de archivo no valido. Usa JPG, PNG, WebP o GIF." });
      return;
    }

    setUploading(true);
    try {
      const compressed = await compressImageToWebP(file, 80);
      setImageBase64(compressed);
      setImagePreview(compressed);
      if (showAdvisorForType) {
        setShowAIAdvisor(true);
      }
    } catch {
      pushToast({ kind: "error", title: "Error", message: "No se pudo procesar la imagen" });
    } finally {
      setUploading(false);
    }
  }, [pushToast, showAdvisorForType]);

  const runAIEnhance = useCallback(async (targetNum: number) => {
    setAiBusy(true);
    setAiGenerating(true);
    setShowAIAdvisor(false);

    try {
      const targetApi = isBebida
        ? api.comida.bebidas
        : api.comida.cafes;
      const b64 = imageBase64?.split(",")[1];
      if (!b64) throw new Error("No image data");

      const byteChars = atob(b64);
      const byteArray = new Uint8Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) {
        byteArray[i] = byteChars.charCodeAt(i);
      }
      const blob = new Blob([byteArray], { type: "image/webp" });
      const webpFile = new File([blob], "comida-ai.webp", { type: "image/webp" });

      const res = await targetApi.uploadImageAI(targetNum, webpFile);
      if (!res.success) {
        pushToast({ kind: "error", title: "Error IA", message: res.message || "No se pudo aplicar IA" });
        setAiGenerating(false);
      }
    } catch {
      pushToast({ kind: "error", title: "Error IA", message: "Error al mejorar la imagen con IA" });
      setAiGenerating(false);
    } finally {
      setAiBusy(false);
    }
  }, [api.comida.bebidas, api.comida.cafes, imageBase64, isBebida, pushToast]);

  const handleAIAdvisorClose = useCallback(() => {
    setShowAIAdvisor(false);
  }, []);

  const handleAIContinueWithout = useCallback(() => {
    setShowAIAdvisor(false);
    setImageBase64(null);
    setImagePreview(null);
  }, []);

  const handleAIEnhance = useCallback(() => {
    if (!currentFoodItem) return;
    runAIEnhance(currentFoodItem.num);
  }, [currentFoodItem, runAIEnhance]);

  return (
    <section aria-label="Detalle comida" className="bo-content-grid bo-memberDetailPage bo-foodDetailPage" data-role="food-detail-page">
      <div className="bo-foodDetailTopbar" data-ui="food-detail-topbar">
        <Breadcrumbs items={breadcrumbs} />
        {item ? (
          <span className={`bo-badge bo-badge--sm ${item.active ? "bo-badge--active" : "bo-badge--inactive"}`} data-role="food-detail-status-badge">
            {item.active ? "Visible" : "Oculto"}
          </span>
        ) : null}
      </div>

      {!item ? (
        <div className="bo-panel bo-foodDetailPanel" data-ui="food-detail-empty-panel">
          <div className="bo-panelHead" data-slot="food-detail-empty-head">
            <div className="bo-panelTitle" data-role="food-detail-empty-title">Elemento no disponible</div>
            <div className="bo-panelMeta" data-role="food-detail-empty-meta">No se pudo cargar el detalle solicitado.</div>
          </div>
        </div>
      ) : (
        <>
          <div className="bo-panel bo-foodDetailHero" data-ui="food-detail-hero">
            <div className="bo-foodDetailMedia max-w-[280px] mx-auto max-h-auto" data-slot="food-detail-media">
              {aiGenerating ? (
                <div className="bo-foodDetailMediaSkeleton flex items-center justify-center" data-role="food-detail-image-skeleton" style={{ minHeight: 160 }}>
                  <Loader2 size={32} className="bo-foodDetailSpinIcon animate-spin" data-role="food-detail-skeleton-spinner" />
                </div>
              ) : imageUrl ? (
                <img src={imageUrl} alt={`Imagen de ${title}`} loading="lazy" decoding="async" data-role="food-detail-image" />
              ) : (
                <div className="bo-foodDetailMediaPlaceholder" aria-hidden="true" data-role="food-detail-media-placeholder">
                  <TypeIcon size={42} data-role="food-detail-type-icon" />
                </div>
              )}
              {supportsQuickEditor && (
                <button
                  data-role="food-detail-change-photo-btn"
                  type="button"
                  className="bo-btn bo-btn--glass w-full mt-3"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading || aiBusy}
                >
                  <Camera size={14} data-role="food-detail-camera-icon" />
                  Cambiar foto
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={handleImageSelect}
                className="hidden"
                data-role="food-detail-file-input"
              />
            </div>

            <div className="bo-foodDetailHeroBody" data-slot="food-detail-hero-body !flex !flex-col !justify-center" style={{ display: "flex", flexDirection: "column", justifyContent: "center"}}>
              <div className="bo-foodDetailHeroIdentity w-fit mx-auto" data-slot="food-detail-hero-identity">
                <div className="bo-foodDetailEyebrow" data-role="food-detail-eyebrow">
                  {FOOD_TYPE_LABELS[foodType]} · #{item.num}
                </div>
                <div className="bo-foodDetailTitleRow" data-ui="food-detail-title-row">
                  <TypeIcon className="bo-foodDetailTypeIcon" size={18} aria-hidden="true" data-ui="food-detail-title-icon" />
                  <div className="bo-panelTitle bo-foodDetailTitle" data-role="food-detail-title">{title}</div>
                </div>
                <div className="bo-foodDetailBadgeRow" data-slot="food-detail-badge-row">
                  {heroBadges.map((badge) => (
                    <span key={badge.id} className={`bo-badge ${badge.className}`} data-role="food-detail-hero-badge">
                      {badge.label}
                    </span>
                  ))}
                </div>
              </div>
              {!isPlate ? (
                <div className="bo-foodDetailPriceWrap !bg-transparent !shadow-none !border-none w-fit mx-auto justify-center" style={{ background: "none" }} data-ui="food-detail-price-wrap">
                  <span className="bo-foodDetailPriceLabel" data-role="food-detail-price-label">Precio carta</span>
                  <div className="bo-foodDetailPrice" data-role="food-detail-price-value">{formatEuro(item.precio)}</div>
                </div>
              ) : null}
            </div>
          </div>

          

          {supportsQuickEditor && currentFoodItem ? (
            <div className="bo-panel bo-foodDetailPanel bo-foodDetailQuickEditor" data-ui="food-detail-quick-editor">
              <div className="bo-panelHead bo-foodDetailQuickHead" data-slot="food-detail-quick-head">
                <div data-slot="food-detail-quick-title-wrap">
                  <div className="bo-panelTitle" data-role="food-detail-quick-title">Edicion rapida</div>
                  <div className="bo-panelMeta" data-role="food-detail-quick-meta">Atajos para ajustar este plato sin volver al listado.</div>
                </div>
                <span className={`bo-badge bo-badge--sm ${quickDirty ? "bo-badge--warning" : "bo-badge--muted"}`} data-role="food-detail-quick-dirty-badge">
                  {quickDirty ? "Cambios sin guardar" : "Sin cambios"}
                </span>
              </div>
              <div className="bo-panelBody" data-slot="food-detail-quick-body">
                <div className="bo-foodDetailQuickGrid" data-ui="food-detail-quick-grid">
                  <label className="bo-field" data-slot="food-detail-quick-name-field">
                    <span className="bo-label" data-role="food-detail-quick-name-label">Nombre</span>
                    <input
                      type="text"
                      className="bo-input"
                      value={quickName}
                      onChange={(event) => setQuickName(event.target.value)}
                      disabled={savingQuick}
                      data-role="food-detail-quick-name-input"
                    />
                  </label>
                  <label className="bo-field" data-slot="food-detail-quick-titulo-field">
                    <span className="bo-label" data-role="food-detail-quick-titulo-label">Titulo</span>
                    <input
                      type="text"
                      className="bo-input"
                      value={quickTitulo}
                      onChange={(event) => setQuickTitulo(event.target.value)}
                      disabled={savingQuick}
                      data-role="food-detail-quick-titulo-input"
                    />
                  </label>
                  {isPlate ? (
                  <label className="bo-field" data-slot="food-detail-quick-tipo-field">
                    <span className="bo-label" data-role="food-detail-quick-tipo-label">Tipo</span>
                    <Select
                      value={quickTipo}
                      onChange={setQuickTipo}
                      options={quickTipoOptions}
                      className="bo-foodDetailSelect"
                      ariaLabel="Tipo del plato"
                      disabled={savingQuick}
                    />
                  </label>
                  ) : null}
                  <label className="bo-field" data-slot="food-detail-quick-precio-field">
                    <span className="bo-label" data-role="food-detail-quick-precio-label">Precio</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className="bo-input"
                      value={quickPrecio}
                      onChange={(event) => setQuickPrecio(event.target.value)}
                      disabled={savingQuick}
                      data-role="food-detail-quick-precio-input"
                    />
                  </label>
                  <label className="bo-field" data-slot="food-detail-quick-categoria-field">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="bo-label" data-role="food-detail-quick-categoria-label">Categoria</span>
                      {isBebida ? (
                        <button
                          data-role="food-detail-add-category-btn"
                          type="button"
                          className="bo-btn bo-btn--ghost bo-btn--sm"
                          onClick={() => setBebidaCatModalOpen(true)}
                        >
                          <Plus size={14} />
                          Añadir categoria
                        </button>
                      ) : null}
                    </div>
                    <Select
                      value={quickCategoria}
                      onChange={setQuickCategoria}
                      options={quickCategorySelectOptions}
                      className="bo-foodDetailSelect"
                      ariaLabel="Categoria del plato"
                      disabled={savingQuick || categoriesLoading}
                    />
                  </label>
                  <div className={`bo-foodDetailQuickStatus bo-foodDetailQuickSupplement${quickHasSuplemento ? " is-active" : ""}`} data-ui="food-detail-quick-supplement">
                    <div className="bo-foodDetailQuickStatusRow" data-ui="food-detail-quick-supplement-row">
                      <span className="bo-label" data-role="food-detail-quick-supplement-label">Tiene suplemento</span>
                      <Switch
                        checked={quickHasSuplemento}
                        onCheckedChange={setQuickHasSuplemento}
                        disabled={savingQuick}
                        aria-label="Activar suplemento"
                      />
                    </div>
                    {quickHasSuplemento ? (
                      <label className="bo-field bo-foodDetailQuickSupplementField" data-slot="food-detail-quick-supplement-field">
                        <span className="bo-label" data-role="food-detail-quick-supplement-amount-label">Importe suplemento</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          className="bo-input"
                          value={quickSuplemento}
                          onChange={(event) => setQuickSuplemento(event.target.value)}
                          disabled={savingQuick}
                          data-role="food-detail-quick-supplement-input"
                        />
                      </label>
                    ) : null}
                  </div>
                  <div className="bo-foodDetailQuickStatus" data-ui="food-detail-quick-active">
                    <span className="bo-label" data-role="food-detail-quick-active-label">Visible en carta</span>
                    <Switch checked={quickActive} onCheckedChange={setQuickActive} disabled={savingQuick} aria-label="Cambiar visibilidad del plato" />
                  </div>
                  <label className="bo-field bo-foodDetailQuickDescription" data-slot="food-detail-quick-description-field">
                    <span className="bo-label" data-role="food-detail-quick-description-label">Descripcion</span>
                    <textarea
                      className="bo-textarea"
                      rows={4}
                      value={quickDescripcion}
                      onChange={(event) => setQuickDescripcion(event.target.value)}
                      disabled={savingQuick}
                      data-role="food-detail-quick-description-textarea"
                    />
                  </label>
                </div>
              </div>
              <div className="bo-foodDetailEditorActions" data-slot="food-detail-quick-actions">
                <button
                  className="bo-btn bo-btn--primary"
                  type="button"
                  onClick={onQuickSave}
                  disabled={!quickCanSave}
                  aria-label="Guardar cambios"
                  title="Guardar cambios"
                  data-role="food-detail-quick-save-btn"
                >
                  {savingQuick ? <Loader2 size={14} className="bo-foodDetailSpinIcon" /> : <Save size={14} />}
                </button>
              </div>
            </div>
          ) : null}

          <div className="bo-panel bo-foodDetailPanel bo-foodDetailPanel--allergens" data-ui="food-detail-allergens-panel">
            <div className="bo-panelHead bo-foodDetailAllergenHead" data-slot="food-detail-allergens-head">
              <div data-slot="food-detail-allergens-title-wrap">
                <div className="bo-panelTitle" data-role="food-detail-allergens-title">Alergenos</div>
                <div className="bo-panelMeta" data-role="food-detail-allergens-meta">Etiquetas usadas para informacion alergena del plato.</div>
              </div>
              {supportsQuickEditor ? (
                <button className="bo-btn bo-btn--ghost bo-btn--sm" type="button" onClick={openAllergenModal} data-role="food-detail-allergens-edit-btn">
                  <Plus size={14} />
                  Añadir
                </button>
              ) : null}
            </div>
            <div className="bo-panelBody" data-slot="food-detail-allergens-body">
              {allergenList.length > 0 ? (
                <div className="bo-tagsList bo-foodDetailTags" data-ui="food-detail-allergens-tags">
                  {allergenList.map((alergeno) => (
                    <span key={alergeno} className="bo-tagItem bo-foodDetailTag bo-foodDetailTag--removable" data-role="food-detail-allergen-tag">
                      <span data-role="food-detail-allergen-tag-text">{alergeno}</span>
                      <button
                        type="button"
                        className="bo-tagItemRemove"
                        onClick={() => void onToggleAllergenAndPersist(alergeno)}
                        aria-label={`Eliminar ${alergeno}`}
                        disabled={savingAllergens}
                        data-role="food-detail-allergen-tag-remove"
                      >
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                </div>
              ) : (
                <div className="bo-foodDetailEmptyNote" data-role="food-detail-allergens-empty">Sin alergenos</div>
              )}
            </div>
          </div>

          {supportsQuickEditor ? (
            <Modal open={allergenModalOpen} title="Alergenos" onClose={() => setAllergenModalOpen(false)} widthPx={620}>
              <div className="bo-modalHead" data-slot="food-detail-allergen-modal-head">
                <div className="bo-modalTitle" data-role="food-detail-allergen-modal-title">Selecciona alergenos</div>
                <button className="bo-modalX" type="button" onClick={() => setAllergenModalOpen(false)} aria-label="Cerrar" data-role="food-detail-allergen-modal-close">
                  ×
                </button>
              </div>
              <div className="bo-modalBody" data-slot="food-detail-allergen-modal-body">
                <div className="bo-allergenGrid" data-ui="food-detail-allergen-modal-grid">
                  {CARD_ALLERGENS.map((item) => {
                    const selected = allergenDraft.includes(item.key);
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.key}
                        type="button"
                        className={`bo-allergenCircle ${selected ? "is-selected" : ""}`}
                        onClick={() => void onToggleAllergenAndPersist(item.key)}
                        disabled={savingAllergens}
                        data-role="food-detail-allergen-modal-item"
                      >
                        <span className="bo-allergenCircleIcon" data-role="food-detail-allergen-modal-item-icon"><Icon size={16} /></span>
                        <span className="bo-allergenCircleLabel" data-role="food-detail-allergen-modal-item-label">{item.key}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="bo-modalActions" data-slot="food-detail-allergen-modal-actions">
                {savingAllergens ? (
                  <span className="bo-panelMeta" data-role="food-detail-allergen-modal-saving">Guardando cambios...</span>
                ) : (
                  <span className="bo-panelMeta" data-role="food-detail-allergen-modal-autosaved">Cambios guardados automaticamente.</span>
                )}
                <button className="bo-btn bo-btn--ghost" type="button" onClick={() => setAllergenModalOpen(false)} disabled={savingAllergens} data-role="food-detail-allergen-modal-cancel">
                  Cancelar
                </button>
              </div>
            </Modal>
          ) : null}

          {isBebida ? (
            <BeverageCategoryModal
              open={bebidaCatModalOpen}
              defaultCategoryNames={["Refrescos", "Aguas", "Zumos", "Cervezas", "Copas", "Licores", "Cocktails"]}
              onClose={() => setBebidaCatModalOpen(false)}
              onAddCategory={handleBebidaCatAdd}
              onOptimisticAdd={handleBebidaCatOptimistic}
            />
          ) : null}

          {/* AI Advisor Modal for image enhancement */}
          {showAIAdvisor && imagePreview ? (
            <div
              data-role="food-detail-ai-advisor-overlay"
              className="fixed inset-0 z-[210] flex items-center justify-center bg-black/60"
              onClick={(e) => { if (e.target === e.currentTarget) handleAIAdvisorClose(); }}
            >
              <div
                data-ui="food-detail-ai-advisor-content"
                className="bg-[var(--bo-surface)] rounded-2xl border border-[var(--bo-border)] shadow-xl max-w-md w-full mx-4 overflow-hidden"
              >
                <div data-slot="food-detail-ai-advisor-header" className="flex items-center justify-between p-4 border-b border-[var(--bo-border)]">
                  <span data-role="food-detail-ai-advisor-title" className="text-sm font-semibold text-[var(--bo-text)]">
                    Asesor IA de imagen
                  </span>
                  <button
                    type="button"
                    onClick={handleAIAdvisorClose}
                    data-role="food-detail-ai-advisor-close"
                    className="p-1 rounded-lg hover:bg-[var(--bo-surface-2)] transition-colors duration-150"
                    disabled={aiBusy}
                  >
                    <X size={16} className="text-[var(--bo-muted)]" data-role="food-detail-ai-advisor-close-icon" />
                  </button>
                </div>

                <div data-slot="food-detail-ai-advisor-preview" className="p-4">
                  <img
                    src={imagePreview}
                    alt="Vista previa"
                    data-role="food-detail-ai-advisor-preview-img"
                    className="w-full aspect-square object-cover rounded-xl"
                  />
                </div>

                <div data-slot="food-detail-ai-advisor-actions" className="flex gap-3 p-4 border-t border-[var(--bo-border)]">
                  <button
                    type="button"
                    onClick={handleAIContinueWithout}
                    disabled={aiBusy}
                    data-role="food-detail-ai-advisor-without-btn"
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium
                      bg-[var(--bo-surface-2)] text-[var(--bo-text)] border border-[var(--bo-border)]
                      hover:bg-[var(--bo-surface-3)] transition-colors duration-150
                      disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Upload size={14} data-slot="upload-icon" />
                    Continuar sin mejorar
                  </button>
                  <button
                    type="button"
                    onClick={handleAIEnhance}
                    disabled={aiBusy}
                    data-role="food-detail-ai-advisor-enhance-btn"
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium
                      bg-purple-950/40 border-white/20 border-solid !border-[0.5px] hover:bg-purple-500/20 hover:cursor-pointer text-white
                      hover:opacity-90 transition-opacity duration-150
                      disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {aiBusy ? (
                      <Loader2 size={14} className="animate-spin" data-slot="ai-spinner" />
                    ) : (
                      "Mejorar con IA"
                    )}
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
