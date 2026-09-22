import React from "react";

/**
 * Reusable media skeleton: shown while an image upload is being processed by
 * the server-side background task. Every usage must pass its own `testId`.
 *
 * Coordination id: special_menu_sections_image_state_v1
 */
export function MediaSkeleton({
  testId,
  label = "Cargando imagen",
  aspectRatio = "4 / 3",
}: {
  testId: string;
  label?: string;
  aspectRatio?: string;
}) {
  return (
    <div
      className="bo-mediaSkeleton"
      style={{ aspectRatio }}
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={label}
      data-testid={testId}
      data-slot="media-skeleton"
      data-coordination-id="special_menu_sections_image_state_v1"
    >
      <span className="bo-mediaSkeletonGlow" aria-hidden="true" data-testid={`${testId}-glow`} />
    </div>
  );
}
