import { AutosaveInput } from "../../inputs/AutosaveInput";
import React, { useCallback, useRef } from "react";
import { GripVertical, Trash2, Upload } from "lucide-react";

import { MediaSkeleton } from "../../feedback/MediaSkeleton";

/**
 * Reusable card for one special-menu image section.
 *
 * One menu can carry several image sections, each with an optional title
 * rendered above the image. The editor handles its own state and calls the
 * supplied callbacks for every meaningful interaction, so the card itself
 * stays presentational and reusable across menu types.
 *
 * Coordination id: special_menu_sections_v1
 */

export type MenuImageSectionCardProps = {
  sectionId: number;
  title: string;
  imageUrl: string;
  /** Coordination id: special_menu_sections_image_state_v1 */
  imageState?: "empty" | "uploading" | "ready";
  busy?: boolean;
  dragHandleProps?: React.HTMLAttributes<HTMLButtonElement>;
  onTitleChange: (value: string) => void;
  onPickImage: (file: File) => void;
  onClearImage: () => void;
  onDelete: () => void;
};

function MenuImageSectionCardImpl({
  sectionId,
  title,
  imageUrl,
  imageState = "empty",
  busy = false,
  dragHandleProps,
  onTitleChange,
  onPickImage,
  onClearImage,
  onDelete,
}: MenuImageSectionCardProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const isUploading = imageState === "uploading";

  const openPicker = useCallback(() => {
    if (busy) return;
    const input = fileInputRef.current;
    if (!input) return;
    input.value = "";
    input.click();
  }, [busy]);

  const handleFileChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.currentTarget.value = "";
      if (!file) return;
      onPickImage(file);
    },
    [onPickImage],
  );

  return (
    <article
      className="bo-menuImageSectionCard"
      data-testid={`menu-image-section-card-${sectionId}`}
      data-slot="menu-image-section-card"
    >
      <header className="bo-menuImageSectionCardHead" data-slot="menu-image-section-card-head">
        <button
          type="button"
          className="bo-menuImageSectionCardDrag"
          aria-label="Reordenar seccion"
          {...dragHandleProps}
          data-testid={`menu-image-section-card-drag-${sectionId}`}
          data-slot="menu-image-section-card-drag"
        >
          <GripVertical size={16} />
        </button>
        <AutosaveInput
          className="bo-input bo-menuImageSectionCardTitle"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder="Titulo opcional"
          disabled={busy}
          data-testid={`menu-image-section-card-title-${sectionId}`}
          data-slot="menu-image-section-card-title"
        />
        <button
          type="button"
          className="bo-btn bo-btn--ghost bo-btn--danger"
          onClick={onDelete}
          disabled={busy}
          aria-label="Eliminar seccion"
          data-testid={`menu-image-section-card-delete-${sectionId}`}
          data-slot="menu-image-section-card-delete"
        >
          <Trash2 size={14} />
        </button>
      </header>

      <div className="bo-menuImageSectionCardMedia" data-slot="menu-image-section-card-media">
        {isUploading ? (
          <MediaSkeleton testId={`menu-image-section-card-media-skeleton-${sectionId}`} label="Subiendo imagen de la seccion" />
        ) : imageUrl ? (
          <div className="bo-menuImageSectionCardPreview" data-slot="menu-image-section-card-preview">
            <img src={imageUrl} alt={title || "Imagen de la seccion"} loading="lazy" decoding="async" data-slot="menu-image-section-card-image" />
            <div className="bo-menuImageSectionCardActions" data-slot="menu-image-section-card-actions">
              <button
                type="button"
                className="bo-btn bo-btn--ghost bo-btn--sm"
                onClick={openPicker}
                disabled={busy}
                data-testid={`menu-image-section-card-change-${sectionId}`}
                data-slot="menu-image-section-card-change"
              >
                <Upload size={14} /> {busy || isUploading ? "Procesando..." : "Cambiar imagen"}
              </button>
              <button
                type="button"
                className="bo-btn bo-btn--ghost bo-btn--danger"
                onClick={onClearImage}
                disabled={busy}
                data-testid={`menu-image-section-card-clear-${sectionId}`}
                data-slot="menu-image-section-card-clear"
              >
                <Trash2 size={14} /> Quitar imagen
              </button>
            </div>
          </div>
        ) : (
          <div className="bo-menuImageSectionCardDropzone" data-slot="menu-image-section-card-dropzone">
            <Upload size={32} />
            <p data-slot="menu-image-section-card-empty-title">Sube una imagen para esta seccion</p>
            <p className="bo-mutedText" data-slot="menu-image-section-card-empty-meta">PNG, JPG, WEBP o GIF hasta 10MB</p>
            <button
              type="button"
              className="bo-btn bo-btn--ghost bo-btn--sm"
              onClick={openPicker}
              disabled={busy}
              data-testid={`menu-image-section-card-upload-${sectionId}`}
              data-slot="menu-image-section-card-upload"
            >
              <Upload size={14} /> {busy || isUploading ? "Procesando..." : "Subir imagen"}
            </button>
          </div>
        )}
      </div>

      <AutosaveInput
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="bo-hiddenFileInput"
        onChange={handleFileChange}
        data-testid={`menu-image-section-card-file-${sectionId}`}
        data-slot="menu-image-section-card-file"
      />
    </article>
  );
}

export const MenuImageSectionCard = React.memo(MenuImageSectionCardImpl);
