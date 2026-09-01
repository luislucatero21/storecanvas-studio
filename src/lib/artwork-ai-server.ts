import { z } from "zod";
import { saveUploadedDataUrl } from "./uploaded-image-server";
type FetchLike = typeof fetch;

export const ArtworkImageRequestSchema = z.object({
  provider: z.literal("openai"),
  apiKey: z.string().trim().optional(),
  model: z.string().trim().min(1).default("gpt-image-2"),
  prompt: z.string().trim().min(12).max(2400),
  spanSlots: z.number().int().min(1).max(10).default(2),
  tone: z.enum(["light", "dark", "mixed"]).default("mixed"),
  tonePattern: z.array(z.enum(["light", "dark"])).max(10).optional(),
}).superRefine((value, context) => {
  if (value.provider === "openai" && !value.apiKey) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["apiKey"], message: "Add a personal OpenAI API key." });
  }
  if (value.tonePattern && value.tonePattern.length > value.spanSlots) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["tonePattern"], message: "Tone pattern cannot exceed the selected screen span." });
  }
});

export type ArtworkImageRequest = z.input<typeof ArtworkImageRequestSchema>;

export type ArtworkProviderRequest = {
  endpoint: string;
  apiKey: string;
  model: string;
};

export class ArtworkImageError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
    this.name = "ArtworkImageError";
  }
}

export function resolveArtworkProviderRequest(
  raw: ArtworkImageRequest,
): ArtworkProviderRequest {
  const input = ArtworkImageRequestSchema.parse(raw);
  return { endpoint: "https://api.openai.com/v1/images/generations", apiKey: input.apiKey!, model: input.model };
}

/** Builds the provider prompt without ever including the user's API key. */
export function buildArtworkPrompt(raw: ArtworkImageRequest): string {
  const input = ArtworkImageRequestSchema.parse(raw);
  const pattern = input.tonePattern?.slice(0, input.spanSlots);
  const toneGuidance = pattern?.length
    ? `Preserve this surface rhythm from left to right: ${pattern.map((tone, index) => `slot ${index + 1} ${tone}`).join(", ")}. Make each transition soft and intentional.`
    : input.tone === "mixed"
      ? "Use a gentle light-to-dark rhythm that remains compatible with alternating light and inverted template slides."
      : `Keep the whole artwork in a ${input.tone} tonal register that supports the selected template.`;
  return `${input.prompt}\n\nCreate one continuous, text-free advertising artwork intended to span ${input.spanSlots} adjacent portrait App Store screenshots. Keep the visual flow continuous across every slot boundary, leave useful negative space for real device mockups and headline overlays, and preserve the chosen template's light/dark rhythm. ${toneGuidance} Do not draw phones, UI, logos, lettering, badges or watermarks.`;
}

async function providerError(response: Response) {
  try {
    const body = await response.json() as { error?: { message?: string }; message?: string };
    return (body.error?.message || body.message || `Image provider failed with HTTP ${response.status}`).slice(0, 280);
  } catch {
    return `Image provider failed with HTTP ${response.status}`;
  }
}

export async function requestArtworkImage(
  raw: ArtworkImageRequest,
  options: {
    fetchImpl?: FetchLike;
    timeoutMs?: number;
    saveDataUrl?: (dataUrl: string) => Promise<string>;
  } = {},
): Promise<{ path: string }> {
  const parsed = ArtworkImageRequestSchema.safeParse(raw);
  if (!parsed.success) throw new ArtworkImageError(parsed.error.issues[0]?.message || "Invalid image request");
  const input = parsed.data;
  const provider = resolveArtworkProviderRequest(input);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 90_000);
  try {
    const response = await (options.fetchImpl || fetch)(provider.endpoint, {
      method: "POST",
      signal: controller.signal,
      headers: { "content-type": "application/json", Authorization: `Bearer ${provider.apiKey}` },
      body: JSON.stringify({
        model: provider.model,
        prompt: buildArtworkPrompt(input),
        size: "1536x1024",
        quality: "high",
        output_format: "png",
      }),
    });
    if (!response.ok) throw new ArtworkImageError(await providerError(response), response.status >= 500 ? 502 : response.status);
    const body = await response.json() as { path?: string; data?: Array<{ b64_json?: string; url?: string }> };
    if (typeof body.path === "string" && body.path.startsWith("/")) return { path: body.path };
    const base64 = body.data?.[0]?.b64_json;
    if (!base64) throw new ArtworkImageError("The image provider returned no image data.", 502);
    const save = options.saveDataUrl || saveUploadedDataUrl;
    return { path: await save(`data:image/png;base64,${base64}`) };
  } catch (error) {
    if (error instanceof ArtworkImageError) throw error;
    if (error instanceof DOMException && error.name === "AbortError") throw new ArtworkImageError("Image generation timed out.", 504);
    throw new ArtworkImageError("StoreCanvas could not reach the image provider.", 502);
  } finally {
    clearTimeout(timeout);
  }
}
