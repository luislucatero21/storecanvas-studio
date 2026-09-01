"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { PROJECT_SCHEMA_VERSION, STORAGE_KEY } from "./constants";
import { DEFAULT_PROJECT } from "./defaults";
import { coerceLocalized } from "./locale";
import { ProjectStateSchema } from "./schema";
import {
  PROJECT_LIBRARY_KEY,
  emptyProjectLibrary,
  createProjectId,
  makeLocalProject,
  projectName,
  removeLocalProject,
  summarizeProjects,
  upsertLocalProject,
  type ProjectLibrary,
} from "./project-library";
import type { ConnectedArtwork, Device, DeviceModel, DevicePresentation, DeviceSlot, ElementTransform, ProjectState, Slide, SlotSpan, TextElement } from "./types";

const HISTORY_LIMIT = 50;
// Coalesce rapid edits (typing, slider drags) into a single undo step.
const COALESCE_MS = 500;
// Debounce file/localStorage writes — frequent enough to feel instant, infrequent enough not to thrash disk.
const SAVE_DEBOUNCE_MS = 600;

function cleanTransform(value: unknown): ElementTransform | undefined {
  if (!value || typeof value !== "object") return undefined;
  const raw = value as Partial<ElementTransform>;
  const required = [raw.x, raw.y, raw.width, raw.height];
  if (!required.every((n) => typeof n === "number" && Number.isFinite(n))) return undefined;
  return {
    x: raw.x!,
    y: raw.y!,
    width: Math.max(1, raw.width!),
    height: Math.max(1, raw.height!),
    ...(typeof raw.rotation === "number" && Number.isFinite(raw.rotation)
      ? { rotation: raw.rotation }
      : {}),
    ...(typeof raw.zIndex === "number" && Number.isFinite(raw.zIndex)
      ? { zIndex: raw.zIndex }
      : {}),
  };
}

function cleanTextElement(value: unknown): TextElement | undefined {
  if (!value || typeof value !== "object") return undefined;
  const raw = value as Partial<TextElement>;
  if (typeof raw.id !== "string" || !raw.id.trim()) return undefined;
  const transform = cleanTransform(raw.transform);
  if (!transform) return undefined;
  return {
    id: raw.id,
    text: coerceLocalized(raw.text as unknown),
    transform,
    ...(typeof raw.fontSize === "number" && Number.isFinite(raw.fontSize)
      ? { fontSize: raw.fontSize }
      : {}),
    ...(typeof raw.fontWeight === "number" && Number.isFinite(raw.fontWeight)
      ? { fontWeight: raw.fontWeight }
      : {}),
    ...(typeof raw.color === "string" ? { color: raw.color } : {}),
    ...(raw.align === "left" || raw.align === "center" || raw.align === "right"
      ? { align: raw.align }
      : {}),
  };
}

function cleanPresentation(value: unknown): DevicePresentation | undefined {
  if (!value || typeof value !== "object") return undefined;
  const raw = value as Partial<DevicePresentation>;
  const presets = ["flat", "tilt-left", "tilt-right", "low-angle", "high-angle", "custom"];
  if (!raw.preset || !presets.includes(raw.preset)) return undefined;
  if (![raw.rotateX, raw.rotateY, raw.perspective, raw.depth].every((number) => typeof number === "number" && Number.isFinite(number))) return undefined;
  if (Math.abs(raw.rotateX!) > 45 || Math.abs(raw.rotateY!) > 60 || raw.perspective! < 400 || raw.perspective! > 4000 || raw.depth! < 0 || raw.depth! > 48) return undefined;
  const models: DeviceModel[] = ["iphone-17-pro-max", "iphone-14-pro-max", "iphone-13-pro-max"];
  return {
    ...(raw as DevicePresentation),
    ...(
      raw.deviceModel && models.includes(raw.deviceModel)
        ? { deviceModel: raw.deviceModel }
        : { deviceModel: undefined }
    ),
  };
}

function cleanSlotSpan(value: unknown, fallback: SlotSpan): SlotSpan {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 10
    ? value as SlotSpan
    : fallback;
}

