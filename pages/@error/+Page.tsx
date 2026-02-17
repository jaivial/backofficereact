import React from "react";
import { AlertTriangle, Home, RefreshCw } from "lucide-react";
import { usePageContext } from "vike-react/usePageContext";

export default function ErrorPage() {
  const pageContext = usePageContext();
  const statusCode = (pageContext as any).statusCode ?? 500;
  const isClient = typeof window !== "undefined";

  const title = statusCode === 404
    ? "Pagina no encontrada"
    : statusCode === 403
    ? "Acceso denegado"
    : "Error del servidor";

  const message = statusCode === 404
    ? "La pagina que buscas no existe o ha sido movida."
    : statusCode === 403
    ? "No tienes permisos para acceder a esta pagina."
    : "Ha ocurrido un error al cargar la pagina. Por favor, intentelo de nuevo.";

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
        <h1 className="bo-errorPage__title">{title}</h1>
        <p className="bo-errorPage__message">{message}</p>
        <div className="bo-errorPage__actions">
          <button
            type="button"
            className="bo-btn bo-btn--primary"
            onClick={handleRetry}
          >
            <RefreshCw size={14} strokeWidth={1.8} />
            Reintentar
          </button>
          <a href="/app" className="bo-btn bo-btn--ghost">
            <Home size={14} strokeWidth={1.8} />
            Ir al inicio
          </a>
        </div>
      </div>
    </div>
  );
}
