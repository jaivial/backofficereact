import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ImagePlus, Upload, X } from "lucide-react";

import { createClient } from "../../../../api/client";
import type { Vino } from "../../../../api/types";
import { useToasts } from "../../../../ui/feedback/useToasts";
import { Modal } from "../../../../ui/overlays/Modal";
import { compressImageToWebP, formatFileSize, isValidImageFile } from "../../../../lib/imageCompressor";

interface WineModalProps {
  open: boolean;
  wine: Vino | null;
  onClose: () => void;
  onSave: (item: Vino) => void;
}

const WINE_TYPE_OPTIONS = [
  { value: "TINTO", label: "Tinto" },
  { value: "BLANCO", label: "Blanco" },
  { value: "CAVA", label: "Cava" },
];

function formatEuro(price: number): string {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(price);
}

export const WineModal = React.memo(function WineModal({
  open,
  wine,
  onClose,
  onSave,
}: WineModalProps) {
  const api = useMemo(() => createClient({ baseUrl: "" }), []);
  const { pushToast } = useToasts();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Form state
  const [nombre, setNombre] = useState("");
  const [tipo, setTipo] = useState("TINTO");
  const [precio, setPrecio] = useState("");
  const [bodega, setBodega] = useState("");
  const [denominacionOrigen, setDenominacionOrigen] = useState("");
  const [graduacion, setGraduacion] = useState("");
  const [anyo, setAnyo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [active, setActive] = useState(true);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // Initialize form when wine changes
  useEffect(() => {
    if (wine) {
      setNombre(wine.nombre || "");
      setTipo(wine.tipo || "TINTO");
      setPrecio(wine.precio?.toString() || "");
      setBodega(wine.bodega || "");
      setDenominacionOrigen(wine.denominacion_origen || "");
      setGraduacion(wine.graduacion?.toString() || "");
      setAnyo(wine.anyo || "");
      setDescripcion(wine.descripcion || "");
      setActive(wine.active ?? true);
      setImageBase64(null);
      setImagePreview(wine.foto_url || null);
    } else {
      setNombre("");
      setTipo("TINTO");
      setPrecio("");
      setBodega("");
      setDenominacionOrigen("");
      setGraduacion("");
      setAnyo("");
      setDescripcion("");
      setActive(true);
      setImageBase64(null);
      setImagePreview(null);
    }
  }, [wine, open]);

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

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    if (!nombre.trim()) {
      pushToast({ kind: "error", title: "Error", message: "El nombre es requerido" });
      return;
    }

    if (!bodega.trim()) {
      pushToast({ kind: "error", title: "Error", message: "La bodega es requerida" });
      return;
    }

    const precioNum = parseFloat(precio);
    if (isNaN(precioNum) || precioNum <= 0) {
      pushToast({ kind: "error", title: "Error", message: "Precio invalido" });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        nombre: nombre.trim(),
        tipo,
        precio: precioNum,
        bodega: bodega.trim(),
        denominacion_origen: denominacionOrigen.trim() || undefined,
        graduacion: graduacion ? parseFloat(graduacion) : undefined,
        anyo: anyo.trim() || undefined,
        descripcion: descripcion.trim() || undefined,
        active,
        imageBase64: imageBase64 || undefined,
      };

      let res;
      if (wine) {
        res = await api.comida.vinos.patch(wine.num, payload);
      } else {
        res = await api.comida.vinos.create(payload);
      }

      if (res.success) {
        pushToast({ kind: "success", title: wine ? "Actualizado" : "Creado" });
        const saved = ((res as any).item as Vino | undefined) ?? {
          num: wine?.num || (res as { num: number }).num,
          nombre: nombre.trim(),
          tipo,
          precio: precioNum,
          bodega: bodega.trim(),
          denominacion_origen: denominacionOrigen.trim(),
          graduacion: graduacion ? parseFloat(graduacion) : 0,
          anyo: anyo.trim(),
          descripcion: descripcion.trim(),
          active,
          has_foto: !!imageBase64 || !!wine?.has_foto,
        };
        onSave(saved);
      } else {
        pushToast({ kind: "error", title: "Error", message: res.message || "No se pudo guardar" });
      }
    } catch {
      pushToast({ kind: "error", title: "Error", message: "Error de conexion" });
    } finally {
      setSaving(false);
    }
  }, [nombre, tipo, precio, bodega, denominacionOrigen, graduacion, anyo, descripcion, active, imageBase64, wine, api, onSave, pushToast]);

  const title = wine ? "Editar vino" : "Nuevo vino";

  return (
    <Modal open={open} onClose={onClose} title={title} size="lg">
      <form onSubmit={handleSubmit} data-role="wine-modal-form">
        <div className="bo-foodModal-grid" data-ui="wine-modal-grid">
          {/* Image upload */}
          <div className="bo-foodModal-imageSection" data-slot="wine-modal-image-section">
            <div className="bo-foodModal-imagePreview bo-foodModal-imagePreview--wine" data-ui="wine-modal-image-preview">
              {imagePreview ? (
                <>
                  <img src={imagePreview} alt="Preview" data-role="wine-modal-preview-image" />
                  <button
                    type="button"
                    className="bo-foodModal-imageRemove"
                    onClick={handleRemoveImage}
                    aria-label="Eliminar imagen"
                    data-ui="wine-modal-remove-image-btn"
                  >
                    <X size={16} data-ui="wine-modal-remove-icon" />
                  </button>
                </>
              ) : (
                <div className="bo-foodModal-imagePlaceholder" data-ui="wine-modal-image-placeholder">
                  <ImagePlus size={32} data-ui="wine-modal-placeholder-icon" />
                  <span data-ui="wine-modal-placeholder-text">Sin imagen</span>
                </div>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={handleImageSelect}
              className="bo-foodModal-fileInput"
              data-role="wine-modal-file-input"
            />
            <button
              type="button"
              className="bo-btn bo-btn--secondary bo-btn--block"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              data-ui="wine-modal-upload-btn"
            >
              {uploading ? (
                <>
                  <div className="bo-spinner bo-spinner--sm" data-role="wine-modal-upload-spinner" />
                  Procesando...
                </>
              ) : (
                <>
                  <Upload size={16} data-ui="wine-modal-upload-icon" />
                  Subir imagen
                </>
              )}
            </button>
            <p className="bo-foodModal-imageHint" data-ui="wine-modal-image-hint">Se comprimira a WebP (max 100KB)</p>
          </div>

          {/* Form fields */}
          <div className="bo-foodModal-fields" data-slot="wine-modal-fields">
            <div className="bo-field" data-ui="wine-modal-field-nombre">
              <label className="bo-label" htmlFor="nombre" data-ui="wine-modal-label-nombre">
                Nombre *
              </label>
              <input
                id="nombre"
                type="text"
                className="bo-input"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Nombre del vino"
                required
                data-role="wine-modal-input-nombre"
              />
            </div>

            <div className="bo-fieldRow" data-ui="wine-modal-field-row-tipo-precio">
              <div className="bo-field" data-ui="wine-modal-field-tipo">
                <label className="bo-label" htmlFor="tipo" data-ui="wine-modal-label-tipo">
                  Tipo
                </label>
                <select
                  id="tipo"
                  className="bo-select"
                  value={tipo}
                  onChange={(e) => setTipo(e.target.value)}
                  data-role="wine-modal-select-tipo"
                >
                  {WINE_TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value} data-role="wine-modal-option-tipo">
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="bo-field" data-ui="wine-modal-field-precio">
                <label className="bo-label" htmlFor="precio" data-ui="wine-modal-label-precio">
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
                  data-role="wine-modal-input-precio"
                />
              </div>
            </div>

            <div className="bo-field" data-ui="wine-modal-field-bodega">
              <label className="bo-label" htmlFor="bodega" data-ui="wine-modal-label-bodega">
                Bodega *
              </label>
              <input
                id="bodega"
                type="text"
                className="bo-input"
                value={bodega}
                onChange={(e) => setBodega(e.target.value)}
                placeholder="Nombre de la bodega"
                required
                data-role="wine-modal-input-bodega"
              />
            </div>

            <div className="bo-fieldRow" data-ui="wine-modal-field-row-do-ano-grad">
              <div className="bo-field" data-ui="wine-modal-field-denominacion">
                <label className="bo-label" htmlFor="denominacion" data-ui="wine-modal-label-denominacion">
                  Denominacion de Origen
                </label>
                <input
                  id="denominacion"
                  type="text"
                  className="bo-input"
                  value={denominacionOrigen}
                  onChange={(e) => setDenominacionOrigen(e.target.value)}
                  placeholder="D.O. Rioja, D.O. Ribera..."
                  data-role="wine-modal-input-denominacion"
                />
              </div>

              <div className="bo-field" data-ui="wine-modal-field-anyo">
                <label className="bo-label" htmlFor="anyo" data-ui="wine-modal-label-anyo">
                  Ano
                </label>
                <input
                  id="anyo"
                  type="text"
                  className="bo-input"
                  value={anyo}
                  onChange={(e) => setAnyo(e.target.value)}
                  placeholder="2020"
                  maxLength={4}
                  data-role="wine-modal-input-anyo"
                />
              </div>

              <div className="bo-field" data-ui="wine-modal-field-graduacion">
                <label className="bo-label" htmlFor="graduacion" data-ui="wine-modal-label-graduacion">
                  Graduacion (%)
                </label>
                <input
                  id="graduacion"
                  type="number"
                  step="0.1"
                  min="0"
                  max="25"
                  className="bo-input"
                  value={graduacion}
                  onChange={(e) => setGraduacion(e.target.value)}
                  placeholder="13.5"
                  data-role="wine-modal-input-graduacion"
                />
              </div>
            </div>

            <div className="bo-field" data-ui="wine-modal-field-descripcion">
              <label className="bo-label" htmlFor="descripcion" data-ui="wine-modal-label-descripcion">
                Descripcion
              </label>
              <textarea
                id="descripcion"
                className="bo-textarea"
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                placeholder="Notas de cata, maridaje..."
                rows={3}
                data-role="wine-modal-textarea-descripcion"
              />
            </div>

            <div className="bo-field" data-ui="wine-modal-field-active">
              <label className="bo-checkboxLabel" data-ui="wine-modal-label-active">
                <input
                  type="checkbox"
                  checked={active}
                  onChange={(e) => setActive(e.target.checked)}
                  data-role="wine-modal-checkbox-active"
                />
                <span data-ui="wine-modal-active-text">Activo</span>
              </label>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="bo-foodModal-actions" data-slot="wine-modal-actions">
          <button type="button" className="bo-btn bo-btn--ghost" onClick={onClose} disabled={saving} data-ui="wine-modal-cancel-btn">
            Cancelar
          </button>
          <button type="submit" className="bo-btn bo-btn--primary" disabled={saving} data-role="wine-modal-submit-btn">
            {saving ? (
              <>
                <div className="bo-spinner bo-spinner--sm" data-role="wine-modal-submit-spinner" />
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
