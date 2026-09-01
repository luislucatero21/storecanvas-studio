export const EDITOR_LAYOUT_STORAGE_KEY = "storecanvas:editor-layout:v1";

export type EditorPanelOrder = "screens-left" | "settings-left";

export type EditorLayoutPreferences = {
  panelOrder: EditorPanelOrder;
  screensVisible: boolean;
  settingsVisible: boolean;
};

export const DEFAULT_EDITOR_LAYOUT: EditorLayoutPreferences = {
  panelOrder: "screens-left",
  screensVisible: true,
  settingsVisible: true,
};

/**
 * Keep workspace preferences deliberately separate from project JSON. They
 * describe this browser's working posture, not the campaign someone exports.
 */
export function normalizeEditorLayout(value: unknown): EditorLayoutPreferences {
  if (!value || typeof value !== "object") return { ...DEFAULT_EDITOR_LAYOUT };
  const raw = value as Partial<EditorLayoutPreferences> & { version?: unknown };
  return {
    panelOrder: raw.panelOrder === "settings-left" ? "settings-left" : "screens-left",
    screensVisible: raw.screensVisible !== false,
    settingsVisible: raw.settingsVisible !== false,
  };
}

export function readEditorLayout(
  storage: Pick<Storage, "getItem"> | null | undefined,
): EditorLayoutPreferences {
  if (!storage) return { ...DEFAULT_EDITOR_LAYOUT };
  try {
    const raw = storage.getItem(EDITOR_LAYOUT_STORAGE_KEY);
    return raw ? normalizeEditorLayout(JSON.parse(raw)) : { ...DEFAULT_EDITOR_LAYOUT };
  } catch {
    return { ...DEFAULT_EDITOR_LAYOUT };
  }
}

export function writeEditorLayout(
  storage: Pick<Storage, "setItem"> | null | undefined,
  preferences: EditorLayoutPreferences,
) {
  if (!storage) return;
  try {
    storage.setItem(
      EDITOR_LAYOUT_STORAGE_KEY,
      JSON.stringify({ version: 1, ...normalizeEditorLayout(preferences) }),
    );
  } catch {
    // Private browsing and full storage quotas should never block editing.
  }
}
