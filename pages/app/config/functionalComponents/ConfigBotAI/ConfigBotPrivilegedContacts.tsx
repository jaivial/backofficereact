import React, { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw, ShieldCheck, Users } from "lucide-react";

import type { BotPrivilegedContact, BotWhatsAppChat } from "../../../../../api/types";
import { useToasts } from "../../../../../ui/feedback/useToasts";

// Coordination id: wa_bot_privileged_contacts_v1
//
// The conversations of the connected WhatsApp that may run the full backoffice
// catalogue. The operator picks them here; every other conversation keeps the
// regular limits of the bot.

export type UsePrivilegedContactsReturn = {
  chats: BotWhatsAppChat[];
  selected: BotPrivilegedContact[];
  isSelected: (jid: string) => boolean;
  toggle: (chat: BotWhatsAppChat) => void;
  load: () => Promise<void>;
  save: () => Promise<{ ok: boolean; message?: string }>;
  loading: boolean;
  saving: boolean;
  error: string;
};

export function usePrivilegedContacts(restaurantId: number): UsePrivilegedContactsReturn {
  const [chats, setChats] = useState<BotWhatsAppChat[]>([]);
  const [selected, setSelected] = useState<BotPrivilegedContact[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!restaurantId) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/bot/ai/${restaurantId}/privileged-contacts`, {
        headers: { accept: "application/json" },
      });
      const data = await res.json().catch(() => null);
      if (!data) {
        setError("No se pudo leer el WhatsApp conectado");
        return;
      }
      setChats(Array.isArray(data.chats) ? data.chats : []);
      setSelected(Array.isArray(data.selected) ? data.selected : []);
      if (data.message) setError(data.message);
    } catch {
      setError("No se pudo leer el WhatsApp conectado");
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  useEffect(() => { void load(); }, [load]);

  const isSelected = useCallback(
    (jid: string) => selected.some((c) => c.jid === jid),
    [selected],
  );

  const toggle = useCallback((chat: BotWhatsAppChat) => {
    setSelected((prev) => {
      if (prev.some((c) => c.jid === chat.jid)) {
        return prev.filter((c) => c.jid !== chat.jid);
      }
      return [...prev, { jid: chat.jid, name: chat.name, isGroup: chat.isGroup }];
    });
  }, []);

  const save = useCallback(async (): Promise<{ ok: boolean; message?: string }> => {
    if (!restaurantId) return { ok: false };
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/bot/ai/${restaurantId}/privileged-contacts`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ contacts: selected }),
      });
      const data = await res.json().catch(() => null);
      if (!data?.success) {
        return { ok: false, message: data?.message ?? "No se pudo guardar" };
      }
      if (Array.isArray(data.selected)) setSelected(data.selected);
      return { ok: true };
    } catch {
      return { ok: false, message: "No se pudo guardar" };
    } finally {
      setSaving(false);
    }
  }, [restaurantId, selected]);

  return { chats, selected, isSelected, toggle, load, save, loading, saving, error };
}

