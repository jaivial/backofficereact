import React, { memo } from "react";

import { cn } from "../shadcn/utils";

export type BreadcrumbItem = {
  label: string;
  href?: string;
};

export type AppNavigationMeta = {
  title: string;
  breadcrumbs: BreadcrumbItem[];
};

const ROOT_BREADCRUMB: BreadcrumbItem = { label: "Backoffice", href: "/app" };

const SEGMENT_LABELS: Record<string, string> = {
  backoffice: "Inicio",
  dashboard: "Dashboard",
  reservas: "Reservas",
  config: "Configuracion",
  anadir: "Anadir",
  menus: "Menus",
  crear: "Crear",
  comida: "Carta",
  comsit: "Configuracion",
  settings: "Ajustes",
  miembros: "Miembros",
  "mi-horario": "Mi Horario",
  roles: "Roles",
  contrato: "Contrato",
  estadisticas: "Estadisticas",
  horarios: "Horarios",
  preview: "Preview",
  turnos: "Turnos",
  fichaje: "Fichaje",
  facturas: "Facturas",
  recurrentes: "Facturacion recurrente",
  reportes: "Reportes",
  "estado-cuenta": "Estado de Cuenta",
};

const TITLE_BY_PATH: Record<string, string> = {
  "/app": "Inicio",
  "/app/backoffice": "Inicio",
  "/app/dashboard": "Dashboard",
  "/app/reservas": "Reservas",
  "/app/reservas/anadir": "Anadir reserva",
  "/app/reservas/config": "Configuracion reservas",
  "/app/menus": "Menus",
  "/app/menus/crear": "Editor de menus",
  "/app/comida": "Gestion de Carta",
  "/app/config": "Configuracion",
  "/app/comsit": "Configuracion",
  "/app/settings": "Ajustes",
  "/app/miembros": "Miembros",
  "/app/miembros/roles": "Roles",
  "/app/miembros/mi-horario": "Mi Horario",
  "/app/horarios": "Horarios",
  "/app/horarios/preview": "Horarios preview",
  "/app/horarios/turnos": "Turnos",
  "/app/fichaje": "Fichaje",
  "/app/facturas": "Facturas",
  "/app/facturas/recurrentes": "Facturacion recurrente",
  "/app/reportes": "Reportes",
  "/app/estado-cuenta": "Estado de Cuenta",
};

function normalizePathname(pathnameRaw: string): string {
  if (!pathnameRaw) return "/";
  if (pathnameRaw.length > 1 && pathnameRaw.endsWith("/")) {
    return pathnameRaw.slice(0, -1);
  }
  return pathnameRaw;
}

function humanizeSegment(segmentRaw: string): string {
  let decoded = segmentRaw;
  try {
    decoded = decodeURIComponent(segmentRaw);
  } catch {
    decoded = segmentRaw;
  }
  const segment = decoded.trim();
  if (!segment) return "";
  return segment
    .split("-")
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(" ");
}

function labelForSegment(segments: string[], index: number): string {
  const value = segments[index];
  if (!value) return "";

  const [first] = segments;
  if (first === "miembros" && index === 1 && /^\d+$/.test(value)) {
    return `Miembro #${value}`;
  }

  return SEGMENT_LABELS[value] ?? humanizeSegment(value);
}

function titleForRoute(pathname: string, segments: string[]): string {
  const exact = TITLE_BY_PATH[pathname];
  if (exact) return exact;

  if (segments[0] === "miembros" && segments[1] && /^\d+$/.test(segments[1])) {
    if (segments[2] === "contrato") return "Contrato";
    if (segments[2] === "estadisticas") return "Estadisticas";
    return `Miembro #${segments[1]}`;
  }

  if (segments[0]) return labelForSegment(segments, 0);
  return "Backoffice";
}

export function buildAppNavigationMeta(pathnameRaw: string): AppNavigationMeta {
  const pathname = normalizePathname(pathnameRaw);
  if (!pathname.startsWith("/app")) {
    return {
      title: "Backoffice",
      breadcrumbs: [{ label: "Backoffice" }],
    };
  }

  const parts = pathname.split("/").filter(Boolean);
  const segments = parts.slice(1);
  const title = titleForRoute(pathname, segments);

  if (!segments.length) {
    return {
      title,
      breadcrumbs: [{ label: "Backoffice" }],
    };
  }

  const breadcrumbs: BreadcrumbItem[] = [ROOT_BREADCRUMB];
  let href = "/app";

  for (let i = 0; i < segments.length; i += 1) {
    const segment = segments[i];
    href += `/${segment}`;
    const isCurrent = i === segments.length - 1;
    breadcrumbs.push({
      label: labelForSegment(segments, i),
      href: isCurrent ? undefined : href,
    });
  }

  return { title, breadcrumbs };
}

export const Breadcrumbs = memo(function Breadcrumbs({
  items,
  className,
}: {
  items: BreadcrumbItem[];
  className?: string;
}) {
  if (!items.length) return null;

  return (
    <nav className={cn("bo-breadcrumb", className)} aria-label="Breadcrumb">
      <ol className="bo-breadcrumbList">
        {items.map((item, index) => {
          const isCurrent = index === items.length - 1;
          return (
            <li key={`${item.href ?? "current"}-${item.label}-${index}`} className="bo-breadcrumbItem">
              {item.href && !isCurrent ? (
                <a className="bo-breadcrumbLink" href={item.href}>
                  {item.label}
                </a>
              ) : (
                <span className="bo-breadcrumbCurrent" aria-current={isCurrent ? "page" : undefined}>
                  {item.label}
                </span>
              )}
              {isCurrent ? null : (
                <span className="bo-breadcrumbSeparator" aria-hidden="true">
                  /
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
});
