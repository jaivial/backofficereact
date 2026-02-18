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
      // We'll need to fetch the image URL - for now just set to null
      setImagePreview(null);
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
        res = await api.vinos.patch(wine.num, payload);
      } else {
        res = await api.vinos.create(payload);
      }

      if (res.success) {
        pushToast({ kind: "success", title: wine ? "Actualizado" : "Creado" });
        onSave({
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
        });
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
      <form onSubmit={handleSubmit}>
        <div className="bo-foodModal-grid">
          {/* Image upload */}
          <div className="bo-foodModal-imageSection">
            <div className="bo-foodModal-imagePreview bo-foodModal-imagePreview--wine">
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
                placeholder="Nombre del vino"
                required
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
                  {WINE_TYPE_OPTIONS.map((opt) => (
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
            </div>

            <div className="bo-field">
              <label className="bo-label" htmlFor="bodega">
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
              />
            </div>

            <div className="bo-fieldRow">
              <div className="bo-field">
                <label className="bo-label" htmlFor="denominacion">
                  Denominacion de Origen
                </label>
                <input
                  id="denominacion"
                  type="text"
                  className="bo-input"
                  value={denominacionOrigen}
                  onChange={(e) => setDenominacionOrigen(e.target.value)}
                  placeholder="D.O. Rioja, D.O. Ribera..."
                />
              </div>

              <div className="bo-field">
                <label className="bo-label" htmlFor="anyo">
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
                />
              </div>

              <div className="bo-field">
                <label className="bo-label" htmlFor="graduacion">
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
                placeholder="Notas de cata, maridaje..."
                rows={3}
              />
            </div>

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
