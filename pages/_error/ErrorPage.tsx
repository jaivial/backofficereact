import React from "react";
import { AlertTriangle, Home, LogIn, RefreshCw } from "lucide-react";
import { usePageContext } from "vike-react/usePageContext";

import { ERROR_CONTENT } from "./constants/errorContent";
import { resolveStatusCode } from "./helpers/resolveStatusCode";

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
    <div className="bo-errorPage" data-ui="error-page">
      <div className="bo-errorPage__content" data-ui="error-content">
        <div className="bo-errorPage__icon" data-ui="error-icon">
          <AlertTriangle size={48} strokeWidth={1.5}>
        </div>
        <div className="bo-errorPage__status" data-ui="error-status">{statusCode}</div>
        <h1 className="bo-errorPage__title" data-ui="error-title">{content.title}</h1>
        <p className="bo-errorPage__message" data-ui="error-message">{content.message}</p>
        <div className="bo-errorPage__actions" data-ui="error-actions">
          {content.primaryAction === "reload" ? (
            <button
              type="button"
              className="bo-btn bo-btn--primary"
              onClick={handleRetry}
              data-ui="error-retry-btn"
            >
              <RefreshCw size={14} strokeWidth={1.8}>
              {content.primaryLabel}
            </button>
          ) : (
            <a
              href={content.primaryHref ?? "/app/backoffice"}
              className="bo-btn bo-btn--primary"
              data-ui="error-primary-link"
            >
              <LogIn size={14} strokeWidth={1.8}>
              {content.primaryLabel}
            </a>
          )}
          <a
            href={content.secondaryHref}
            className="bo-btn bo-btn--ghost"
            data-ui="error-secondary-link"
          >
            <Home size={14} strokeWidth={1.8}>
            {content.secondaryLabel}
          </a>
        </div>
      </div>
    </div>
  );
}
