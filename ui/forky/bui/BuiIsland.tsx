import { useEffect, type ReactNode } from "react";

/* ─────────────────────────────────────────────────────────
 * BUI ISLAND
 * Scoping wrapper for the literal beautifului.dev components.
 *
 * The components in ./ use beautifului.dev's own utility class
 * names (bg-surface, text-ink, rounded-card, …) verbatim. Those
 * names do not exist in the backoffice Tailwind config, and the
 * global stylesheets must not restyle them either. Adding this
 * wrapper class activates forky-bui-island.css, which:
 *   - defines the beautifului.dev tokens on the island root
 *     (dark by default, light via :root[data-theme="light"]),
 *   - re-declares every utility the components use, scoped to
 *     `.bui-scope` so nothing leaks in or out.
 *
 * It also mirrors the backoffice theme onto the `.dark` html class
 * while at least one island is mounted: the literal components
 * (e.g. InsightCards' useDarkMode) read that class for their canvas
 * themes. The backoffice keys dark styles on [data-theme] only, so
 * toggling `.dark` cannot restyle the host app.
 *
 * Always mount BUI components inside <BuiIsland>.
 */

let islandCount = 0;

function syncDarkClass() {
  const root = document.documentElement;
  const light = root.getAttribute("data-theme") === "light";
  root.classList.toggle("dark", !light);
}

export function BuiIsland({
  children,
  className,
  ...rest
}: {
  children: ReactNode;
  className?: string;
} & Omit<React.HTMLAttributes<HTMLDivElement>, "children" | "className">) {
  useEffect(() => {
    if (islandCount++ > 0) return;
    syncDarkClass();
    const observer = new MutationObserver(syncDarkClass);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => {
      observer.disconnect();
      if (--islandCount === 0) document.documentElement.classList.remove("dark");
    };
  }, []);

  return (
    <div data-slot="buiIsland-div" className={`bui-scope ${className ?? ""}`} {...rest}>
      {children}
    </div>
  );
}
