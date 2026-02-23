import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bean,
  ChevronLeft,
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
import { FOOD_TYPE_LABELS, type FoodType } from "../../_components/foodTypes";

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
    if (!trimmed) return;
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

  const item = itemState;
  const foodType = data.foodType;
  const isPlate = foodType === "platos";

  const syncQuickFromItem = useCallback((nextItem: FoodItem | null) => {
    if (!nextItem) {
      setQuickName("");
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
    if (!isPlate) return;
    syncQuickFromItem(item as FoodItem | null);
  }, [isPlate, item, syncQuickFromItem]);

  useEffect(() => {
    if (!isPlate) return;
    let active = true;
    setCategoriesLoading(true);
    void api.comida.platos.categories.list()
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
  }, [api.comida.platos.categories, isPlate]);

  const currentPlate = useMemo(() => (isPlate && item ? (item as FoodItem) : null), [isPlate, item]);
  const currentCategoryValue = useMemo(() => {
    if (!currentPlate) return "";
    return currentPlate.category_id ? String(currentPlate.category_id) : String(currentPlate.categoria || "");
  }, [currentPlate]);
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
    if (!currentPlate) return false;
    const epsilon = 0.001;
    return (
      quickName.trim() !== String(currentPlate.nombre || "").trim()
      || quickTipo.trim() !== String(currentPlate.tipo || "").trim()
      || quickDescripcion.trim() !== String(currentPlate.descripcion || "").trim()
      || quickCategoria.trim() !== currentCategoryValue.trim()
      || quickActive !== !!currentPlate.active
      || !areAllergenSetsEqual(quickAllergens, Array.isArray(currentPlate.alergenos) ? currentPlate.alergenos : [])
      || quickPriceNumber === null
      || quickSuppEffectiveNumber === null
      || Math.abs(quickPriceNumber - Number(currentPlate.precio || 0)) > epsilon
      || Math.abs(quickSuppEffectiveNumber - Number(currentPlate.suplemento || 0)) > epsilon
    );
  }, [
    currentCategoryValue,
    currentPlate,
    quickActive,
    quickAllergens,
    quickCategoria,
    quickDescripcion,
    quickName,
    quickPriceNumber,
    quickSuppEffectiveNumber,
    quickTipo,
  ]);
  const quickCanSave = useMemo(() => {
    if (!currentPlate || savingQuick) return false;
    if (!quickDirty) return false;
    if (quickName.trim().length === 0) return false;
    if (quickPriceNumber === null || quickPriceNumber < 0) return false;
    if (quickSuppEffectiveNumber === null || quickSuppEffectiveNumber < 0) return false;
    return true;
  }, [currentPlate, quickDirty, quickName, quickPriceNumber, quickSuppEffectiveNumber, savingQuick]);

  const isWine = foodType === "vinos";
  const title = useMemo(() => {
    if (!item) return "Detalle no disponible";
    return item.nombre || `Elemento #${data.foodId}`;
  }, [data.foodId, item]);
  const TypeIcon = FOOD_TYPE_ICONS[foodType];

  const backHref = `/app/comida/${foodType}`;
  const detailKeyFacts = useMemo<DetailFact[]>(() => {
    if (!item) return [];

    const facts: DetailFact[] = [
      { id: "type", label: "Tipo", value: item.tipo || "-" },
      { id: "state", label: "Estado", value: item.active ? "Activo" : "Inactivo" },
      { id: "price", label: "Precio base", value: formatEuro(item.precio) },
    ];

    if (foodType === "vinos") {
      const wine = item as Vino;
      facts.push(
        { id: "bodega", label: "Bodega", value: wine.bodega || "-" },
        { id: "origen", label: "D.O.", value: wine.denominacion_origen || "-" },
        { id: "anyo", label: "Anyo", value: wine.anyo || "-" },
        { id: "graduacion", label: "Graduacion", value: Number(wine.graduacion || 0) > 0 ? `${wine.graduacion}% vol` : "-" },
      );
      return facts;
    }

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

    if (foodType === "vinos") {
      const wine = item as Vino;
      if (wine.denominacion_origen) badges.push({ id: "do", label: wine.denominacion_origen, className: "bo-badge--cyan" });
      return badges;
    }

    const food = item as FoodItem;
    if (food.categoria) badges.push({ id: "categoria", label: food.categoria, className: "bo-badge--cyan" });
    if (foodType === "platos" && Number(food.suplemento || 0) > 0) {
      badges.push({ id: "extra", label: `+${formatEuro(food.suplemento || 0)}`, className: "bo-badge--yellow" });
    }

    return badges;
  }, [foodType, item]);

  const allergenList = useMemo<string[]>(() => {
    if (!item || isWine) return [];
    if (isPlate) return quickAllergens;
    const alergenos = Array.isArray((item as FoodItem).alergenos) ? (item as FoodItem).alergenos : [];
    return normalizeToCardAllergens(alergenos);
  }, [isPlate, isWine, item, quickAllergens]);

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
    if (!currentPlate || !quickCanSave) return;
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
      tipo: quickTipo.trim() || currentPlate.tipo || "PRINCIPAL",
      precio: precioNumber,
      suplemento: suplementoNumber ?? 0,
      descripcion: quickDescripcion.trim(),
      active: quickActive,
      alergenos: quickAllergens,
    };
    const categoryValue = quickCategoria.trim();
    if (!categoryValue) {
      patch.category_id = null;
      patch.categoria = "";
    } else {
      const parsedCategoryId = Number(categoryValue);
      if (Number.isFinite(parsedCategoryId) && parsedCategoryId > 0) patch.category_id = parsedCategoryId;
      else patch.categoria = categoryValue;
    }

    setSavingQuick(true);
    try {
      const res = await api.comida.platos.patch(currentPlate.num, patch as any);
      if (!res.success) {
        pushToast({ kind: "error", title: "Error", message: res.message || "No se pudieron guardar los cambios" });
        return;
      }
      const fresh = await api.comida.platos.get(currentPlate.num);
      if (fresh.success && fresh.item) {
        setItemState(fresh.item);
        syncQuickFromItem(fresh.item);
      } else {
        const fallbackItem: FoodItem = {
          ...currentPlate,
          nombre: String((patch.nombre as string | undefined) ?? currentPlate.nombre),
          tipo: String((patch.tipo as string | undefined) ?? currentPlate.tipo),
          precio: Number((patch.precio as number | undefined) ?? currentPlate.precio ?? 0),
          suplemento: Number((patch.suplemento as number | undefined) ?? currentPlate.suplemento ?? 0),
          descripcion: String((patch.descripcion as string | undefined) ?? currentPlate.descripcion ?? ""),
          active: Boolean(patch.active),
          category_id: typeof patch.category_id === "number" ? patch.category_id as number : null,
          categoria: quickCategoryLabel || "",
          alergenos: Array.isArray(patch.alergenos) ? patch.alergenos as string[] : currentPlate.alergenos,
        };
        setItemState(fallbackItem);
        syncQuickFromItem(fallbackItem);
      }
      pushToast({ kind: "success", title: "Plato actualizado" });
    } catch {
      pushToast({ kind: "error", title: "Error", message: "Error de conexion" });
    } finally {
      setSavingQuick(false);
    }
  }, [
    api.comida.platos,
    currentPlate,
    pushToast,
    quickActive,
    quickCanSave,
    quickCategoria,
    quickCategoryLabel,
    quickDescripcion,
    quickHasSuplemento,
    quickAllergens,
    quickName,
    quickPrecio,
    quickSuplemento,
    quickTipo,
    syncQuickFromItem,
  ]);

  useEffect(() => {
    if (!isPlate) return;
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
  }, [isPlate, onQuickSave, quickCanSave]);

  const openAllergenModal = useCallback(() => {
    setAllergenDraft(quickAllergens);
    setAllergenModalOpen(true);
  }, [quickAllergens]);

  const onToggleAllergenAndPersist = useCallback(async (key: string) => {
    if (!currentPlate || savingAllergens) return;
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
      const res = await api.comida.platos.patch(currentPlate.num, { alergenos: nextAllergens });
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
  }, [allergenDraft, api.comida.platos, currentPlate, pushToast, quickAllergens, savingAllergens]);

  return (
    <section aria-label="Detalle comida" className="bo-content-grid bo-memberDetailPage bo-foodDetailPage">
      <div className="bo-foodDetailTopbar">
        <button className="bo-menuBackBtn" type="button" onClick={() => window.location.assign(backHref)}>
          <ChevronLeft size={16} />
          Volver a {FOOD_TYPE_LABELS[foodType]}
        </button>
        {item ? (
          <span className={`bo-badge bo-badge--sm ${item.active ? "bo-badge--active" : "bo-badge--inactive"}`}>
            {item.active ? "Visible" : "Oculto"}
          </span>
        ) : null}
      </div>

      {!item ? (
        <div className="bo-panel bo-foodDetailPanel">
          <div className="bo-panelHead">
            <div className="bo-panelTitle">Elemento no disponible</div>
            <div className="bo-panelMeta">No se pudo cargar el detalle solicitado.</div>
          </div>
        </div>
      ) : (
        <>
          <div className="bo-panel bo-foodDetailHero">
            <div className="bo-foodDetailMedia">
              {imageUrl ? (
                <img src={imageUrl} alt={`Imagen de ${title}`} loading="lazy" decoding="async" />
              ) : (
                <div className="bo-foodDetailMediaPlaceholder" aria-hidden="true">
                  <TypeIcon size={42} />
                </div>
              )}
            </div>

            <div className="bo-foodDetailHeroBody">
              <div className="bo-foodDetailHeroIdentity">
                <div className="bo-foodDetailEyebrow">
                  {FOOD_TYPE_LABELS[foodType]} · #{item.num}
                </div>
                <div className="bo-foodDetailTitleRow">
                  <TypeIcon className="bo-foodDetailTypeIcon" size={18} aria-hidden="true" />
                  <div className="bo-panelTitle bo-foodDetailTitle">{title}</div>
                </div>
                <div className="bo-foodDetailBadgeRow">
                  {heroBadges.map((badge) => (
                    <span key={badge.id} className={`bo-badge ${badge.className}`}>
                      {badge.label}
                    </span>
                  ))}
                </div>
              </div>
              {!isPlate ? (
                <div className="bo-foodDetailPriceWrap">
                  <span className="bo-foodDetailPriceLabel">Precio carta</span>
                  <div className="bo-foodDetailPrice">{formatEuro(item.precio)}</div>
                </div>
              ) : null}
              {isPlate ? (
                <div className="bo-foodDetailHeroSections">
                  <div className="bo-foodDetailHeroSection">
                    <div className="bo-panelTitle">Datos clave</div>
                    <div className="bo-panelMeta">Valores principales del elemento seleccionado.</div>
                    <div className="bo-foodDetailFactsGrid">
                      {detailKeyFacts.map((fact) => (
                        <div key={fact.id} className="bo-kv bo-foodDetailFact">
                          <div className="bo-kvLabel">{fact.label}</div>
                          <div className="bo-kvValue bo-kvValue--wrap">{fact.value}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          {!isPlate ? (
            <div className="bo-foodDetailBodyGrid">
              <div className="bo-panel bo-foodDetailPanel bo-foodDetailPanel--facts">
                <div className="bo-panelHead">
                  <div className="bo-panelTitle">Datos clave</div>
                  <div className="bo-panelMeta">Valores principales del elemento seleccionado.</div>
                </div>
                <div className="bo-panelBody">
                  <div className="bo-foodDetailFactsGrid">
                    {detailKeyFacts.map((fact) => (
                      <div key={fact.id} className="bo-kv bo-foodDetailFact">
                        <div className="bo-kvLabel">{fact.label}</div>
                        <div className="bo-kvValue bo-kvValue--wrap">{fact.value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="bo-panel bo-foodDetailPanel bo-foodDetailPanel--description">
                <div className="bo-panelHead">
                  <div className="bo-panelTitle">Descripcion</div>
                  <div className="bo-panelMeta">Texto que aparece en la carta publica.</div>
                </div>
                <div className="bo-panelBody">
                  <p className={`bo-foodDetailDescription${hasDescription ? "" : " is-empty"}`}>
                    {hasDescription ? descriptionValue : descriptionFallback}
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          {isPlate && currentPlate ? (
            <div className="bo-panel bo-foodDetailPanel bo-foodDetailQuickEditor">
              <div className="bo-panelHead bo-foodDetailQuickHead">
                <div>
                  <div className="bo-panelTitle">Edicion rapida</div>
                  <div className="bo-panelMeta">Atajos para ajustar este plato sin volver al listado.</div>
                </div>
                <span className={`bo-badge bo-badge--sm ${quickDirty ? "bo-badge--warning" : "bo-badge--muted"}`}>
                  {quickDirty ? "Cambios sin guardar" : "Sin cambios"}
                </span>
              </div>
              <div className="bo-panelBody">
                <div className="bo-foodDetailQuickGrid">
                  <label className="bo-field">
                    <span className="bo-label">Nombre</span>
                    <input
                      type="text"
                      className="bo-input"
                      value={quickName}
                      onChange={(event) => setQuickName(event.target.value)}
                      disabled={savingQuick}
                    />
                  </label>
                  <label className="bo-field">
                    <span className="bo-label">Tipo</span>
                    <Select
                      value={quickTipo}
                      onChange={setQuickTipo}
                      options={quickTipoOptions}
                      className="bo-foodDetailSelect"
                      ariaLabel="Tipo del plato"
                      disabled={savingQuick}
                    />
                  </label>
                  <label className="bo-field">
                    <span className="bo-label">Precio</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className="bo-input"
                      value={quickPrecio}
                      onChange={(event) => setQuickPrecio(event.target.value)}
                      disabled={savingQuick}
                    />
                  </label>
                  <label className="bo-field">
                    <span className="bo-label">Categoria</span>
                    <Select
                      value={quickCategoria}
                      onChange={setQuickCategoria}
                      options={quickCategorySelectOptions}
                      className="bo-foodDetailSelect"
                      ariaLabel="Categoria del plato"
                      disabled={savingQuick || categoriesLoading}
                    />
                  </label>
                  <div className={`bo-foodDetailQuickStatus bo-foodDetailQuickSupplement${quickHasSuplemento ? " is-active" : ""}`}>
                    <div className="bo-foodDetailQuickStatusRow">
                      <span className="bo-label">Tiene suplemento</span>
                      <Switch
                        checked={quickHasSuplemento}
                        onCheckedChange={setQuickHasSuplemento}
                        disabled={savingQuick}
                        aria-label="Activar suplemento"
                      />
                    </div>
                    {quickHasSuplemento ? (
                      <label className="bo-field bo-foodDetailQuickSupplementField">
                        <span className="bo-label">Importe suplemento</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          className="bo-input"
                          value={quickSuplemento}
                          onChange={(event) => setQuickSuplemento(event.target.value)}
                          disabled={savingQuick}
                        />
                      </label>
                    ) : null}
                  </div>
                  <div className="bo-foodDetailQuickStatus">
                    <span className="bo-label">Visible en carta</span>
                    <Switch checked={quickActive} onCheckedChange={setQuickActive} disabled={savingQuick} aria-label="Cambiar visibilidad del plato" />
                  </div>
                  <label className="bo-field bo-foodDetailQuickDescription">
                    <span className="bo-label">Descripcion</span>
                    <textarea
                      className="bo-textarea"
                      rows={4}
                      value={quickDescripcion}
                      onChange={(event) => setQuickDescripcion(event.target.value)}
                      disabled={savingQuick}
                    />
                  </label>
                </div>
              </div>
              <div className="bo-foodDetailEditorActions">
                <button
                  className="bo-btn bo-btn--primary"
                  type="button"
                  onClick={onQuickSave}
                  disabled={!quickCanSave}
                  aria-label="Guardar cambios"
                  title="Guardar cambios"
                >
                  {savingQuick ? <Loader2 size={14} className="bo-foodDetailSpinIcon" /> : <Save size={14} />}
                </button>
              </div>
            </div>
          ) : null}

          {!isWine ? (
            <div className="bo-panel bo-foodDetailPanel bo-foodDetailPanel--allergens">
              <div className="bo-panelHead bo-foodDetailAllergenHead">
                <div>
                  <div className="bo-panelTitle">Alergenos</div>
                  <div className="bo-panelMeta">Etiquetas usadas para informacion alergena del plato.</div>
                </div>
                {isPlate ? (
                  <button className="bo-btn bo-btn--ghost bo-btn--sm" type="button" onClick={openAllergenModal}>
                    Editar alergenos
                  </button>
                ) : null}
              </div>
              <div className="bo-panelBody">
                {allergenList.length > 0 ? (
                  <div className="bo-tagsList bo-foodDetailTags">
                    {allergenList.map((alergeno) => (
                      <span key={alergeno} className="bo-tagItem bo-foodDetailTag">
                        {alergeno}
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="bo-foodDetailEmptyNote">No hay alergenos declarados para este elemento.</div>
                )}
              </div>
            </div>
          ) : null}

          {isPlate ? (
            <Modal open={allergenModalOpen} title="Alergenos" onClose={() => setAllergenModalOpen(false)} widthPx={620}>
              <div className="bo-modalHead">
                <div className="bo-modalTitle">Selecciona alergenos</div>
                <button className="bo-modalX" type="button" onClick={() => setAllergenModalOpen(false)} aria-label="Cerrar">
                  ×
                </button>
              </div>
              <div className="bo-modalBody">
                <div className="bo-allergenGrid">
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
                      >
                        <span className="bo-allergenCircleIcon"><Icon size={16} /></span>
                        <span className="bo-allergenCircleLabel">{item.key}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="bo-modalActions">
                {savingAllergens ? (
                  <span className="bo-panelMeta">Guardando cambios...</span>
                ) : (
                  <span className="bo-panelMeta">Cambios guardados automaticamente.</span>
                )}
                <button className="bo-btn bo-btn--ghost" type="button" onClick={() => setAllergenModalOpen(false)} disabled={savingAllergens}>
                  Cancelar
                </button>
              </div>
            </Modal>
          ) : null}
        </>
      )}
    </section>
  );
}
