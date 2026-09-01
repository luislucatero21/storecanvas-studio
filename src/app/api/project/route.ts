import { promises as fs } from "node:fs";
import { NextResponse } from "next/server";
import { ProjectStateSchema } from "@/lib/schema";
import { isProjectFileConfigured, projectFilePath } from "@/lib/project-file";
import { isReadOnlyRuntime } from "@/lib/runtime";
import { getLocalProject, setLocalProject } from "@/lib/local-project-server";
import type { ProjectState } from "@/lib/types";

export const dynamic = "force-dynamic";

function filePath() {
  return projectFilePath();
}

export async function GET() {
  const browserOnly = !isReadOnlyRuntime() && !isProjectFileConfigured();
  const localProject = browserOnly ? getLocalProject() : null;
  if (localProject) {
    return NextResponse.json({ ok: true, state: localProject, persisted: "browser" });
  }
  try {
    const raw = await fs.readFile(filePath(), "utf8");
    const parsed = JSON.parse(raw);
    return NextResponse.json({
      ok: true,
      state: parsed,
      persisted: !isReadOnlyRuntime() && isProjectFileConfigured() ? "file" : "browser",
    });
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      return NextResponse.json({
        ok: true,
        state: null,
        persisted: !isReadOnlyRuntime() && isProjectFileConfigured() ? "file" : "browser",
      });
    }
    return NextResponse.json(
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
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }
  try {
    const parsed = ProjectStateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          error: "Project does not match the StoreCanvas schema",
          issues: parsed.error.issues.slice(0, 20),
        },
        { status: 400 },
      );
    }
    const pretty = JSON.stringify(parsed.data, null, 2) + "\n";
    if (isReadOnlyRuntime()) {
      return NextResponse.json({ ok: true, persisted: "browser" });
    }
    if (!isProjectFileConfigured()) {
      setLocalProject(parsed.data as ProjectState);
      return NextResponse.json({ ok: true, persisted: "browser" });
    }
    await fs.writeFile(filePath(), pretty, "utf8");
    return NextResponse.json({ ok: true, persisted: "file" });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
