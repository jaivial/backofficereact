import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { RestaurantInfo } from "../../../../../api/types";
import { readAPIMessage } from "../../../config/helpers/configHelpers";
import { clasificacionOptions } from "../../../config/constants/config.constants";
import type { ContactoContentProps } from "./types/ConfigContacto.types";
import { Select } from "../../../../../ui/inputs/Select";
import EmailProviderConfigInner from "../EmailProviderConfig/EmailProviderConfig";
import { useEmailProviderConfig } from "../EmailProviderConfig/hooks/useEmailProviderConfig";

const DEBOUNCE_MS = 400;

export function ConfigContactoContent({ initialInfo, busy, setBusy, setError, api, pushToast }: ContactoContentProps) {
  const [info, setInfo] = useState<RestaurantInfo>(initialInfo);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstRender = useRef(true);
  const emailProv = useEmailProviderConfig();

  // Sync when initialInfo changes (e.g. after page reload)
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    setInfo(initialInfo);
  }, [initialInfo]);

  const save = useCallback(
    async (patch: Partial<RestaurantInfo>) => {
      setError(null);
      try {
        const res = await api.config.setRestaurantInfo(patch);
        if (!res.success) {
          setError(readAPIMessage(res, "No se pudo guardar"));
          return;
        }
        if (res.restaurantInfo) {
          setInfo(res.restaurantInfo);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo guardar");
      } finally {
        setBusy(false);
      }
    },
    [api.config, setError, setBusy],
  );

  const scheduleDebouncedSave = useCallback(
    (patch: Partial<RestaurantInfo>) => {
      setBusy(true);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        void save(patch);
        pushToast({ kind: "success", title: "Guardado", message: "Cambios guardados" });
      }, DEBOUNCE_MS);
    },
    [save, pushToast],
  );

  const handleField = useCallback(
    (field: keyof RestaurantInfo, value: string) => {
      const patch = { [field]: value } as Partial<RestaurantInfo>;
      setInfo((prev) => ({ ...prev, [field]: value }));
      scheduleDebouncedSave(patch);
    },
    [scheduleDebouncedSave],
  );

  const handleClasificacion = useCallback(
    (value: string) => {
      const patch = { clasificacion: value as "persona_fisica" | "sociedad" };
      setInfo((prev) => ({ ...prev, clasificacion: value as "persona_fisica" | "sociedad" }));
      scheduleDebouncedSave(patch);
    },
    [scheduleDebouncedSave],
  );

  return (
    <>
      <div className="bo-panel" data-ui="config-contacto-main-panel">
        <div className="bo-panelHead" data-ui="config-contacto-main-header">
          <div className="bo-panelTitle">Contacto</div>
        </div>
        <div className="bo-panelBody bo-stack" data-ui="config-contacto-main-body">
          <div className="bo-field" data-ui="config-contacto-address-field">
            <label className="bo-label" htmlFor="config-contacto-direccion">
              Dirección
            </label>
            <input
              id="config-contacto-direccion"
              type="text"
              className="bo-input"
              value={info.direccion}
              onChange={(e) => handleField("direccion", e.target.value)}
              disabled={busy}
              placeholder="Calle, número, CP, ciudad..."
              aria-label="Dirección del restaurante"
              data-testid="config-contacto-direccion-input"
            />
          </div>

          <div className="bo-field" data-ui="config-contacto-phone-field">
            <label className="bo-label" htmlFor="config-contacto-telefono">
              Teléfono
            </label>
            <input
              id="config-contacto-telefono"
              type="tel"
              className="bo-input"
              value={info.telefono}
              onChange={(e) => handleField("telefono", e.target.value)}
              disabled={busy}
              placeholder="+34 600 000 000"
              aria-label="Teléfono de contacto"
              data-testid="config-contacto-telefono-input"
            />
          </div>

          <div className="bo-field" data-ui="config-contacto-email-field">
            <label className="bo-label" htmlFor="config-contacto-email">
              Email
            </label>
            <input
              id="config-contacto-email"
              type="email"
              className="bo-input"
              value={info.email}
              onChange={(e) => handleField("email", e.target.value)}
              disabled={busy}
              placeholder="info@restaurante.com"
              aria-label="Email de contacto"
              data-testid="config-contacto-email-input"
            />
          </div>

          <EmailProviderConfigInner
            config={emailProv.config}
            setField={emailProv.setField as (key: string, value: unknown) => void}
            save={emailProv.save}
            load={emailProv.load}
            saving={emailProv.saving}
            pushToast={pushToast as (t: { kind: "success" | "error" | "info" | "warning"; title: string; message?: string }) => void}
          />
        </div>
      </div>

      <div className="bo-panel" data-ui="config-contacto-fiscal-panel">
        <div className="bo-panelHead" data-ui="config-contacto-fiscal-header">
          <div className="bo-panelTitle">Información fiscal</div>
          <div className="bo-panelMeta">Datos para facturación</div>
        </div>
        <div className="bo-panelBody bo-stack" data-ui="config-contacto-fiscal-body">
          <div className="bo-field" data-ui="config-contacto-cif-field">
            <label className="bo-label" htmlFor="config-contacto-cif">
              CIF / NIF
            </label>
            <input
              id="config-contacto-cif"
              type="text"
              className="bo-input"
              value={info.cif}
              onChange={(e) => handleField("cif", e.target.value)}
              disabled={busy}
              placeholder="B12345678"
              aria-label="CIF o NIF del restaurante"
              data-testid="config-contacto-cif-input"
            />
          </div>

          <div className="bo-field" data-ui="config-contacto-billing-address-field">
            <label className="bo-label" htmlFor="config-contacto-dir-fact">
              Dirección de facturación
            </label>
            <input
              id="config-contacto-dir-fact"
              type="text"
              className="bo-input"
              value={info.direccionFacturacion}
              onChange={(e) => handleField("direccionFacturacion", e.target.value)}
              disabled={busy}
              placeholder="Calle de facturación, número, CP, ciudad..."
              aria-label="Dirección de facturación"
              data-testid="config-contacto-dir-fact-input"
            />
          </div>

          <div className="bo-field" data-ui="config-contacto-clasificacion-field">
            <div className="bo-label">Clasificación</div>
            <Select
              value={info.clasificacion}
              onChange={handleClasificacion}
              options={clasificacionOptions}
              size="sm"
              disabled={busy}
              ariaLabel="Clasificación fiscal"
            />
          </div>
        </div>
      </div>
    </>
  );
}
