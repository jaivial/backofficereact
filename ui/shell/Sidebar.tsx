import React, { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Ellipsis, Settings, Clock3, Store } from "lucide-react";

import { sidebarItemsForRole, canManageHorarios } from "../../lib/rbac";
import { NavLink } from "../nav/NavLink";
import { iconForSidebarItemKey } from "../nav/sectionIcons";

type SidebarNavEntry = {
  id: string;
  href: string;
  label: string;
  icon: React.ReactNode;
  active: boolean;
  className?: string;
};

export function Sidebar({
  pathname,
  role,
  sectionAccess,
  roleImportance,
}: {
  pathname: string;
  role: string;
  sectionAccess?: string[];
  roleImportance?: number;
}) {
  const reduceMotion = useReducedMotion();
  const iconProps = { size: 18, strokeWidth: 1.8 } as const;
  const items = sidebarItemsForRole(role, sectionAccess, roleImportance);
  const showMiHorario = !canManageHorarios(role, roleImportance);
  const showRestaurantConfig = items.some((item) => item.key === "reservas");
  const isRestaurantConfigActive = pathname === "/app/config" || pathname.startsWith("/app/config/") || pathname === "/app/comsit" || pathname.startsWith("/app/comsit/");
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);

  useEffect(() => {
    setMobileMoreOpen(false);
  }, [pathname]);

  const navEntries = useMemo<SidebarNavEntry[]>(() => {
    const base: SidebarNavEntry[] = items.map((item) => {
      const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
      return {
        id: item.key,
        href: item.href,
        label: item.label,
        icon: iconForSidebarItemKey(item.key, iconProps),
        active,
      };
    });

    if (showMiHorario) {
      base.push({
        id: "mi_horario",
        href: "/app/miembros/mi-horario",
        label: "Mi Horario",
        icon: <Clock3 size={iconProps.size} strokeWidth={iconProps.strokeWidth} />,
        active: pathname === "/app/miembros/mi-horario",
      });
    }

    if (showRestaurantConfig) {
      base.push({
        id: "restaurant_config",
        href: "/app/config",
        label: "Configuracion restaurante",
        icon: <Store size={iconProps.size} strokeWidth={iconProps.strokeWidth} />,
        active: isRestaurantConfigActive,
        className: "bo-navBtn--restaurantConfig",
      });
    }

    return base;
  }, [iconProps.size, iconProps.strokeWidth, isRestaurantConfigActive, items, pathname, showMiHorario, showRestaurantConfig]);

  const mobilePrimaryEntries = useMemo(() => {
    const preferredOrder = ["reservas", "menus", "comida"];
    const selected: SidebarNavEntry[] = [];

    for (const key of preferredOrder) {
      const found = navEntries.find((entry) => entry.id === key);
      if (found) selected.push(found);
    }
    for (const entry of navEntries) {
      if (selected.length >= 3) break;
      if (selected.some((current) => current.id === entry.id)) continue;
      selected.push(entry);
    }
    return selected;
  }, [navEntries]);

  const mobileOverflowEntries = useMemo(
    () => navEntries.filter((entry) => !mobilePrimaryEntries.some((primary) => primary.id === entry.id)),
    [mobilePrimaryEntries, navEntries],
  );

  const mobileListVariants = reduceMotion
    ? {
        open: { transition: { duration: 0 } },
        closed: { transition: { duration: 0 } },
      }
    : {
        open: {
          transition: { staggerChildren: 0.07, staggerDirection: -1, delayChildren: 0.03 },
        },
        closed: {
          transition: { staggerChildren: 0.05, staggerDirection: -1 },
        },
      };

  const mobileItemVariants = reduceMotion
    ? {
        open: { opacity: 1, y: 0, scale: 1 },
        closed: { opacity: 1, y: 0, scale: 1 },
      }
    : {
        open: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.2, ease: "easeOut" as const } },
        closed: { opacity: 0, y: 12, scale: 0.96, transition: { duration: 0.16, ease: "easeIn" as const } },
      };

  return (
    <aside className="bo-sidebar" aria-label="Sidebar">
      <div className="bo-brand" aria-label="Backoffice">
        <Settings {...iconProps} />
      </div>

      <nav className="bo-nav bo-navDesktop" aria-label="Navigation">
        {navEntries.map((entry) => (
          <NavLink
            key={entry.id}
            href={entry.href}
            active={entry.active}
            label={entry.label}
            className={entry.className}
          >
            {entry.icon}
          </NavLink>
        ))}
      </nav>

      <nav className="bo-navMobile" aria-label="Navigation móvil">
        <div className="bo-navMobileMain">
          {mobilePrimaryEntries.map((entry) => (
            <NavLink
              key={`mobile-main-${entry.id}`}
              href={entry.href}
              active={entry.active}
              label={entry.label}
              className={entry.className}
            >
              {entry.icon}
            </NavLink>
          ))}
          <div className="bo-navMobileMoreWrap">
            <button
              type="button"
              className={`bo-navBtn bo-navBtn--glass bo-navBtn--mobileMore${mobileMoreOpen ? " is-active" : ""}`}
              aria-label={mobileMoreOpen ? "Cerrar más opciones" : "Abrir más opciones"}
              aria-expanded={mobileMoreOpen}
              aria-controls="bo-mobile-nav-overflow"
              onClick={() => {
                if (!mobileOverflowEntries.length) return;
                setMobileMoreOpen((prev) => !prev);
              }}
              disabled={!mobileOverflowEntries.length}
            >
              <Ellipsis size={iconProps.size} strokeWidth={2} />
            </button>

            <AnimatePresence>
              {mobileMoreOpen && mobileOverflowEntries.length > 0 ? (
                <motion.div
                  id="bo-mobile-nav-overflow"
                  className="bo-navMobileOverflow"
                  initial={reduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 14 }}
                  transition={reduceMotion ? { duration: 0 } : { duration: 0.24, ease: "easeOut" }}
                >
                  <motion.div
                    className="bo-navMobileOverflowList"
                    variants={mobileListVariants}
                    initial="closed"
                    animate="open"
                    exit="closed"
                  >
                    {mobileOverflowEntries.map((entry) => (
                      <motion.div key={`mobile-overflow-${entry.id}`} variants={mobileItemVariants}>
                        <NavLink
                          href={entry.href}
                          active={entry.active}
                          label={entry.label}
                          className={entry.className}
                        >
                          {entry.icon}
                        </NavLink>
                      </motion.div>
                    ))}
                  </motion.div>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        </div>
      </nav>

      <div className="bo-sidebarSpacer" aria-hidden="true" />
    </aside>
  );
}