function cleanDeviceSlot(value: unknown): DeviceSlot | undefined {
  if (!value || typeof value !== "object") return undefined;
  const raw = value as Partial<DeviceSlot>;
  if (typeof raw.id !== "string" || !raw.id.trim() || typeof raw.screenshot !== "string") return undefined;
  const transform = cleanTransform(raw.transform);
  if (!transform) return undefined;
  const presentation = cleanPresentation(raw.presentation);
  const spanSlots = cleanSlotSpan(raw.spanSlots, 1);
  return {
    id: raw.id,
    screenshot: raw.screenshot,
    transform,
    ...(typeof raw.assetRef === "string" && raw.assetRef.trim() ? { assetRef: raw.assetRef } : {}),
    ...(presentation ? { presentation } : {}),
    spanSlots,
    linkedTransforms: raw.linkedTransforms === true,
    ...(typeof raw.opacity === "number" && Number.isFinite(raw.opacity) ? { opacity: Math.max(0, Math.min(1, raw.opacity)) } : {}),
  };
}

function cleanConnectedArtwork(value: unknown): ConnectedArtwork | undefined {
  if (!value || typeof value !== "object") return undefined;
  const raw = value as Partial<ConnectedArtwork>;
  if (typeof raw.id !== "string" || !raw.id.trim() || typeof raw.image !== "string") return undefined;
  const transform = cleanTransform(raw.transform);
  if (!transform) return undefined;
  return {
    id: raw.id,
    image: raw.image,
    transform,
    spanSlots: cleanSlotSpan(raw.spanSlots, 2),
    ...(typeof raw.assetRef === "string" && raw.assetRef.trim() ? { assetRef: raw.assetRef } : {}),
    ...(typeof raw.opacity === "number" && Number.isFinite(raw.opacity) ? { opacity: Math.max(0, Math.min(1, raw.opacity)) } : {}),
  };
}

// Migrate older projects into the current schema while keeping legacy decks
// visually stable until they explicitly opt into connected canvas.
function migrateSlide(slide: Slide): Slide {
  const captionSpan = cleanSlotSpan(slide.captionSpan, 1);
  const transforms = slide.transforms
    ? Object.fromEntries(
        Object.entries(slide.transforms)
          .map(([id, transform]) => [id, cleanTransform(transform)])
          .filter((entry): entry is [string, ElementTransform] => !!entry[1]),
      )
    : undefined;
  const textElements = Array.isArray(slide.textElements)
    ? slide.textElements.map(cleanTextElement).filter((t): t is TextElement => !!t)
    : undefined;
  const deviceSlots = Array.isArray(slide.deviceSlots)
    ? slide.deviceSlots.map(cleanDeviceSlot).filter((slot): slot is DeviceSlot => !!slot)
    : undefined;
  const connectedArtworks = Array.isArray(slide.connectedArtworks)
    ? slide.connectedArtworks.map(cleanConnectedArtwork).filter((artwork): artwork is ConnectedArtwork => !!artwork)
    : undefined;
  const presentations = slide.presentations
    ? Object.fromEntries(
        Object.entries(slide.presentations)
          .map(([id, presentation]) => [id, cleanPresentation(presentation)])
          .filter((entry): entry is [string, DevicePresentation] => !!entry[1]),
      )
    : undefined;

  return {
    ...slide,
    label: coerceLocalized(slide.label as unknown),
    headline: coerceLocalized(slide.headline as unknown),
    ...(transforms && Object.keys(transforms).length > 0 ? { transforms } : { transforms: undefined }),
    ...(textElements && textElements.length > 0 ? { textElements } : { textElements: undefined }),
    ...(deviceSlots && deviceSlots.length > 0 ? { deviceSlots } : { deviceSlots: undefined }),
    ...(connectedArtworks && connectedArtworks.length > 0 ? { connectedArtworks } : { connectedArtworks: undefined }),
    ...(presentations && Object.keys(presentations).length > 0 ? { presentations } : { presentations: undefined }),
    captionSpan: captionSpan > 1 ? captionSpan : undefined,
  };
}

