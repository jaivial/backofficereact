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
    <div className="flex flex-col items-center text-center max-w-[400px] p-6">
      <div className="flex flex-col items-center">
        <div className="text-bo-accent mb-4">
          <AlertTriangle size={48} strokeWidth={1.5} />
        </div>
        <div className="text-7xl font-bold leading-none text-bo-text opacity-15 mb-[-8px]">{statusCode}</div>
        <h1 className="text-xl font-bold text-bo-text mb-2">{content.title}</h1>
        <p className="text-sm text-text-muted mb-4">{content.message}</p>
        <div className="flex flex-wrap gap-2 justify-center">
          {content.primaryAction === "reload" ? (
            <button type="button" className="h-10 rounded-xl border border-primary/30 bg-primary/16 font-semibold inline-flex items-center justify-center gap-2 px-4 transition-all hover:-translate-y-0.5" onClick={handleRetry}>
              <RefreshCw size={14} strokeWidth={1.8} />
              {content.primaryLabel}
            </button>
          ) : (
            <a href={content.primaryHref ?? "/app/backoffice"} className="h-10 rounded-xl border border-primary/30 bg-primary/16 font-semibold inline-flex items-center justify-center gap-2 px-4 transition-all hover:-translate-y-0.5">
              <LogIn size={14} strokeWidth={1.8} />
              {content.primaryLabel}
            </a>
          )}
          <a href={content.secondaryHref} className="h-10 rounded-xl border border-white/[0.06] bg-white/[0.03] font-semibold inline-flex items-center justify-center gap-2 px-4 transition-all hover:-translate-y-0.5">
            <Home size={14} strokeWidth={1.8} />
            {content.secondaryLabel}
          </a>
        </div>
      </div>
    </div>
  );
}
