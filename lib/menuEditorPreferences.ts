// Coordination id: menu_editor_preview_open_v1
//
// The editor/preview split of /app/comida/menus/crear?menuId= is a per
// (user, restaurant, menu) preference (user_menu_preferences, key
// "menuEditorPreviewOpen"), written over the group-menus-v2 socket and read back
// through the menu REST (GET /api/admin/group-menus-v2/{id}) when the page
// hydrates.
//
// This helper is the fallback for pages that have no menu id yet (the menus
// list and its add-menu modal), where only the generic session preference
// applies.

export const MENU_EDITOR_PREVIEW_PREF_KEY = "menuEditorPreviewOpen";

export function menuEditorPreviewOpenFromPrefs(preferences?: Record<string, string> | null): boolean {
  return (preferences ?? {})[MENU_EDITOR_PREVIEW_PREF_KEY] !== "0";
}
