import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Accordion } from "../../../../../ui/overlays/Accordion";
import { Select } from "../../../../../ui/inputs/Select";

type EmailProviderConfigInnerProps = {
  config: {
    id: number;
    provider: "smtp" | "gmail";
    smtpHost: string;
    smtpPort: number;
    smtpUsername: string;
    smtpPassword: string;
    smtpFromEmail: string;
    smtpEncryption: "none" | "tls" | "ssl";
    gmailAppPassword: string;
    gmailFromEmail: string;
    isActive: boolean;
  };
  setField: (key: string, value: unknown) => void;
  save: () => Promise<boolean>;
  load: () => Promise<void>;
  saving: boolean;
  pushToast: (t: { kind: "success" | "error" | "info" | "warning"; title: string; message?: string }) => void;
};

const providerOptions = [
  { value: "smtp", label: "SMTP" },
  { value: "gmail", label: "Gmail" },
];

const encryptionOptions = [
  { value: "none", label: "Ninguno" },
  { value: "tls", label: "TLS" },
  { value: "ssl", label: "SSL" },
];

function EmailProviderConfigInner({ config, setField, save, load, saving, pushToast }: EmailProviderConfigInnerProps) {
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    void load();
  }, []);

  const isSmtp = config.provider === "smtp";

  const isValid = useMemo(() => {
    if (isSmtp) {
      return (
        config.smtpHost.trim() !== "" &&
        config.smtpPort > 0 &&
        config.smtpUsername.trim() !== "" &&
        config.smtpPassword.trim() !== "" &&
        config.smtpFromEmail.trim() !== ""
      );
    }
    return config.gmailFromEmail.trim() !== "" && config.gmailAppPassword.trim() !== "";
  }, [isSmtp, config]);

  const handleField = useCallback(
    (field: string, value: unknown) => {
      setField(field, value);
      setDirty(true);
    },
    [setField],
  );

  const handleSave = useCallback(async () => {
    const ok = await save();
    if (ok) {
      setDirty(false);
      pushToast({ kind: "success", title: "Guardado", message: "Configuración de email guardada" });
    }
  }, [save, pushToast]);

  return (
    <Accordion title="Configuración proveedor de email" data-slot="email-config-accordion">
      <div className="bo-stack" data-slot="email-config-body">
        <div className="bo-field" data-slot="provider-field">
          <div className="bo-label" data-slot="provider-label">
            Proveedor de mensajería email
          </div>
          <Select
            value={config.provider}
            onChange={(v) => handleField("provider", v)}
            options={providerOptions}
            size="sm"
            ariaLabel="Proveedor de mensajería email"
            data-testid="email-provider-select"
          />
        </div>

        {isSmtp ? (
          <div className="bo-stack" data-slot="smtp-fields">
            <div className="bo-field" data-slot="smtp-host-field">
              <label className="bo-label" htmlFor="email-smtp-host" data-slot="smtp-host-label">
                Host SMTP
              </label>
              <input
                id="email-smtp-host"
                type="text"
                className="bo-input"
                value={config.smtpHost}
                onChange={(e) => handleField("smtpHost", e.target.value)}
                placeholder="smtp.gmail.com"
                disabled={saving}
                data-testid="email-smtp-host"
              />
            </div>

            <div className="bo-field" data-slot="smtp-port-field">
              <label className="bo-label" htmlFor="email-smtp-port" data-slot="smtp-port-label">
                Puerto
              </label>
              <input
                id="email-smtp-port"
                type="number"
                min={1}
                max={65535}
                className="bo-input"
                value={config.smtpPort}
                onChange={(e) => handleField("smtpPort", parseInt(e.target.value, 10) || 0)}
                placeholder="587"
                disabled={saving}
                data-testid="email-smtp-port"
              />
            </div>

            <div className="bo-field" data-slot="smtp-username-field">
              <label className="bo-label" htmlFor="email-smtp-user" data-slot="smtp-username-label">
                Usuario SMTP
              </label>
              <input
                id="email-smtp-user"
                type="text"
                className="bo-input"
                value={config.smtpUsername}
                onChange={(e) => handleField("smtpUsername", e.target.value)}
                placeholder="usuario@dominio.com"
                disabled={saving}
                data-testid="email-smtp-username"
              />
            </div>

            <div className="bo-field" data-slot="smtp-pass-field">
              <label className="bo-label" htmlFor="email-smtp-pass" data-slot="smtp-pass-label">
                Contraseña SMTP
              </label>
              <input
                id="email-smtp-pass"
                type="password"
                className="bo-input"
                value={config.smtpPassword}
                onChange={(e) => handleField("smtpPassword", e.target.value)}
                placeholder="••••••••"
                disabled={saving}
                data-testid="email-smtp-password"
              />
            </div>

            <div className="bo-field" data-slot="smtp-encrypt-field">
              <div className="bo-label" data-slot="smtp-encrypt-label">
                Encriptación
              </div>
              <Select
                value={config.smtpEncryption}
                onChange={(v) => handleField("smtpEncryption", v)}
                options={encryptionOptions}
                size="sm"
                ariaLabel="Encriptación SMTP"
                data-testid="email-smtp-encryption"
              />
            </div>

            <div className="bo-field" data-slot="smtp-from-field">
              <label className="bo-label" htmlFor="email-smtp-from" data-slot="smtp-from-label">
                Email remitente
              </label>
              <input
                id="email-smtp-from"
                type="email"
                className="bo-input"
                value={config.smtpFromEmail}
                onChange={(e) => handleField("smtpFromEmail", e.target.value)}
                placeholder="noreply@restaurante.com"
                disabled={saving}
                data-testid="email-smtp-from"
              />
            </div>
          </div>
        ) : (
          <div className="bo-stack" data-slot="gmail-fields">
            <div className="bo-field" data-slot="gmail-email-field">
              <label className="bo-label" htmlFor="email-gmail-address" data-slot="gmail-email-label">
                Cuenta Gmail
              </label>
              <input
                id="email-gmail-address"
                type="email"
                className="bo-input"
                value={config.gmailFromEmail}
                onChange={(e) => handleField("gmailFromEmail", e.target.value)}
                placeholder="restaurante@gmail.com"
                disabled={saving}
                data-testid="email-gmail-from"
              />
            </div>

            <div className="bo-field" data-slot="gmail-app-pass-field">
              <label className="bo-label" htmlFor="email-gmail-app-pass" data-slot="gmail-app-pass-label">
                Contraseña de aplicación Google
              </label>
              <input
                id="email-gmail-app-pass"
                type="password"
                className="bo-input"
                value={config.gmailAppPassword}
                onChange={(e) => handleField("gmailAppPassword", e.target.value)}
                placeholder="••••••••••••"
                disabled={saving}
                data-testid="email-gmail-app-password"
              />
              <div className="bo-fieldHint" data-slot="gmail-hint">
                Generada en{" "}
                <a
                  href="https://myaccount.google.com/apppasswords"
                  target="_blank"
                  rel="noopener noreferrer"
                  data-slot="gmail-link"
                >
                  Google App Passwords
                </a>
              </div>
            </div>
          </div>
        )}

        <div className={`bo-configRow${dirty ? "" : " is-disabled"}`} data-slot="save-row">
          <button
            type="button"
            className="bo-btn bo-btn--primary"
            disabled={!isValid || saving}
            onClick={handleSave}
            data-testid="email-save-button"
          >
            {saving ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </div>
    </Accordion>
  );
}

export default EmailProviderConfigInner;
