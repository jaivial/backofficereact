export function titleForPath(pathname: string): string {
  if (pathname.startsWith("/app/reservas")) return "Reservas";
  if (pathname.startsWith("/app/comida/menus")) return "Menus";
  if (pathname.startsWith("/app/config")) return "Configuracion";
  if (pathname.startsWith("/app/comsit")) return "Configuracion";
  if (pathname.startsWith("/app/settings")) return "Ajustes";
  if (pathname.startsWith("/app/miembros")) return "Miembros";
  if (pathname.startsWith("/app/horarios")) return "Horarios";
  if (pathname.startsWith("/app/fichaje")) return "Fichaje";
  if (pathname.startsWith("/app/reportes")) return "Reportes";
  if (pathname.startsWith("/app/website")) return "Website Builder";
  if (pathname.startsWith("/app/estado-cuenta")) return "Estado de Cuenta";
  return "Backoffice";
}
