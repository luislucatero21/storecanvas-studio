import { NextResponse } from "next/server";
import { z } from "zod";
import {
  CAMPAIGN_TEMPLATES,
  PALETTE_PRESETS,
  applyPalette,
} from "@/lib/campaign-presets";
import {
  applyAgentTemplate,
  assertConnectedArtworkRange,
  resolveAgentPalette,
  resolveAgentTemplate,
  summarizeProject,
  tonePatternForProject,
  upsertGeneratedArtwork,
} from "@/lib/agent-workflow";
import {
  ArtworkImageError,
  buildArtworkPrompt,
  requestArtworkImage,
} from "@/lib/artwork-ai-server";
import { inheritDefaultDeviceDecks } from "@/lib/device-sync";
import { ProjectStateSchema } from "@/lib/schema";
import { validateProject } from "@/lib/validation";
import type { Device, ProjectState, SlotSpan } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DeviceSchema = z.enum([
  "iphone",
  "ipad",
  "android",
  "android-7",
  "android-10",
  "feature-graphic",
]);
const ToneSchema = z.enum(["light", "dark", "mixed"]);
const ActionSchema = z.enum([
  "catalog",
  "inspect",
  "validate",
  "apply-template",
  "generate-background",
]);

type Body = Record<string, unknown>;

function errorResponse(message: string, status = 400) {
  return noStoreJson({ ok: false, error: message }, { status });
}

function noStoreJson(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  response.headers.set("Cache-Control", "no-store, max-age=0");
  return response;
}

function bodyRecord(value: unknown): Body | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Body
    : null;
}

function actionOf(body: Body) {
  const parsed = ActionSchema.safeParse(body.action);
  return parsed.success ? parsed.data : null;
}

function projectOf(value: unknown): ProjectState | { error: string } {
  const parsed = ProjectStateSchema.safeParse(value);
  if (parsed.success) return parsed.data as ProjectState;
  const issue = parsed.error.issues[0];
  return { error: `project: ${issue?.message || "invalid StoreCanvas project"}` };
}

function deviceOf(value: unknown, fallback: Device): Device | { error: string } {
  const parsed = DeviceSchema.safeParse(value ?? fallback);
  return parsed.success ? parsed.data : { error: "device must be one of the supported StoreCanvas devices" };
}

function integerOf(value: unknown, fallback: number, label: string): number | { error: string } {
  const candidate = value === undefined ? fallback : value;
  if (typeof candidate !== "number" || !Number.isInteger(candidate)) {
    return { error: `${label} must be an integer` };
  }
  return candidate;
}

function stringOf(value: unknown, label: string, required = false): string | undefined | { error: string } {
  if (value === undefined || value === null) {
    return required ? { error: `${label} is required` } : undefined;
  }
  if (typeof value !== "string" || !value.trim()) return { error: `${label} must be a non-empty string` };
  return value.trim();
}

function isError(value: unknown): value is { error: string } {
  return !!value && typeof value === "object" && "error" in value && typeof (value as { error?: unknown }).error === "string";
}

function tonePatternOf(value: unknown) {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.some((tone) => tone !== "light" && tone !== "dark")) {
    return { error: "tonePattern must contain only light or dark values" };
  }
  return value as Array<"light" | "dark">;
}

function catalog() {
  return {
    protocolVersion: 1,
    capabilities: {
      inspect: true,
      validate: true,
      applyTemplate: true,
      generateBackground: true,
      maxArtworkSlots: 10,
    },
    devices: DeviceSchema.options,
    templates: CAMPAIGN_TEMPLATES,
    palettes: PALETTE_PRESETS,
  };
}

export async function GET(request: Request) {
  const view = new URL(request.url).searchParams.get("view") || "catalog";
  if (view !== "catalog") return errorResponse(`Unknown agent view: ${view}`, 404);
  return noStoreJson({ ok: true, ...catalog() });
}

