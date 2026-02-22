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
    <header className="bo-topbar" aria-label="Topbar">
      <div className="bo-topbarHeading bo-topbarHeading--actionsInline">
        <div className="bo-title">{title}</div>
        {breadcrumbs?.length ? <Breadcrumbs items={breadcrumbs} /> : null}
      </div>
      <div className="bo-actions bo-topbarActions">
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
          triggerClassName="bo-avatarBtn"
          triggerContent={<div className="bo-avatar" aria-label="Profile">{initials}</div>}
          items={userMenuItems}
          menuMinWidthPx={250}
        />

        {fichaje.activeEntry ? (
          <div className={`bo-fichajeTopbarChip${fichaje.wsConnected ? " is-live" : ""}`} aria-live="polite">
            <span className="bo-fichajeTopbarDot" aria-hidden="true" />
            <span className="bo-fichajeTopbarTime">{fichajeElapsed || "--:--:--"}</span>
          </div>
        ) : null}
      </div>
    </header>
  );
}
