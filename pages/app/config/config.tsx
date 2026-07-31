import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { usePageContext } from "vike-react/usePageContext";
import { Building2, LayoutGrid, Phone, UtensilsCrossed, CalendarDays, Scale, Sparkles } from "lucide-react";

import { createClient } from "../../../api/client";
import type { ConfigDefaults, ConfigFloor, RestaurantInfo } from "../../../api/types";
import { InlineAlert } from "../../../ui/feedback/InlineAlert";
import { useErrorToast } from "../../../ui/feedback/useErrorToast";
import { useToasts } from "../../../ui/feedback/useToasts";
import { Select } from "../../../ui/inputs/Select";
import { Switch } from "../../../ui/shadcn/Switch";
import { PlusMinusCounter } from "../../../ui/widgets/PlusMinusCounter";
import { Tabs, type TabItem } from "../../../ui/nav/Tabs";
import { PageToolbar } from "../../../ui/shell/PageToolbar";
import { ConfigRestauranteContent as ConfigRestaurante } from "./functionalComponents/ConfigRestaurante/ConfigRestaurante";
import { ConfigContactoContent as ConfigContacto } from "./functionalComponents/ConfigContacto/ConfigContacto";
import { BookingManager } from "./booking/BookingManager";
import { ConfigLegalPages } from "./functionalComponents/ConfigLegalPages/ConfigLegalPages";
import { ConfigAIImage } from "./functionalComponents/ConfigAIImage/ConfigAIImage";
import { ConfigWhatsAppBot } from "./functionalComponents/ConfigWhatsAppBot/ConfigWhatsAppBot";

type PageData = {
  defaults: ConfigDefaults | null;
  floors: ConfigFloor[];
  restaurantInfo: RestaurantInfo | null;
  error: string | null;
};

type ContentTab = "restaurante" | "contacto" | "booking" | "legal-pages" | "ia";

// ─── Hour/slot helpers (shared) ───────────────────────────────────────────────

type HourSlot = {
  id: string;
  value: string;
  label: string;
};

const tableLimitValues = [...Array.from({ length: 41 }, (_, i) => String(i)), "999"];

function normalizeToHHMM(totalMinutes: number): string {
  const day = 24 * 60;
  const normalized = ((totalMinutes % day) + day) % day;
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function buildHalfHourSlots(startMinutes: number, endMinutes: number, prefix: string): HourSlot[] {
  const out: HourSlot[] = [];
  const target = endMinutes < startMinutes ? endMinutes + 24 * 60 : endMinutes;
  for (let cursor = startMinutes; cursor <= target; cursor += 30) {
    const value = normalizeToHHMM(cursor);
    out.push({
      id: `${prefix}-${value.replace(":", "")}`,
      value,
      label: value,
    });
  }
  return out;
}

function serviceSortKey(hhmm: string): number {
  const [hRaw, mRaw] = hhmm.split(":");
  const h = Number(hRaw);
  const m = Number(mRaw);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return 0;
  const minutes = h * 60 + m;
  return minutes < 8 * 60 ? minutes + 24 * 60 : minutes;
}

function sortServiceHours(hours: string[]): string[] {
  return [...hours].sort((a, b) => {
    const ka = serviceSortKey(a);
    const kb = serviceSortKey(b);
    if (ka === kb) return a.localeCompare(b);
    return ka - kb;
  });
}

function toggleHour(current: string[], hour: string): string[] {
  const set = new Set(current);
  if (set.has(hour)) set.delete(hour);
  else set.add(hour);
  return sortServiceHours([...set]);
}

function clampDailyLimit(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(500, Math.trunc(v)));
}

function normalizeTableLimit(value: string | null | undefined): string {
  if (value === "999") return "999";
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return "999";
  const clamped = Math.max(0, Math.min(40, Math.trunc(parsed)));
  return String(clamped);
}

function stepTableLimit(current: string, direction: -1 | 1): string {
  const currentValue = normalizeTableLimit(current);
  const currentIndex = tableLimitValues.indexOf(currentValue);
  const safeIndex = currentIndex === -1 ? tableLimitValues.indexOf("999") : currentIndex;
  const nextIndex = Math.max(0, Math.min(tableLimitValues.length - 1, safeIndex + direction));
  return tableLimitValues[nextIndex] || currentValue;
}

function formatTableLimit(value: string): string {
  const normalized = normalizeTableLimit(value);
  return normalized === "999" ? "Sin límite" : normalized;
}

function readAPIMessage(result: unknown, fallback: string): string {
  if (!result || typeof result !== "object") return fallback;
  if (!("message" in result)) return fallback;
  const message = (result as { message?: unknown }).message;
  if (typeof message !== "string") return fallback;
  const trimmed = message.trim();
  return trimmed || fallback;
}

