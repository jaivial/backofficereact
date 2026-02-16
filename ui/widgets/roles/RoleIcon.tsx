import React from "react";
import {
  BadgeCheck,
  ClipboardList,
  Coffee,
  Crown,
  Droplets,
  Flame,
  GlassWater,
  KeyRound,
  Route,
  ShieldUser,
  Sparkles,
  UserCog,
  UserRoundPlus,
  UsersRound,
  Utensils,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";

type Props = {
  roleSlug: string;
  iconKey?: string | null;
  size?: number;
  strokeWidth?: number;
};

const ICONS: Record<string, LucideIcon> = {
  "badge-check": BadgeCheck,
  "clipboard-list": ClipboardList,
  coffee: Coffee,
  crown: Crown,
  droplets: Droplets,
  flame: Flame,
  "glass-water": GlassWater,
  "key-round": KeyRound,
  route: Route,
  "shield-user": ShieldUser,
  sparkles: Sparkles,
  "user-cog": UserCog,
  "user-round-plus": UserRoundPlus,
  "users-round": UsersRound,
  utensils: Utensils,
  "utensils-crossed": UtensilsCrossed,
};

function fallbackIconKeyForRole(roleSlug: string): string {
  switch (roleSlug) {
    case "root":
      return "crown";
    case "admin":
      return "shield-user";
    case "metre":
      return "clipboard-list";
    case "jefe_cocina":
      return "utensils";
    case "arrocero":
      return "flame";
    case "pinche_cocina":
      return "utensils-crossed";
    case "fregaplatos":
      return "droplets";
    case "camarero":
      return "glass-water";
    case "responsable_sala":
      return "users-round";
    case "ayudante_camarero":
      return "user-round-plus";
    case "runner":
      return "route";
    case "barista":
      return "coffee";
    default:
      return "badge-check";
  }
}

export function RoleIcon({ roleSlug, iconKey, size = 18, strokeWidth = 1.8 }: Props) {
  const normalized = String(iconKey ?? "").trim().toLowerCase();
  const key = normalized && ICONS[normalized] ? normalized : fallbackIconKeyForRole(roleSlug);
  const Icon = ICONS[key] ?? ShieldUser;
  return <Icon size={size} strokeWidth={strokeWidth} />;
}