export async function POST(request: Request) {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return errorResponse("Invalid JSON.");
  }
  const body = bodyRecord(raw);
  if (!body) return errorResponse("Agent request must be a JSON object.");
  const action = actionOf(body);
  if (!action) return errorResponse("Unknown agent action.");

  if (action === "catalog") return noStoreJson({ ok: true, ...catalog() });

  const project = projectOf(body.project);
  if ("error" in project) return errorResponse(project.error);

  if (action === "inspect") {
    const hydrated = inheritDefaultDeviceDecks(project);
    return noStoreJson({ ok: true, state: hydrated, summary: summarizeProject(hydrated) });
  }

  if (action === "validate") {
    const strict = body.strict !== false;
    return noStoreJson({
      ok: true,
      summary: summarizeProject(project),
      validation: validateProject(project, { strict }),
    });
  }

  const device = deviceOf(body.device, project.device);
  if (isError(device)) return errorResponse(device.error);
  const templateId = stringOf(body.templateId, "templateId", action === "apply-template");
  if (isError(templateId)) return errorResponse(templateId.error);
  const requiredTemplateId = typeof templateId === "string" ? templateId : undefined;
  if (action === "apply-template" && !requiredTemplateId) return errorResponse("templateId is required");

  if (action === "apply-template") {
    const paletteId = stringOf(body.paletteId, "paletteId");
    if (isError(paletteId)) return errorResponse(paletteId.error);
    try {
      const state = applyAgentTemplate(project, requiredTemplateId!, device, {
        applyRecommendedPalette: body.applyRecommendedPalette === true,
        resetCustomizations: body.resetCustomizations === true,
        reflowConnectedArtwork: body.reflowConnectedArtwork !== false,
        paletteId: paletteId || undefined,
      });
      return noStoreJson({
        ok: true,
        action,
        state,
        summary: summarizeProject(state),
      });
    } catch (error) {
      return errorResponse(error instanceof Error ? error.message : "Could not apply template.");
    }
  }

  const spanSlots = integerOf(body.spanSlots, 2, "spanSlots");
  if (isError(spanSlots)) return errorResponse(spanSlots.error);
  const startSlot = integerOf(body.startSlot, 1, "startSlot");
  if (isError(startSlot)) return errorResponse(startSlot.error);
  const startIndex = startSlot - 1;
  const applyTemplate = body.applyTemplate !== false;
  const paletteId = stringOf(body.paletteId, "paletteId");
  if (isError(paletteId)) return errorResponse(paletteId.error);
  const prompt = stringOf(body.prompt, "prompt", true);
  if (isError(prompt)) return errorResponse(prompt.error);
  if (!prompt) return errorResponse("prompt is required");
  const apiKey = stringOf(body.apiKey, "apiKey", true);
  if (isError(apiKey)) return errorResponse(apiKey.error);
  if (!apiKey) return errorResponse("apiKey is required");
  const model = stringOf(body.model, "model") || "gpt-image-2";
  if (isError(model)) return errorResponse(model.error);
  const tone = body.tone === undefined ? undefined : ToneSchema.safeParse(body.tone);
  if (tone && !tone.success) return errorResponse("tone must be light, dark or mixed");
  const tonePattern = tonePatternOf(body.tonePattern);
  if (isError(tonePattern)) return errorResponse(tonePattern.error);
  const artworkId = stringOf(body.artworkId, "artworkId");
  if (isError(artworkId)) return errorResponse(artworkId.error);
  const assetRef = stringOf(body.assetRef, "assetRef");
  if (isError(assetRef)) return errorResponse(assetRef.error);

  try {
    let prepared = project;
    if (templateId && applyTemplate) {
      prepared = applyAgentTemplate(prepared, templateId, device, {
        applyRecommendedPalette: body.applyRecommendedPalette === true,
        resetCustomizations: body.resetCustomizations === true,
        reflowConnectedArtwork: body.reflowConnectedArtwork !== false,
        paletteId: paletteId || undefined,
      });
    } else if (paletteId) {
      if (!resolveAgentPalette(paletteId)) throw new Error(`Unknown palette: ${paletteId}`);
      prepared = applyPalette(prepared, paletteId);
    }

    assertConnectedArtworkRange(prepared, device, startIndex, spanSlots);
    const pattern = tonePattern || tonePatternForProject(prepared, device, startIndex, spanSlots);
    const inferredTone = pattern.every((value) => value === "light")
      ? "light"
      : pattern.every((value) => value === "dark")
        ? "dark"
        : "mixed";
    const requestInput = {
      provider: "openai" as const,
      apiKey,
      model,
      prompt,
      spanSlots: spanSlots as SlotSpan,
      tone: tone?.data || inferredTone,
      tonePattern: pattern,
    };
    const generated = await requestArtworkImage(requestInput);
    const resolvedArtworkId = artworkId || `ai-background-${startIndex + 1}-${spanSlots}`;
    const state = upsertGeneratedArtwork(prepared, {
      device,
      startIndex,
      spanSlots: spanSlots as SlotSpan,
      image: generated.path,
      artworkId: resolvedArtworkId,
      assetRef: assetRef || undefined,
    });
    return noStoreJson({
      ok: true,
      action,
      state,
      path: generated.path,
      artworkId: resolvedArtworkId,
      startSlot,
      spanSlots,
      tone: requestInput.tone,
      tonePattern: pattern,
      prompt: buildArtworkPrompt(requestInput),
      summary: summarizeProject(state),
    });
  } catch (error) {
    const status = error instanceof ArtworkImageError ? error.status : 400;
    return errorResponse(error instanceof Error ? error.message : "Could not generate background.", status);
  }
}
