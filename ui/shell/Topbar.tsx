import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useAtom, useAtomValue } from "jotai";
import { LogOut, Store } from "lucide-react";

import { createClient } from "../../api/client";
import type { BOSection } from "../../lib/rbac";
import { hasSectionAccess } from "../../lib/rbac";
import { fichajeRealtimeAtom, sessionAtom } from "../../state/atoms";
import { DropdownMenu } from "../inputs/DropdownMenu";
import { Select } from "../inputs/Select";
import { ThemeToggle } from "../theme/ThemeToggle";
import { useToasts } from "../feedback/useToasts";
import { Breadcrumbs, type BreadcrumbItem } from "../nav/Breadcrumbs";

function isBOSection(value: string): value is BOSection {
  return value === "reservas" || value === "menus" || value === "ajustes" || value === "miembros" || value === "fichaje" || value === "horarios";
}

function formatElapsed(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function Topbar({
  title,
  breadcrumbs,
}: {
  title: string;
  breadcrumbs?: BreadcrumbItem[];
}) {
  const api = useMemo(() => createClient({ baseUrl: "" }), []);
  const { pushToast } = useToasts();
  const [session, setSession] = useAtom(sessionAtom);
  const fichaje = useAtomValue(fichajeRealtimeAtom);
  const [tick, setTick] = useState(() => Date.now());

  const restaurantOptions = useMemo(() => {
    const list = session?.restaurants ?? [];
    return list.map((r) => ({ value: String(r.id), label: r.name }));
  }, [session?.restaurants]);

  const onRestaurantChange = useCallback(
    async (restaurantIdRaw: string) => {
      const restaurantId = Number(restaurantIdRaw);
      if (!session || !restaurantId) return;
      const res = await api.auth.setActiveRestaurant(restaurantId);
      if (!res.success) {
        pushToast({ kind: "error", title: "Error", message: res.message || "No se pudo cambiar restaurante" });
        return;
      }
      setSession({
        ...session,
        activeRestaurantId: res.activeRestaurantId,
        user: {
          ...session.user,
          role: res.role ?? session.user.role,
          roleImportance: typeof res.roleImportance === "number" ? res.roleImportance : session.user.roleImportance,
          sectionAccess: Array.isArray(res.sectionAccess) ? res.sectionAccess.filter((value): value is BOSection => isBOSection(value)) : session.user.sectionAccess,
        },
      });
    },
    [api, pushToast, session, setSession],
  );

  const doLogout = useCallback(async () => {
    try {
      await api.auth.logout();
    } finally {
      setSession(null);
      window.location.href = "/login";
    }
  }, [api, setSession]);

  const goRestaurantConfig = useCallback(() => {
    window.location.href = "/app/config";
  }, []);

  const canOpenRestaurantConfig = useMemo(() => {
    if (!session) return false;
    return hasSectionAccess(
      session.user.role,
      "reservas",
      session.user.sectionAccess,
      session.user.roleImportance,
    );
  }, [session]);

  const initials = useMemo(() => {
    const n = session?.user?.name || session?.user?.email || "";
    const parts = n.trim().split(/\s+/).filter(Boolean);
    const a = parts[0]?.[0] ?? "U";
    const b = parts[1]?.[0] ?? "";
    return (a + b).toUpperCase();
  }, [session?.user?.email, session?.user?.name]);

  useEffect(() => {
    if (!fichaje.activeEntry) return;
    const timer = window.setInterval(() => setTick(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [fichaje.activeEntry?.id, fichaje.activeEntry?.startAtIso]);

  const fichajeElapsed = useMemo(() => {
    if (!fichaje.activeEntry?.startAtIso) return "";
    const startMs = Date.parse(fichaje.activeEntry.startAtIso);
    if (!Number.isFinite(startMs)) return "";
    return formatElapsed((tick - startMs) / 1000);
  }, [fichaje.activeEntry?.startAtIso, tick]);

  const userMenuItems = useMemo(
    () => [
      ...(canOpenRestaurantConfig
        ? [
            {
              id: "restaurant-config",
              label: "Configuracion restaurante",
              icon: <Store size={18} strokeWidth={1.8} />,
              onSelect: goRestaurantConfig,
            },
          ]
        : []),
      {
        id: "logout",
        label: "Salir",
        icon: <LogOut size={18} strokeWidth={1.8} />,
        onSelect: doLogout,
      },
    ],
    [canOpenRestaurantConfig, doLogout, goRestaurantConfig],
  );

  return (
    <header className="flex items-start justify-between gap-4 relative z-[170]" aria-label="Topbar">
      <div className="min-w-0 flex flex-col gap-1 pt-1 pr-4">
        <div className="text-xl font-semibold leading-tight tracking-wide">{title}</div>
        {breadcrumbs?.length ? <Breadcrumbs items={breadcrumbs} /> : null}
      </div>
      <div className="relative ml-auto max-w-full z-[170] flex items-center gap-2.5">
        {session?.restaurants?.length ? (
          <Select
            value={String(session.activeRestaurantId || session.restaurants[0]?.id || "")}
            onChange={onRestaurantChange}
            options={restaurantOptions}
            size="sm"
            ariaLabel="Restaurante"
            menuMinWidthPx={280}
          />
        ) : null}

        <ThemeToggle />

        <DropdownMenu
          label="User menu"
          triggerClassName="border-0 bg-transparent p-0 cursor-pointer"
          triggerContent={<div className="w-9 h-9 rounded-xl border border-border bg-gradient-to-br from-primary/30 to-accent/20 grid place-items-center text-[13px] font-bold text-foreground" aria-label="Profile">{initials}</div>}
          items={userMenuItems}
          menuMinWidthPx={250}
        />

        {fichaje.activeEntry ? (
          <div className={`h-8 min-w-[124px] rounded-full border border-border bg-white/[0.03] inline-flex items-center justify-center gap-1.5 px-2.5 text-xs font-bold ${fichaje.wsConnected ? "border-accent/40 text-accent" : "text-muted-foreground"}`} aria-live="polite">
            <span className="w-2 h-2 rounded-full bg-current shadow-[0_0_0_3px_rgba(147,239,231,0.16)]" aria-hidden="true" />
            <span className="inline-flex justify-center w-[9ch] min-w-[9ch] text-center tracking-wide font-mono tabular-nums whitespace-nowrap">{fichajeElapsed || "--:--:--"}</span>
          </div>
        ) : null}
      </div>
    </header>
  );
}
