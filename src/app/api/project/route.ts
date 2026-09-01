import { promises as fs } from "node:fs";
import { NextResponse } from "next/server";
import { ProjectStateSchema } from "@/lib/schema";
import {
  CHECKED_IN_EXAMPLE_PROJECT,
  isLocalPrivateProjectAvailable,
  isProjectFileConfigured,
  projectFilePath,
} from "@/lib/project-file";
import { inheritDefaultDeviceDecks } from "@/lib/device-sync";
import { isReadOnlyRuntime } from "@/lib/runtime";
import { getLocalProject, setLocalProject } from "@/lib/local-project-server";
import type { ProjectState } from "@/lib/types";

export const dynamic = "force-dynamic";

function noStoreJson(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  response.headers.set("Cache-Control", "no-store, max-age=0");
  return response;
}

function filePath() {
  return projectFilePath();
}

function source() {
  if (isProjectFileConfigured()) return "configured-file" as const;
  if (isLocalPrivateProjectAvailable()) return "local-private-file" as const;
  return "demo-file" as const;
}

export async function GET(request: Request) {
  const preferFile = new URL(request.url).searchParams.get("prefer") === "file";
  const browserOnly = !isReadOnlyRuntime() && !isProjectFileConfigured();
  const fileAvailable = isProjectFileConfigured() || isLocalPrivateProjectAvailable();
  const localProject = browserOnly && (!preferFile || !fileAvailable) ? getLocalProject() : null;
  if (localProject) {
    return noStoreJson({ ok: true, state: inheritDefaultDeviceDecks(localProject), persisted: "browser", source: "browser" });
  }
  try {
    const raw = await fs.readFile(filePath(), "utf8");
    const parsed = JSON.parse(raw);
    const validated = ProjectStateSchema.safeParse(parsed);
    return noStoreJson({
      ok: true,
      state: validated.success ? inheritDefaultDeviceDecks(validated.data as ProjectState) : parsed,
      persisted: !isReadOnlyRuntime() && isProjectFileConfigured() ? "file" : "browser",
      source: source(),
    });
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      return noStoreJson({
        ok: true,
        state: source() === "demo-file" ? inheritDefaultDeviceDecks(CHECKED_IN_EXAMPLE_PROJECT) : null,
        persisted: !isReadOnlyRuntime() && isProjectFileConfigured() ? "file" : "browser",
        source: source(),
      });
    }
    return noStoreJson(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return noStoreJson({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }
  try {
    const parsed = ProjectStateSchema.safeParse(body);
    if (!parsed.success) {
      return noStoreJson(
        {
          ok: false,
          error: "Project does not match the StoreCanvas schema",
          issues: parsed.error.issues.slice(0, 20),
        },
        { status: 400 },
      );
    }
    const state = inheritDefaultDeviceDecks(parsed.data as ProjectState);
    const pretty = JSON.stringify(parsed.data, null, 2) + "\n";
    if (isReadOnlyRuntime()) {
      return noStoreJson({ ok: true, state, persisted: "browser" });
    }
    if (!isProjectFileConfigured()) {
      setLocalProject(parsed.data as ProjectState);
      return noStoreJson({ ok: true, state, persisted: "browser" });
    }
    await fs.writeFile(filePath(), pretty, "utf8");
    return noStoreJson({ ok: true, state, persisted: "file" });
  } catch (e) {
    return noStoreJson(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
