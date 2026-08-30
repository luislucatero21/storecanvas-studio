import { z } from "zod";
import { writeLocalized } from "./locale";
import type { Device, ProjectState } from "./types";

export const AI_PROVIDERS = ["openai", "openrouter", "platform"] as const;
export const AI_MODES = ["polish", "narrative", "critique"] as const;

export const AiProviderSchema = z.enum(AI_PROVIDERS);
export const AiModeSchema = z.enum(AI_MODES);

const AiSlideInputSchema = z.object({
  id: z.string().trim().min(1).max(160),
  label: z.string().trim().max(160),
  headline: z.string().trim().min(1).max(360),
});

export const AiImproveRequestSchema = z
  .object({
    provider: AiProviderSchema,
    apiKey: z.string().trim().min(10).max(500).optional(),
    model: z.string().trim().min(1).max(160),
    mode: AiModeSchema,
    appName: z.string().trim().min(1).max(160),
    locale: z.string().trim().min(1).max(32),
    templateId: z.string().trim().max(80).optional(),
    paletteId: z.string().trim().max(80).optional(),
    brief: z.string().trim().max(480).optional(),
    slides: z.array(AiSlideInputSchema).min(1).max(10),
  })
  .superRefine((value, ctx) => {
    if (value.provider !== "platform" && !value.apiKey) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["apiKey"],
        message: "Add a personal API key for this provider.",
      });
    }
  });

const AiSlideProposalSchema = z.object({
  id: z.string().trim().min(1).max(160),
  label: z.string().trim().max(160),
  headline: z.string().trim().min(1).max(360),
  rationale: z.string().trim().min(1).max(360),
});

export const AiProposalSchema = z.object({
  summary: z.string().trim().min(1).max(480),
  recommendedTemplateId: z.string().trim().max(80).optional(),
  recommendedPaletteId: z.string().trim().max(80).optional(),
  slides: z.array(AiSlideProposalSchema).min(1).max(10),
});

export type AiProvider = z.infer<typeof AiProviderSchema>;
export type AiMode = z.infer<typeof AiModeSchema>;
export type AiImproveRequest = z.infer<typeof AiImproveRequestSchema>;
export type AiProposal = z.infer<typeof AiProposalSchema>;

export function validateAiRequest(input: unknown):
  | { ok: true; value: AiImproveRequest }
  | { ok: false; error: string } {
  const parsed = AiImproveRequestSchema.safeParse(input);
  if (parsed.success) return { ok: true, value: parsed.data };
  const first = parsed.error.issues[0];
  return {
    ok: false,
    error: first ? `${first.path.join(".") || "request"}: ${first.message}` : "Invalid AI request.",
  };
}

const MODE_GUIDANCE: Record<AiMode, string> = {
  polish:
    "Tighten the current claims. Keep the original strategic intent, but make each slide fast to read at thumbnail size.",
  narrative:
    "Improve the arc across the deck: promise, differentiator, proof, then a memorable close. Give every slide one distinct job.",
  critique:
    "Diagnose weak or repetitive claims, then propose the smallest wording changes that make the campaign clearer and more credible.",
};

/** Builds a text-only brief; screenshot paths and API credentials never enter this prompt. */
export function buildAiPrompt(input: AiImproveRequest): string {
  const templateContext = input.templateId ? `Current template: ${input.templateId}.` : "";
  const paletteContext = input.paletteId ? `Current palette: ${input.paletteId}.` : "";
  const customBrief = input.brief ? `Creator brief: ${input.brief}` : "";
  return [
    `App: ${input.appName}.`,
    `Locale: ${input.locale}.`,
    templateContext,
    paletteContext,
    MODE_GUIDANCE[input.mode],
    customBrief,
    "Store screenshot copy must be outcome-led, concrete and easy to scan. Use one idea per slide; avoid hype, feature lists and repeated verbs. Keep label short and uppercase-friendly. Keep headlines compact with intentional line breaks when they improve thumbnail reading.",
    "Return only valid JSON in this exact shape:",
    '{"summary":"...","recommendedTemplateId":"optional","recommendedPaletteId":"optional","slides":[{"id":"existing-id","label":"...","headline":"...","rationale":"..."}]}',
    "Only use the supplied slide IDs. Propose a recommendation only when it is clearly useful.",
    "Slides to improve:",
    JSON.stringify(input.slides),
  ]
    .filter(Boolean)
    .join("\n\n");
}

function jsonCandidate(raw: string): string {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const source = (fenced || raw).trim();
  const start = source.indexOf("{");
  const end = source.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("The AI response did not include a JSON proposal.");
  }
  return source.slice(start, end + 1);
}

export function parseAiProposal(raw: string, expectedSlideIds: Iterable<string>): AiProposal {
  let value: unknown;
  try {
    value = JSON.parse(jsonCandidate(raw));
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("The AI response")) throw error;
    throw new Error("The AI response was not valid JSON. Try again or choose another model.");
  }

  const parsed = AiProposalSchema.safeParse(value);
  if (!parsed.success) {
    throw new Error("The AI response did not match the StoreCanvas proposal format. Try again.");
  }

  const allowed = new Set(expectedSlideIds);
  const seen = new Set<string>();
  const slides = parsed.data.slides.filter((slide) => {
    if (!allowed.has(slide.id) || seen.has(slide.id)) return false;
    seen.add(slide.id);
    return true;
  });
  if (slides.length === 0) {
    throw new Error("The AI response did not contain suggestions for this campaign.");
  }

  return { ...parsed.data, slides };
}

/** Apply copy only. Captures, links, transforms, layouts and custom text remain untouched. */
export function applyAiProposal(
  project: ProjectState,
  proposal: AiProposal,
  locale: string,
  device: Device = project.device,
): ProjectState {
  const updates = new Map(proposal.slides.map((slide) => [slide.id, slide]));
  return {
    ...project,
    slidesByDevice: {
      ...project.slidesByDevice,
      [device]: (project.slidesByDevice[device] || []).map((slide) => {
        const update = updates.get(slide.id);
        if (!update) return slide;
        return {
          ...slide,
          label: writeLocalized(slide.label, locale, update.label),
          headline: writeLocalized(slide.headline, locale, update.headline),
        };
      }),
    },
  };
}