export type { HourSlot };
export { buildHalfHourSlots, sortServiceHours, toggleHour, clampDailyLimit, stepTableLimit, formatTableLimit, readAPIMessage };

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Page() {
  const pageContext = usePageContext();
  const data = pageContext.data as PageData;
  const api = useMemo(() => createClient({ baseUrl: "" }), []);
  const { pushToast } = useToasts();

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(data.error);
  const [defaults, setDefaults] = useState<ConfigDefaults | null>(data.defaults);
  const [floors, setFloors] = useState<ConfigFloor[]>(data.floors || []);
  const [restaurantInfo, setRestaurantInfo] = useState<RestaurantInfo | null>(
    data.restaurantInfo ?? {
      direccion: "",
      telefono: "",
      email: "",
      website: "",
      cif: "",
      direccionFacturacion: "",
      clasificacion: "sociedad",
    },
  );

  const isRoot = (pageContext.bo?.session?.user?.role ?? "") === "root";

  const contentTabFromQuery = pageContext.urlParsed.search.content as ContentTab | null | undefined;
  const [contentTab, setContentTab] = useState<ContentTab>(contentTabFromQuery ?? "restaurante");

  const contentTabs = useMemo<TabItem[]>(
    () => [
      {
        id: "restaurante",
        label: "Restaurante",
        href: "#restaurante",
        icon: <UtensilsCrossed className="bo-ico" />,
      },
      {
        id: "contacto",
        label: "Contacto",
        href: "#contacto",
        icon: <Phone className="bo-ico" />,
      },
      {
        id: "booking",
        label: "Booking",
        href: "#booking",
        icon: <CalendarDays className="bo-ico" />,
      },
      {
        id: "legal-pages",
        label: "Paginas legales",
        href: "#legal-pages",
        icon: <Scale className="bo-ico" />,
      },
      ...(isRoot
        ? [{
            id: "ia",
            label: "IA",
            href: "#ia",
            icon: <Sparkles className="bo-ico" />,
          } as TabItem]
        : []),
    ],
    [isRoot],
  );

  useErrorToast(error);

  const reload = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const [defaultsRes, floorsRes, infoRes] = await Promise.all([
        api.config.getDefaults(),
        api.config.getDefaultFloors(),
        api.config.getRestaurantInfo(),
      ]);

      if (!defaultsRes.success) {
        setError(readAPIMessage(defaultsRes, "Error cargando configuración por defecto"));
        return;
      }
      if (!floorsRes.success) {
        setError(readAPIMessage(floorsRes, "Error cargando plantas"));
        return;
      }

      setDefaults(defaultsRes);
      setFloors(floorsRes.floors || []);
      if (infoRes.success) {
        setRestaurantInfo(infoRes.restaurantInfo);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error cargando configuración");
    } finally {
      setBusy(false);
    }
  }, [api.config]);

  const onNavigateContentTab = useCallback(
    (_href: string, id: string, event: React.MouseEvent<HTMLAnchorElement>) => {
      void _href;
      event.preventDefault();
      setContentTab(id as ContentTab);
      // ponytail: sync URL so tab survives refresh
      window.history.replaceState(null, "", `${window.location.pathname}?content=${id}`);
    },
    [],
  );

  if (!defaults) {
    return <InlineAlert kind="info" title="Cargando" message="Preparando configuración..." />;
  }

  return (
    <>
      <style>{`@media (max-width: 640px) { .bo-main:has([data-testid="config-section"]) { padding: 0 1rem 2rem !important } .bo-install-code, .bo-install-code code { white-space: pre-wrap !important; word-break: break-all !important; overflow-x: auto !important; max-width: 100% !important } }`}</style>
    <section aria-label="Configuración" className="w-full max-w-3xl mx-auto max-sm:mx-0 max-sm:px-0" data-testid="config-section">
      <Tabs
        tabs={contentTabs}
        activeId={contentTab}
        ariaLabel="Secciones de configuración"
        className="bo-tabs--reservas mx-auto mb-6"
        onNavigate={onNavigateContentTab}
        layoutId="boContentTabIndicator"
      />

      <PageToolbar
        left={
          <button className="bo-btn bo-btn--ghost" type="button" onClick={() => void reload()} disabled={busy} data-testid="config-reload-button">
            Recargar
          </button>
        }
        right={
          <div className="bo-mutedText" data-slot="config-mutedText">{busy ? "Actualizando..." : "Valores por defecto"}</div>
        }
        data-slot="config-toolbar"
      />

      <AnimatePresence mode="wait">
        <motion.div
          key={contentTab}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
          className="bo-stack"
        >
          {contentTab === "ia" ? (
            isRoot ? (
              <>
                <ConfigAIImage />
				<ConfigWhatsAppBot
                  restaurants={pageContext.bo?.session?.restaurants ?? []}
                  activeRestaurantId={pageContext.bo?.session?.activeRestaurantId ?? 0}
                />
              </>
            ) : null
          ) : contentTab === "restaurante" ? (
            <ConfigRestaurante
              defaults={defaults}
              floors={floors}
              busy={busy}
              setBusy={setBusy}
              setError={setError}
              api={api}
              pushToast={pushToast}
            />
          ) : contentTab === "contacto" ? (
            <ConfigContacto
              initialInfo={
                restaurantInfo ?? {
                  direccion: "",
                  telefono: "",
                  email: "",
                  website: "",
                  cif: "",
                  direccionFacturacion: "",
                  clasificacion: "sociedad",
                }
              }
              busy={busy}
              setBusy={setBusy}
              setError={setError}
              api={api}
              pushToast={pushToast}
            />
          ) : contentTab === "legal-pages" ? (
            <ConfigLegalPages />
          ) : (
            <BookingManager />
          )}
        </motion.div>
      </AnimatePresence>
    </section>
    </>
  );
}
