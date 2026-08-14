/**
 * Helpers for the table-map layout template.
 *
 * The "template" owns cross-day data (limit area + draw elements). The
 * "per-day layout" stores customer-specific data (booking_states, table
 * positions, optional day-specific overrides of the template fields).
 *
 * The toggle in the side panel decides which source the front-end treats as
 * authoritative when sending edits to the server.
 */

import type { TableMapLayoutTemplate, TableMapTemplateScope } from "../../../../../api/types";

export type LayoutWithScope = {
  layout: Record<string, unknown>;
  template?: TableMapLayoutTemplate;
  scope: TableMapTemplateScope;
};

/**
 * Returns true when the saved layout payload looks like a non-empty
 * template (it has at least one known template field, or the legacy
 * `limit_area_template_points` key).
 */
export function isNonEmptyTemplate(tpl: unknown): boolean {
  if (!tpl || typeof tpl !== "object") return false;
  const obj = tpl as Record<string, unknown>;
  if (Array.isArray(obj.limit_area_template_points) && obj.limit_area_template_points.length > 0) {
    return true;
  }
  if (Array.isArray(obj.draw_elements_template) && obj.draw_elements_template.length > 0) {
    return true;
  }
  // Positions-only templates (created by template-scope table moves) are
  // real cross-day content: the backend counts them too, and both sides
  // must agree on when the scope toggle renders.
  if (
    obj.table_positions &&
    typeof obj.table_positions === "object" &&
    !Array.isArray(obj.table_positions) &&
    Object.keys(obj.table_positions).length > 0
  ) {
    return true;
  }
  return false;
}

/**
 * Default scope after a template is saved: "template" (global). If no
 * template is configured the user can still flip the toggle, but the
 * effective scope falls back to "day" (per-day only).
 */
export function defaultScope(hasTemplate: boolean, override?: TableMapTemplateScope): TableMapTemplateScope {
  if (override === "day" || override === "template") return override;
  return hasTemplate ? "template" : "day";
}

/**
 * Strips template-only fields from a per-day layout payload so that
 * `queuePersistLayout` can never accidentally write a template into the
 * per-day table. Mirrors the backend's `isBOPremiumTemplateOnlyField`.
 */
export function stripTemplateFieldsForDay(layout: Record<string, unknown>): Record<string, unknown> {
  const next: Record<string, unknown> = { ...layout };
  delete next.limit_area_template_points;
  delete next.draw_elements_template;
  delete next.template_updated_at;
  delete next._table_positions_override;
  return next;
}

/**
 * Strips per-day-only fields (booking states + scope markers) from a layout
 * payload so the result is safe to persist as a template. table_positions
 * are KEPT: since template-scope table moves are cross-day, the template now
 * owns a table_positions map (per-day layouts win per id only when they
 * opted into day scope).
 */
export function stripDayFieldsForTemplate(layout: Record<string, unknown>): Record<string, unknown> {
  const next: Record<string, unknown> = { ...layout };
  delete next.booking_states;
  delete next._template_scope;
  delete next._limit_area_template_points_override;
  delete next._draw_elements_template_override;
  delete next._table_positions_override;
  return next;
}

/**
 * Computes the payload to send to `POST /tables/template/{floor}` so the
 * server can persist the resolved template.
 */
export function buildTemplatePayload(args: {
  limitPoints?: Array<{ x: number; y: number }>;
  drawElements?: Array<Record<string, unknown>>;
  previousTemplate?: TableMapLayoutTemplate;
}): Record<string, unknown> {
  const payload: Record<string, unknown> = { ...(args.previousTemplate || {}) };
  if (args.limitPoints !== undefined) {
    payload.limit_area_template_points = args.limitPoints;
  }
  if (args.drawElements !== undefined) {
    payload.draw_elements_template = args.drawElements;
  }
  return payload;
}

/**
 * Returns the per-day layout overrides that should be written when the
 * user toggles to "day-specific changes" — copies the template values into
 * per-day overrides so the rest of the app keeps working without losing
 * state.
 */
export function buildDayOverrideLayout(
  template: TableMapLayoutTemplate,
  currentLayout: Record<string, unknown>,
  tablePositions?: Record<string, unknown>,
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...currentLayout };
  next._template_scope = "day";
  if (template.limit_area_template_points) {
    next._limit_area_template_points_override = template.limit_area_template_points;
  }
  if (template.draw_elements_template) {
    next._draw_elements_template_override = template.draw_elements_template;
  }
  if (tablePositions) {
    // Freeze the resolved positions into the day so day-scope edits never
    // touch the template, and mark the override so the backend merge lets
    // the per-day map win for the tables it owns.
    next.table_positions = tablePositions;
    next._table_positions_override = tablePositions;
  }
  return next;
}

/**
 * Returns the per-day layout when the user toggles back to "global
 * template changes": removes the day-specific scope and override markers
 * so the next read merges the template back in.
 */
export function buildGlobalTemplateLayout(
  currentLayout: Record<string, unknown>,
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...currentLayout };
  delete next._template_scope;
  delete next._limit_area_template_points_override;
  delete next._draw_elements_template_override;
  delete next._table_positions_override;
  return next;
}
