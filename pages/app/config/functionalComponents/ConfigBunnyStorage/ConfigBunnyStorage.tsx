import React, { useEffect } from "react";
import { Cloud, Save } from "lucide-react";

import { Switch } from "../../../../../ui/shadcn/Switch";
import { useToasts } from "../../../../../ui/feedback/useToasts";
import { useBunnyStorageConfig } from "./hooks/useBunnyStorageConfig";
import { InfoHint } from "./InfoHint";

export function ConfigBunnyStorage() {
  const { config, storageKey, setStorageKey, setField, load, save, loaded, saving } = useBunnyStorageConfig();
  const { pushToast } = useToasts();

  useEffect(() => { void load(); }, [load]);

  const onSave = async () => {
    const res = await save();
    pushToast(res.ok
      ? { kind: "success", title: "Credenciales CDN guardadas" }
      : { kind: "error", title: "Error", message: res.message || "No se pudieron guardar las credenciales" });
  };

  if (!loaded) {
    return <div className="bo-panel p-6 text-sm text-[var(--bo-muted)]" data-slot="config-cdn-loading">Cargando configuracion...</div>;
  }

  return (
    <div className="bo-panel" data-ui="config-bunny-storage" data-testid="config-bunny-storage">
      <div className="bo-panelHead flex-col items-stretch gap-1">
        <div className="bo-panelTitle flex items-center gap-2">
          <Cloud size={18} className="text-[var(--bo-accent)]" aria-hidden="true" />
          Almacenamiento CDN (BunnyCDN)
        </div>
        <div className="bo-panelMeta">
          Credenciales de la zona de BunnyCDN de este restaurante. Se usan para subir y servir las imagenes generadas con IA y las fotos de la carta.
        </div>
      </div>

      <div className="bo-panelBody flex flex-col gap-5">
        {config.usingEnvFallback ? (
          <div className="bo-panelMeta" data-slot="config-cdn-fallback-notice">
            Ahora mismo se usan las credenciales globales del servidor. Rellena los tres campos y activa el interruptor para que este restaurante use su propia zona.
          </div>
        ) : null}

        <div className="bo-field" data-slot="config-cdn-zone-field">
          <span className="bo-label flex items-center gap-1.5">
            <label htmlFor="cdn-zone">Zona de almacenamiento</label>
            <InfoHint title="Zona de almacenamiento">
              <p>El <strong>nombre</strong> de tu Storage Zone, no la URL.</p>
              <p>
                En BunnyCDN: <em>Storage &rsaquo; tu zona &rsaquo; FTP &amp; API Access</em>. Ahi veras
                el endpoint como <code>https://storage.bunnycdn.com/villacarmen</code> — aqui va solo la
                ultima parte, <code>villacarmen</code>.
              </p>
            </InfoHint>
          </span>
          <input
            type="text"
            autoComplete="off"
            className="bo-input"
            value={config.storageZone || ""}
            onChange={(e) => setField("storageZone", e.target.value)}
            id="cdn-zone"
            placeholder="villacarmen"
            disabled={saving}
            data-role="config-cdn-zone-input"
          />
        </div>

        <div className="bo-field" data-slot="config-cdn-key-field">
          <span className="bo-label flex items-center gap-1.5">
            <label htmlFor="cdn-key">Password</label>
            <InfoHint title="Password">
              <p>La contrasena de acceso de la Storage Zone, que hace de clave de API para subir ficheros.</p>
              <p>
                En BunnyCDN: <em>Storage &rsaquo; tu zona &rsaquo; FTP &amp; API Access</em>, campo
                <strong> Password</strong>. Usa la principal, no la de solo lectura, porque necesitamos escribir.
              </p>
              <p>Una vez guardada no se vuelve a mostrar: si la dejas en blanco se mantiene la que ya hay.</p>
            </InfoHint>
          </span>
          <input
            type="password"
            autoComplete="off"
            className="bo-input"
            id="cdn-key"
            value={storageKey}
            onChange={(e) => setStorageKey(e.target.value)}
            placeholder={config.hasStorageKey ? `Guardada (${config.storageKeyMask}) — escribe una nueva para cambiarla` : "Pega la password de la zona"}
            disabled={saving}
            data-role="config-cdn-key-input"
          />
        </div>

        <div className="bo-field" data-slot="config-cdn-pull-field">
          <span className="bo-label flex items-center gap-1.5">
            <label htmlFor="cdn-pull">Pull URL publica</label>
            <InfoHint title="Pull URL publica">
              <p>El dominio publico desde el que se sirven las imagenes a los clientes.</p>
              <p>
                En BunnyCDN: <em>CDN &rsaquo; tu Pull Zone &rsaquo; General</em>, el <strong>Hostname</strong>.
                Se escribe completo con <code>https://</code>, por ejemplo <code>https://villacarmenmedia.b-cdn.net</code>.
              </p>
              <p>La Pull Zone tiene que estar conectada a la Storage Zone de arriba, o las imagenes daran 404.</p>
            </InfoHint>
          </span>
          <input
            type="text"
            autoComplete="off"
            className="bo-input"
            value={config.pullBaseUrl || ""}
            onChange={(e) => setField("pullBaseUrl", e.target.value)}
            id="cdn-pull"
            placeholder="https://villacarmenmedia.b-cdn.net"
            disabled={saving}
            data-role="config-cdn-pull-input"
          />
        </div>

        <div className="bo-foodDetailQuickStatus" data-slot="config-cdn-active-field">
          <span className="bo-label flex items-center gap-1.5">
            Usar estas credenciales
            <InfoHint title="Usar estas credenciales">
              <p>
                Activado, este restaurante usa la zona de arriba. Desactivado, vuelve a las credenciales
                globales del servidor sin perder lo que hayas guardado.
              </p>
            </InfoHint>
          </span>
          <Switch
            checked={config.isActive}
            onCheckedChange={(v) => setField("isActive", v)}
            disabled={saving}
            aria-label="Usar estas credenciales"
          />
        </div>
      </div>

      <div className="bo-foodDetailEditorActions" data-slot="config-cdn-actions">
        <button
          type="button"
          className="bo-btn bo-btn--primary gap-2"
          onClick={() => void onSave()}
          disabled={saving}
          data-role="config-cdn-save-btn"
        >
          <Save size={14} />
          {saving ? "Guardando..." : "Guardar"}
        </button>
      </div>
    </div>
  );
}
