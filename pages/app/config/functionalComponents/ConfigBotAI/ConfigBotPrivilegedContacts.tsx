import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, RefreshCw, Search, ShieldCheck, UserPlus, Users } from "lucide-react";

import type { BotPrivilegedContact, BotWhatsAppChat } from "../../../../../api/types";
import { useToasts } from "../../../../../ui/feedback/useToasts";

// Coordination id: wa_bot_privileged_contacts_v1 / wa_bot_privileged_contacts_v2
//
// The conversations of the connected WhatsApp that may run the full backoffice
// catalogue. The operator picks them here; every other conversation keeps the
// regular limits of the bot.
//
// v2: the list is searched and paged SERVER-SIDE (GET ?q=&page=&count=) and a
// phone number can be added by hand (POST {phone, name}) even before the
// conversation exists in the provider chat list; the high is immediate.

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 350;

export type UsePrivilegedContactsReturn = {
  chats: BotWhatsAppChat[];
  selected: BotPrivilegedContact[];
  search: string;
  applySearch: (q: string) => void;
  page: number;
  total: number;
  hasMore: boolean;
  goToPage: (page: number) => void;
  isSelected: (jid: string) => boolean;
  toggle: (chat: BotWhatsAppChat) => void;
  load: () => Promise<void>;
  save: () => Promise<{ ok: boolean; message?: string }>;
  addPhone: (phone: string, name: string) => Promise<{ ok: boolean; message?: string }>;
  loading: boolean;
  saving: boolean;
  adding: boolean;
  error: string;
};

export function usePrivilegedContacts(restaurantId: number): UsePrivilegedContactsReturn {
  const [chats, setChats] = useState<BotWhatsAppChat[]>([]);
  const [selected, setSelected] = useState<BotPrivilegedContact[]>([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");

  // Last-write-wins: every request carries a sequence token and only the most
  // recent one may touch the state, so a slow provider answer can never
  // overwrite a newer page/search result (PR review 685, blocker 1).
  const seqRef = useRef(0);
  const inflightRef = useRef(0);

  const readChats = useCallback(async (nextPage: number, q: string, withSelected: boolean) => {
    if (!restaurantId) return;
    const seq = ++seqRef.current;
    inflightRef.current += 1;
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ page: String(nextPage), count: String(PAGE_SIZE) });
      if (q.trim()) params.set("q", q.trim());
      const res = await fetch(`/api/admin/bot/ai/${restaurantId}/privileged-contacts?${params}`, {
        headers: { accept: "application/json" },
      });
      const data = await res.json().catch(() => null);
      if (seq !== seqRef.current) return;
      if (!data) {
        setError("No se pudo leer el WhatsApp conectado");
        return;
      }
      setChats(Array.isArray(data.chats) ? data.chats : []);
      setTotal(Number.isFinite(data.total) ? data.total : Array.isArray(data.chats) ? data.chats.length : 0);
      setPage(Number.isFinite(data.page) && data.page > 0 ? data.page : nextPage);
      setHasMore(Boolean(data.has_more));
      // Paging or searching must not discard unsaved toggles: only a full
      // load (mount + Actualizar) re-syncs the selection from the server.
      if (withSelected && Array.isArray(data.selected)) setSelected(data.selected);
      if (data.message) setError(data.message);
    } catch {
      if (seq !== seqRef.current) return;
      setError("No se pudo leer el WhatsApp conectado");
    } finally {
      inflightRef.current -= 1;
      // The counter is the source of truth for the spinner: even a superseded
      // response must clear it when it is the last one in flight.
      setLoading(inflightRef.current > 0);
    }
  }, [restaurantId]);

  const fetchPage = useCallback(async (nextPage: number, q: string) => {
    await readChats(nextPage, q, false);
  }, [readChats]);

  const load = useCallback(async () => {
    await readChats(page, search, true);
  }, [readChats, page, search]);

  useEffect(() => { void readChats(1, "", true); }, [readChats]);

  // A different restaurant starts from a clean search/page slate, otherwise
  // the previous tenant's query would filter the new one's list invisibly
  // (PR review 685, blocker 2).
  useEffect(() => {
    setSearch("");
    setPage(1);
    setTotal(0);
    setHasMore(false);
  }, [restaurantId]);

  const applySearch = useCallback((q: string) => {
    setSearch(q);
    void fetchPage(1, q);
  }, [fetchPage]);

  const goToPage = useCallback((next: number) => {
    void fetchPage(Math.max(1, next), search);
  }, [fetchPage, search]);

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

  const addPhone = useCallback(async (phone: string, name: string): Promise<{ ok: boolean; message?: string }> => {
    if (!restaurantId) return { ok: false };
    setAdding(true);
    try {
      const res = await fetch(`/api/admin/bot/ai/${restaurantId}/privileged-contacts`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone: phone.trim(), name: name.trim() }),
      });
      const data = await res.json().catch(() => null);
      if (!data?.success) {
        return { ok: false, message: data?.message ?? "No se pudo añadir el número" };
      }
      // Union merge: the stored list plus any unsaved local toggles.
      setSelected((prev) => {
        const byJid = new Map(prev.map((c) => [c.jid, c]));
        for (const c of Array.isArray(data.selected) ? data.selected : []) byJid.set(c.jid, c);
        return [...byJid.values()];
      });
      await fetchPage(page, search);
      return { ok: true };
    } catch {
      return { ok: false, message: "No se pudo añadir el número" };
    } finally {
      setAdding(false);
    }
  }, [restaurantId, page, search, fetchPage]);

  return {
    chats, selected, search, applySearch, page, total, hasMore, goToPage,
    isSelected, toggle, load, save, addPhone, loading, saving, adding, error,
  };
}

