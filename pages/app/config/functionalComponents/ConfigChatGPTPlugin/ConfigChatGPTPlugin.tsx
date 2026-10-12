import React, { useCallback, useState } from "react";
import { Bot, Copy, Check, KeyRound, Ban, AlertTriangle } from "lucide-react";

import { useToasts } from "../../../../../ui/feedback/useToasts";
import { InlineAlert } from "../../../../../ui/feedback/InlineAlert";
import { useChatGPTPluginTokens } from "./hooks/useChatGPTPluginTokens";

/**
 * ConfigChatGPTPlugin issues and revokes the ChatGPT connector credentials for
 * the active restaurant. The token inherits the signed-in user's own role, so
 * a token issued here can never reach further than the person who made it.
 */
export function ConfigChatGPTPlugin() {
  const { pushToast } = useToasts();
  const {
    tokens, manifestUrl, label, setLabel, issuedToken, clearIssuedToken,
    load, issue, revoke, loaded, busy, error,
  } = useChatGPTPluginTokens();
  const [copied, setCopied] = useState<"token" | "manifest" | null>(null);

  const onIssue = useCallback(async () => {
    const ok = await issue();
    pushToast(ok
      ? { kind: "success", title: "Token creado", message: "Copiallo ahora: no se volvera a mostrar." }
      : { kind: "error", title: "Error", message: "No se pudo crear el token" });
  }, [issue, pushToast]);

  const onRevoke = useCallback(async () => {
    const n = await revoke();
    pushToast(n > 0
      ? { kind: "success", title: "Tokens revocados", message: `Se revocaron ${n} token(s).` }
      : { kind: "error", title: "Error", message: "No se pudieron revocar los tokens" });
  }, [revoke, pushToast]);

  const onCopy = useCallback(async (value: string, which: "token" | "manifest") => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(which);
      window.setTimeout(() => setCopied(null), 1800);
    } catch {
      pushToast({ kind: "error", title: "Copiar", message: "No se pudo copiar al portapapeles" });
    }
  }, [pushToast]);

  if (!loaded) {
    return <div className="bo-panel p-6 text-sm text-[var(--bo-muted)]" data-slot="config-chatgpt-plugin-loading">Cargando configuración...</div>;
  }

  const active = tokens.filter((t) => t.active);

  return (
    <div className="bo-panel" data-ui="config-chatgpt-plugin" data-testid="config-chatgpt-plugin">
      <div data-slot="configChatGPTPlugin-gap-1" className="bo-panelHead flex-col items-stretch gap-1">
        <div data-slot="configChatGPTPlugin-gap-2" className="bo-panelTitle flex items-center gap-2">
          <Bot size={18} className="text-[var(--bo-accent)]" aria-hidden="true" />
          Conectar ChatGPT
        </div>
        <div data-slot="configChatGPTPlugin-panelMeta" className="bo-panelMeta">
          Crea una credencial para que ChatGPT pueda consultar y gestionar este restaurante con tus mismos permisos.
        </div>
      </div>

      <div data-slot="configChatGPTPlugin-gap-5" className="bo-panelBody flex flex-col gap-5">
        {error ? <InlineAlert kind="error" title="Error" message={error} testId="config-chatgpt-error" /> : null}

        {issuedToken ? (
          <div className="bo-field" data-slot="config-chatgpt-issued-field">
            <span data-slot="configChatGPTPlugin-label" className="bo-label flex items-center gap-2">
              <KeyRound size={14} className="text-[var(--bo-accent)]" aria-hidden="true" />
              Tu token (solo se muestra ahora)
            </span>
            <div className="bo-install-code flex items-center gap-2" data-slot="config-chatgpt-issued-row">
              <code className="flex-1" data-testid="config-chatgpt-issued-token">{issuedToken}</code>
              <button
                type="button"
                className="bo-btn bo-btn--primary gap-2"
                onClick={() => void onCopy(issuedToken, "token")}
                data-testid="config-chatgpt-copy-token"
              >
                {copied === "token" ? <Check size={14} /> : <Copy size={14} />}
                {copied === "token" ? "Copiado" : "Copiar"}
              </button>
            </div>
            <span data-slot="configChatGPTPlugin-hint" className="bo-label flex items-center gap-2">
              <AlertTriangle size={14} className="text-[var(--bo-accent)]" aria-hidden="true" />
              En ChatGPT: crea un GPT, ve a Configure, Actions, anade el plugin y pega este token como autenticacion bearer.
            </span>
            <button
              type="button"
              className="bo-btn gap-2 self-start"
              onClick={clearIssuedToken}
              data-testid="config-chatgpt-dismiss-token"
            >
              Entendido, lo he guardado
            </button>
          </div>
        ) : null}

        <div className="bo-field" data-slot="config-chatgpt-manifest-field">
          <span data-slot="configChatGPTPlugin-label" className="bo-label">URL del manifiesto</span>
          <div className="bo-install-code flex items-center gap-2" data-slot="config-chatgpt-manifest-row">
            <code className="flex-1" data-testid="config-chatgpt-manifest-url">{manifestUrl}</code>
            <button
              type="button"
              className="bo-btn gap-2"
              onClick={() => void onCopy(manifestUrl, "manifest")}
              data-testid="config-chatgpt-copy-manifest"
            >
              {copied === "manifest" ? <Check size={14} /> : <Copy size={14} />}
              {copied === "manifest" ? "Copiado" : "Copiar"}
            </button>
          </div>
        </div>

        <label className="bo-field" data-slot="config-chatgpt-label-field">
          <span data-slot="configChatGPTPlugin-label" className="bo-label">Nombre del token (opcional)</span>
          <input
            type="text"
            className="bo-input"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Ej. Conector ChatGPT de Jaime"
            disabled={busy}
            data-testid="config-chatgpt-label-input"
          />
        </label>
      </div>

      <div className="bo-foodDetailEditorActions" data-slot="config-chatgpt-actions">
        <button
          type="button"
          className="bo-btn bo-btn--primary gap-2"
          onClick={() => void onIssue()}
          disabled={busy}
          data-testid="config-chatgpt-issue-btn"
        >
          <KeyRound size={14} />
          {busy ? "Trabajando..." : "Crear token"}
        </button>
        <button
          type="button"
          className="bo-btn gap-2"
          onClick={() => void onRevoke()}
          disabled={busy || active.length === 0}
          data-testid="config-chatgpt-revoke-btn"
        >
          <Ban size={14} />
          Revocar todos
        </button>
      </div>

      <div data-slot="config-chatgpt-list" className="bo-panelBody flex flex-col gap-2">
        <span data-slot="configChatGPTPlugin-label" className="bo-label">
          Tokens de este restaurante ({active.length} activo(s), {tokens.length} en total)
        </span>
        {tokens.length === 0 ? (
          <span data-slot="config-chatgpt-empty" className="bo-label" data-testid="config-chatgpt-empty">
            Todavia no hay tokens. Crea uno para conectar ChatGPT.
          </span>
        ) : (
          <ul data-slot="config-chatgpt-token-list" className="bo-stack" data-testid="config-chatgpt-token-list">
            {tokens.map((t) => (
              <li
                key={t.id}
                data-slot="config-chatgpt-token-item"
                className="bo-foodDetailQuickStatus"
                data-testid={`config-chatgpt-token-item-${t.id}`}
              >
                <span data-slot="configChatGPTPlugin-label" className="bo-label">
                  {t.label || `Token #${t.id}`} — {t.active ? "activo" : "revocado"}
                </span>
                <span data-slot="config-chatgpt-token-meta" className="bo-label">
                  Creado {t.created_at}
                  {t.last_used_at ? ` · ultimo uso ${t.last_used_at}` : " · sin uso"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
