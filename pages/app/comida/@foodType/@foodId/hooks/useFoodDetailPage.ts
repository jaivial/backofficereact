import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePageContext } from "vike-react/usePageContext";

import { createClient } from "../../../../../../api/client";
import type { FoodItem, Vino } from "../../../../../../api/types";
import type { Data } from "../+data";
import { useErrorToast } from "../../../../../../ui/feedback/useErrorToast";
import { useToasts } from "../../../../../../ui/feedback/useToasts";
import { FOOD_TYPE_LABELS, FOOD_TYPE_SINGULAR } from "../../../_components/foodTypes";
import type { FoodType } from "../../../_components/foodTypes";
import { normalizeToCardAllergens, parseDecimalInput, toMoneyInput } from "../helpers";
import { useComidaAIWebSocket, type ComidaAIWSMessage } from "../functionalComponents/FoodDetailImageEditor/hooks/useComidaAIWebSocket";
import { compressImageToWebP, isValidImageFile } from "../../../../../../lib/imageCompressor";

export interface QuickFormState {
  name: string;
  titulo: string;
  tipo: string;
  precio: string;
  suplemento: string;
  hasSuplemento: boolean;
  categoria: string;
  descripcion: string;
  active: boolean;
  allergens: string[];
}

export function useFoodDetailPage() {
  const pageContext = usePageContext();
  const data = pageContext.data as Data;
  useErrorToast(data.error);
  const api = useMemo(() => createClient({ baseUrl: "" }), []);
  const { pushToast } = useToasts();

  const [itemState, setItemState] = useState<typeof data.item>(data.item);
  const [categories, setCategories] = useState<Array<{ value: string; label: string }>>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [savingQuick, setSavingQuick] = useState(false);
  const [savingAllergens, setSavingAllergens] = useState(false);
  const [allergenModalOpen, setAllergenModalOpen] = useState(false);
  const [allergenDraft, setAllergenDraft] = useState<string[]>([]);
  const [bebidaCatModalOpen, setBebidaCatModalOpen] = useState(false);

  // Image handling state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [showAIAdvisor, setShowAIAdvisor] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);

  // Quick form state
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

  const item = itemState;
  const foodType = data.foodType;
  const isPlate = foodType === "platos";
  const isCafe = foodType === "cafes";
  const isBebida = foodType === "bebidas";
  const isWine = foodType === "vinos";
  const supportsQuickEditor = isPlate || isCafe || isBebida;

  // WebSocket for AI events
  const itemNum = item ? (item as FoodItem).num : null;
  const showAdvisorForType = isBebida || isCafe;

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

  useEffect(() => {
    setItemState(data.item);
  }, [data.item]);

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
    if (!supportsQuickEditor) return;
    syncQuickFromItem(item as FoodItem | null);
  }, [supportsQuickEditor, item, syncQuickFromItem]);

  useEffect(() => {
    if (!isPlate && !isBebida) return;
    let active = true;
    setCategoriesLoading(true);
    const targetCategories = isBebida ? api.comida.bebidas.categories : api.comida.platos.categories;
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
  const currentFoodItem = useMemo(() => (supportsQuickEditor && item ? (item as FoodItem) : null), [supportsQuickEditor, item]);
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
      || quickAllergens.length !== (Array.isArray(currentFoodItem.alergenos) ? currentFoodItem.alergenos : []).length
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
    quickCategoryLabel,
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

  const CARD_ALLERGEN_KEYS_SET = new Set([
    "Gluten", "Crustaceos", "Huevos", "Pescado", "Cacahuetes", "Soja", "Leche",
    "Frutos de cascara", "Apio", "Mostaza", "Sesamo", "Sulfitos", "Altramuces", "Moluscos",
  ]);

  const onToggleAllergenAndPersist = useCallback(async (key: string) => {
    if (!currentFoodItem || savingAllergens) return;
    const prevDraft = normalizeToCardAllergens(allergenDraft);
    const prevAllergens = quickAllergens;
    const nextDraft = prevDraft.includes(key)
      ? prevDraft.filter((value) => value !== key)
      : normalizeToCardAllergens([...prevDraft, key]);
    const unknownExisting = prevAllergens.filter((value) => !CARD_ALLERGEN_KEYS_SET.has(value));
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
      const targetApi = isBebida ? api.comida.bebidas : api.comida.cafes;
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

  return {
    // State
    item,
    itemState,
    setItemState,
    categories,
    categoriesLoading,
    savingQuick,
    savingAllergens,
    allergenModalOpen,
    setAllergenModalOpen,
    allergenDraft,
    bebidaCatModalOpen,
    setBebidaCatModalOpen,
    fileInputRef,
    imageBase64,
    imagePreview,
    uploading,
    showAIAdvisor,
    aiBusy,
    aiGenerating,
    // Quick form state
    quickName, setQuickName,
    quickTitulo, setQuickTitulo,
    quickTipo, setQuickTipo,
    quickPrecio, setQuickPrecio,
    quickSuplemento, setQuickSuplemento,
    quickHasSuplemento, setQuickHasSuplemento,
    quickCategoria, setQuickCategoria,
    quickDescripcion, setQuickDescripcion,
    quickActive, setQuickActive,
    quickAllergens, setQuickAllergens,
    // Derived state
    foodType,
    isPlate,
    isCafe,
    isBebida,
    isWine,
    supportsQuickEditor,
    itemNum,
    showAdvisorForType,
    currentPlate,
    currentFoodItem,
    currentCategoryValue,
    quickPriceNumber,
    quickSuppNumber,
    quickSuppEffectiveNumber,
    quickCategoryLabel,
    quickCategoryOptions,
    quickTipoOptions,
    quickCategorySelectOptions,
    quickDirty,
    quickCanSave,
    // Handlers
    onWineSave,
    syncQuickFromItem,
    onQuickSave,
    openAllergenModal,
    onToggleAllergenAndPersist,
    handleBebidaCatAdd,
    handleBebidaCatOptimistic,
    handleImageSelect,
    handleAIAdvisorClose,
    handleAIContinueWithout,
    handleAIEnhance,
  };
}
