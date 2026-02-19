import React from "react";
import { AlertTriangle, Home, LogIn, RefreshCw } from "lucide-react";
import { usePageContext } from "vike-react/usePageContext";

type ErrorStatus = 401 | 403 | 404 | 500;

type ErrorContent = {
  title: string;
  message: string;
  primaryLabel: string;
  primaryHref?: string;
  primaryAction?: "reload";
  secondaryLabel: string;
  secondaryHref: string;
};

const ERROR_CONTENT: Record<ErrorStatus, ErrorContent> = {
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
    primaryHref: "/app",
    secondaryLabel: "Cambiar sesion",
    secondaryHref: "/login",
  },
  404: {
    title: "Pagina no encontrada",
    message: "La ruta solicitada no existe o ha cambiado.",
    primaryLabel: "Volver al panel",
    primaryHref: "/app",
    secondaryLabel: "Ir al inicio",
    secondaryHref: "/",
  },
  500: {
    title: "Error interno",
    message: "Algo ha fallado al cargar esta pagina. Puedes reintentar ahora.",
    primaryLabel: "Reintentar",
    primaryAction: "reload",
    secondaryLabel: "Volver al panel",
    secondaryHref: "/app",
  },
};

function resolveStatusCode(pageContext: unknown): ErrorStatus {
  const ctx = pageContext as any;
  const raw =
    ctx?.statusCode ??
    ctx?.abortStatusCode ??
    (ctx?.is404 ? 404 : undefined) ??
    (ctx?.is500 ? 500 : undefined) ??
    ctx?.httpResponse?.statusCode ??
    500;
  const status = Number(raw);
  return status === 401 || status === 403 || status === 404 || status === 500 ? status : 500;
}

export default function ErrorPage() {
  const pageContext = usePageContext();
  const statusCode = resolveStatusCode(pageContext);
  const isClient = typeof window !== "undefined";
  const content = ERROR_CONTENT[statusCode];

  const handleRetry = () => {
    if (isClient) {
      window.location.reload();
    }
  };

  return (
    <div className="bo-errorPage">
      <div className="bo-errorPage__content">
        <div className="bo-errorPage__icon">
          <AlertTriangle size={48} strokeWidth={1.5} />
        </div>
        <div className="bo-errorPage__status">{statusCode}</div>
        <h1 className="bo-errorPage__title">{content.title}</h1>
        <p className="bo-errorPage__message">{content.message}</p>
        <div className="bo-errorPage__actions">
          {content.primaryAction === "reload" ? (
            <button type="button" className="bo-btn bo-btn--primary" onClick={handleRetry}>
              <RefreshCw size={14} strokeWidth={1.8} />
              {content.primaryLabel}
            </button>
          ) : (
            <a href={content.primaryHref ?? "/app"} className="bo-btn bo-btn--primary">
              <LogIn size={14} strokeWidth={1.8} />
              {content.primaryLabel}
            </a>
          )}
          <a href={content.secondaryHref} className="bo-btn bo-btn--ghost">
            <Home size={14} strokeWidth={1.8} />
            {content.secondaryLabel}
          </a>
        </div>
      </div>
    </div>
  );
}
