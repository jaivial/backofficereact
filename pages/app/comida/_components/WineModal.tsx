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
      <form onSubmit={handleSubmit}>
        <div className="grid grid-gap-6" style={{ gridTemplateColumns: "200px 1fr" }}>
          {/* Image upload */}
          <div className="flex flex-col gap-3">
            <div className="w-[200px] h-[280px] rounded-[var(--rounded-md)] overflow-hidden bg-[var(--bo-surface-2)] relative">
              {imagePreview ? (
                <>
                  <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    className="absolute top-2 right-2 w-7 h-7 rounded-full bg-[var(--bo-color-danger)] text-white border-0 cursor-pointer flex items-center justify-center hover:scale-110 transition-transform duration-150"
                    onClick={handleRemoveImage}
                    aria-label="Eliminar imagen"
                  >
                    <X size={16} />
                  </button>
                </>
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-[var(--text-faint)] gap-2">
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
              className="hidden"
            />
            <button
              type="button"
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-white/[0.09] bg-bo-surface-2 text-bo-text text-sm font-bold transition-all hover:border-bo-primary hover:bg-bo-surface-2/80 disabled:opacity-55 disabled:cursor-not-allowed"
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
            <p className="text-[11px] text-[var(--text-faint)] text-center m-0">Se comprimira a WebP (max 100KB)</p>
          </div>

          {/* Form fields */}
          <div className="flex flex-col gap-3.5">
            <div className="grid gap-2">
              <label className="text-bo-sm font-semibold text-bo-muted" htmlFor="nombre">
                Nombre *
              </label>
              <input
                id="nombre"
                type="text"
                className="h-10 rounded-bo-md border border-bo-border bg-white/5 text-bo-text px-3 outline-none min-w-0 transition-colors"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Nombre del vino"
                required
              />
            </div>

            <div className="grid grid-gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))" }}>
              <div className="grid gap-2">
                <label className="text-bo-sm font-semibold text-bo-muted" htmlFor="tipo">
                  Tipo
                </label>
                <select
                  id="tipo"
                  className="h-10 rounded-bo-sm border border-bo-border bg-bo-surface-2 text-bo-text px-3 cursor-pointer"
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

              <div className="grid gap-2">
                <label className="text-bo-sm font-semibold text-bo-muted" htmlFor="precio">
                  Precio *
                </label>
                <input
                  id="precio"
                  type="number"
                  step="0.01"
                  min="0"
                  className="h-10 rounded-bo-md border border-bo-border bg-white/5 text-bo-text px-3 outline-none min-w-0 transition-colors"
                  value={precio}
                  onChange={(e) => setPrecio(e.target.value)}
                  placeholder="0.00"
                  required
                />
              </div>
            </div>

            <div className="grid gap-2">
              <label className="text-bo-sm font-semibold text-bo-muted" htmlFor="bodega">
                Bodega *
              </label>
              <input
                id="bodega"
                type="text"
                className="h-10 rounded-bo-md border border-bo-border bg-white/5 text-bo-text px-3 outline-none min-w-0 transition-colors"
                value={bodega}
                onChange={(e) => setBodega(e.target.value)}
                placeholder="Nombre de la bodega"
                required
              />
            </div>

            <div className="grid grid-gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))" }}>
              <div className="grid gap-2">
                <label className="text-bo-sm font-semibold text-bo-muted" htmlFor="denominacion">
                  Denominacion de Origen
                </label>
                <input
                  id="denominacion"
                  type="text"
                  className="h-10 rounded-bo-md border border-bo-border bg-white/5 text-bo-text px-3 outline-none min-w-0 transition-colors"
                  value={denominacionOrigen}
                  onChange={(e) => setDenominacionOrigen(e.target.value)}
                  placeholder="D.O. Rioja, D.O. Ribera..."
                />
              </div>

              <div className="grid gap-2">
                <label className="text-bo-sm font-semibold text-bo-muted" htmlFor="anyo">
                  Ano
                </label>
                <input
                  id="anyo"
                  type="text"
                  className="h-10 rounded-bo-md border border-bo-border bg-white/5 text-bo-text px-3 outline-none min-w-0 transition-colors"
                  value={anyo}
                  onChange={(e) => setAnyo(e.target.value)}
                  placeholder="2020"
                  maxLength={4}
                />
              </div>

              <div className="grid gap-2">
                <label className="text-bo-sm font-semibold text-bo-muted" htmlFor="graduacion">
                  Graduacion (%)
                </label>
                <input
                  id="graduacion"
                  type="number"
                  step="0.1"
                  min="0"
                  max="25"
                  className="h-10 rounded-bo-md border border-bo-border bg-white/5 text-bo-text px-3 outline-none min-w-0 transition-colors"
                  value={graduacion}
                  onChange={(e) => setGraduacion(e.target.value)}
                  placeholder="13.5"
                />
              </div>
            </div>

            <div className="grid gap-2">
              <label className="text-bo-sm font-semibold text-bo-muted" htmlFor="descripcion">
                Descripcion
              </label>
              <textarea
                id="descripcion"
                className="min-h-[80px] rounded-bo-md border border-bo-border bg-white/5 text-bo-text p-3 outline-none"
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                placeholder="Notas de cata, maridaje..."
                rows={3}
              />
            </div>

            <div className="grid gap-2">
              <label className="text-bo-sm text-bo-text">
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
        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-[var(--border)]">
          <button type="button" className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-white/[0.06] bg-transparent text-bo-text text-sm font-bold transition-all hover:bg-white/[0.04]" onClick={onClose} disabled={saving}>
            Cancelar
          </button>
          <button type="submit" className="h-9 px-4 rounded-bo-sm font-semibold inline-flex items-center justify-center gap-2 cursor-pointer bg-transparent border border-transparent hover:bg-white/5 bo-btn--primary" disabled={saving}>
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
