import type { ReactNode } from "react";

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
 * Always mount BUI components inside <BuiIsland>.
 */
export function BuiIsland({
  children,
  className,
  ...rest
}: {
  children: ReactNode;
  className?: string;
} & Omit<React.HTMLAttributes<HTMLDivElement>, "children" | "className">) {
  return (
    <div className={`bui-scope ${className ?? ""}`} {...rest}>
      {children}
    </div>
  );
}
