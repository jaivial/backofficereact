import React, { useState } from "react";
import { useAtomValue } from "jotai";
import { Receipt, Download, ChevronRight, Search } from "lucide-react";
import { sessionAtom } from "../../../../state/atoms";

export default function MobileFacturasPage() {
  const session = useAtomValue(sessionAtom);

  if (!session) return null;

  return (
    <div className="flex flex-col gap-4 p-4" data-ui="mobile-facturas">
      <header className="pt-2" data-ui="mobile-facturas-header">
        <h1 className="text-xl font-bold text-[hsl(var(--foreground))]" data-ui="mobile-facturas-title">Facturas</h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))]" data-ui="mobile-facturas-subtitle">Ultimas facturas</p>
      </header>

      {/* Search bar */}
      <div className="relative" data-ui="mobile-facturas-search">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" strokeWidth={1.8} aria-hidden="true" />
        <input
          type="search"
          placeholder="Buscar factura..."
          className="w-full pl-10 pr-4 py-3 rounded-xl border border-[hsl(var(--input))] bg-[hsl(var(--background))] text-[hsl(var(--foreground))] text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
          data-ui="mobile-facturas-search-input"
          aria-label="Buscar factura"
        />
      </div>

      {/* Placeholder empty state */}
      <div className="flex flex-col items-center justify-center py-12 text-center" data-ui="mobile-facturas-empty">
        <Receipt size={40} strokeWidth={1.5} className="text-[hsl(var(--muted-foreground))] mb-3" aria-hidden="true" />
        <p className="text-[hsl(var(--muted-foreground))] text-sm">No hay facturas recientes</p>
        <a
          href="/m/app/facturas/all"
          className="mt-4 text-sm font-medium text-[hsl(var(--primary))] no-underline flex items-center gap-1"
          data-ui="mobile-facturas-view-all"
        >
          Ver todas <ChevronRight size={14} strokeWidth={2} aria-hidden="true" />
        </a>
      </div>
    </div>
  );
}