export function ConfigBotPrivilegedContacts({ restaurantId }: { restaurantId: number }) {
  const {
    chats, selected, search, applySearch, page, total, hasMore, goToPage,
    isSelected, toggle, load, save, addPhone, loading, saving, adding, error,
  } = usePrivilegedContacts(restaurantId);
  const { pushToast } = useToasts();
  const [searchInput, setSearchInput] = useState("");
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");

  // Debounced server-side search (wa_bot_privileged_contacts_v2 ?q=).
  useEffect(() => {
    const t = setTimeout(() => {
      if (searchInput !== search) applySearch(searchInput);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [searchInput, search, applySearch]);

  // Keep the visible search text in sync with the hook's slate when the
  // restaurant changes (PR review 685, blocker 2).
  useEffect(() => { setSearchInput(""); }, [restaurantId]);

  const groups = useMemo(() => chats.filter((c) => c.isGroup), [chats]);
  const contacts = useMemo(() => chats.filter((c) => !c.isGroup), [chats]);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const onSave = async () => {
    const res = await save();
    pushToast(res.ok
      ? { kind: "success", title: "Conversaciones privilegiadas guardadas" }
      : { kind: "error", title: "Error", message: res.message || "No se pudo guardar" });
  };

  const onAdd = async () => {
    if (!phone.trim()) return;
    const res = await addPhone(phone, name);
    pushToast(res.ok
      ? { kind: "success", title: "Número añadido a las conversaciones privilegiadas" }
      : { kind: "error", title: "Error", message: res.message || "No se pudo añadir el número" });
    if (res.ok) {
      setPhone("");
      setName("");
    }
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

        <div className="flex items-center justify-between gap-2" data-testid="config-bot-privileged-contacts-summary">
          <span className="bo-label flex items-center gap-1.5" data-testid="config-bot-privileged-contacts-count-label">
            <Users size={14} strokeWidth={1.5} aria-hidden="true" />
            {selected.length} seleccionada{selected.length === 1 ? "" : "s"}
          </span>
          <button type="button" className="bo-btn bo-btn--ghost gap-1.5 bo-pressable" onClick={() => void load()} disabled={loading || saving}
            data-testid="config-bot-privileged-contacts-refresh-btn">
            <RefreshCw size={14} strokeWidth={2} aria-hidden="true" /> Actualizar
          </button>
        </div>

        <label className="bo-field flex items-center gap-2" data-testid="config-bot-privileged-contacts-search">
          <Search size={14} strokeWidth={1.8} aria-hidden="true" />
          <input type="search" className="bo-input flex-1" value={searchInput}
            placeholder="Buscar conversación por nombre o teléfono..." aria-label="Buscar conversación"
            onChange={(e) => setSearchInput(e.target.value)} data-testid="config-bot-privileged-contacts-search-input" />
        </label>

        <div className="flex flex-col gap-2" data-testid="config-bot-privileged-contacts-manual">
          <span className="bo-label flex items-center gap-1.5" data-testid="config-bot-privileged-contacts-manual-label">
            <UserPlus size={14} strokeWidth={1.5} aria-hidden="true" />
            Añadir número a mano
          </span>
          <div className="flex flex-wrap gap-2" data-testid="config-bot-privileged-contacts-manual-row">
            <input type="tel" className="bo-input min-w-[12rem] flex-1" value={phone} placeholder="+34 600 000 000"
              aria-label="Teléfono a añadir" onChange={(e) => setPhone(e.target.value)} disabled={adding || saving}
              data-testid="config-bot-privileged-contacts-manual-phone-input" />
            <input type="text" className="bo-input min-w-[10rem] flex-1" value={name} placeholder="Nombre (opcional)"
              aria-label="Nombre del contacto" onChange={(e) => setName(e.target.value)} disabled={adding || saving}
              data-testid="config-bot-privileged-contacts-manual-name-input" />
            <button type="button" className="bo-btn bo-btn--secondary gap-1.5 bo-pressable" onClick={() => void onAdd()}
              disabled={adding || saving || !phone.trim()} data-testid="config-bot-privileged-contacts-manual-add-btn">
              <UserPlus size={14} strokeWidth={2} aria-hidden="true" />
              {adding ? "Añadiendo..." : "Añadir"}
            </button>
          </div>
          <p className="bo-panelMeta" data-testid="config-bot-privileged-contacts-manual-help">
            Se guarda al momento, sin pasar por Guardar: útil para un número autorizado que aún no tiene conversación en el WhatsApp conectado.
          </p>
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
            {search.trim() ? "Sin resultados para la búsqueda." : "No hay conversaciones en el WhatsApp conectado."}
          </p>
        ) : null}

        <div className="flex items-center justify-between gap-2" data-testid="config-bot-privileged-contacts-pagination">
          <span className="bo-panelMeta" data-testid="config-bot-privileged-contacts-page-label">
            Página {page} de {totalPages} · {total} conversaciones
          </span>
          <div className="flex gap-1" data-testid="config-bot-privileged-contacts-page-btns">
            <button type="button" className="bo-btn bo-btn--ghost bo-pressable" disabled={loading || page <= 1}
              onClick={() => goToPage(page - 1)} aria-label="Página anterior"
              data-testid="config-bot-privileged-contacts-prev-page">
              <ChevronLeft size={14} strokeWidth={2} aria-hidden="true" />
            </button>
            <button type="button" className="bo-btn bo-btn--ghost bo-pressable" disabled={loading || !hasMore}
              onClick={() => goToPage(page + 1)} aria-label="Página siguiente"
              data-testid="config-bot-privileged-contacts-next-page">
              <ChevronRight size={14} strokeWidth={2} aria-hidden="true" />
            </button>
          </div>
        </div>
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
