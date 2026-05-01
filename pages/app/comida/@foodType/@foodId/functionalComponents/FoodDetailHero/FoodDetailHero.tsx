import React, { useMemo, type ChangeEvent } from "react";
import { Camera, ImagePlus, Loader2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import type { FoodItem, Vino } from "../../../../../../../api/types";
import type { HeroBadge } from "../../types";
import { FOOD_TYPE_ICONS } from "../../constants";
import { FOOD_TYPE_LABELS } from "../../../../_components/foodTypes";
import { formatEuro } from "../../helpers";

interface FoodDetailHeroProps {
  item: FoodItem | Vino | null;
  foodType: string;
  title: string;
  aiGenerating: boolean;
  imageUrl: string;
  uploading: boolean;
  aiBusy: boolean;
  supportsQuickEditor: boolean;
  heroBadges: HeroBadge[];
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onImageSelect: (e: ChangeEvent<HTMLInputElement>) => void;
  onImageUpdate?: (file: File) => void;
}

export function FoodDetailHero({
  item,
  foodType,
  title,
  aiGenerating,
  imageUrl,
  uploading,
  aiBusy,
  supportsQuickEditor,
  heroBadges,
  fileInputRef,
  onImageSelect,
  onImageUpdate,
}: FoodDetailHeroProps) {
  const TypeIcon =
    FOOD_TYPE_ICONS[foodType as keyof typeof FOOD_TYPE_ICONS] || ((() => null) as LucideIcon);
  const busy = uploading || aiBusy;
  const hasImage = Boolean(imageUrl);
  const showHoverOverlay = supportsQuickEditor && hasImage && onImageUpdate;

  const handleOverlayClick = () => {
    fileInputRef.current?.click();
  };

  const eyebrow = `${FOOD_TYPE_LABELS[foodType as keyof typeof FOOD_TYPE_LABELS] ?? foodType} · #${
    item?.num ?? "—"
  }`;

  return (
    <div
      className="bo-panel bo-foodDetailHero"
      data-ui="food-detail-hero"
    >
      {/* ── Media column ── */}
      <div
        className={`bo-foodDetailMedia${showHoverOverlay ? " bo-foodDetailMedia--editable" : ""}`}
        data-slot="food-detail-media"
        onClick={showHoverOverlay ? handleOverlayClick : undefined}
        role={showHoverOverlay ? "button" : undefined}
        tabIndex={showHoverOverlay ? 0 : undefined}
        onKeyDown={
          showHoverOverlay
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleOverlayClick();
                }
              }
            : undefined
        }
        aria-label={showHoverOverlay ? "Actualizar imagen" : undefined}
      >
        {aiGenerating ? (
          <div
            className="bo-foodDetailMediaSkeleton flex items-center justify-center"
            data-role="food-detail-image-skeleton"
          >
            <Loader2
              size={36}
              className="bo-foodDetailSpinIcon animate-spin"
              data-role="food-detail-skeleton-spinner"
            />
          </div>
        ) : hasImage ? (
          <>
            <img
              src={imageUrl}
              alt={`Imagen de ${title}`}
              loading="lazy"
              decoding="async"
              data-role="food-detail-image"
            />
            {/* Hover overlay */}
            <div
              className="bo-foodDetailMediaOverlay"
              data-ui="food-detail-media-overlay"
              aria-hidden="true"
            >
              <Camera size={28} strokeWidth={1.5} data-slot="overlay-camera-icon" />
              <span className="bo-foodDetailOverlayLabel" data-slot="overlay-label">
                Actualizar imagen
              </span>
            </div>
          </>
        ) : (
          <div
            className="bo-foodDetailMediaPlaceholder"
            aria-hidden="true"
            data-role="food-detail-media-placeholder"
          >
            <TypeIcon size={44} data-role="food-detail-type-icon" />
          </div>
        )}

        {/* Loading overlay */}
        {busy && (
          <div
            className="bo-foodDetailMediaLoadingOverlay"
            data-ui="food-detail-media-loading"
            aria-label="Subiendo imagen..."
          >
            <Loader2
              size={24}
              className="bo-foodDetailSpinIcon animate-spin"
              data-slot="media-loading-spinner"
            />
          </div>
        )}
      </div>

      {/* ── Action button ── */}
      {supportsQuickEditor && (
        <button
          data-role="food-detail-change-photo-btn"
          type="button"
          className="bo-btn bo-btn--glass bo-foodDetailPhotoBtn"
          onClick={() => fileInputRef.current?.click()}
          disabled={busy}
        >
          {busy ? (
            <Loader2 size={14} className="animate-spin" data-role="btn-spinner" />
          ) : hasImage ? (
            <Camera size={14} data-role="btn-camera-icon" />
          ) : (
            <ImagePlus size={14} data-role="btn-add-icon" />
          )}
          {hasImage ? "Actualizar imagen" : "Añadir imagen"}
        </button>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        onChange={onImageSelect}
        className="hidden"
        data-role="food-detail-file-input"
      />

      {/* ── Info column ── */}
      <div
        className="bo-foodDetailHeroBody"
        data-slot="food-detail-hero-body"
      >
        <div
          className="bo-foodDetailHeroIdentity"
          data-slot="food-detail-hero-identity"
        >
          <div className="bo-foodDetailEyebrow" data-role="food-detail-eyebrow">
            {eyebrow}
          </div>
          <div className="bo-foodDetailTitleRow" data-ui="food-detail-title-row">
            <TypeIcon
              className="bo-foodDetailTypeIcon"
              size={18}
              aria-hidden="true"
              data-ui="food-detail-title-icon"
            />
            <div
              className="bo-panelTitle bo-foodDetailTitle"
              data-role="food-detail-title"
            >
              {title}
            </div>
          </div>
          <div className="bo-foodDetailBadgeRow" data-slot="food-detail-badge-row">
            {heroBadges.map((badge) => (
              <span
                key={badge.id}
                className={`bo-badge ${badge.className}`}
                data-role="food-detail-hero-badge"
              >
                {badge.label}
              </span>
            ))}
          </div>
        </div>

        {foodType !== "platos" ? (
          <div
            className="bo-foodDetailPriceWrap"
            data-ui="food-detail-price-wrap"
          >
            <span
              className="bo-foodDetailPriceLabel"
              data-role="food-detail-price-label"
            >
              Precio carta
            </span>
            <div
              className="bo-foodDetailPrice"
              data-role="food-detail-price-value"
            >
              {formatEuro(item?.precio ?? 0)}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
