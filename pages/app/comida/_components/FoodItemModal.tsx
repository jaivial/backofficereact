import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ImagePlus, Upload, X } from "lucide-react";

import { createClient } from "../../../../api/client";
import type { FoodItem } from "../../../../api/types";
import { useToasts } from "../../../../ui/feedback/useToasts";
import { Modal } from "../../../../ui/overlays/Modal";
import { compressImageToWebP, formatFileSize, isValidImageFile } from "../../../../lib/imageCompressor";

type FoodType = "platos" | "bebidas" | "cafes";

interface FoodItemModalProps {
  open: boolean;
  item: FoodItem | null;
  foodType: FoodType;
  onClose: () => void;
  onSave: (item: FoodItem) => void;
}

// Common allergen options
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

// Type options based on food type
const TIPO_OPTIONS: Record<FoodType, { value: string; label: string }[]> = {
  platos: [
    { value: "ENTRANTE", label: "Entrante" },
    { value: "PRINCIPAL", label: "Principal" },
    { value: "ARROZ", label: "Arroz" },
    { value: "POSTRES", label: "Postres" },
  ],
  bebidas: [
    { value: "REFRESCO", label: "Refresco" },
    { value: "AGUA", label: "Agua" },
    { value: "ZUMO", label: "Zumo" },
    { value: "CERVEZA", label: "Cerveza" },
    { value: "COPA", label: "Copa" },
  ],
  cafes: [
    { value: "CAFE", label: "Cafe" },
    { value: "INFUSION", label: "Infusion" },
    { value: "CHOCOLATE", label: "Chocolate" },
  ],
};

function formatEuro(price: number): string {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(price);
}

export const FoodItemModal = React.memo(function FoodItemModal({
  open,
  item,
  foodType,
  onClose,
  onSave,
}: FoodItemModalProps) {
  const api = useMemo(() => createClient({ baseUrl: "" }), []);
  const { pushToast } = useToasts();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Form state
  const [nombre, setNombre] = useState("");
  const [tipo, setTipo] = useState("");
  const [precio, setPrecio] = useState("");
  const [suplemento, setSuplemento] = useState("");
  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [alergenos, setAlergenos] = useState<string[]>([]);
  const [active, setActive] = useState(true);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // Initialize form when item changes
  useEffect(() => {
    if (item) {
      setNombre(item.nombre || "");
      setTipo(item.tipo || TIPO_OPTIONS[foodType][0]?.value || "");
      setPrecio(item.precio?.toString() || "");
      setSuplemento((item as FoodItem).suplemento?.toString() || "");
      setTitulo((item as FoodItem).titulo || "");
      setDescripcion(item.descripcion || "");
      setAlergenos((item as FoodItem).alergenos || []);
      setActive(item.active ?? true);
      setImageBase64(null);
      setImagePreview((item as FoodItem).foto_url || null);
    } else {
      setNombre("");
      setTipo(TIPO_OPTIONS[foodType][0]?.value || "");
      setPrecio("");
      setSuplemento("");
      setTitulo("");
      setDescripcion("");
      setAlergenos([]);
      setActive(true);
      setImageBase64(null);
      setImagePreview(null);
    }
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
      pushToast({ kind: "success", title: "Imagen comprimida", message: `Tamano: ${formatFileSize(Math.ceil((compressed.split(",")[1].length * 3) / 4))}` });
    } catch (err) {
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
    setAlergenos((prev) => (prev.includes(value) ? prev.filter((a) => a !== value) : []));
  }, []);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    if (!nombre.trim()) {
      pushToast({ kind: "error", title: "Error", message: "El nombre es requerido" });
      return;
    }

    const precioNum = parseFloat(precio);
    if (isNaN(precioNum) || precioNum < 0) {
      pushToast({ kind: "error", title: "Error", message: "Precio invalido" });
      return;
    }

    const suplementoNum = parseFloat(suplemento) || 0;

    setSaving(true);
    try {
      const payload = {
        nombre: nombre.trim(),
        tipo: tipo || undefined,
        precio: precioNum,
        suplemento: suplementoNum,
        titulo: titulo.trim() || undefined,
        descripcion: descripcion.trim() || undefined,
        alergenos: alergenos.length > 0 ? alergenos : undefined,
        active,
        imageBase64: imageBase64 || undefined,
      };

      let res;
      if (foodType === "cafes") {
        if (item) {
          res = await api.menus.cafes.patch(item.num, payload);
        } else {
          res = await api.menus.cafes.create(payload);
        }
      } else if (foodType === "bebidas") {
        if (item) {
          res = await api.menus.bebidas.patch(item.num, payload);
        } else {
          res = await api.menus.bebidas.create(payload);
        }
      } else {
        if (item) {
          res = await api.menus.platos.patch(item.num, payload);
        } else {
          res = await api.menus.platos.create(payload);
        }
      }

      if (res.success) {
        pushToast({ kind: "success", title: item ? "Actualizado" : "Creado" });
        onSave({
          num: item?.num || (res as { num: number }).num,
          nombre: nombre.trim(),
          tipo: tipo,
          precio: precioNum,
          descripcion: descripcion.trim(),
          titulo: titulo.trim(),
          suplemento: suplementoNum,
          alergenos,
          active,
          has_foto: !!imageBase64 || !!imagePreview,
          foto_url: imagePreview || undefined,
        });
      } else {
        pushToast({ kind: "error", title: "Error", message: res.message || "No se pudo guardar" });
      }
    } catch {
      pushToast({ kind: "error", title: "Error", message: "Error de conexion" });
    } finally {
      setSaving(false);
    }
  }, [nombre, tipo, precio, suplemento, titulo, descripcion, alergenos, active, imageBase64, imagePreview, item, foodType, api, onSave, pushToast]);

  const title = item ? `Editar ${foodType.slice(0, -1)}` : `Nuevo ${foodType.slice(0, -1)}`;

  return (
    <Modal open={open} onClose={onClose} title={title} size="lg">
      <form onSubmit={handleSubmit}>
        <div className="bo-foodModal-grid">
          {/* Image upload */}
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

          {/* Form fields */}
          <div className="bo-foodModal-fields">
            <div className="bo-field">
              <label className="bo-label" htmlFor="nombre">
                Nombre *
              </label>
              <input
                id="nombre"
                type="text"
                className="bo-input"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Nombre del elemento"
                required
              />
            </div>

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
                placeholder="Titulo alternativo para mostrar"
              />
            </div>

            <div className="bo-fieldRow">
              <div className="bo-field">
                <label className="bo-label" htmlFor="tipo">
                  Tipo
                </label>
                <select
                  id="tipo"
                  className="bo-select"
                  value={tipo}
                  onChange={(e) => setTipo(e.target.value)}
                >
                  {TIPO_OPTIONS[foodType].map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

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
            </div>

            <div className="bo-field">
              <label className="bo-label" htmlFor="descripcion">
                Descripcion
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

            {/* Alergenos - only for dishes */}
            {foodType === "platos" && (
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
            )}

            <div className="bo-field">
              <label className="bo-checkboxLabel">
                <input
                  type="checkbox"
                  checked={active}
                  onChange={(e) => setActive(e.target.checked)}
                />
                <span>Activo</span>
              </label>
            </div>
          </div>
        </div>

        {/* Actions */}
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
