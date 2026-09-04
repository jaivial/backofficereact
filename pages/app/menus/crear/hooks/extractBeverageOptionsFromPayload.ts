import type { BeverageOption } from '../types/menuEditor.types'

/**
 * Pure parser for the backoffice menu editor WebSocket payload's beverage list.
 *
 * Two payload shapes are supported:
 *  - `beverage_options` (or `beverage_error`) frames use `payload.options`
 *  - `hello` / `sync` / `tracker_update` / `ai_update` / `snapshot` frames
 *    embed the same list under `payload.beverage_options`
 *
 * Returns an empty array when nothing is present so the caller can blindly
 * call `setBeverageOptions(...)` without conditional checks.
 *
 * Extracted from `useMenuEditor` to make the parsing unit-testable.
 */
export function extractBeverageOptionsFromPayload(
  payload: Record<string, unknown> | null | undefined,
): BeverageOption[] {
  if (!payload || typeof payload !== 'object') return []
  const list = Array.isArray(payload.options)
    ? payload.options
    : Array.isArray(payload.beverage_options)
      ? payload.beverage_options
      : null
  if (!list) return []

  const out: BeverageOption[] = []
  for (const raw of list) {
    if (!raw || typeof raw !== 'object') continue
    const row = raw as Record<string, unknown>
    const id = Number(row.id ?? 0)
    const name = String(row.name ?? '').trim()
    if (!id || !name) continue
    out.push({
      id,
      slug: String(row.slug ?? ''),
      name,
      is_custom: row.is_custom === true || row.is_custom === 1,
      selected: row.selected === true || row.selected === 1,
    })
  }
  return out
}
