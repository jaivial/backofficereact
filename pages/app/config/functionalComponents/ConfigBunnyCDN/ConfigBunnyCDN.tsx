import React, { useCallback, useEffect, useMemo, useState } from "react";

import type { createClient } from "../../../../../api/client";
import type { BunnyCDNConfig, BunnyCDNConfigInput } from "../../../../../api/types";

type BunnyApi = ReturnType<typeof createClient>;
type Toast = (toast: { kind: "success" | "error" | "info"; title: string; message?: string }) => void;

type Props = {
  api: BunnyApi;
  pushToast: Toast;
};

type FormState = BunnyCDNConfigInput;

const emptyForm: FormState = {
  publicPullBaseUrl: "",
  publicStorageZone: "",
  publicStorageAccessKey: "",
  memberPullBaseUrl: "",
  memberStorageZone: "",
  memberStorageAccessKey: "",
  privateStorageZone: "",
  privateStorageAccessKey: "",
};

function fieldValue(form: FormState, key: keyof FormState): string {
  return form[key] ?? "";
}

function profileComplete(values: string[], hasKey: boolean): boolean {
  return values.every((value) => value.trim() !== "") && hasKey;
}

function Field({ label, id, value, type = "text", placeholder, disabled, onChange }: { label: string; id: string; value: string; type?: string; placeholder: string; disabled: boolean; onChange: (value: string) => void }) {
  return (
    <label className="flex flex-col gap-2" htmlFor={id} data-ui="bunny-field">
      <span className="text-sm font-medium text-bo-text" data-ui="bunny-field-label">{label}</span>
      <input
        id={id}
        type={type}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-10 rounded-bo-sm border border-bo-border-2 bg-bo-surface-2 px-3 text-sm text-bo-text placeholder:text-bo-faint focus-visible:outline-2 focus-visible:outline-bo-accent disabled:cursor-not-allowed disabled:opacity-60"
        data-testid={id}
        data-ui="bunny-field-input"
      />
    </label>
  );
}

function ProfileStatus({ configured, label }: { configured: boolean; label: string }) {
  return (
    <span className={configured ? "text-bo-text-success" : "text-bo-text-warning"} data-ui="bunny-profile-status">
      {configured ? `${label}: configurado` : `${label}: pendiente`}
    </span>
  );
}

