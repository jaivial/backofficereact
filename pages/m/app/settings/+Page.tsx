import React from "react";
import { useAtomValue } from "jotai";
import { sessionAtom } from "../../../../state/atoms";
import { usePageContext } from "vike-react/usePageContext";
import {
  User,
  Bell,
  Moon,
  LogOut,
  Shield,
  Smartphone,
  type LucideIcon,
} from "lucide-react";

function SettingsRow({
  icon: Icon,
  label,
  value,
  onClick,
  danger,
  "data-ui": dataUi,
  "data-role": dataRole,
}: {
  icon: LucideIcon;
  label: string;
  value?: string;
  onClick?: () => void;
  danger?: boolean;
  "data-ui"?: string;
  "data-role"?: string;
}) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={[
        "flex items-center gap-4 w-full p-4 text-left rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]",
        onClick ? "active:scale-[0.99] transition-transform cursor-pointer" : "",
        danger ? "border-red-500/20" : "",
      ].join(" ")}
      data-ui={dataUi}
      data-role={dataRole}
    >
      <div
        className={[
          "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0",
          danger ? "bg-red-500/10" : "bg-[hsl(var(--primary))]/10",
        ].join(" ")}
        data-slot="settings-icon-wrapper"
        aria-hidden="true"
      >
        <Icon
          size={20}
          strokeWidth={1.8}
          className={danger ? "text-red-500" : "text-[hsl(var(--primary))]"}
          aria-hidden="true"
        />
      </div>
      <div className="flex-1 min-w-0" data-slot="settings-min-w-0">
        <p className={["text-sm font-medium", danger ? "text-red-500" : "text-[hsl(var(--foreground))]"].join(" ")} data-slot="settings-p">
          {label}
        </p>
        {value && (
          <p className="text-xs text-[hsl(var(--muted-foreground))] truncate" data-slot="settings-truncate">{value}</p>
        )}
      </div>
    </Tag>
  );
}

export default function MobileSettingsPage() {
  const session = useAtomValue(sessionAtom);

  const handleLogout = React.useCallback(() => {
    // Signal logout to parent window so mobile shell can clear session
    if (typeof window !== "undefined") {
      window.parent.postMessage({ type: "bo:session:cleared" }, "*");
      window.location.href = "/m/login";
    }
  }, []);

  if (!session) return null;

  return (
    <div className="flex flex-col gap-4 p-4" data-ui="mobile-settings">
      <header className="pt-2" data-ui="mobile-settings-header">
        <h1 className="text-xl font-bold text-[hsl(var(--foreground))]" data-ui="mobile-settings-title">Ajustes</h1>
      </header>

      {/* User info */}
      <section aria-label="Cuenta" data-ui="mobile-settings-account">
        <h2 className="text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider mb-2 px-1" data-ui="mobile-settings-section-title">
          Cuenta
        </h2>
        <div className="flex flex-col gap-2" data-slot="settings-gap-2">
          <SettingsRow
            icon={User}
            label={session.user.name}
            value={`${session.user.role} · ${session.user.email}`}
            data-ui="mobile-settings-user"
            data-role="user-info"
          />
          <SettingsRow
            icon={Shield}
            label="Rol"
            value={session.user.role}
            data-ui="mobile-settings-role"
            data-role="role-info"
          />
        </div>
      </section>

      {/* Preferences */}
      <section aria-label="Preferencias" data-ui="mobile-settings-preferences">
        <h2 className="text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider mb-2 px-1" data-ui="mobile-settings-section-title">
          Preferencias
        </h2>
        <div className="flex flex-col gap-2" data-slot="settings-gap-2">
          <SettingsRow
            icon={Moon}
            label="Tema oscuro"
            value="Activado"
            data-ui="mobile-settings-theme"
            data-role="theme"
          />
          <SettingsRow
            icon={Bell}
            label="Notificaciones"
            value="Activadas"
            data-ui="mobile-settings-notifications"
            data-role="notifications"
          />
        </div>
      </section>

      {/* App info */}
      <section aria-label="App" data-ui="mobile-settings-app">
        <h2 className="text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider mb-2 px-1" data-ui="mobile-settings-section-title">
          App
        </h2>
        <div className="flex flex-col gap-2" data-slot="settings-gap-2">
          <SettingsRow
            icon={Smartphone}
            label="Version"
            value="0.1.0"
            data-ui="mobile-settings-version"
            data-role="app-version"
          />
          <SettingsRow
            icon={LogOut}
            label="Cerrar sesion"
            onClick={handleLogout}
            danger
            data-ui="mobile-settings-logout"
            data-role="logout"
          />
        </div>
      </section>
    </div>
  );
}
