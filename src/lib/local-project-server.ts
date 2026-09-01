import type { ProjectState } from "./types";

// A small local-process bridge keeps the server-rendered preview in step with
// browser edits when file sync is not configured. It is intentionally not a
// durable store and is never populated by the read-only Vercel runtime. The
// global slot is shared by Next's separately bundled route modules.
const runtime = globalThis as typeof globalThis & {
  __storecanvasLocalProject?: ProjectState | null;
};

export function getLocalProject() {
  return runtime.__storecanvasLocalProject || null;
}

export function setLocalProject(state: ProjectState) {
  runtime.__storecanvasLocalProject = state;
}
