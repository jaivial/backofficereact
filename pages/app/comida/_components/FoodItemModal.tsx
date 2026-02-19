import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ImagePlus, Plus, Upload, X } from "lucide-react";

import { createClient } from "../../../../api/client";
import type { FoodItem } from "../../../../api/types";
import { useToasts } from "../../../../ui/feedback/useToasts";
import { Modal } from "../../../../ui/overlays/Modal";
import { compressImageToWebP, formatFileSize, isValidImageFile } from "../../../../lib/imageCompressor";
import { FOOD_TYPE_TIPO_OPTIONS, type FoodType } from "./foodTypes";

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

  const isPostre = foodType === "postres";
  const supportsAlergenos = foodType === "platos" || foodType === "postres";
  const supportsCategoria = foodType === "platos";
  const supportsSuplemento = foodType === "platos";

  useEffect(() => {
    if (item) {
      setNombre(item.nombre || "");
      setTipo(item.tipo || TIPO_OPTIONS[foodType][0]?.value || "");
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
    setTipo(TIPO_OPTIONS[foodType][0]?.value || "");
    setPrecio("");
    setSuplemento("");
    setTitulo("");
    setDescripcion("");
    setCategoria("");
    setAlergenos([]);
    setActive(true);
    setImageBase64(null);
    setImagePreview(null);
  }, [item, foodType, open]);

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
    } catch {
      pushToast({ kind: "error", title: "Error", message: "No se pudo procesar la imagen" });
    } finally {
      setUploading(false);
    }
  }, [pushToast]);

  const handleRemoveImage = useCallback(() => {
    setImageBase64("");
    setImagePreview(null);
  }, []);

  const handleAlergenoToggle = useCallback((value: string) => {
    setAlergenos((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]));
  }, []);

  const onSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    const nombreOrDesc = isPostre ? (descripcion.trim() || nombre.trim()) : nombre.trim();
    if (!nombreOrDesc) {
      pushToast({ kind: "error", title: "Error", message: isPostre ? "La descripcion es requerida" : "El nombre es requerido" });
      return;
    }

    const precioNum = isPostre ? 0 : Number(precio);
    if (!isPostre && (!Number.isFinite(precioNum) || precioNum < 0)) {
      pushToast({ kind: "error", title: "Error", message: "Precio invalido" });
      return;
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
          return;
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
        onSave(saved);
        return;
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
        return;
      }

      const categoriaLabel = supportsCategoria
        ? (categoryOptions.find((option) => option.value === categoria)?.label || categoria || undefined)
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
      onSave(saved);
    } catch {
      pushToast({ kind: "error", title: "Error", message: "Error de conexion" });
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
    categoryOptions,
    descripcion,
    foodType,
    imageBase64,
    imagePreview,
    isPostre,
    item,
    nombre,
    onSave,
    precio,
    pushToast,
    suplemento,
    supportsCategoria,
    supportsSuplemento,
    tipo,
    titulo,
  ]);

  const title = item ? "Editar elemento" : "Nuevo elemento";

  return (
    <Modal open={open} onClose={onClose} title={title} size="lg">
      <form onSubmit={onSubmit}>
        <div className="bo-foodModal-grid">
          <div className="bo-foodModal-imageSection">
            <div className="bo-foodModal-imagePreview">
              {imagePreview ? (
                <>
                  <img src={imagePreview} alt="Preview" />
                  <button
                    type="button"
                    className="bo-foodModal-imageRemove"
                    onClick={handleRemoveImage}
                    aria-label="Eliminar imagen"
                  >
                    <X size={16} />
                  </button>
                </>
              ) : (
                <div className="bo-foodModal-imagePlaceholder">
                  <ImagePlus size={32} />
                  <span>Sin imagen</span>
                </div>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={handleImageSelect}
              className="bo-foodModal-fileInput"
            />
            <button
              type="button"
              className="bo-btn bo-btn--secondary bo-btn--block"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? (
                <>
                  <div className="bo-spinner bo-spinner--sm" />
                  Procesando...
                </>
              ) : (
                <>
                  <Upload size={16} />
                  Subir imagen
                </>
              )}
            </button>
            <p className="bo-foodModal-imageHint">Se comprimira a WebP (max 100KB)</p>
          </div>

          <div className="bo-foodModal-fields">
            <div className="bo-field">
              <label className="bo-label" htmlFor="nombre">
                {isPostre ? "Descripcion *" : "Nombre *"}
              </label>
              <input
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
              <div className="bo-field">
                <label className="bo-label" htmlFor="titulo">
                  Titulo (opcional)
                </label>
                <input
                  id="titulo"
                  type="text"
                  className="bo-input"
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                  placeholder="Texto secundario para card"
                />
              </div>
            ) : null}

            <div className="bo-fieldRow">
              <div className="bo-field">
                <label className="bo-label" htmlFor="tipo">
                  Tipo
                </label>
                <select id="tipo" className="bo-select" value={tipo} onChange={(e) => setTipo(e.target.value)}>
                  {TIPO_OPTIONS[foodType].map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {!isPostre ? (
                <div className="bo-field">
                  <label className="bo-label" htmlFor="precio">
                    Precio *
                  </label>
                  <input
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
                <div className="bo-field">
                  <label className="bo-label" htmlFor="suplemento">
                    Suplemento
                  </label>
                  <input
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

            {supportsCategoria ? (
              <div className="bo-field">
                <div className="bo-foodModalCategoryHead">
                  <label className="bo-label" htmlFor="categoria">
                    Categoria
                  </label>
                  <button type="button" className="bo-btn bo-btn--ghost bo-btn--sm" onClick={onRequestCreateCategory}>
                    <Plus size={14} />
                    Anadir categoria
                  </button>
                </div>
                <select id="categoria" className="bo-select" value={categoria} onChange={(e) => setCategoria(e.target.value)}>
                  <option value="">Sin categoria</option>
                  {categoryOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            {!isPostre ? (
              <div className="bo-field">
                <label className="bo-label" htmlFor="descripcion">
                  Detalle
                </label>
                <textarea
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
              <div className="bo-field">
                <label className="bo-label">Alergenos</label>
                <div className="bo-foodModal-alergenos">
                  {ALERGEN_OPTIONS.map((opt) => (
                    <label key={opt.value} className="bo-checkboxLabel">
                      <input
                        type="checkbox"
                        checked={alergenos.includes(opt.value)}
                        onChange={() => handleAlergenoToggle(opt.value)}
                      />
                      <span>{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="bo-field">
              <label className="bo-checkboxLabel">
                <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
                <span>Activo</span>
              </label>
            </div>
          </div>
        </div>

        <div className="bo-foodModal-actions">
          <button type="button" className="bo-btn bo-btn--ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </button>
          <button type="submit" className="bo-btn bo-btn--primary" disabled={saving}>
            {saving ? (
              <>
                <div className="bo-spinner bo-spinner--sm" />
                Guardando...
              </>
            ) : (
              "Guardar"
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
});