export function ConfigBotPrivilegedContacts({ restaurantId }: { restaurantId: number }) {
  const { chats, selected, isSelected, toggle, load, save, loading, saving, error } = usePrivilegedContacts(restaurantId);
  const { pushToast } = useToasts();

  const groups = useMemo(() => chats.filter((c) => c.isGroup), [chats]);
  const contacts = useMemo(() => chats.filter((c) => !c.isGroup), [chats]);

  const onSave = async () => {
    const res = await save();
    pushToast(res.ok
      ? { kind: "success", title: "Conversaciones privilegiadas guardadas" }
      : { kind: "error", title: "Error", message: res.message || "No se pudo guardar" });
  };

  return (
    <div className="bo-panel" data-ui="config-bot-privileged-contacts" data-testid="config-bot-privileged-contacts">
      <div className="bo-panelHead flex-col items-stretch gap-1" data-testid="config-bot-privileged-contacts-head">
        <div className="bo-panelTitle flex items-center gap-2" data-testid="config-bot-privileged-contacts-title">
          <ShieldCheck size={18} strokeWidth={2} className="text-[var(--bo-accent)]" aria-hidden="true" />
          Conversaciones privilegiadas
        </div>
        <div className="bo-panelMeta" data-testid="config-bot-privileged-contacts-meta">
          En las conversaciones que elijas, el bot responde con todas las herramientas del backoffice (reservas, carta, stock, fichas, TPV...) y puede ejecutar operaciones de administración. En el resto se comporta con los límites habituales del bot.
        </div>
      </div>

      <div className="bo-panelBody flex flex-col gap-4" data-testid="config-bot-privileged-contacts-body">
        {error ? (
          <p className="bo-panelMeta" data-testid="config-bot-privileged-contacts-error">{error}</p>
        ) : null}

        <div className="flex items-center justify-between gap-2">
          <span className="bo-label flex items-center gap-1.5" data-testid="config-bot-privileged-contacts-count-label">
            <Users size={14} strokeWidth={1.5} aria-hidden="true" />
            {selected.length} seleccionada{selected.length === 1 ? "" : "s"}
          </span>
          <button type="button" className="bo-btn bo-btn--ghost gap-1.5 bo-pressable" onClick={() => void load()} disabled={loading || saving}
            data-testid="config-bot-privileged-contacts-refresh-btn">
            <RefreshCw size={14} strokeWidth={2} aria-hidden="true" /> Actualizar
          </button>
        </div>

        {loading && chats.length === 0 ? (
          <p className="bo-panelMeta" data-testid="config-bot-privileged-contacts-loading">Leyendo el WhatsApp conectado...</p>
        ) : null}

        {groups.length > 0 ? (
          <div className="flex flex-col gap-2" data-testid="config-bot-privileged-contacts-groups">
            <span className="bo-label" data-testid="config-bot-privileged-contacts-groups-label">Grupos</span>
            {groups.map((c) => (
              <ChatRow key={c.jid} chat={c} checked={isSelected(c.jid)} onToggle={() => toggle(c)} disabled={saving} />
            ))}
          </div>
        ) : null}

        {contacts.length > 0 ? (
          <div className="flex flex-col gap-2" data-testid="config-bot-privileged-contacts-contacts">
            <span className="bo-label" data-testid="config-bot-privileged-contacts-contacts-label">Contactos</span>
            {contacts.map((c) => (
              <ChatRow key={c.jid} chat={c} checked={isSelected(c.jid)} onToggle={() => toggle(c)} disabled={saving} />
            ))}
          </div>
        ) : null}

        {!loading && chats.length === 0 ? (
          <p className="bo-panelMeta" data-testid="config-bot-privileged-contacts-empty">
            No hay conversaciones en el WhatsApp conectado.
          </p>
        ) : null}
      </div>

      <div className="bo-foodDetailEditorActions" data-testid="config-bot-privileged-contacts-actions">
        <button type="button" className="bo-btn bo-btn--primary gap-2 bo-pressable" onClick={() => void onSave()} disabled={saving}
          data-testid="config-bot-privileged-contacts-save-btn">
          {saving ? "Guardando..." : "Guardar"}
        </button>
      </div>
    </div>
  );
}

function ChatRow({ chat, checked, onToggle, disabled }: {
  chat: BotWhatsAppChat;
  checked: boolean;
  onToggle: () => void;
  disabled: boolean;
}) {
  return (
    <label className="bo-field flex items-center gap-2 cursor-pointer" data-testid={`config-bot-privileged-contact-${chat.jid}`}>
      <input type="checkbox" checked={checked} onChange={onToggle} disabled={disabled} data-testid={`config-bot-privileged-contact-input-${chat.jid}`} />
      <span className="bo-label flex-1" data-testid={`config-bot-privileged-contact-label-${chat.jid}`}>
        {chat.name || chat.jid}
        {chat.isGroup ? " · grupo" : ""}
      </span>
      <span className="bo-panelMeta" data-testid={`config-bot-privileged-contact-jid-${chat.jid}`}>{chat.jid}</span>
    </label>
  );
}