function mergeWithDefaults(parsed: Partial<ProjectState>): ProjectState {
  const connectedCanvas =
    typeof parsed.connectedCanvas === "boolean"
      ? parsed.connectedCanvas
      : false;
  const themeId =
    typeof parsed.themeId === "string" && parsed.themeId.trim()
      ? parsed.themeId
      : DEFAULT_PROJECT.themeId;
  const templateId =
    typeof parsed.templateId === "string" && parsed.templateId.trim()
      ? parsed.templateId
      : DEFAULT_PROJECT.templateId;
  const paletteId =
    typeof parsed.paletteId === "string" && parsed.paletteId.trim()
      ? parsed.paletteId
      : DEFAULT_PROJECT.paletteId;
  const slidesByDevice = parsed.slidesByDevice
    ? Object.fromEntries(
        Object.entries(parsed.slidesByDevice).map(([device, slides]) => [
          device,
          Array.isArray(slides) ? slides.map((slide) => migrateSlide(slide as Slide)) : [],
        ]),
      )
    : {};
  const merged: ProjectState = {
    ...DEFAULT_PROJECT,
    ...parsed,
    schemaVersion: PROJECT_SCHEMA_VERSION,
    themeId,
    templateId,
    paletteId,
    connectedCanvas,
    slidesByDevice: {
      ...DEFAULT_PROJECT.slidesByDevice,
      ...slidesByDevice,
    } as ProjectState["slidesByDevice"],
  };
  if (merged.copySync) {
    const validDevices: Device[] = ["iphone", "ipad", "android", "android-7", "android-10", "feature-graphic"];
    if (!validDevices.includes(merged.copySync.sourceDevice)) merged.copySync = undefined;
    else merged.copySync = { ...merged.copySync, matchBy: "copyKey-or-index" };
  }
  // Clamp the active locale into the project's locale list so a stale
  // `locale` (e.g. from a project that dropped languages) doesn't show blank.
  if (!merged.locales || merged.locales.length === 0) {
    merged.locales = [...DEFAULT_PROJECT.locales];
  }
  if (!merged.locales.includes(merged.locale)) {
    merged.locale = merged.locales[0];
  }
  return merged;
}

function normalizeStoredProject(value: unknown): ProjectState | null {
  if (!value || typeof value !== "object") return null;
  return mergeWithDefaults(value as Partial<ProjectState>);
}

function loadProjectLibrary(): ProjectLibrary {
  if (typeof window === "undefined") return emptyProjectLibrary();
  try {
    const raw = window.localStorage.getItem(PROJECT_LIBRARY_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<ProjectLibrary>;
      if (parsed.version === 1 && Array.isArray(parsed.projects)) {
        const projects = parsed.projects.flatMap((candidate) => {
          if (!candidate || typeof candidate !== "object") return [];
          const item = candidate as Partial<ProjectLibrary["projects"][number]>;
          const state = normalizeStoredProject(item.state);
          if (!state || typeof item.id !== "string" || !item.id.trim()) return [];
          return [{
            id: item.id,
            name: typeof item.name === "string" && item.name.trim() ? item.name.trim() : projectName(state),
            state,
            updatedAt: typeof item.updatedAt === "number" && Number.isFinite(item.updatedAt) ? item.updatedAt : Date.now(),
          }];
        });
        if (projects.length > 0) {
          const activeProjectId = projects.some((project) => project.id === parsed.activeProjectId)
            ? parsed.activeProjectId!
            : projects[0].id;
          return { version: 1, activeProjectId, projects };
        }
      }
    }

    // Migrate the pre-selector cache. This is how an existing private
    // campaign (including one loaded before the open-source cleanup) returns
    // automatically without ever being copied into the repository.
    const legacy = loadFromLocalStorage();
    if (legacy) {
      const recovered = makeLocalProject(legacy, { id: "project-recovered" });
      return upsertLocalProject(emptyProjectLibrary(), recovered);
    }
  } catch {
    // A malformed or full cache should not prevent the editor from opening.
  }
  return emptyProjectLibrary();
}

function loadFromLocalStorage(): ProjectState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return mergeWithDefaults(JSON.parse(raw) as Partial<ProjectState>);
  } catch {
    return null;
  }
}

async function loadFromFile(): Promise<
  | {
      ok: true;
      state: ProjectState | null;
      persisted?: "file" | "browser";
      source?: "browser" | "configured-file" | "local-private-file" | "demo-file";
    }
  | { ok: false; error: string }
