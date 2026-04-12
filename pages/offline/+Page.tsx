import React from "react";
import { WifiOff } from "lucide-react";

export default function OfflinePage() {
  return (
    <div
      className="flex flex-col items-center justify-center min-h-screen px-6 text-center bg-[hsl(var(--background))]"
      data-ui="offline-page"
    >
      <div
        className="w-20 h-20 rounded-2xl bg-[hsl(var(--muted))] flex items-center justify-center mb-6"
        data-ui="offline-icon-wrap"
        aria-hidden="true"
      >
        <WifiOff size={40} strokeWidth={1.5} className="text-[hsl(var(--muted-foreground))]" aria-hidden="true" />
      </div>

      <h1
        className="text-2xl font-bold text-[hsl(var(--foreground))] mb-2"
        data-ui="offline-title"
      >
        Sin conexion
      </h1>

      <p
        className="text-base text-[hsl(var(--muted-foreground))] max-w-xs mb-8"
        data-ui="offline-message"
      >
        No tienes conexion a internet. Comprueba tu red Wi-Fi o datos moviles y prueba de nuevo.
      </p>

      <button
        onClick={() => window.location.reload()}
        className="px-6 py-3 rounded-xl bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] font-semibold active:scale-95 transition-transform"
        data-ui="offline-retry-btn"
        data-role="retry"
      >
        Reintentar
      </button>
    </div>
  );
}
