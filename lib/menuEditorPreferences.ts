// Coordination id: menu_editor_preview_open_v1
//
// The editor/preview split of /app/comida/menus/crear?menuId= is a user
// preference (user_preferences(user_id, restaurant_id, "menuEditorPreviewOpen")),
// written over the group-menus-v2 socket and read back through the session REST
// (`/api/admin/me`), which every page fetches on its initial load.

export const MENU_EDITOR_PREVIEW_PREF_KEY = "menuEditorPreviewOpen";

export function menuEditorPreviewOpenFromPrefs(preferences?: Record<string, string> | null): boolean {
  return (preferences ?? {})[MENU_EDITOR_PREVIEW_PREF_KEY] !== "0";
}
