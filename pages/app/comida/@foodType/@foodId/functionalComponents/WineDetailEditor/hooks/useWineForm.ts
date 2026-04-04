import { useCallback, useEffect, useMemo, useState } from "react";

import type { Vino } from "../../../../../../../../api/types";
import { createClient } from "../../../../../../../../api/client";
import { useToasts } from "../../../../../../../../ui/feedback/useToasts";
import type { WineFormData } from "../types";
import { EMPTY_WINE_FORM } from "../constants";

function toMoneyInput(value: number | null | undefined): string {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed.toFixed(2) : "0.00";
}

function vinoToForm(vino: Vino | null): WineFormData {
  if (!vino) return { ...EMPTY_WINE_FORM };
  return {
    nombre: String(vino.nombre || ""),
    tipo: String(vino.tipo || "TINTO"),
    precio: toMoneyInput(vino.precio),
    bodega: String(vino.bodega || ""),
    denominacion_origen: String(vino.denominacion_origen || ""),
    graduacion: vino.graduacion ? String(vino.graduacion) : "",
    anyo: String(vino.anyo || ""),
    descripcion: String(vino.descripcion || ""),
    active: !!vino.active,
  };
}

function parseDecimal(value: string): number | null {
  const n = Number(String(value || "").trim().replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export function useWineForm(vino: Vino | null, isNew: boolean) {
  const api = useMemo(() => createClient({ baseUrl: "" }), []);
  const { pushToast } = useToasts();
  const [form, setForm] = useState<WineFormData>(() => vinoToForm(vino));
  const [saving, setSaving] = useState(false);
  const [createdId, setCreatedId] = useState<number | null>(null);

  useEffect(() => {
    if (!isNew) setForm(vinoToForm(vino));
  }, [isNew, vino]);

  const dirty = useMemo(() => {
    const baseline = vinoToForm(vino);
    return (
      form.nombre !== baseline.nombre
      || form.tipo !== baseline.tipo
      || form.precio !== baseline.precio
      || form.bodega !== baseline.bodega
      || form.denominacion_origen !== baseline.denominacion_origen
      || form.graduacion !== baseline.graduacion
      || form.anyo !== baseline.anyo
      || form.descripcion !== baseline.descripcion
      || form.active !== baseline.active
    );
  }, [form, vino]);

  const canSave = useMemo(() => {
    if (saving) return false;
    if (!dirty && !isNew) return false;
    if (!form.nombre.trim()) return false;
    const price = parseDecimal(form.precio);
    if (price === null || price < 0) return false;
    return true;
  }, [dirty, form.nombre, form.precio, isNew, saving]);

  const setField = useCallback(<K extends keyof WineFormData>(key: K, value: WineFormData[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  const save = useCallback(async (): Promise<Vino | null> => {
    if (!canSave) return null;
    const precioNumber = parseDecimal(form.precio);
    const graduacionNumber = form.graduacion.trim() ? (parseDecimal(form.graduacion) ?? undefined) : undefined;
    if (precioNumber === null || precioNumber < 0) {
      pushToast({ kind: "error", title: "Error", message: "Precio invalido" });
      return null;
    }

    setSaving(true);
    try {
      if (isNew) {
        const res = await api.comida.vinos.create({
          tipo: form.tipo,
          nombre: form.nombre.trim(),
          precio: precioNumber,
          bodega: form.bodega.trim(),
          descripcion: form.descripcion.trim() || undefined,
          denominacion_origen: form.denominacion_origen.trim() || undefined,
          graduacion: graduacionNumber,
          anyo: form.anyo.trim() || undefined,
          active: form.active,
        });
        if (!res.success) {
          pushToast({ kind: "error", title: "Error", message: res.message || "No se pudo crear el vino" });
          return null;
        }
        const newId = (res as any).num as number;
        if (newId) setCreatedId(newId);
        const freshRes = await api.comida.vinos.get(newId);
        const saved = freshRes.success ? (freshRes.vino as Vino) : null;
        pushToast({ kind: "success", title: "Vino creado" });
        return saved;
      }

      const res = await api.comida.vinos.patch((vino as Vino).num, {
        nombre: form.nombre.trim(),
        tipo: form.tipo,
        precio: precioNumber,
        bodega: form.bodega.trim(),
        descripcion: form.descripcion.trim(),
        denominacion_origen: form.denominacion_origen.trim(),
        graduacion: graduacionNumber,
        anyo: form.anyo.trim(),
        active: form.active,
      });
      if (!res.success) {
        pushToast({ kind: "error", title: "Error", message: res.message || "No se pudo guardar el vino" });
        return null;
      }
      pushToast({ kind: "success", title: "Vino actualizado" });
      const freshRes = await api.comida.vinos.get((vino as Vino).num);
      return freshRes.success ? (freshRes.vino as Vino) : null;
    } catch {
      pushToast({ kind: "error", title: "Error", message: "Error de conexion" });
      return null;
    } finally {
      setSaving(false);
    }
  }, [api.comida.vinos, canSave, form, isNew, pushToast, vino]);

  return { form, saving, dirty, canSave, createdId, setField, save };
}
