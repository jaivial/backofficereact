import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bean, CircleDot, Egg, Fish, FlaskConical, ImagePlus, LeafyGreen, Milk, Nut, Plus, Shell, Shrimp, Sprout, Upload, X } from "lucide-react";

import { createClient } from "../../../../api/client";
import type { FoodItem } from "../../../../api/types";
import { useToasts } from "../../../../ui/feedback/useToasts";
import { Modal } from "../../../../ui/overlays/Modal";
import { compressImageToWebP, formatFileSize, isValidImageFile } from "../../../../lib/imageCompressor";
import { ModalHeader } from "../../../../ui/overlays/ModalHeader";
import { FOOD_TYPE_TIPO_OPTIONS, type FoodType } from "./foodTypes";
import { Select } from "../../../../ui/inputs/Select";
import { Switch } from "../../../../ui/shadcn/Switch";
import { BeverageCategoryModal } from "./BeverageCategoryModal";
import { type ProductionType } from "./TechnicalSheet/ProductionTypeToggle";
import { ProductionTypeSection } from "./TechnicalSheet/ProductionTypeSection";
import { AllergenSelectGrid } from "../../../../ui/widgets/allergens/AllergenSelectGrid";
import { sheetsApi, type SheetSummary } from "./TechnicalSheet/sheetsApi";
import { normalizeAllergen } from "../../../../ui/widgets/allergens/allergens";

interface FoodItemModalProps {
  open: boolean;
  item: FoodItem | null;
  foodType: Exclude<FoodType, "vinos">;
  categoryOptions?: Array<{ value: string; label: string }>;
  onRequestCreateCategory?: () => void;
  onClose: () => void;
  onSave: (item: FoodItem) => void;
}

// Values stay the lowercase slugs already persisted for comida items; only the
// presentation is shared with the technical sheet.
const ALERGEN_OPTIONS = [
  { value: "gluten", label: "Gluten", icon: <Bean size={16} /> },
  { value: "crustaceos", label: "Crustaceos", icon: <Shrimp size={16} /> },
  { value: "huevos", label: "Huevos", icon: <Egg size={16} /> },
  { value: "pescado", label: "Pescado", icon: <Fish size={16} /> },
  { value: "cacahuetes", label: "Cacahuetes", icon: <Nut size={16} /> },
  { value: "soja", label: "Soja", icon: <Bean size={16} /> },
  { value: "lacteos", label: "Lacteos", icon: <Milk size={16} /> },
  { value: "frutos_secos", label: "Frutos secos", icon: <Nut size={16} /> },
  { value: "apio", label: "Apio", icon: <LeafyGreen size={16} /> },
  { value: "mostaza", label: "Mostaza", icon: <Sprout size={16} /> },
  { value: "sesamo", label: "Sesamo", icon: <CircleDot size={16} /> },
  { value: "sulfitos", label: "Sulfitos", icon: <FlaskConical size={16} /> },
  { value: "altramuces", label: "Altramuces", icon: <Bean size={16} /> },
  { value: "moluscos", label: "Moluscos", icon: <Shell size={16} /> },
];

/**
 * Maps canonical allergen names ("Leche", "Frutos de cascara") onto the
 * lowercase slugs comida items persist ("lacteos", "frutos_secos"). Anything
 * unrecognised is dropped rather than stored: an unknown string must never be
 * saved as if it were a declared allergen.
 */
function toComidaAllergenSlugs(keys: readonly string[]): string[] {
  const bySlug = new Map(
    ALERGEN_OPTIONS.map((option) => [normalizeAllergen(option.value) ?? option.value, option.value]),
  );
  const seen = new Set<string>();
  for (const key of keys) {
    const slug = bySlug.get(normalizeAllergen(key) ?? key);
    if (slug) seen.add(slug);
  }
  return [...seen];
}

const TIPO_OPTIONS = FOOD_TYPE_TIPO_OPTIONS;

const BEBIDA_DEFAULT_CATEGORY_NAMES = [
  "Refrescos",
  "Aguas",
  "Zumos",
  "Cervezas",
  "Copas",
  "Licores",
  "Cocktails",
];

const AI_ADVISOR_FOOD_TYPES = new Set<FoodType>(["bebidas", "cafes"]);

