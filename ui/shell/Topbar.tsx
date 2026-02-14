import React, { useCallback, useMemo } from "react";
import { useAtom } from "jotai";
import { LogOut } from "lucide-react";

import { createClient } from "../../api/client";
import { sessionAtom } from "../../state/atoms";
import { DropdownMenu } from "../inputs/DropdownMenu";
import { Select } from "../inputs/Select";
import { ThemeToggle } from "../theme/ThemeToggle";
import { useToasts } from "../feedback/useToasts";

export function Topbar({ title }: { title: string }) {
  const api = useMemo(() => createClient({ baseUrl: "" }), []);
  const { pushToast } = useToasts();
  const [session, setSession] = useAtom(sessionAtom);

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
      setSession({ ...session, activeRestaurantId: res.activeRestaurantId });
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

  const initials = useMemo(() => {
    const n = session?.user?.name || session?.user?.email || "";
    const parts = n.trim().split(/\s+/).filter(Boolean);
    const a = parts[0]?.[0] ?? "U";
    const b = parts[1]?.[0] ?? "";
    return (a + b).toUpperCase();
  }, [session?.user?.email, session?.user?.name]);

  return (
    <header className="bo-topbar" aria-label="Topbar">
      <div className="bo-title">{title}</div>
      <div className="bo-actions">
        {session?.restaurants?.length ? (
          <Select
            value={String(session.activeRestaurantId || session.restaurants[0]?.id || "")}
            onChange={onRestaurantChange}
            options={restaurantOptions}
            size="sm"
            ariaLabel="Restaurante"
          />
        ) : null}

        <ThemeToggle />

        <DropdownMenu
          label="User menu"
          triggerClassName="bo-avatarBtn"
          triggerContent={<div className="bo-avatar" aria-label="Profile">{initials}</div>}
          items={[
            {
              id: "logout",
              label: "Salir",
              icon: <LogOut size={18} strokeWidth={1.8} />,
              onSelect: doLogout,
            },
          ]}
        />
      </div>
    </header>
  );
}

