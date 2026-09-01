import { existsSync } from "node:fs";
import path from "node:path";

/**
 * The checked-in example is safe to share. A local checkout can also contain
 * the ignored private campaign file; it is discovered automatically for the
 * first local load, but remains browser-persisted unless explicitly configured
 * for file sync through `.env.local`.
 */
export const DEFAULT_PROJECT_FILE = "example-project.json";
export const LOCAL_PRIVATE_PROJECT_FILE = "app-store-screenshots.json";

type RuntimeEnv = Record<string, string | undefined>;

function isLocalRuntime(env: RuntimeEnv) {
  return env.VERCEL !== "1" && env.STORECANVAS_READ_ONLY !== "1";
}

export function isProjectFileConfigured(env: Record<string, string | undefined> = process.env) {
  return !!env.STORECANVAS_PROJECT_FILE?.trim();
}

export function isLocalPrivateProjectAvailable(
  root = process.cwd(),
  env: RuntimeEnv = process.env,
  fileExists: (filePath: string) => boolean = existsSync,
) {
  if (!isLocalRuntime(env) || isProjectFileConfigured(env)) return false;
  return fileExists(path.resolve(root, LOCAL_PRIVATE_PROJECT_FILE));
}

export function projectFilePath(
  root = process.cwd(),
  env: RuntimeEnv = process.env,
  fileExists: (filePath: string) => boolean = existsSync,
) {
  const configured = env.STORECANVAS_PROJECT_FILE?.trim();
  const projectFile = configured
    || (isLocalPrivateProjectAvailable(root, env, fileExists) ? LOCAL_PRIVATE_PROJECT_FILE : DEFAULT_PROJECT_FILE);
  return path.resolve(root, projectFile);
}
