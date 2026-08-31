import path from "node:path";

/**
 * The checked-in example is safe to share. Point this at a local project from
 * `.env.local` when working on a private campaign.
 */
export const DEFAULT_PROJECT_FILE = "example-project.json";

export function projectFilePath(root = process.cwd()) {
  const configured = process.env.STORECANVAS_PROJECT_FILE?.trim() || DEFAULT_PROJECT_FILE;
  return path.resolve(root, configured);
}