> {
  if (typeof window === "undefined") return { ok: false, error: "Window is not available" };
  try {
    // Ask the local server for the file even when an older browser project is
    // still cached. The normal endpoint intentionally prefers browser state.
    const resp = await fetch("/api/project?prefer=file", { cache: "no-store" });
    if (!resp.ok) return { ok: false, error: `HTTP ${resp.status}` };
    const json = (await resp.json()) as {
      ok: boolean;
      state: Partial<ProjectState> | null;
      persisted?: "file" | "browser";
      source?: "browser" | "configured-file" | "local-private-file" | "demo-file";
    };
    if (!json.ok) return { ok: false, error: "Project response was not ok" };
    if (!json.state) return { ok: true, state: null, persisted: json.persisted, source: json.source };
    return { ok: true, state: mergeWithDefaults(json.state), persisted: json.persisted, source: json.source };
  } catch {
    return { ok: false, error: "Project file could not be loaded" };
  }
}

function isStarterOrDemoProject(state: ProjectState | undefined) {
  if (!state || state.campaignSource) return false;
  return state.appName === DEFAULT_PROJECT.appName
    || state.appName === "Example app"
    || state.slidesByDevice.iphone?.[0]?.id?.startsWith("demo-");
}

/**
 * Detect a local file update that expands an existing imported campaign. This
 * is intentionally narrow: ordinary browser edits remain the source of truth,
 * while a regenerated local panorama can upgrade a stale cached 2-screen span
 * without overwriting unrelated work on every reload.
 */
export function hasExpandedLocalArtwork(cached: ProjectState | undefined, file: ProjectState | null) {
  if (!cached || !file || !cached.campaignSource || !file.campaignSource) return false;
  if (cached.campaignSource.appId !== file.campaignSource.appId) return false;
  return Object.entries(file.slidesByDevice).some(([device, fileSlides]) => {
    const cachedSlides = cached.slidesByDevice[device as keyof ProjectState["slidesByDevice"]] || [];
    return fileSlides.some((fileSlide, index) =>
      (fileSlide.connectedArtworks || []).some((fileArtwork) => {
        const cachedArtwork = cachedSlides[index]?.connectedArtworks?.find((candidate) => candidate.id === fileArtwork.id);
        return !!cachedArtwork && fileArtwork.spanSlots > (cachedArtwork.spanSlots || 2);
      }),
    );
  });
}

