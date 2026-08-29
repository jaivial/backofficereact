export type OrderedNavItem = { key: string };

export function splitMobileNavigation<T extends OrderedNavItem>(items: readonly T[], visibleCount = 4): {
  primary: T[];
  overflow: T[];
} {
  const limit = Math.max(0, visibleCount);
  return {
    primary: items.slice(0, limit),
    overflow: items.slice(limit),
  };
}
