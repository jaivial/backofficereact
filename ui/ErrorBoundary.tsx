import { Component, ReactNode, ErrorInfo } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Route/page name for error context */
  page?: string;
  /** Called when an error is caught — use to report to your backend */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  /** Fallback UI to render after an error is caught */
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * Catches React rendering errors and reports them to the backend
 * via POST /api/admin/errors so they appear in server-side logs.
 *
 * Usage:
 *   <ErrorBoundary page="reservas">
 *     <ReservasPage />
 *   </ErrorBoundary>
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo });

    // Report to backend
    this.reportError(error, errorInfo);

    // Call the optional onError prop
    this.props.onError?.(error, errorInfo);
  }

  private async reportError(error: Error, errorInfo: ErrorInfo): Promise<void> {
    try {
      const payload = {
        message: error.message,
        name: error.name,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        page: this.props.page ?? "unknown",
        url: typeof window !== "undefined" ? window.location.href : undefined,
        userAgent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
        timestamp: new Date().toISOString(),
      };

      // Report to backend (fire-and-forget; do not block the error boundary)
      await fetch("/api/admin/errors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        // Credentials so session cookie is sent (for admin auth context in logs)
        credentials: "include",
      }).catch(() => {
        // Silently ignore fetch failures — error reporting must never break the UI
      });
    } catch {
      // swallow
    }
  }

  private handleRetry = (): void => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div
          data-ui="error-boundary-fallback"
          data-page={this.props.page ?? "unknown"}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "200px",
            padding: "24px",
            textAlign: "center",
            color: "var(--bo-muted, #9ca3af)",
          }}
        >
          <svg
            data-ui="error-icon"
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <h2
            data-ui="error-title"
            style={{ margin: "16px 0 8px", fontSize: "18px", fontWeight: 650 }}
          >
            Algo salio mal
          </h2>
          <p
            data-ui="error-message"
            style={{ margin: "0 0 16px", fontSize: "14px", maxWidth: "360px" }}
          >
            {this.state.error?.message ?? "Error desconocido"}
          </p>
          <button
            data-ui="error-retry-button"
            data-testid="error-retry-button"
            onClick={this.handleRetry}
            style={{
              padding: "8px 20px",
              borderRadius: "8px",
              background: "var(--bo-accent, #8b5cf6)",
              color: "#fff",
              border: "none",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: 600,
            }}
          >
            Reintentar
          </button>
          {import.meta.env.DEV && this.state.error?.stack && (
            <pre
              data-ui="error-stack"
              style={{
                marginTop: "16px",
                padding: "12px",
                background: "#1f1f1f",
                borderRadius: "8px",
                fontSize: "11px",
                textAlign: "left",
                overflow: "auto",
                maxWidth: "600px",
                maxHeight: "200px",
                color: "#d1d5db",
              }}
            >
              {this.state.error.stack}
            </pre>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