function saveToLocalStorage(
  state: ProjectState,
  library: ProjectLibrary,
  activeProjectId: string,
): { ok: true; library: ProjectLibrary } | { ok: false; error: string } {
  if (typeof window === "undefined") return { ok: true, library };
  try {
    const project = makeLocalProject(state, { id: activeProjectId, updatedAt: Date.now() });
    const nextLibrary = upsertLocalProject(library, project);
    window.localStorage.setItem(PROJECT_LIBRARY_KEY, JSON.stringify(nextLibrary));
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return { ok: true, library: nextLibrary };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}

async function saveToFile(state: ProjectState): Promise<
  { ok: true; persisted: "file" | "browser" } | { ok: false; error: string }
> {
  if (typeof window === "undefined") return { ok: true, persisted: "browser" };
  try {
    const resp = await fetch("/api/project", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(state),
    });
    if (!resp.ok) {
      return { ok: false, error: `HTTP ${resp.status}` };
    }
    const json = (await resp.json()) as { ok: boolean; error?: string; persisted?: "file" | "browser" };
    if (!json.ok) return { ok: false, error: json.error || "Unknown error" };
    return { ok: true, persisted: json.persisted || "file" };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

type Updater = ProjectState | ((prev: ProjectState) => ProjectState);

function applyUpdater(updater: Updater, prev: ProjectState): ProjectState {
  return typeof updater === "function" ? updater(prev) : updater;
}

export function useProject() {
  const [state, _setState] = useState<ProjectState>(DEFAULT_PROJECT);
  const [hydrated, setHydrated] = useState(false);
  const [projectLibrary, setProjectLibrary] = useState<ProjectLibrary>(() => emptyProjectLibrary());
  const [fileSyncAvailable, setFileSyncAvailable] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const libraryRef = useRef<ProjectLibrary>(emptyProjectLibrary());
  const activeProjectIdRef = useRef<string | null>(null);
  const stateRef = useRef<ProjectState>(DEFAULT_PROJECT);

  // History stacks live in refs — they don't drive any rendered UI, so
  // mutating them never needs to re-render.
  const pastRef = useRef<ProjectState[]>([]);
  const futureRef = useRef<ProjectState[]>([]);
  const lastPushAt = useRef(0);

  // Hydrate the active browser project first. A local private campaign file is
  // also an automatic seed when the browser only contains the shareable blank
  // or demo project. An explicitly configured project file is authoritative;
  // this lets a local preview switch to the file even when an older project
  // remains in the browser cache. Vercel and ordinary local-first sessions
  // continue to prefer their browser project.
  useEffect(() => {
    let cancelled = false;
    const localLibrary = loadProjectLibrary();
    const active = localLibrary.projects.find((project) => project.id === localLibrary.activeProjectId)
      || localLibrary.projects[0];
    const cached = active?.state || loadFromLocalStorage();
    if (cached) _setState(cached);

    void (async () => {
      const fromFile = await loadFromFile();
      if (cancelled) return;
      const autoLocalState = fromFile.ok && fromFile.source === "local-private-file"
        ? fromFile.state
        : null;
      const configuredFileState = fromFile.ok && fromFile.source === "configured-file"
        ? fromFile.state
        : null;
      const shouldAutoLoadLocalProject = !!autoLocalState
        && (!active || isStarterOrDemoProject(cached || active.state));
      const shouldRefreshExpandedLocalArtwork = hasExpandedLocalArtwork(cached || active?.state, autoLocalState);
      const shouldUseFileProject = !!configuredFileState || shouldAutoLoadLocalProject || shouldRefreshExpandedLocalArtwork;
      let nextState = shouldUseFileProject
        ? (configuredFileState || autoLocalState)!
        : cached || (fromFile.ok ? fromFile.state : null) || DEFAULT_PROJECT;
      let nextLibrary = localLibrary;
      let activeProjectId = active?.id || localLibrary.activeProjectId;
      if (shouldUseFileProject) {
        const seed = makeLocalProject(nextState, {
          id: active?.id || (configuredFileState ? createProjectId(nextState.appName) : "project-local-private"),
        });
        nextLibrary = upsertLocalProject(localLibrary, seed);
        activeProjectId = seed.id;
      } else if (!activeProjectId) {
        const seed = makeLocalProject(nextState, {
          id: cached ? "project-recovered" : createProjectId(nextState.appName),
        });
        nextLibrary = upsertLocalProject(nextLibrary, seed);
        activeProjectId = seed.id;
      } else {
        nextLibrary = { ...nextLibrary, activeProjectId };
      }
      _setState(nextState);
      libraryRef.current = nextLibrary;
      activeProjectIdRef.current = activeProjectId;
      setProjectLibrary(nextLibrary);
      setFileSyncAvailable(fromFile.ok && fromFile.persisted === "file");
      setSaveError(null);
      pastRef.current = [];
      futureRef.current = [];
      lastPushAt.current = 0;
      setHydrated(true);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Debounced autosave to the local project library first, then best-effort to
  // the development file. Vercel returns a browser-persisted acknowledgement
  // from the file endpoint, so this remains quiet in a read-only runtime.
  useEffect(() => {
    if (!hydrated) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const activeProjectId = activeProjectIdRef.current || createProjectId(state.appName);
      activeProjectIdRef.current = activeProjectId;
      const localResult = saveToLocalStorage(state, libraryRef.current, activeProjectId);
      if (localResult.ok) {
        libraryRef.current = localResult.library;
        setProjectLibrary(localResult.library);
      }
      void saveToFile(state).then((fileResult) => {
        if (fileResult.ok && localResult.ok) {
          setSavedAt(Date.now());
          setSaveError(null);
          setFileSyncAvailable(fileResult.persisted === "file");
        } else if (localResult.ok) {
          // Browser storage is the source of truth when a filesystem is not
          // available (for example on Vercel or a static deployment).
          setSavedAt(Date.now());
          setFileSyncAvailable(false);
          setSaveError(null);
        } else {
          setSaveError(localResult.error);
        }
      });
    }, SAVE_DEBOUNCE_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [state, hydrated]);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const setState = useCallback((updater: Updater) => {
    _setState((prev) => {
      const next = applyUpdater(updater, prev);
      if (next === prev) return prev;
      const now = Date.now();
      if (now - lastPushAt.current > COALESCE_MS) {
        pastRef.current.push(prev);
        if (pastRef.current.length > HISTORY_LIMIT) pastRef.current.shift();
        futureRef.current.length = 0;
      }
      lastPushAt.current = now;
      return next;
    });
  }, []);

  const undo = useCallback(() => {
    _setState((cur) => {
      const prev = pastRef.current.pop();
      if (prev === undefined) return cur;
      futureRef.current.push(cur);
      // Reset coalescing so the next edit after an undo creates a fresh history entry.
      lastPushAt.current = 0;
      return prev;
    });
  }, []);

  const redo = useCallback(() => {
    _setState((cur) => {
      const next = futureRef.current.pop();
      if (next === undefined) return cur;
      pastRef.current.push(cur);
      lastPushAt.current = 0;
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    setState(DEFAULT_PROJECT);
  }, [setState]);

  const resetDevice = useCallback((device: Device) => {
    setState((prev) => ({
      ...prev,
      slidesByDevice: {
        ...prev.slidesByDevice,
        [device]: DEFAULT_PROJECT.slidesByDevice[device],
      },
    }));
  }, [setState]);

  const switchProject = useCallback((projectId: string) => {
    const project = libraryRef.current.projects.find((candidate) => candidate.id === projectId);
    if (!project) return false;
    let library = libraryRef.current;
    const currentId = activeProjectIdRef.current;
    if (currentId && currentId !== projectId) {
      const currentSave = saveToLocalStorage(stateRef.current, library, currentId);
      if (currentSave.ok) library = currentSave.library;
    }
    const nextLibrary = { ...library, activeProjectId: project.id };
    libraryRef.current = nextLibrary;
    activeProjectIdRef.current = project.id;
    setProjectLibrary(nextLibrary);
    _setState(project.state);
    pastRef.current = [];
    futureRef.current = [];
    lastPushAt.current = 0;
    setSaveError(null);
    return true;
  }, []);

  const createProject = useCallback((name = "Untitled project") => {
    let library = libraryRef.current;
    if (activeProjectIdRef.current) {
      const currentSave = saveToLocalStorage(stateRef.current, library, activeProjectIdRef.current);
      if (currentSave.ok) library = currentSave.library;
    }
    const nextState = mergeWithDefaults({
      ...DEFAULT_PROJECT,
      appName: name.trim() || "Untitled project",
    });
    const project = makeLocalProject(nextState);
    const nextLibrary = upsertLocalProject(library, project);
    libraryRef.current = nextLibrary;
    activeProjectIdRef.current = project.id;
    setProjectLibrary(nextLibrary);
    _setState(nextState);
    pastRef.current = [];
    futureRef.current = [];
    lastPushAt.current = 0;
    return project.id;
  }, []);

  const importProject = useCallback((raw: unknown):
    | { ok: true; projectId: string; name: string }
    | { ok: false; error: string } => {
    const parsed = ProjectStateSchema.safeParse(raw);
    if (!parsed.success) {
      return { ok: false, error: "That file is not a valid StoreCanvas project JSON." };
    }
    const nextState = mergeWithDefaults(parsed.data as Partial<ProjectState>);
    let library = libraryRef.current;
    if (activeProjectIdRef.current) {
      const currentSave = saveToLocalStorage(stateRef.current, library, activeProjectIdRef.current);
      if (currentSave.ok) library = currentSave.library;
    }
    const project = makeLocalProject(nextState);
    const nextLibrary = upsertLocalProject(library, project);
    libraryRef.current = nextLibrary;
    activeProjectIdRef.current = project.id;
    setProjectLibrary(nextLibrary);
    _setState(nextState);
    pastRef.current = [];
    futureRef.current = [];
    lastPushAt.current = 0;
    setSaveError(null);
    return { ok: true, projectId: project.id, name: project.name };
  }, []);

  const deleteProject = useCallback((projectId: string) => {
    if (libraryRef.current.projects.length <= 1) return false;
    const nextLibrary = removeLocalProject(libraryRef.current, projectId);
    libraryRef.current = nextLibrary;
    setProjectLibrary(nextLibrary);
    if (activeProjectIdRef.current === projectId) {
      const next = nextLibrary.projects.find((project) => project.id === nextLibrary.activeProjectId);
      if (next) {
        activeProjectIdRef.current = next.id;
        _setState(next.state);
        pastRef.current = [];
        futureRef.current = [];
        lastPushAt.current = 0;
      }
    }
    return true;
  }, []);

  return {
    state,
    setState,
    hydrated,
    savedAt,
    saveError,
    fileSyncAvailable,
    projects: summarizeProjects(projectLibrary.projects),
    activeProjectId: projectLibrary.activeProjectId,
    switchProject,
    createProject,
    importProject,
    deleteProject,
    reset,
    resetDevice,
    undo,
    redo,
  };
}
