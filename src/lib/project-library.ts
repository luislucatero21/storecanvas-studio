import type { ProjectState } from "./types";

export const PROJECT_LIBRARY_VERSION = 1 as const;
export const PROJECT_LIBRARY_KEY = "storecanvas:projects:v1";

export type LocalProject = {
  id: string;
  name: string;
  state: ProjectState;
  updatedAt: number;
};

export type ProjectLibrary = {
  version: typeof PROJECT_LIBRARY_VERSION;
  activeProjectId: string | null;
  projects: LocalProject[];
};

export type LocalProjectSummary = Pick<LocalProject, "id" | "name" | "updatedAt">;

export function emptyProjectLibrary(): ProjectLibrary {
  return { version: PROJECT_LIBRARY_VERSION, activeProjectId: null, projects: [] };
}

export function projectName(state: Pick<ProjectState, "appName">) {
  const name = state.appName.trim();
  return name || "Untitled project";
}

export function createProjectId(name: string, now = Date.now(), random = Math.random()) {
  const slug = projectName({ appName: name })
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 36) || "project";
  const suffix = Math.floor(Math.max(0, Math.min(0.999999, random)) * 0xffffff)
    .toString(36)
    .padStart(4, "0");
  return `${slug}-${now.toString(36)}-${suffix}`;
}

export function makeLocalProject(
  state: ProjectState,
  options: { id?: string; updatedAt?: number } = {},
): LocalProject {
  return {
    id: options.id || createProjectId(state.appName),
    name: projectName(state),
    state,
    updatedAt: options.updatedAt || Date.now(),
  };
}

export function upsertLocalProject(library: ProjectLibrary, project: LocalProject): ProjectLibrary {
  return {
    ...library,
    activeProjectId: project.id,
    projects: [project, ...library.projects.filter((candidate) => candidate.id !== project.id)],
  };
}

export function removeLocalProject(library: ProjectLibrary, projectId: string): ProjectLibrary {
  const projects = library.projects.filter((project) => project.id !== projectId);
  const activeProjectId = library.activeProjectId === projectId ? projects[0]?.id || null : library.activeProjectId;
  return { ...library, activeProjectId, projects };
}

export function summarizeProjects(projects: LocalProject[]): LocalProjectSummary[] {
  return projects.map(({ id, name, updatedAt }) => ({ id, name, updatedAt }));
}
