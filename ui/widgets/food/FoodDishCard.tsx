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
      className={`bo-memberCard bo-foodMemberCard${clickable ? " is-clickable" : ""}${className ? ` ${className}` : ""}`}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      aria-label={clickable ? openAriaLabel || `Abrir detalle de ${title}` : undefined}
      onClick={clickable ? onOpen : undefined}
      onKeyDown={clickable ? onKeyDown : undefined}
    >
      {showMedia ? (
        <div className="bo-foodMemberMedia">
          {mediaInteractive ? (
            <button
              type="button"
              className="bo-foodMemberMediaButton"
              onClick={onMediaClick}
              aria-label={mediaActionAriaLabel || `Subir imagen de ${title}`}
              disabled={mediaActionDisabled || isMediaLoading}
            >
              {isMediaLoading ? (
                <div className="bo-foodMemberMediaSkeleton" aria-hidden="true" />
              ) : hasImage ? (
                <img src={imageUrl || undefined} alt="" loading="lazy" decoding="async" onError={() => setImageFailed(true)} />
              ) : (
                <div className="bo-foodMemberMediaPlaceholder">
                  <UtensilsCrossed size={30} />
                </div>
              )}
              <span className="bo-foodMemberMediaOverlay" aria-hidden="true">
                <Upload size={22} />
              </span>
            </button>
          ) : (
            <>
              {isMediaLoading ? (
                <div className="bo-foodMemberMediaSkeleton" aria-hidden="true" />
              ) : hasImage ? (
                <img src={imageUrl || undefined} alt="" loading="lazy" decoding="async" onError={() => setImageFailed(true)} aria-hidden="true" />
              ) : (
                <div className="bo-foodMemberMediaPlaceholder" aria-hidden="true">
                  <UtensilsCrossed size={30} />
                </div>
              )}
            </>
          )}
        </div>
      ) : null}

      <div className={`bo-foodMemberBody${bodyClassName ? ` ${bodyClassName}` : ""}`}>
        <div className="bo-foodMemberTitleRow">
          <h3 className="bo-foodMemberTitle">{title}</h3>
          {inactive ? <span className="bo-badge bo-badge--danger">Inactivo</span> : null}
        </div>

        {primaryMeta ? <div className="bo-foodMemberMeta">{primaryMeta}</div> : null}
        {secondaryMeta ? <div className="bo-foodMemberSubMeta">{secondaryMeta}</div> : null}

        {children}

        {priceLabel || footerActions ? (
          <div className="bo-foodMemberFooter">
            {priceLabel ? <span className="bo-foodMemberPrice">{priceLabel}</span> : <span className="bo-foodMemberPriceSpacer" aria-hidden="true" />}
            {footerActions ? <div className="bo-foodMemberActions">{footerActions}</div> : null}
          </div>
        ) : null}
      </div>
    </article>
  );
});
