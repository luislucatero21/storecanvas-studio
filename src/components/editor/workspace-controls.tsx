"use client";

import * as React from "react";
import { ArrowLeftRight, Check, PanelLeft, PanelRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { EditorLayoutPreferences } from "@/lib/editor-layout";

type Props = {
  layout: EditorLayoutPreferences;
  onChange: (patch: Partial<EditorLayoutPreferences>) => void;
  disabled?: boolean;
};

export function WorkspaceControls({ layout, onChange, disabled }: Props) {
  const visibleCount = Number(layout.screensVisible) + Number(layout.settingsVisible);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant={visibleCount < 2 ? "secondary" : "ghost"}
          size="sm"
          className="h-8 gap-1.5 px-2 text-xs"
          aria-label="Workspace panels"
          title="Show, hide or move workspace panels"
          disabled={disabled}
        >
          <PanelLeft className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Panels</span>
          {visibleCount < 2 ? <span className="text-[10px] text-muted-foreground">{visibleCount}/2</span> : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72 p-2">
        <DropdownMenuLabel className="px-2 pb-0 pt-1 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          Workspace panels
        </DropdownMenuLabel>
        <p className="px-2 pb-2 pt-1 text-[11px] leading-relaxed text-muted-foreground">
          Keep the canvas clear on a small desktop. Your choice is saved in this browser.
        </p>
        <DropdownMenuCheckboxItem
          checked={layout.screensVisible}
          onCheckedChange={(checked) => onChange({ screensVisible: checked === true })}
        >
          <PanelLeft className="h-3.5 w-3.5 text-muted-foreground" />
          Screens panel
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={layout.settingsVisible}
          onCheckedChange={(checked) => onChange({ settingsVisible: checked === true })}
        >
          <PanelRight className="h-3.5 w-3.5 text-muted-foreground" />
          Settings panel
        </DropdownMenuCheckboxItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="px-2 pb-1 pt-1 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          Panel position
        </DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => onChange({ panelOrder: "screens-left" })}>
          <PanelLeft className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="flex-1">Screens left · Settings right</span>
          {layout.panelOrder === "screens-left" ? <Check className="h-3.5 w-3.5" /> : null}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onChange({ panelOrder: "settings-left" })}>
          <PanelRight className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="flex-1">Settings left · Screens right</span>
          {layout.panelOrder === "settings-left" ? <Check className="h-3.5 w-3.5" /> : null}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => onChange({ screensVisible: true, settingsVisible: true })}>
          <ArrowLeftRight className="h-3.5 w-3.5 text-muted-foreground" />
          Show both panels
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onChange({ screensVisible: false, settingsVisible: false })}>
          <span className="flex h-3.5 w-3.5 items-center justify-center text-[11px] text-muted-foreground">⌘</span>
          Focus canvas
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