export const FoodItemModal = React.memo(function FoodItemModal({
  open,
  item,
  foodType,
  categoryOptions = [],
  onRequestCreateCategory,
  onClose,
  onSave,
}: FoodItemModalProps) {
  const api = useMemo(() => createClient({ baseUrl: "" }), []);
  const { pushToast } = useToasts();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [nombre, setNombre] = useState("");
  const [tipo, setTipo] = useState("");
  const [precio, setPrecio] = useState("");
  const [suplemento, setSuplemento] = useState("");
  const [hasSuplemento, setHasSuplemento] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [categoria, setCategoria] = useState("");
  const [alergenos, setAlergenos] = useState<string[]>([]);
  // Slugs the linked technical sheet declares. Kept separate from `alergenos`
  // because the sheet owns them: they are badged, not editable here, and are
  // released when the product stops being Preparado.
  const [sheetAlergenos, setSheetAlergenos] = useState<string[]>([]);
  // Mirrors sheetAlergenos for the setAlergenos updater: reading state there
  // would need it as a dependency, which would change the callback identity and
  // retrigger the editor's notification effect.
  const sheetAlergenosRef = useRef<string[]>([]);
  const [active, setActive] = useState(true);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const [bebidaCategories, setBebidaCategories] = useState<Array<{ value: string; label: string }>>([]);
  const [platoCategories, setPlatoCategories] = useState<Array<{ value: string; label: string }>>([]);
  const [bebidaCatModalOpen, setBebidaCatModalOpen] = useState(false);
  // Technical sheet state. A dish only has a sheet once it exists, so all of
  // this hangs off the saved item rather than the in-progress form.
  const [productionType, setProductionType] = useState<ProductionType>("RAW");
  const [stockRecipeId, setStockRecipeId] = useState<number | null>(null);
  const [sheetPickerOpen, setSheetPickerOpen] = useState(false);
  const [sheetEditorOpen, setSheetEditorOpen] = useState(false);
  const [showAIAdvisor, setShowAIAdvisor] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [pendingAIEnhance, setPendingAIEnhance] = useState(false);
  const [aiConfigValid, setAIConfigValid] = useState(false);

  const isPostre = foodType === "postres";
  const isPlato = foodType === "platos";
  const supportsAlergenos = foodType === "platos" || foodType === "postres";
  const supportsCategoria = foodType === "platos" || foodType === "bebidas";
  const supportsSuplemento = foodType === "platos";
  const isBebida = foodType === "bebidas";
  const showAdvisorForType = AI_ADVISOR_FOOD_TYPES.has(foodType);

  useEffect(() => {
    if (!api.comida.aiImageStatus) return;
    let active = true;
    void api.comida.aiImageStatus()
      .then((res) => { if (active) setAIConfigValid(!!(res.success && res.valid)); })
      .catch(() => { if (active) setAIConfigValid(false); });
    return () => { active = false; };
  }, [api.comida]);

  useEffect(() => {
    if (item) {
      setNombre(item.nombre || "");
      setTipo(item.tipo || TIPO_OPTIONS[foodType]?.[0]?.value || "");
      setPrecio(item.precio?.toString() || "");
      setSuplemento(item.suplemento?.toString() || "");
      setHasSuplemento(Number(item.suplemento || 0) > 0);
      setTitulo(item.titulo || "");
      setDescripcion(item.descripcion || item.nombre || "");
      setCategoria(item.category_id ? String(item.category_id) : (item.categoria || ""));
      setAlergenos(item.alergenos || []);
      setActive(item.active ?? true);
      setImageBase64(null);
      setImagePreview(item.foto_url || null);
      // Hydrate from what the server actually stored, so reopening the modal
      // never silently downgrades an elaborated dish back to "bought".
      // Seeded per open; the toggle then owns the value for this session so a
      // save is not reverted by the stale item the list still holds.
      setProductionType(item.production_type === "MANUFACTURED" ? "MANUFACTURED" : "RAW");
      setStockRecipeId(item.stock_recipe_id ?? null);
      setSheetPickerOpen(false);
      setSheetEditorOpen(false);
      return;
    }
    setNombre("");
    setTipo(TIPO_OPTIONS[foodType]?.[0]?.value || "");
    setPrecio(isPlato ? "0.00" : "");
    setSuplemento("");
    setHasSuplemento(false);
    setTitulo("");
    setDescripcion("");
    setCategoria("");
    setAlergenos([]);
    setActive(!isPlato);
    setImageBase64(null);
    setImagePreview(null);
    setProductionType("RAW");
    setStockRecipeId(null);
    setSheetPickerOpen(false);
    setSheetEditorOpen(false);
    setShowAIAdvisor(false);
    setAiBusy(false);
    setPendingAIEnhance(false);
  }, [item, foodType, open]);

  useEffect(() => {
    if (!open || !isBebida) return;
    let cancelled = false;
    api.comida.bebidas.categories
      .list()
      .then((res) => {
        if (cancelled || !res.success) return;
        const cats = Array.isArray(res.categories)
          ? res.categories.map((c: any) => ({ value: String(c.id), label: c.name }))
          : [];
        setBebidaCategories(cats);
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [api.comida.bebidas.categories, isBebida, open]);

  useEffect(() => {
    if (!open || !isPlato) return;
    let cancelled = false;
    api.comida.platos.categories
      .list()
      .then((res) => {
        if (cancelled || !res.success) return;
        setPlatoCategories((res.categories || []).map((c) => ({ value: String(c.id), label: c.name })));
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [api.comida.platos.categories, isPlato, open]);

  const effectiveCategoryOptions = useMemo(() => {
    if (!supportsCategoria) return [];
    if (isBebida) return bebidaCategories;
    if (isPlato) return platoCategories.length ? platoCategories : categoryOptions;
    return categoryOptions;
  }, [supportsCategoria, isBebida, isPlato, bebidaCategories, platoCategories, categoryOptions]);

  const handleImageSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!isValidImageFile(file)) {
      pushToast({ kind: "error", title: "Error", message: "Tipo de archivo no valido. Usa JPG, PNG, WebP o GIF." });
      return;
    }

    setUploading(true);
    try {
      const compressed = await compressImageToWebP(file, 100);
      setImageBase64(compressed);
      setImagePreview(compressed);
      const bytes = Math.ceil((compressed.split(",")[1]?.length || 0) * 0.75);
      pushToast({ kind: "success", title: "Imagen comprimida", message: `Tamano: ${formatFileSize(bytes)}` });
      if (showAdvisorForType && aiConfigValid) setShowAIAdvisor(true);
    } catch {
      pushToast({ kind: "error", title: "Error", message: "No se pudo procesar la imagen" });
    } finally {
      setUploading(false);
    }
  }, [aiConfigValid, pushToast, showAdvisorForType]);

  const handleRemoveImage = useCallback(() => {
    setImageBase64("");
    setImagePreview(null);
    setShowAIAdvisor(false);
  }, []);

  const handleAlergenoToggle = useCallback((value: string) => {
    setAlergenos((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]));
  }, []);

  const handleAIAdvisorClose = useCallback(() => {
    setShowAIAdvisor(false);
  }, []);

  const handleAIContinueWithout = useCallback(() => {
    setShowAIAdvisor(false);
  }, []);

  const saveItem = useCallback(async (): Promise<FoodItem | null> => {
    const nombreOrDesc = isPostre ? (descripcion.trim() || nombre.trim()) : nombre.trim();
    if (!nombreOrDesc) {
      pushToast({ kind: "error", title: "Error", message: isPostre ? "La descripcion es requerida" : "El nombre es requerido" });
      return null;
    }

    const precioNum = isPostre ? 0 : Number(precio);
    if (!isPostre && (!Number.isFinite(precioNum) || precioNum < 0)) {
      pushToast({ kind: "error", title: "Error", message: "Precio invalido" });
      return null;
    }
    const suplementoNum = supportsSuplemento && hasSuplemento ? Number(suplemento || 0) : 0;

    setSaving(true);
    try {
      if (isPostre) {
        const payload = {
          descripcion: nombreOrDesc,
          alergenos: alergenos,
          active,
          precio: Number.isFinite(Number(precio)) ? Number(precio) : undefined,
        };
        const res = item
          ? await api.comida.postres.patch(item.num, payload)
          : await api.comida.postres.create(payload);

        if (!res.success) {
          pushToast({ kind: "error", title: "Error", message: res.message || "No se pudo guardar" });
          return null;
        }

        const saved = ((res as any).item as FoodItem | undefined) ?? {
          num: item?.num || Number((res as any).num || 0),
          tipo: "POSTRE",
          nombre: nombreOrDesc,
          precio: 0,
          descripcion: nombreOrDesc,
          titulo: "",
          suplemento: 0,
          alergenos: alergenos,
          active,
          has_foto: false,
        };
        pushToast({ kind: "success", title: item ? "Actualizado" : "Creado" });
        return saved;
      }

      const payload: Record<string, any> = {
        nombre: nombreOrDesc,
        tipo: tipo || undefined,
        precio: precioNum,
        descripcion: descripcion.trim() || undefined,
        titulo: titulo.trim() || undefined,
        suplemento: supportsSuplemento ? suplementoNum : undefined,
        alergenos: alergenos.length > 0 ? alergenos : undefined,
        active,
        imageBase64: imageBase64 || undefined,
        ai_generating: pendingAIEnhance || undefined,
      };

      if (supportsCategoria) {
        const catValue = categoria.trim();
        if (catValue !== "") {
          const maybeId = Number(catValue);
          if (Number.isFinite(maybeId) && maybeId > 0) payload.category_id = maybeId;
          else payload.categoria = catValue;
        }
      }

      const targetApi = foodType === "platos"
        ? api.comida.platos
        : foodType === "bebidas"
          ? api.comida.bebidas
          : api.comida.cafes;

      const res = item
        ? await targetApi.patch(item.num, payload as any)
        : await targetApi.create(payload as any);

      if (!res.success) {
        pushToast({ kind: "error", title: "Error", message: res.message || "No se pudo guardar" });
        return null;
      }

      const categoriaLabel = supportsCategoria
        ? (effectiveCategoryOptions.find((option) => option.value === categoria)?.label || categoria || undefined)
        : undefined;
      const saved = ((res as any).item as FoodItem | undefined) ?? {
        num: item?.num || Number((res as any).num || 0),
        nombre: nombreOrDesc,
        tipo: tipo || "",
        precio: precioNum,
        descripcion: descripcion.trim(),
        titulo: titulo.trim(),
        suplemento: suplementoNum,
        alergenos,
        active,
        has_foto: !!imageBase64 || !!imagePreview,
        foto_url: imagePreview || undefined,
        categoria: categoriaLabel,
      };
      pushToast({ kind: "success", title: item ? "Actualizado" : "Creado" });
      return saved;
    } catch {
      pushToast({ kind: "error", title: "Error", message: "Error de conexion" });
      return null;
    } finally {
      setSaving(false);
    }
  }, [
    active,
    alergenos,
    api.comida.bebidas,
    api.comida.cafes,
    api.comida.platos,
    api.comida.postres,
    categoria,
    effectiveCategoryOptions,
    descripcion,
    foodType,
    hasSuplemento,
    imageBase64,
    imagePreview,
    isPostre,
    item,
    nombre,
    pendingAIEnhance,
    precio,
    pushToast,
    suplemento,
    supportsCategoria,
    supportsSuplemento,
    tipo,
    titulo,
  ]);

  const runAIEnhance = useCallback(async (targetNum: number) => {
    setAiBusy(true);
    try {
      const targetApi = isBebida
        ? api.comida.bebidas
        : api.comida.cafes;
      const b64 = imageBase64?.split(",")[1];
      if (!b64) throw new Error("No image data");
      const byteChars = atob(b64);
      const byteArray = new Uint8Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) byteArray[i] = byteChars.charCodeAt(i);
      const blob = new Blob([byteArray], { type: "image/webp" });
      const file = new File([blob], "comida-ai.webp", { type: "image/webp" });
      const res = await targetApi.uploadImageAI(targetNum, file);
      if (res.success) {
        pushToast({ kind: "success", title: "IA aplicada", message: "Imagen mejorada con IA" });
      } else {
        pushToast({ kind: "error", title: "Error IA", message: res.message || "No se pudo aplicar IA" });
      }
    } catch {
      pushToast({ kind: "error", title: "Error IA", message: "Error al mejorar la imagen con IA" });
    } finally {
      setAiBusy(false);
    }
  }, [api.comida.bebidas, api.comida.cafes, imageBase64, isBebida, pushToast]);

  const handleAIEnhance = useCallback(() => {
    if (item) {
      setShowAIAdvisor(false);
      runAIEnhance(item.num);
    } else {
      setPendingAIEnhance(true);
      setShowAIAdvisor(false);
    }
  }, [item, runAIEnhance]);

  const handleBebidaCatAdd = useCallback(async (name: string) => {
    const res = await api.comida.bebidas.categories.create({ name });
    if (!res.success) throw new Error(res.message || "No se pudo crear la categoria");
    return { id: (res as any).category?.id ?? 0, name, slug: (res as any).category?.slug ?? "" };
  }, [api.comida.bebidas.categories]);

  const handleBebidaCatOptimistic = useCallback((category: { value: string; label: string }) => {
    setBebidaCategories((prev) => {
      if (prev.some((c) => c.value === category.value)) return prev;
      return [...prev, category];
    });
    setCategoria(category.value);
  }, []);

  const onSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    const saved = await saveItem();
    if (!saved) return;

    // A sheet built while creating the dish exists on its own until now; the
    // dish only gets an id here, so this is the first moment the two can be
    // attached. Without it the recipe the user just typed would be orphaned.
    if (productionType === "MANUFACTURED" && stockRecipeId != null && saved.num) {
      try {
        await sheetsApi.setProductionType(saved.num, "MANUFACTURED", stockRecipeId);
      } catch {
        // The dish itself saved; surfacing a second failure here would be
        // confusing, and the link can be set again from the detail page.
      }
    }

    onSave(saved);

    if (pendingAIEnhance) {
      setPendingAIEnhance(false);
      runAIEnhance(saved.num);
    }
  }, [onSave, pendingAIEnhance, productionType, runAIEnhance, saveItem, stockRecipeId]);

  // Reusing an existing sheet fills the product form from it. The sheet already
  // records the preparation's name, price, method and allergens, so retyping
  // them would invite the two records to disagree about the same dish.
  //
  // Empty sheet fields are skipped rather than written as blanks: a sheet with
  // no price is unknown, not free, and must not overwrite a price the user has
  // already typed.
  const fillFromSheet = useCallback(
    (sheet: SheetSummary) => {
      if (sheet.name) {
        if (isPostre) setDescripcion(sheet.name);
        else setNombre(sheet.name);
      }
      if (sheet.sellingPriceGross != null && sheet.sellingPriceGross > 0) {
        setPrecio(String(sheet.sellingPriceGross));
      }
      if (sheet.instructions && !isPostre) {
        setDescripcion(sheet.instructions);
      }
      if (sheet.allergens.length > 0) {
        const slugs = toComidaAllergenSlugs(sheet.allergens);
        if (slugs.length > 0) setAlergenos(slugs);
      }
    },
    [isPostre],
  );

  // A sheet's allergens are the dish's allergens - they are what reaches the
  // menu - so the product grid follows the sheet rather than holding a second
  // opinion that whichever save ran last would silently win.
  //
  // This replaces rather than merges: an allergen removed in the sheet has to
  // disappear here too, and merging would make removal impossible.
  const syncAllergensFromSheet = useCallback((effective: string[]) => {
    const slugs = toComidaAllergenSlugs(effective);
    setAlergenos((prev) => {
      // The sheet's previous contribution is withdrawn before the new one is
      // applied, so switching an allergen off in the ficha tecnica clears it
      // here too. Adding without removing left a stale entry that the user
      // could not delete, because the card is locked precisely on the grounds
      // that the sheet owns it.
      const withoutSheet = prev.filter((slug) => !sheetAlergenosRef.current.includes(slug));
      return [...new Set([...withoutSheet, ...slugs])];
    });
    sheetAlergenosRef.current = slugs;
    setSheetAlergenos(slugs);
  }, []);

  // "FT" (ficha tecnica) marks the corner; the tooltip spells it out, so the
  // reason does not depend on knowing the abbreviation.
  const sheetAllergenBadges = useMemo(
    () => Object.fromEntries(sheetAlergenos.map((slug) => [slug, "FT"])),
    [sheetAlergenos],
  );
  const sheetAllergenReasons = useMemo(
    () =>
      Object.fromEntries(
        sheetAlergenos.map((slug) => [
          slug,
          "Viene de la ficha tecnica. Se quita desde la ficha o cambiando a Materia prima.",
        ]),
      ),
    [sheetAlergenos],
  );

  const title = item ? "Editar elemento" : "Nuevo elemento";

  return (
    <>
      <Modal open={open} onClose={onClose} title={title} size="lg">
        <form data-role="food-modal-form" onSubmit={onSubmit}>
          <div data-ui="food-modal-grid" className="bo-foodModal-grid">
            <div data-slot="food-modal-fields" className="bo-foodModal-fields">
            <div data-slot="food-modal-image-section" className="bo-foodModal-imageSection">
              <div data-ui="food-modal-image-preview" className="bo-foodModal-imagePreview">
                {imagePreview ? (
                  <>
                    <img data-role="food-modal-preview-img" src={imagePreview} alt="Preview" />
                    <button
                      data-role="food-modal-remove-image"
                      type="button"
                      className="bo-foodModal-imageRemove"
                      onClick={handleRemoveImage}
                      aria-label="Eliminar imagen"
                    >
                      <X size={16} />
                    </button>
                  </>
                ) : (
                  <div data-ui="food-modal-image-placeholder" className="bo-foodModal-imagePlaceholder">
                    <ImagePlus size={32} />
                    <span data-role="food-modal-placeholder-text">Sin imagen</span>
                  </div>
                )}
              </div>

              <input
                data-role="food-modal-file-input"
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={handleImageSelect}
                className="bo-foodModal-fileInput"
              />
              <button
                data-role="food-modal-upload-btn"
                type="button"
                className="bo-btn bo-btn--secondary bo-btn--block"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? (
                  <>
                    <div data-ui="food-modal-upload-spinner" className="bo-spinner bo-spinner--sm" />
                    Procesando...
                  </>
                ) : (
                  <>
                    <Upload size={16} />
                    Subir imagen
                  </>
                )}
              </button>
              <p data-role="food-modal-image-hint" className="bo-foodModal-imageHint">Se comprimira a WebP (max 100KB)</p>
            </div>

              <div data-ui="food-modal-field-nombre" className="bo-field">
                <label data-role="food-modal-label-nombre" className="bo-label" htmlFor="nombre">
                  {isPostre ? "Descripcion *" : "Nombre *"}
                </label>
                <input
                  data-role="food-modal-input-nombre"
                  id="nombre"
                  type="text"
                  className="bo-input"
                  value={isPostre ? descripcion : nombre}
                  onChange={(e) => {
                    if (isPostre) setDescripcion(e.target.value);
                    else setNombre(e.target.value);
                  }}
                  placeholder={isPostre ? "Descripcion del postre" : "Nombre del elemento"}
                  required
                />
              </div>

              {!isPostre && !isPlato ? (
                <div data-ui="food-modal-field-titulo" className="bo-field">
                  <label data-role="food-modal-label-titulo" className="bo-label" htmlFor="titulo">
                    Titulo (opcional)
                  </label>
                  <input
                    data-role="food-modal-input-titulo"
                    id="titulo"
                    type="text"
                    className="bo-input"
                    value={titulo}
                    onChange={(e) => setTitulo(e.target.value)}
                    placeholder="Texto secundario para card"
                  />
                </div>
              ) : null}

              <div data-ui="food-modal-field-row" className="bo-fieldRow">
                {isPlato ? (
                  <div data-ui="food-modal-field-tipo" className="bo-field">
                    <label data-role="food-modal-label-tipo" className="bo-label">Tipo</label>
                    <Select value={tipo} onChange={setTipo} options={TIPO_OPTIONS.platos} ariaLabel="Tipo del plato" />
                  </div>
                ) : null}

                {supportsCategoria && !isBebida ? (
                  <div data-ui="food-modal-field-categoria" className="bo-field">
                    <div data-ui="food-modal-category-head" className="bo-foodModalCategoryHead flex items-center gap-2">
                      <label data-role="food-modal-label-categoria" className="bo-label m-0">
                        Categoria
                      </label>
                      {onRequestCreateCategory ? (
                        <button
                          data-role="food-modal-add-category-btn"
                          type="button"
                          className="bo-btn bo-btn--ghost bo-btn--sm"
                          onClick={onRequestCreateCategory}
                        >
                          <Plus size={14} />
                          Añadir categoria
                        </button>
                      ) : null}
                    </div>
                    <Select
                      value={categoria}
                      onChange={setCategoria}
                      options={[{ value: "", label: "Sin categoria" }, ...effectiveCategoryOptions]}
                      ariaLabel="Categoria"
                    />
                  </div>
                ) : null}

                {!isPostre ? (
                  <div data-ui="food-modal-field-precio" className="bo-field">
                    <label data-role="food-modal-label-precio" className="bo-label" htmlFor="precio">
                      Precio *
                    </label>
                    <input
                      data-role="food-modal-input-precio"
                      id="precio"
                      type="number"
                      step="0.01"
                      min="0"
                      className="bo-input"
                      value={precio}
                      onChange={(e) => setPrecio(e.target.value)}
                      placeholder="0.00"
                      required
                    />
                  </div>
                ) : null}

              </div>

              {isBebida && supportsCategoria ? (
                <div data-ui="food-modal-field-categoria" className="bo-field">
                  <label data-role="food-modal-label-categoria" className="bo-label">Categoria</label>
                  <Select
                    value={categoria}
                    onChange={setCategoria}
                    options={[{ value: "", label: "Sin categoria" }, ...effectiveCategoryOptions]}
                    ariaLabel="Categoria"
                  />
                  <button
                    data-role="food-modal-add-category-btn"
                    type="button"
                    className="bo-btn bo-btn--ghost bo-btn--sm mt-2 w-fit"
                    onClick={() => setBebidaCatModalOpen(true)}
                  >
                    <Plus size={14} />
                    Añadir categoria
                  </button>
                </div>
              ) : null}

              {supportsSuplemento ? (
                <div data-ui="food-modal-field-suplemento" className="bo-field bo-foodModalSupplementField">
                  <div data-ui="food-modal-supplement-head" className="bo-foodModalSupplementHead">
                    <span data-role="food-modal-label-suplemento" className="bo-label m-0">Tiene suplemento</span>
                    <Switch
                      checked={hasSuplemento}
                      onCheckedChange={setHasSuplemento}
                      aria-label="Activar suplemento"
                      data-role="food-modal-supplement-toggle"
                    />
                  </div>
                  {/* The amount belongs under the switch that reveals it, not
                      beside it: on a narrow modal the inline input pushed the
                      label and toggle out of alignment. */}
                  {hasSuplemento ? (
                    <div data-ui="food-modal-supplement-amount" className="bo-foodModalSupplementAmount">
                      <label data-role="food-modal-label-suplemento-precio" className="bo-label" htmlFor="suplemento">
                        Precio del suplemento
                      </label>
                      <input
                        data-role="food-modal-input-suplemento"
                        id="suplemento"
                        type="number"
                        step="0.01"
                        min="0"
                        className="bo-input"
                        value={suplemento}
                        onChange={(e) => setSuplemento(e.target.value)}
                        placeholder="0.00"
                      />
                    </div>
                  ) : null}
                </div>
              ) : null}

              {!isPostre ? (
                <div data-ui="food-modal-field-detalle" className="bo-field">
                  <label data-role="food-modal-label-detalle" className="bo-label" htmlFor="descripcion">
                    Detalle
                  </label>
                  <textarea
                    data-role="food-modal-textarea-detalle"
                    id="descripcion"
                    className="bo-textarea"
                    value={descripcion}
                    onChange={(e) => setDescripcion(e.target.value)}
                    placeholder="Descripcion del elemento..."
                    rows={3}
                  />
                </div>
              ) : null}

              {supportsAlergenos ? (
                <div data-ui="food-modal-field-alergenos" className="bo-field">
                  <label data-role="food-modal-label-alergenos" className="bo-label">Alergenos</label>
                  {/* Shared with the technical sheet, so both grids stay identical. */}
                  <AllergenSelectGrid
                    data-slot="food-modal-alergenos-list"
                    options={ALERGEN_OPTIONS}
                    selected={alergenos}
                    locked={sheetAlergenos}
                    badges={sheetAllergenBadges}
                    lockedReasons={sheetAllergenReasons}
                    onToggle={(value) => handleAlergenoToggle(value)}
                    itemDataRole="food-modal-alergeno-option"
                  />
                </div>
              ) : null}

              <ProductionTypeSection
                itemId={item ? item.num : null}
                productionType={productionType}
                stockRecipeId={stockRecipeId}
                productName={titulo || nombre}
                onChange={(next) => {
                  setProductionType(next);
                  if (next === "RAW") {
                    setStockRecipeId(null);
                    // No sheet means no sheet-owned allergens. They are dropped
                    // rather than left behind as undeletable leftovers.
                    setAlergenos((prev) => prev.filter((slug) => !sheetAlergenos.includes(slug)));
                    sheetAlergenosRef.current = [];
                    setSheetAlergenos([]);
                  }
                }}
                onSheetLinked={(sheetId) => {
                  setStockRecipeId(sheetId);
                  setProductionType("MANUFACTURED");
                }}
                onSheetPicked={fillFromSheet}
                onSheetAllergensChange={syncAllergensFromSheet}
              />

              <div data-ui="food-modal-field-active" className="bo-field">
                <div data-ui="food-modal-visibility-row" className="bo-foodModalCategoryHead flex items-center gap-2">
                  <span data-role="food-modal-label-active" className="bo-label m-0">Visible en carta</span>
                  <Switch
                    checked={active}
                    onCheckedChange={setActive}
                    aria-label="Cambiar visibilidad del elemento"
                    data-role="food-modal-visibility-switch"
                  />
                </div>
              </div>
            </div>
          </div>

          <div data-slot="food-modal-actions" className="bo-foodModal-actions">
            <button data-role="food-modal-cancel-btn" type="button" className="bo-btn bo-btn--ghost" onClick={onClose} disabled={saving}>
              Cancelar
            </button>
            <button data-role="food-modal-submit-btn" type="submit" className="bo-btn bo-btn--primary mx-0" disabled={saving}>
              {saving ? (
                <>
                  <div data-ui="food-modal-submit-spinner" className="bo-spinner bo-spinner--sm" />
                  Guardando...
                </>
              ) : (
                "Guardar"
              )}
            </button>
          </div>
        </form>
      </Modal>



      {isBebida ? (
        <BeverageCategoryModal
          open={bebidaCatModalOpen}
          defaultCategoryNames={BEBIDA_DEFAULT_CATEGORY_NAMES}
          onClose={() => setBebidaCatModalOpen(false)}
          onAddCategory={handleBebidaCatAdd}
          onOptimisticAdd={handleBebidaCatOptimistic}
        />
      ) : null}

      <Modal open={showAIAdvisor && !!imagePreview} title="Asesor IA de imagen" onClose={aiBusy ? () => undefined : () => handleAIAdvisorClose()} widthPx={620} hideClose>
        <ModalHeader title="Asesor IA de imagen" onClose={aiBusy ? () => undefined : () => handleAIAdvisorClose()} />
        <div className="bo-modalBody bo-dishAIAdvisorBody" data-slot="food-modal-ai-advisor-body">
          <div className="bo-dishAIAdvisorCopy" data-slot="food-modal-ai-advisor-copy">
            <p className="bo-dishAIAdvisorLead" data-slot="food-modal-ai-advisor-lead">
              Mejorar esta foto con IA puede elevar la presentacion y hacer la carta mas atractiva para el cliente.
            </p>
            <p className="bo-dishAIAdvisorHint" data-slot="food-modal-ai-advisor-hint">
              Imagen optimizada para subir · WebP.
            </p>
          </div>
          <div className="bo-dishAIAdvisorPreviewWrap" data-slot="food-modal-ai-advisor-preview">
            <img className="bo-dishAIAdvisorPreview" src={imagePreview || ""} alt="Previsualizacion de imagen optimizada" />
          </div>
        </div>
        <div className="bo-modalActions bo-dishAIAdvisorActions" data-slot="food-modal-ai-advisor-actions">
          <button
            className="bo-btn bo-btn--advisorSecondary"
            type="button"
            onClick={handleAIContinueWithout}
            disabled={aiBusy}
            data-role="food-modal-ai-advisor-without-btn"
          >
            Continuar sin mejorar
          </button>
          <button
            className="bo-btn bo-btn--advisorPrimary"
            type="button"
            onClick={handleAIEnhance}
            disabled={aiBusy || saving}
            aria-label={aiBusy ? "Mejorando con IA" : "Mejorar con IA"}
            data-role="food-modal-ai-advisor-enhance-btn"
          >
            {aiBusy ? (
              <>
                <div className="animate-spin h-3.5 w-3.5 border-2 border-white/30 border-t-white rounded-full" data-slot="ai-spinner" />
                Mejorando con IA...
              </>
            ) : (
              "Mejorar con IA"
            )}
          </button>
        </div>
      </Modal>
    </>
  );
});
