/**
 * Menus Page Types
 * TypeScript interfaces and types specific to the menus page
 */

import type { GroupMenuV2Summary } from "../../../../api/types";

export type PageData = {
  menus: GroupMenuV2Summary[];
  error: string | null;
};

export type MenuStatusFilter = string;
export type MenuSortOption = string;
