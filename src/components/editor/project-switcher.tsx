"use client";

import * as React from "react";
import { Check, ChevronDown, Download, FolderOpen, Plus, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ProjectState } from "@/lib/types";
import type { LocalProjectSummary } from "@/lib/project-library";

type ImportResult =
  | { ok: true; projectId: string; name: string }
  | { ok: false; error: string };

type Props = {
  projects: LocalProjectSummary[];
  activeProjectId: string | null;
  state: ProjectState;
  disabled?: boolean;
  onSwitchProject: (projectId: string) => boolean;
  onCreateProject: () => string;
  onImportProject: (raw: unknown) => ImportResult;
};

export function ProjectSwitcher({
  projects,
  activeProjectId,
  state,
  disabled,
  onSwitchProject,
  onCreateProject,
  onImportProject,
}: Props) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [open, setOpen] = React.useState(false);
  const active = projects.find((project) => project.id === activeProjectId) || projects[0];

  async function importFile(file: File) {
    try {
      const result = onImportProject(JSON.parse(await file.text()));
      if (!result.ok) {
        toast.error("Could not import project", { description: result.error });
        return;
      }
      toast.success(`${result.name} is ready`, {
        description: "The imported campaign is now the active local project.",
      });
    } catch {
      toast.error("Could not import project", {
        description: "Choose a valid StoreCanvas project JSON file.",
      });
    } finally {
      if (inputRef.current) inputRef.current.value = "";
      setOpen(false);
    }
  }

  function exportCurrent() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${slugify(state.appName) || "storecanvas-project"}.json`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast.success("Project JSON downloaded", {
      description: "Keep this file as a portable backup or import it on another device.",
    });
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        aria-label="Import project JSON"
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          if (file) void importFile(file);
        }}
      />
      <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 max-w-[18rem] gap-2 border-[hsl(var(--accent))]/30 bg-[hsl(var(--accent))]/[0.045] px-2.5 shadow-none hover:border-[hsl(var(--accent))]/60 hover:bg-[hsl(var(--accent))]/[0.09]"
          aria-label="Project menu"
          title="Switch local project"
          disabled={disabled}
        >
          <FolderOpen className="h-3.5 w-3.5 shrink-0 text-[hsl(var(--accent))]" />
          <span className="hidden text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground sm:inline">Project</span>
          <span className="min-w-0 truncate text-xs font-semibold">{active?.name || "Untitled project"}</span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[min(23rem,calc(100vw-1rem))] p-2">
        <DropdownMenuLabel className="px-2 pb-0 pt-1 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          Local projects
        </DropdownMenuLabel>
        <p className="px-2 pb-2 pt-1 text-[11px] leading-relaxed text-muted-foreground">
          Local dev auto-loads <span className="font-medium text-foreground">app-store-screenshots.json</span>; Vercel restores projects saved in this browser.
        </p>

        <div className="max-h-56 overflow-y-auto">
          {projects.map((project) => {
            const selected = project.id === activeProjectId;
            return (
              <DropdownMenuItem
                key={project.id}
                onSelect={() => onSwitchProject(project.id)}
                className="gap-2 px-2 py-2.5"
                aria-current={selected ? "true" : undefined}
              >
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted/70">
                  {selected ? <Check className="h-3.5 w-3.5 text-[hsl(var(--accent))]" /> : null}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-medium">{project.name}</span>
                  <span className="block text-[10px] text-muted-foreground">Updated {dateLabel(project.updatedAt)}</span>
                </span>
              </DropdownMenuItem>
            );
          })}
        </div>

        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => onCreateProject()} className="px-2 py-2">
          <Plus className="h-3.5 w-3.5 text-[hsl(var(--accent))]" />
          <span>New blank project</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={(event) => {
            event.preventDefault();
            inputRef.current?.click();
          }}
          className="px-2 py-2"
        >
          <Upload className="h-3.5 w-3.5 text-[hsl(var(--accent))]" />
          <span>Import project JSON</span>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={exportCurrent} className="px-2 py-2">
          <Download className="h-3.5 w-3.5 text-[hsl(var(--accent))]" />
          <span>Download current project</span>
        </DropdownMenuItem>
        <p className="px-2 pb-1 pt-2 text-[10px] leading-relaxed text-muted-foreground">
          Import once to move a private campaign between localhost and Vercel. Nothing is uploaded to a StoreCanvas database.
        </p>
      </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function dateLabel(timestamp: number) {
  return new Date(timestamp).toISOString().slice(0, 10);
}
