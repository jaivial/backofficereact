import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CircleAlert, CheckCircle2, ImagePlus, Loader2, Upload } from "lucide-react";

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
import { WhatsAppConnection, type ConnState } from "../WhatsAppConnection/WhatsAppConnection";
import { BookingNotifications } from "../BookingNotifications/BookingNotifications";

function normalizeWebsiteInput(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/^https:\/\//i.test(trimmed)) return trimmed;
  if (/^http:\/\//i.test(trimmed)) return trimmed.replace(/^http:\/\//i, "https://");
  return `https://${trimmed}`;
}

export function ConfigContactoContent({ initialInfo, busy, setBusy, setError, api, pushToast }: ContactoContentProps) {
  const [info, setInfo] = useState<RestaurantInfo>(initialInfo);
  const [savedInfo, setSavedInfo] = useState<RestaurantInfo>(initialInfo);
  const [savedBrandName, setSavedBrandName] = useState<string | null>(null);
  const isFirstRender = useRef(true);
  const emailProv = useEmailProviderConfig();
  const branding = useBranding();
  const [logoPreviewNonce, setLogoPreviewNonce] = useState(0);
  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const [logoError, setLogoError] = useState(false);
  // Pairing state lifted from WhatsAppConnection so the notification panel can
  // stay hidden until the bot is actually paired (coordination id: bkg-wa-notif).
  const [whatsappState, setWhatsappState] = useState<ConnState>("loading");
  const [websiteCheck, setWebsiteCheck] = useState<"idle" | "loading" | "success" | "error">("idle");
  const websiteCheckRequest = useRef(0);

  useEffect(() => {
    const website = info.website.trim();
    const requestId = ++websiteCheckRequest.current;
    if (!website) {
      setWebsiteCheck("idle");
      return;
    }

    setWebsiteCheck("idle");
    const timer = window.setTimeout(async () => {
      setWebsiteCheck("loading");
      try {
        const res = await api.config.checkRestaurantWebsite(website);
        if (requestId !== websiteCheckRequest.current) return;
        setWebsiteCheck(res.success ? "success" : "error");
      } catch {
        if (requestId === websiteCheckRequest.current) setWebsiteCheck("error");
      }
    }, 500);

    return () => window.clearTimeout(timer);
  }, [api.config, info.website]);

  // Sync when initialInfo changes (e.g. after page reload)
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    setInfo(initialInfo);
    setSavedInfo(initialInfo);
  }, [initialInfo]);

  useEffect(() => {
    void branding.load();
  }, [branding.load]);

  // Capture the saved brand name once branding has loaded, so we can show a
  // Save button only when the field actually changed.
  useEffect(() => {
    if (branding.loaded && savedBrandName === null) {
      setSavedBrandName(branding.branding.brandName);
    }
  }, [branding.loaded, branding.branding.brandName, savedBrandName]);

  // Clear a stale image error whenever the logo URL changes.
  useEffect(() => {
    setLogoError(false);
  }, [branding.branding.logoUrl, logoPreviewNonce]);

  const saveSection = useCallback(
    async (fields: (keyof RestaurantInfo)[]) => {
      setError(null);
      setBusy(true);
      const patch = fields.reduce<Partial<RestaurantInfo>>((acc, f) => {
        (acc as Record<string, unknown>)[f] = info[f];
        return acc;
      }, {});
      try {
        const res = await api.config.setRestaurantInfo(patch);
        if (!res.success) {
          setError(readAPIMessage(res, "No se pudo guardar"));
          return;
        }
        // Advance the saved baseline for the patched fields. Use the server
        // echo when present so normalized values are reflected.
        const next = res.restaurantInfo ?? info;
        if (res.restaurantInfo) {
          setInfo((prev) => {
            const merged = { ...prev };
            for (const f of fields) (merged as Record<string, unknown>)[f] = next[f];
            return merged;
          });
        }
        setSavedInfo((prev) => {
          const merged = { ...prev };
          for (const f of fields) (merged as Record<string, unknown>)[f] = next[f];
          return merged;
        });
        pushToast({ kind: "success", title: "Guardado", message: "Cambios guardados" });
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo guardar");
      } finally {
        setBusy(false);
      }
    },
    [api.config, info, setError, setBusy, pushToast],
  );

  const handleBrandingField = useCallback(
    (field: "brandName", value: string) => {
      branding.setField(field, value);
    },
    [branding],
  );

  const handleBrandingSave = useCallback(async () => {
    const ok = await branding.save();
    if (ok) {
      setSavedBrandName(branding.branding.brandName);
      pushToast({ kind: "success", title: "Guardado", message: "Cambios guardados" });
    } else {
      pushToast({ kind: "error", title: "No se pudo guardar" });
    }
  }, [branding, pushToast]);

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

  const handleField = useCallback((field: keyof RestaurantInfo, value: string) => {
    setInfo((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleClasificacion = useCallback((value: string) => {
    setInfo((prev) => ({ ...prev, clasificacion: value as "persona_fisica" | "sociedad" }));
  }, []);

  const contactoFields: (keyof RestaurantInfo)[] = ["direccion", "telefono", "email", "website"];
  const fiscalFields: (keyof RestaurantInfo)[] = ["cif", "direccionFacturacion", "clasificacion"];
  const contactoDirty = contactoFields.some((f) => info[f] !== savedInfo[f]);
  const fiscalDirty = fiscalFields.some((f) => info[f] !== savedInfo[f]);

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
          {savedBrandName !== null && branding.branding.brandName !== savedBrandName ? (
            <div className="bo-brandingSaveRow" data-slot="brandname-save-row">
              <button
                type="button"
                className="bo-brandingSaveBtn"
                onClick={handleBrandingSave}
                disabled={busy || branding.saving}
                aria-label="Guardar nombre del restaurante"
                data-testid="config-contacto-brandname-save-btn"
              >
                {branding.saving ? "Guardando..." : "Guardar"}
              </button>
            </div>
          ) : null}
        </div>
        <div className="bo-field" data-ui="config-contacto-logo-field" data-slot="config-contacto-logo-field">
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
            <div data-slot="configContacto-brandingLogo-actions" className="bo-brandingLogo-actions">
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
            <span data-slot="configContacto-brandingLogo-hint" className="bo-brandingLogo-hint">PNG, JPG o WebP · se reduce a 50 KB automaticamente</span>
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

          <div className="bo-field bo-websiteField" data-ui="config-contacto-website-field" data-slot="config-contacto-website-field">
            <label className="bo-label" htmlFor="config-contacto-website" data-slot="configContacto-label">
              Dominio web del restaurante
            </label>
            <div data-slot="configContacto-inputWithStatus" className="bo-inputWithStatus">
              <input
                id="config-contacto-website"
                type="text"
                inputMode="url"
                className={`bo-input${websiteCheck === "error" ? " bo-input--error" : ""}`}
                value={info.website}
                onChange={(e) => handleField("website", e.target.value)}
                onBlur={(e) => handleField("website", normalizeWebsiteInput(e.target.value))}
                disabled={busy}
                placeholder="https://www.restaurante.com"
                aria-label="Dominio web del restaurante"
                data-testid="config-contacto-website-input"
              />
              <span data-slot="configContacto-span"
                className={`bo-inputStatus bo-inputStatus--${websiteCheck}`}
                aria-live="polite"
                aria-label={websiteCheck === "loading" ? "Comprobando web" : websiteCheck === "success" ? "Web válida" : websiteCheck === "error" ? "Web no válida" : undefined}
              >
                {websiteCheck === "loading" ? <Loader2 size={18} className="bo-spin" aria-hidden="true" /> : null}
                {websiteCheck === "success" ? <CheckCircle2 size={18} aria-hidden="true" /> : null}
                {websiteCheck === "error" ? <CircleAlert size={18} aria-hidden="true" /> : null}
              </span>
            </div>
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
          <div className="bo-sectionSaveRow" data-slot="config-contacto-save-row">
            {contactoDirty ? (
              <button
                type="button"
                className="bo-brandingSaveBtn"
                onClick={() => void saveSection(contactoFields)}
                disabled={busy}
                aria-label="Guardar datos de contacto"
                data-testid="config-contacto-save-btn"
              >
                {busy ? "Guardando..." : "Guardar"}
              </button>
            ) : null}
          </div>
      </Panel>

      <WhatsAppConnection onStateChange={setWhatsappState} />

      <BookingNotifications connected={whatsappState === "connected"} />

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
          <div className="bo-sectionSaveRow" data-slot="config-contacto-fiscal-save-row">
            {fiscalDirty ? (
              <button
                type="button"
                className="bo-brandingSaveBtn"
                onClick={() => void saveSection(fiscalFields)}
                disabled={busy}
                aria-label="Guardar información fiscal"
                data-testid="config-contacto-fiscal-save-btn"
              >
                {busy ? "Guardando..." : "Guardar"}
              </button>
            ) : null}
          </div>
      </Panel>
    </>
  );
}
