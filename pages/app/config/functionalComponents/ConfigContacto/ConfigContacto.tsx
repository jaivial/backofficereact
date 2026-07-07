import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ImagePlus, Loader2, Upload } from "lucide-react";

import type { RestaurantInfo } from "../../../../../api/types";
import { readAPIMessage } from "../../../config/helpers/configHelpers";
import { clasificacionOptions } from "../../../config/constants/config.constants";
import type { ContactoContentProps } from "./types/ConfigContacto.types";
import { Select } from "../../../../../ui/inputs/Select";
import { Panel } from "../../../../../ui/shell/Panel";
import { ImageDropInput } from "../../../../../ui/inputs/ImageDropInput";
import EmailProviderConfigInner from "../EmailProviderConfig/EmailProviderConfig";
import { useEmailProviderConfig } from "../EmailProviderConfig/hooks/useEmailProviderConfig";
import { useBranding } from "./hooks/useBranding";

const DEBOUNCE_MS = 400;

export function ConfigContactoContent({ initialInfo, busy, setBusy, setError, api, pushToast }: ContactoContentProps) {
  const [info, setInfo] = useState<RestaurantInfo>(initialInfo);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const brandingDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstRender = useRef(true);
  const emailProv = useEmailProviderConfig();
  const branding = useBranding();
  const [logoPreviewNonce, setLogoPreviewNonce] = useState(0);
  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const [logoError, setLogoError] = useState(false);

  // Sync when initialInfo changes (e.g. after page reload)
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    setInfo(initialInfo);
  }, [initialInfo]);

  useEffect(() => {
    void branding.load();
  }, [branding.load]);

  // Clear a stale image error whenever the logo URL changes.
  useEffect(() => {
    setLogoError(false);
  }, [branding.branding.logoUrl, logoPreviewNonce]);

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

  const scheduleBrandingSave = useCallback(() => {
    if (brandingDebounceRef.current) clearTimeout(brandingDebounceRef.current);
    brandingDebounceRef.current = setTimeout(async () => {
      const ok = await branding.save();
      if (ok) {
        pushToast({ kind: "success", title: "Guardado", message: "Cambios guardados" });
      }
    }, DEBOUNCE_MS);
  }, [branding, pushToast]);

  const handleBrandingField = useCallback(
    (field: "brandName", value: string) => {
      branding.setField(field, value);
      scheduleBrandingSave();
    },
    [branding, scheduleBrandingSave],
  );

  const handleLogoFile = useCallback(
    async (file: File) => {
      const url = await branding.uploadLogo(file);
      if (url) {
        setLogoPreviewNonce(Date.now());
        pushToast({ kind: "success", title: "Logo actualizado" });
      } else {
        pushToast({ kind: "error", title: "No se pudo subir el logo" });
      }
    },
    [branding, pushToast],
  );

  const openLogoPicker = useCallback(() => {
    logoInputRef.current?.click();
  }, []);

  const onLogoInputChange = useCallback(
    async (ev: React.ChangeEvent<HTMLInputElement>) => {
      const file = ev.target.files?.[0];
      ev.target.value = "";
      if (!file) return;
      await handleLogoFile(file);
    },
    [handleLogoFile],
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
      <Panel title="Marca (email)" bodyClassName="bo-stack" data-ui="config-contacto-branding-panel" data-slot="config-contacto-branding-panel">
        <div className="bo-field" data-ui="config-contacto-brandname-field" data-slot="config-contacto-brandname-field">
          <label className="bo-label" htmlFor="config-contacto-brandname" data-slot="configContacto-label">
            Nombre del restaurante (cabecera del email)
          </label>
          <input
            id="config-contacto-brandname"
            type="text"
            className="bo-input"
            value={branding.branding.brandName}
            onChange={(e) => handleBrandingField("brandName", e.target.value)}
            disabled={busy || branding.saving}
            placeholder="Alquería Villa Carmen"
            aria-label="Nombre del restaurante para emails"
            data-testid="config-contacto-brandname-input"
          />
        </div>

        <div className="bo-field" data-ui="config-contacto-logo-field" data-slot="config-contacto-logo-field">
          <label className="bo-label" data-slot="configContacto-label">
            Logo (cabecera del email)
          </label>
          <div className="bo-brandingLogo" data-slot="config-contacto-logo-block">
            <ImageDropInput
              className="bo-brandingLogo-dropzone"
              disabled={busy || branding.uploading}
              ariaLabel="Subir logo del restaurante"
              onSelectFile={handleLogoFile}
            >
                <div className="bo-brandingLogo-preview" data-slot="logo-preview-wrapper">
                  {branding.branding.logoUrl && !logoError ? (
                    <img
                      src={
                        branding.branding.logoUrl.includes("?")
                          ? branding.branding.logoUrl + (logoPreviewNonce ? `&_n=${logoPreviewNonce}` : "")
                          : `${branding.branding.logoUrl}${logoPreviewNonce ? `?v=${logoPreviewNonce}` : ""}`
                      }
                      alt="Logo actual"
                      className="bo-brandingLogo-image"
                      data-testid="config-contacto-logo-preview"
                      onError={() => setLogoError(true)}
                    />
                  ) : branding.branding.logoUrl && logoError ? (
                    <span className="bo-brandingLogo-fallback" data-slot="logo-empty" aria-hidden="true">
                      <ImagePlus size={42} strokeWidth={1.6} className="bo-brandingLogo-fallbackIcon" />
                    </span>
                  ) : !branding.loaded ? (
                    <span className="bo-brandingLogo-status" data-slot="logo-loading-status">
                      <Loader2 size={28} className="bo-brandingLogo-iconSpin" />
                    </span>
                  ) : (
                    <span className="bo-brandingLogo-fallback" data-slot="logo-empty" aria-hidden="true">
                      <ImagePlus size={42} strokeWidth={1.6} className="bo-brandingLogo-fallbackIcon" />
                    </span>
                  )}
                  {branding.uploading ? (
                    <span className="bo-brandingLogo-status" data-slot="logo-uploading-status">
                      <Loader2 size={28} className="bo-brandingLogo-iconSpin" />
                    </span>
                  ) : null}
                </div>
            </ImageDropInput>
            <div className="bo-brandingLogo-actions">
              <button
                type="button"
                className="bo-brandingLogo-uploadBtn"
                onClick={openLogoPicker}
                disabled={busy || branding.uploading}
                aria-label="Subir logo del restaurante"
                data-testid="config-contacto-logo-upload-btn"
              >
                {branding.uploading ? (
                  <>
                    <Loader2 size={16} className="bo-brandingLogo-iconSpin" />
                    Subiendo...
                  </>
                ) : (
                  <>
                    <Upload size={16} strokeWidth={1.8} />
                    {branding.branding.logoUrl ? "Cambiar logo" : "Subir logo"}
                  </>
                )}
              </button>
            </div>
            <span className="bo-brandingLogo-hint">PNG, JPG o WebP · se reduce a 50 KB automaticamente</span>
            <input
              ref={logoInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              hidden
              onChange={onLogoInputChange}
              data-slot="logo-picker-input"
              data-testid="config-contacto-logo-picker-input"
            />
          </div>
        </div>
      </Panel>

      <Panel title="Contacto" bodyClassName="bo-stack" data-ui="config-contacto-main-panel" data-slot="config-contacto-panel">
          <div className="bo-field" data-ui="config-contacto-address-field" data-slot="config-contacto-address-field">
            <label className="bo-label" htmlFor="config-contacto-direccion" data-slot="configContacto-label">
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

          <div className="bo-field" data-ui="config-contacto-phone-field" data-slot="config-contacto-phone-field">
            <label className="bo-label" htmlFor="config-contacto-telefono" data-slot="configContacto-label">
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

          <div className="bo-field" data-ui="config-contacto-email-field" data-slot="config-contacto-email-field">
            <label className="bo-label" htmlFor="config-contacto-email" data-slot="configContacto-label">
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


        <p className="bo-help" data-slot="config-contacto-email-helper">
          Estos datos aparecen en el email de confirmación.
        </p>
          <EmailProviderConfigInner
            config={emailProv.config}
            setField={emailProv.setField as (key: string, value: unknown) => void}
            save={emailProv.save}
            load={emailProv.load}
            saving={emailProv.saving}
            pushToast={pushToast as (t: { kind: "success" | "error" | "info" | "warning"; title: string; message?: string }) => void}
          />
      </Panel>

      <Panel title="Información fiscal" meta="Datos para facturación" bodyClassName="bo-stack" data-ui="config-contacto-fiscal-panel" data-slot="config-contacto-fiscal-panel">
          <div className="bo-field" data-ui="config-contacto-cif-field" data-slot="config-contacto-cif-field">
            <label className="bo-label" htmlFor="config-contacto-cif" data-slot="configContacto-label">
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

          <div className="bo-field" data-ui="config-contacto-billing-address-field" data-slot="config-contacto-billing-address-field">
            <label className="bo-label" htmlFor="config-contacto-dir-fact" data-slot="configContacto-label">
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

          <div className="bo-field" data-ui="config-contacto-clasificacion-field" data-slot="config-contacto-clasificacion-field">
            <div className="bo-label" data-slot="configContacto-label">Clasificación</div>
            <Select
              value={info.clasificacion}
              onChange={handleClasificacion}
              options={clasificacionOptions}
              size="sm"
              disabled={busy}
              ariaLabel="Clasificación fiscal"
            />
          </div>
      </Panel>
    </>
  );
}
