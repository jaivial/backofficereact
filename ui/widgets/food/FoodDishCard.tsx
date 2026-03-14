import React, { useCallback, useEffect, useRef, useState } from "react";
import { Upload, UtensilsCrossed } from "lucide-react";

type FoodDishCardProps = {
  title: string;
  imageUrl?: string | null;
  showMedia?: boolean;
  mediaLoading?: boolean;
  inactive?: boolean;
  primaryMeta?: string;
  secondaryMeta?: string;
  priceLabel?: string;
  onOpen?: () => void;
  openAriaLabel?: string;
  onMediaAction?: () => void;
  mediaActionAriaLabel?: string;
  mediaActionDisabled?: boolean;
  footerActions?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  debugId?: string;
};

export const FoodDishCard = React.memo(function FoodDishCard({
  title,
  imageUrl,
  showMedia = true,
  mediaLoading,
  inactive,
  primaryMeta,
  secondaryMeta,
  priceLabel,
  onOpen,
  openAriaLabel,
  onMediaAction,
  mediaActionAriaLabel,
  mediaActionDisabled,
  footerActions,
  children,
  className,
  bodyClassName,
  debugId,
}: FoodDishCardProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const renderCountRef = useRef(0);
  renderCountRef.current += 1;

  useEffect(() => {
    setImageFailed(false);
  }, [imageUrl]);

  useEffect(() => {
    if (!debugId || typeof window === "undefined") return;
    const globalDebug = (window as any).__MENU_PERF_DEBUG === true;
    let storageDebug = false;
    try {
      storageDebug = window.localStorage.getItem("menuPerfDebug") === "1";
    } catch {
      storageDebug = false;
    }
    if (!globalDebug && !storageDebug) return;
    console.log("[menus/crear perf] card-render", {
      debugId,
      render: renderCountRef.current,
      title,
      inactive: !!inactive,
    });
  });

  const clickable = typeof onOpen === "function";
  const mediaInteractive = typeof onMediaAction === "function";
  const isMediaLoading = !!mediaLoading;
  const hasImage = !!imageUrl && !imageFailed;

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLElement>) => {
      if (!onOpen) return;
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onOpen();
      }
    },
    [onOpen],
  );

  const onMediaClick = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.stopPropagation();
      if (!onMediaAction || mediaActionDisabled) return;
      onMediaAction();
    },
    [mediaActionDisabled, onMediaAction],
  );

  return (
    <article
      className={`rounded-xl border border-white/[0.06] bg-gradient-to-b from-white/[0.04] to-black/[0.10] overflow-hidden transition-all duration-150 hover:-translate-y-0.5 hover:shadow-lg hover:border-white/[0.12]${clickable ? " cursor-pointer" : ""}${className ? ` ${className}` : ""}`}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      aria-label={clickable ? openAriaLabel || `Abrir detalle de ${title}` : undefined}
      onClick={clickable ? onOpen : undefined}
      onKeyDown={clickable ? onKeyDown : undefined}
    >
      {showMedia ? (
        <div className="aspect-[4/3] relative bg-white/[0.02]">
          {mediaInteractive ? (
            <button
              type="button"
              className="absolute inset-0 w-full h-full flex items-center justify-center bg-black/40 opacity-0 hover:opacity-100 transition-opacity"
              onClick={onMediaClick}
              aria-label={mediaActionAriaLabel || `Subir imagen de ${title}`}
              disabled={mediaActionDisabled || isMediaLoading}
            >
              {isMediaLoading ? (
                <div className="absolute inset-0 bg-white/5 animate-pulse" aria-hidden="true" />
              ) : hasImage ? (
                <img src={imageUrl || undefined} alt="" loading="lazy" decoding="async" onError={() => setImageFailed(true)} />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-white/60">
                  <UtensilsCrossed size={30} />
                </div>
              )}
              <span className="absolute inset-0 flex items-center justify-center text-white/90">
                <Upload size={22} />
              </span>
            </button>
          ) : (
            <>
              {isMediaLoading ? (
                <div className="absolute inset-0 bg-white/5 animate-pulse" aria-hidden="true" />
              ) : hasImage ? (
                <img src={imageUrl || undefined} alt="" loading="lazy" decoding="async" onError={() => setImageFailed(true)} aria-hidden="true" className="w-full h-full object-cover" />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-white/30" aria-hidden="true">
                  <UtensilsCrossed size={30} />
                </div>
              )}
            </>
          )}
        </div>
      ) : null}

      <div className={`p-3${bodyClassName ? ` ${bodyClassName}` : ""}`}>
        <div className="flex items-start justify-between gap-2 mb-1">
          <h3 className="text-sm font-semibold leading-tight flex-1">{title}</h3>
          {inactive ? <span className="px-1.5 py-0.5 text-[10px] font-medium rounded-full bg-red-500/20 text-red-400 border border-red-500/30">Inactivo</span> : null}
        </div>

        {primaryMeta ? <div className="text-xs text-muted-foreground">{primaryMeta}</div> : null}
        {secondaryMeta ? <div className="text-xs text-white/50">{secondaryMeta}</div> : null}

        {children}

        {priceLabel || footerActions ? (
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/[0.06]">
            {priceLabel ? <span className="text-sm font-semibold text-primary">{priceLabel}</span> : <span aria-hidden="true" />}
            {footerActions ? <div className="flex items-center gap-1">{footerActions}</div> : null}
          </div>
        ) : null}
      </div>
    </article>
  );
});
