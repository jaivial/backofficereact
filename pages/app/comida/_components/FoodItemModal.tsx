import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ImagePlus, Plus, Upload, X } from "lucide-react";

import { createClient } from "../../../../api/client";
import type { FoodItem } from "../../../../api/types";
import { useToasts } from "../../../../ui/feedback/useToasts";
import { Modal } from "../../../../ui/overlays/Modal";
import { compressImageToWebP, formatFileSize, isValidImageFile } from "../../../../lib/imageCompressor";
import { FOOD_TYPE_TIPO_OPTIONS, type FoodType } from "./foodTypes";
import { Select } from "../../../../ui/inputs/Select";
import { BeverageCategoryModal } from "./BeverageCategoryModal";

interface FoodItemModalProps {
  open: boolean;
  item: FoodItem | null;
  foodType: Exclude<FoodType, "vinos">;
  categoryOptions?: Array<{ value: string; label: string }>;
  onRequestCreateCategory?: () => void;
  onClose: () => void;
  onSave: (item: FoodItem) => void;
}

const ALERGEN_OPTIONS = [
  { value: "gluten", label: "Gluten" },
  { value: "crustaceos", label: "Crustaceos" },
  { value: "huevos", label: "Huevos" },
  { value: "pescado", label: "Pescado" },
  { value: "cacahuetes", label: "Cacahuetes" },
  { value: "soja", label: "Soja" },
  { value: "lacteos", label: "Lacteos" },
  { value: "frutos_secos", label: "Frutos secos" },
  { value: "apio", label: "Apio" },
  { value: "mostaza", label: "Mostaza" },
  { value: "sesamo", label: "Sesamo" },
  { value: "sulfitos", label: "Sulfitos" },
  { value: "altramuces", label: "Altramuces" },
  { value: "moluscos", label: "Moluscos" },
];

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
  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [categoria, setCategoria] = useState("");
  const [alergenos, setAlergenos] = useState<string[]>([]);
  const [active, setActive] = useState(true);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const [bebidaCategories, setBebidaCategories] = useState<Array<{ value: string; label: string }>>([]);
  const [bebidaCatModalOpen, setBebidaCatModalOpen] = useState(false);
  const [showAIAdvisor, setShowAIAdvisor] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [pendingAIEnhance, setPendingAIEnhance] = useState(false);

  const isPostre = foodType === "postres";
  const supportsAlergenos = foodType === "platos" || foodType === "postres";
  const supportsCategoria = foodType === "platos" || foodType === "bebidas";
  const supportsSuplemento = foodType === "platos";
  const isBebida = foodType === "bebidas";
  const showAdvisorForType = AI_ADVISOR_FOOD_TYPES.has(foodType);

  useEffect(() => {
    if (item) {
      setNombre(item.nombre || "");
      setTipo(item.tipo || TIPO_OPTIONS[foodType]?.[0]?.value || "");
      setPrecio(item.precio?.toString() || "");
      setSuplemento(item.suplemento?.toString() || "");
      setTitulo(item.titulo || "");
      setDescripcion(item.descripcion || item.nombre || "");
      setCategoria(item.category_id ? String(item.category_id) : (item.categoria || ""));
      setAlergenos(item.alergenos || []);
      setActive(item.active ?? true);
      setImageBase64(null);
      setImagePreview(item.foto_url || null);
      return;
    }
    setNombre("");
    setTipo(TIPO_OPTIONS[foodType]?.[0]?.value || "");
    setPrecio("");
    setSuplemento("");
    setTitulo("");
    setDescripcion("");
    setCategoria("");
    setAlergenos([]);
    setActive(true);
    setImageBase64(null);
    setImagePreview(null);
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

  const effectiveCategoryOptions = useMemo(() => {
    if (!supportsCategoria) return [];
    if (isBebida) return bebidaCategories;
    return categoryOptions;
  }, [supportsCategoria, isBebida, bebidaCategories, categoryOptions]);

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
      if (showAdvisorForType) setShowAIAdvisor(true);
    } catch {
      pushToast({ kind: "error", title: "Error", message: "No se pudo procesar la imagen" });
    } finally {
      setUploading(false);
    }
  }, [pushToast, showAdvisorForType]);

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
    const suplementoNum = supportsSuplemento ? Number(suplemento || 0) : 0;

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
    onSave(saved);

    if (pendingAIEnhance) {
      setPendingAIEnhance(false);
      runAIEnhance(saved.num);
    }
  }, [onSave, pendingAIEnhance, runAIEnhance, saveItem]);

  const title = item ? "Editar elemento" : "Nuevo elemento";

  return (
    <>
      <Modal open={open} onClose={onClose} title={title} size="lg">
        <form data-role="food-modal-form" onSubmit={onSubmit}>
          <div data-ui="food-modal-grid" className="bo-foodModal-grid">
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

            <div data-slot="food-modal-fields" className="bo-foodModal-fields">
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

              {!isPostre ? (
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
                {supportsCategoria ? (
                  <div data-ui="food-modal-field-categoria" className="bo-field">
                    <div data-ui="food-modal-category-head" className="bo-foodModalCategoryHead flex items-center gap-2 mb-2">
                      <label data-role="food-modal-label-categoria" className="bo-label m-0">
                        Categoria
                      </label>
                      {isBebida ? (
                        <button
                          data-role="food-modal-add-category-btn"
                          type="button"
                          className="bo-btn bo-btn--ghost bo-btn--sm"
                          onClick={() => setBebidaCatModalOpen(true)}
                        >
                          <Plus size={14} />
                          Añadir categoria
                        </button>
                      ) : onRequestCreateCategory ? (
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

                {supportsSuplemento ? (
                  <div data-ui="food-modal-field-suplemento" className="bo-field">
                    <label data-role="food-modal-label-suplemento" className="bo-label" htmlFor="suplemento">
                      Suplemento
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
                  <div data-slot="food-modal-alergenos-list" className="bo-foodModal-alergenos">
                    {ALERGEN_OPTIONS.map((opt) => (
                      <label data-role="food-modal-alergeno-label" key={opt.value} className="bo-checkboxLabel">
                        <input
                          data-role="food-modal-alergeno-checkbox"
                          type="checkbox"
                          checked={alergenos.includes(opt.value)}
                          onChange={() => handleAlergenoToggle(opt.value)}
                        />
                        <span data-role="food-modal-alergeno-text">{opt.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ) : null}

              <div data-ui="food-modal-field-active" className="bo-field">
                <label data-role="food-modal-label-active" className="bo-checkboxLabel">
                  <input
                    data-role="food-modal-checkbox-active"
                    type="checkbox"
                    checked={active}
                    onChange={(e) => setActive(e.target.checked)}
                  />
                  <span data-role="food-modal-active-text">Activo</span>
                </label>
              </div>
            </div>
          </div>

          <div data-slot="food-modal-actions" className="bo-foodModal-actions">
            <button data-role="food-modal-cancel-btn" type="button" className="bo-btn bo-btn--ghost" onClick={onClose} disabled={saving}>
              Cancelar
            </button>
            <button data-role="food-modal-submit-btn" type="submit" className="bo-btn bo-btn--primary" disabled={saving}>
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

      {showAIAdvisor && imagePreview ? (
        <div
          data-role="food-modal-ai-advisor-overlay"
          className="fixed inset-0 z-[210] flex items-center justify-center bg-black/60"
          onClick={(e) => { if (e.target === e.currentTarget) handleAIAdvisorClose(); }}
        >
          <div
            data-ui="food-modal-ai-advisor-content"
            className="bg-[var(--bo-surface)] rounded-2xl border border-[var(--bo-border)] shadow-xl max-w-md w-full mx-4 overflow-hidden"
          >
            <div data-slot="food-modal-ai-advisor-header" className="flex items-center justify-between p-4 border-b border-[var(--bo-border)]">
              <span data-role="food-modal-ai-advisor-title" className="text-sm font-semibold text-[var(--bo-text)]">
                Asesor IA de imagen
              </span>
              <button
                type="button"
                onClick={handleAIAdvisorClose}
                data-role="food-modal-ai-advisor-close"
                className="p-1 rounded-lg hover:bg-[var(--bo-surface-2)] transition-colors duration-150"
                disabled={aiBusy}
              >
                <X size={16} className="text-[var(--bo-muted)]" data-role="food-modal-ai-advisor-close-icon" />
              </button>
            </div>

            <div data-slot="food-modal-ai-advisor-preview" className="p-4">
              <img
                src={imagePreview}
                alt="Vista previa"
                data-role="food-modal-ai-advisor-preview-img"
                className="w-full aspect-square object-cover rounded-xl"
              />
            </div>

            <div data-slot="food-modal-ai-advisor-actions" className="flex gap-3 p-4 border-t border-[var(--bo-border)]">
              <button
                type="button"
                onClick={handleAIContinueWithout}
                disabled={aiBusy}
                data-role="food-modal-ai-advisor-without-btn"
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
                disabled={aiBusy || saving}
                title={saving ? "Guardando elemento..." : undefined}
                data-role="food-modal-ai-advisor-enhance-btn"
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium
                  bg-purple-950/40 border-white/20 border-solid !border-[0.5px] hover:bg-purple-500/20 hover:cursor-pointer text-white
                  hover:opacity-90 transition-opacity duration-150
                  disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {aiBusy ? (
                  <div className="animate-spin h-3.5 w-3.5 border-2 border-white/30 border-t-white rounded-full" data-slot="ai-spinner" />
                ) : (
                  "Mejorar con IA"
                )}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
});
