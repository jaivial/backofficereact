import React, { useCallback, useEffect, useRef, useState } from "react";
import { Upload, UtensilsCrossed } from "lucide-react";

import { cn } from "../../shadcn/utils";

type FoodDishCardProps = {
  title: string;
  imageUrl?: string | null;
  showMedia?: boolean;
  mediaLoading?: boolean;
  inactive?: boolean;
  stockBadge?: { tone: "danger" | "yellow"; label: string };
  primaryMeta?: string;
  secondaryMeta?: string;
  priceLabel?: string;
  onOpen?: () => void;
  openAriaLabel?: string;
  onMediaAction?: () => void;
  mediaActionAriaLabel?: string;
  mediaActionDisabled?: boolean;
  showTitleRow?: boolean;
  footerActions?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  debugId?: string;
  horizontal?: boolean;
  testId?: string;
};

export const FoodDishCard = React.memo(function FoodDishCard({
  title,
  imageUrl,
  showMedia = true,
  mediaLoading,
  inactive,
  stockBadge,
  primaryMeta,
  secondaryMeta,
  priceLabel,
  onOpen,
  openAriaLabel,
  onMediaAction,
  mediaActionAriaLabel,
  mediaActionDisabled,
  showTitleRow = true,
  footerActions,
  children,
  className,
  bodyClassName,
  debugId,
  horizontal,
  testId,
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
      data-ui="dish-card"
      className={cn("bo-memberCard bo-foodMemberCard", clickable && "is-clickable", horizontal && "bo-foodMemberCard--horizontal", className)}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      data-testid={testId}
      aria-label={clickable ? openAriaLabel || `Abrir detalle de ${title}` : undefined}
      onClick={clickable ? onOpen : undefined}
      onKeyDown={clickable ? onKeyDown : undefined}
    >
      {showMedia ? (
        <div data-ui="dish-card-media" className="bo-foodMemberMedia">
          {mediaInteractive ? (
            <button
              data-role="dish-card-media-trigger"
              type="button"
              className="bo-foodMemberMediaButton"
              onClick={onMediaClick}
              aria-label={mediaActionAriaLabel || `Subir imagen de ${title}`}
              disabled={mediaActionDisabled || isMediaLoading}
            >
              {isMediaLoading ? (
                <div data-ui="dish-card-media-skeleton" className="bo-foodMemberMediaSkeleton" aria-hidden="true" />
              ) : hasImage ? (
                <img data-role="dish-card-image" src={imageUrl || undefined} alt="" loading="lazy" decoding="async" onError={() => setImageFailed(true)} />
              ) : (
                <div data-ui="dish-card-media-placeholder" className="bo-foodMemberMediaPlaceholder">
                  <UtensilsCrossed size={30} />
                </div>
              )}
              <span data-ui="dish-card-media-overlay" className="bo-foodMemberMediaOverlay" aria-hidden="true">
                <Upload size={22} />
              </span>
            </button>
          ) : (
            <>
              {isMediaLoading ? (
                <div data-ui="dish-card-media-skeleton" className="bo-foodMemberMediaSkeleton" aria-hidden="true" />
              ) : hasImage ? (
                <img data-role="dish-card-image" src={imageUrl || undefined} alt="" loading="lazy" decoding="async" onError={() => setImageFailed(true)} aria-hidden="true" />
              ) : (
                <div data-ui="dish-card-media-placeholder" className="bo-foodMemberMediaPlaceholder" aria-hidden="true">
                  <UtensilsCrossed size={30} />
                </div>
              )}
            </>
          )}
        </div>
      ) : null}

      <div data-ui="dish-card-body" className={cn("bo-foodMemberBody", bodyClassName)}>
        {showTitleRow ? (
          <div data-ui="dish-card-title-row" className="bo-foodMemberTitleRow">
            <h3 data-role="dish-card-title" className="bo-foodMemberTitle">{title}</h3>
            {inactive ? <span data-role="dish-card-inactive-badge" className="bo-badge bo-badge--danger">Inactivo</span> : null}
            {stockBadge ? <span data-role="dish-card-stock-badge" className={`bo-badge bo-badge--${stockBadge.tone}`}>{stockBadge.label}</span> : null}
          </div>
        ) : null}

        {primaryMeta ? <div data-ui="dish-card-meta" className="bo-foodMemberMeta">{primaryMeta}</div> : null}
        {secondaryMeta ? <div data-ui="dish-card-submeta" className="bo-foodMemberSubMeta">{secondaryMeta}</div> : null}

        {children}

        {priceLabel || footerActions ? (
          <div data-ui="dish-card-footer" className="bo-foodMemberFooter">
            {priceLabel ? <span data-role="dish-card-price" className="bo-foodMemberPrice">{priceLabel}</span> : <span data-ui="dish-card-price-spacer" className="bo-foodMemberPriceSpacer" aria-hidden="true" />}
            {footerActions ? <div data-ui="dish-card-actions" className="bo-foodMemberActions">{footerActions}</div> : null}
          </div>
        ) : null}
      </div>
    </article>
  );
});
