export type ErrorStatus = 401 | 403 | 404 | 500;

export type ErrorContent = {
  title: string;
  message: string;
  primaryLabel: string;
  primaryHref?: string;
  primaryAction?: "reload";
  secondaryLabel: string;
  secondaryHref: string;
};

export const ERROR_CONTENT: Record<ErrorStatus, ErrorContent> = {
  401: {
    title: "Sesion expirada",
    message: "Necesitas iniciar sesion para continuar en el panel de administracion.",
    primaryLabel: "Iniciar sesion",
    primaryHref: "/login",
    secondaryLabel: "Ir al inicio",
    secondaryHref: "/",
  },
  403: {
    title: "Acceso denegado",
    message: "Tu usuario no tiene permisos para ver esta seccion.",
    primaryLabel: "Volver al panel",
    primaryHref: "/app/backoffice",
    secondaryLabel: "Cambiar sesion",
    secondaryHref: "/login",
  },
  404: {
    title: "Pagina no encontrada",
    message: "La ruta solicitada no existe o ha cambiado.",
    primaryLabel: "Volver al panel",
    primaryHref: "/app/backoffice",
    secondaryLabel: "Ir al inicio",
    secondaryHref: "/",
  },
  500: {
    title: "Error interno",
    message: "Algo ha fallado al cargar esta pagina. Puedes reintentar ahora.",
    primaryLabel: "Reintentar",
    primaryAction: "reload",
    secondaryLabel: "Volver al panel",
    secondaryHref: "/app/backoffice",
  },
};
