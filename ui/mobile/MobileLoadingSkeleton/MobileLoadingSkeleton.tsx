import React from "react";

interface SkeletonProps {
  className?: string;
  "data-ui"?: string;
}

export function Skeleton({ className = "", "data-ui": dataUi }: SkeletonProps) {
  return (
    <div
      className={["animate-pulse rounded-lg bg-[hsl(var(--muted))]/50", className].join(" ")}
      data-ui={dataUi}
      aria-hidden="true"
      role="presentation"
    />
  );
}

interface MobileLoadingSkeletonProps {
  type?: "list" | "card" | "form";
  count?: number;
  className?: string;
  "data-ui"?: string;
}

export function MobileLoadingSkeleton({
  type = "card",
  count = 3,
  className = "",
  "data-ui": dataUi,
}: MobileLoadingSkeletonProps) {
  if (type === "list") {
    return (
      <div className={["flex flex-col gap-3", className].join(" ")} data-ui={dataUi} aria-busy="true" aria-label="Cargando...">
        {Array.from({ length: count }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 p-4 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]"
            data-ui="mobile-skeleton-list-item"
          >
            <Skeleton className="w-10 h-10 rounded-full flex-shrink-0" />
            <div className="flex-1 flex flex-col gap-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (type === "form") {
    return (
      <div className={["flex flex-col gap-4", className].join(" ")} data-ui={dataUi} aria-busy="true" aria-label="Cargando...">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-12 w-full rounded-xl" />
        </div>
        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-12 w-full rounded-xl" />
        </div>
        <Skeleton className="h-12 w-full rounded-xl" />
      </div>
    );
  }

  // Default: card
  return (
    <div className={["flex flex-col gap-3", className].join(" ")} data-ui={dataUi} aria-busy="true" aria-label="Cargando...">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="flex flex-col gap-3 p-4 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]"
          data-ui="mobile-skeleton-card"
        >
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-3 w-1/3" />
        </div>
      ))}
    </div>
  );
}
