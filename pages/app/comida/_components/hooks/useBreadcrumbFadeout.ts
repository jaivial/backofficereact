import { useEffect, type RefObject } from "react";

const FADE_MS = 250;

/**
 * Fade the container out before navigating via a breadcrumb link.
 *
 * Breadcrumb links carry `data-vike="false"`, so Vike's client router ignores
 * them. We intercept the click, prevent the native navigation, run the CSS
 * fade (`is-navigating`), then do a full-page navigation once the fade ends.
 * Full-page navigation avoids Vike's empty-page bug on detail -> list.
 *
 * The `is-navigating` class is applied to `document.body` — outside React's
 * control — so that React's `className` reconciliation cannot overwrite it
 * if a re-render occurs during the fadeout window.
 *
 * @param _ref - Unused but kept for API compatibility; the class goes on body.
 */
export function useBreadcrumbFadeout(_ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    let navigating = false;

    const onClick = (e: MouseEvent) => {
      if (navigating) return;
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

      const link = (e.target as HTMLElement).closest<HTMLAnchorElement>('[data-role="breadcrumb-link"]');
      if (!link) return;

      const href = link.getAttribute("href");
      if (!href || href === window.location.pathname + window.location.search) return;

      e.preventDefault();
      navigating = true;
      document.body.classList.add("is-navigating");
      window.setTimeout(() => {
        window.location.href = href;
      }, FADE_MS);
    };

    document.addEventListener("click", onClick);
    return () => {
      document.removeEventListener("click", onClick);
    };
  }, []);
}