export function ConfigBunnyCDN({ api, pushToast }: Props) {
  const [config, setConfig] = useState<BunnyCDNConfig | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api.config.getBunnyCDNConfig();
      if (!result.success) throw new Error(result.message);
      setConfig(result.config);
      setForm({
        publicPullBaseUrl: result.config.publicPullBaseUrl,
        publicStorageZone: result.config.publicStorageZone,
        publicStorageAccessKey: "",
        memberPullBaseUrl: result.config.memberPullBaseUrl,
        memberStorageZone: result.config.memberStorageZone,
        memberStorageAccessKey: "",
        privateStorageZone: result.config.privateStorageZone,
        privateStorageAccessKey: "",
      });
      setDirty(false);
    } catch (error) {
      pushToast({ kind: "error", title: "No se pudo cargar BunnyCDN", message: error instanceof Error ? error.message : "Error desconocido" });
    } finally {
      setLoading(false);
    }
  }, [api.config, pushToast]);

  useEffect(() => { void load(); }, [load]);

  const update = useCallback((key: keyof FormState, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
    setDirty(true);
  }, []);

  const publicComplete = useMemo(() => profileComplete([fieldValue(form, "publicPullBaseUrl"), fieldValue(form, "publicStorageZone")], Boolean(config?.hasPublicStorageAccessKey || fieldValue(form, "publicStorageAccessKey"))), [config, form]);
  const memberComplete = useMemo(() => profileComplete([fieldValue(form, "memberPullBaseUrl"), fieldValue(form, "memberStorageZone")], Boolean(config?.hasMemberStorageAccessKey || fieldValue(form, "memberStorageAccessKey"))), [config, form]);
  const privateComplete = useMemo(() => profileComplete([fieldValue(form, "privateStorageZone")], Boolean(config?.hasPrivateStorageAccessKey || fieldValue(form, "privateStorageAccessKey"))), [config, form]);

  const save = useCallback(async () => {
    setSaving(true);
    try {
      const result = await api.config.setBunnyCDNConfig(form);
      if (!result.success) throw new Error(result.message);
      setConfig(result.config);
      setForm((current) => ({ ...current, publicStorageAccessKey: "", memberStorageAccessKey: "", privateStorageAccessKey: "" }));
      setDirty(false);
      pushToast({ kind: "success", title: "BunnyCDN guardado", message: "La configuración se guardó para el restaurante activo" });
    } catch (error) {
      pushToast({ kind: "error", title: "No se pudo guardar BunnyCDN", message: error instanceof Error ? error.message : "Error desconocido" });
    } finally {
      setSaving(false);
    }
  }, [api.config, form, pushToast]);

  if (loading && !config) {
    return <section className="rounded-bo-lg border border-bo-border bg-bo-surface p-5 text-sm text-bo-muted" aria-label="Configuración BunnyCDN" data-testid="bunnycdn-config-loading" data-ui="bunny-config-loading">Cargando configuración BunnyCDN...</section>;
  }

  return (
    <section className="flex flex-col gap-5 rounded-bo-lg border border-bo-border bg-bo-surface p-5 shadow-sm" aria-label="Configuración BunnyCDN" data-testid="bunnycdn-config-section" data-ui="bunny-config-section">
      <header className="flex flex-col gap-1" data-ui="bunny-config-header">
        <h2 className="text-lg font-semibold text-bo-text" data-ui="bunny-config-title">Almacenamiento BunnyCDN</h2>
        <p className="text-sm leading-relaxed text-bo-muted" data-ui="bunny-config-description">Las credenciales se guardan de forma independiente para cada restaurante. Los campos de clave vacíos conservan la clave almacenada.</p>
      </header>

      <div className="grid gap-4 rounded-bo-md border border-bo-border bg-bo-surface-2 p-4" data-ui="bunny-public-profile">
        <div className="flex items-center justify-between gap-3" data-ui="bunny-public-heading">
          <h3 className="font-semibold text-bo-text" data-ui="bunny-public-title">Media pública</h3>
          <ProfileStatus configured={publicComplete} label="Media pública" />
        </div>
        <p className="text-sm text-bo-muted" data-ui="bunny-public-help">Menús, imágenes de platos, logos, facturas, web y mejoras de imagen IA.</p>
        <div className="grid gap-4 md:grid-cols-2" data-ui="bunny-public-fields">
          <Field label="Pull base URL" id="bunny-public-pull-url" value={fieldValue(form, "publicPullBaseUrl")} placeholder="https://media.b-cdn.net" disabled={saving} onChange={(value) => update("publicPullBaseUrl", value)} />
          <Field label="Storage zone" id="bunny-public-zone" value={fieldValue(form, "publicStorageZone")} placeholder="restaurant-media" disabled={saving} onChange={(value) => update("publicStorageZone", value)} />
          <Field label={config?.hasPublicStorageAccessKey ? `Access key (actual ${config.publicStorageAccessKeyMask ?? "configurada"})` : "Access key"} id="bunny-public-key" type="password" value={fieldValue(form, "publicStorageAccessKey")} placeholder="••••••••" disabled={saving} onChange={(value) => update("publicStorageAccessKey", value)} />
        </div>
      </div>

      <div className="grid gap-4 rounded-bo-md border border-bo-border bg-bo-surface-2 p-4" data-ui="bunny-member-profile">
        <div className="flex items-center justify-between gap-3" data-ui="bunny-member-heading">
          <h3 className="font-semibold text-bo-text" data-ui="bunny-member-title">Avatares de miembros</h3>
          <ProfileStatus configured={memberComplete} label="Avatares" />
        </div>
        <p className="text-sm text-bo-muted" data-ui="bunny-member-help">Usa una zona separada para las fotos de miembros y usuarios.</p>
        <div className="grid gap-4 md:grid-cols-2" data-ui="bunny-member-fields">
          <Field label="Pull base URL" id="bunny-member-pull-url" value={fieldValue(form, "memberPullBaseUrl")} placeholder="https://members.b-cdn.net" disabled={saving} onChange={(value) => update("memberPullBaseUrl", value)} />
          <Field label="Storage zone" id="bunny-member-zone" value={fieldValue(form, "memberStorageZone")} placeholder="restaurant-members" disabled={saving} onChange={(value) => update("memberStorageZone", value)} />
          <Field label={config?.hasMemberStorageAccessKey ? `Access key (actual ${config.memberStorageAccessKeyMask ?? "configurada"})` : "Access key"} id="bunny-member-key" type="password" value={fieldValue(form, "memberStorageAccessKey")} placeholder="••••••••" disabled={saving} onChange={(value) => update("memberStorageAccessKey", value)} />
        </div>
      </div>

      <div className="grid gap-4 rounded-bo-md border border-bo-border bg-bo-surface-2 p-4" data-ui="bunny-private-profile">
        <div className="flex items-center justify-between gap-3" data-ui="bunny-private-heading">
          <h3 className="font-semibold text-bo-text" data-ui="bunny-private-title">Documentos privados</h3>
          <ProfileStatus configured={privateComplete} label="Documentos privados" />
        </div>
        <p className="text-sm text-bo-muted" data-ui="bunny-private-help">Almacenamiento privado para documentos originales de stock. No se publica ninguna URL.</p>
        <div className="grid gap-4 md:grid-cols-2" data-ui="bunny-private-fields">
          <Field label="Storage zone" id="bunny-private-zone" value={fieldValue(form, "privateStorageZone")} placeholder="restaurant-private" disabled={saving} onChange={(value) => update("privateStorageZone", value)} />
          <Field label={config?.hasPrivateStorageAccessKey ? `Access key (actual ${config.privateStorageAccessKeyMask ?? "configurada"})` : "Access key"} id="bunny-private-key" type="password" value={fieldValue(form, "privateStorageAccessKey")} placeholder="••••••••" disabled={saving} onChange={(value) => update("privateStorageAccessKey", value)} />
        </div>
      </div>

      <div className="flex items-center justify-between gap-3" data-ui="bunny-config-actions">
        <button type="button" className="min-h-10 rounded-bo-sm border border-bo-border-2 px-4 text-sm font-medium text-bo-text hover:bg-bo-surface-2 focus-visible:outline-2 focus-visible:outline-bo-accent disabled:cursor-not-allowed disabled:opacity-60" onClick={() => void load()} disabled={saving || loading} data-testid="bunnycdn-reload-button" data-ui="bunny-reload-button">Recargar</button>
        <button type="button" className="min-h-10 rounded-bo-sm bg-bo-accent px-4 text-sm font-semibold text-bo-bg hover:brightness-105 focus-visible:outline-2 focus-visible:outline-bo-accent disabled:cursor-not-allowed disabled:opacity-60" onClick={() => void save()} disabled={!dirty || saving} data-testid="bunnycdn-save-button" data-ui="bunny-save-button">{saving ? "Guardando..." : "Guardar configuración"}</button>
      </div>
    </section>
  );
}
