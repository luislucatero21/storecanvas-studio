import {
  AiImproveRequestSchema,
  buildAiPrompt,
  parseAiProposal,
  type AiImproveRequest,
  type AiProposal,
} from "./ai";

type FetchLike = typeof fetch;
type RuntimeEnv = Record<string, string | undefined>;

type ProviderRequest = {
  endpoint: string;
  apiKey: string;
  model: string;
  headers: Record<string, string>;
};

export class AiServiceError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
    this.name = "AiServiceError";
  }
}

function configured(value: string | undefined) {
  return value?.trim() || undefined;
}

export function resolveProviderRequest(
  input: AiImproveRequest,
  env: RuntimeEnv = process.env,
): ProviderRequest {
  if (input.provider === "openai") {
    return {
      endpoint: "https://api.openai.com/v1/chat/completions",
      apiKey: input.apiKey!,
      model: input.model,
      headers: {},
    };
  }

  if (input.provider === "openrouter") {
    const publicUrl = configured(env.STORECANVAS_PUBLIC_URL);
    return {
      endpoint: "https://openrouter.ai/api/v1/chat/completions",
      apiKey: input.apiKey!,
      model: input.model,
      headers: {
        ...(publicUrl ? { "HTTP-Referer": publicUrl } : {}),
        "X-OpenRouter-Title": "StoreCanvas",
      },
    };
  }

  return {
    endpoint: "https://api.openai.com/v1/chat/completions",
    apiKey: input.apiKey!,
    model: input.model,
    headers: {},
  };
}

function assistantText(body: unknown): string {
  const content = (body as { choices?: Array<{ message?: { content?: unknown } }> })?.choices?.[0]
    ?.message?.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    const text = content
      .map((part) => {
        if (!part || typeof part !== "object") return "";
        const maybeText = (part as { text?: unknown }).text;
        return typeof maybeText === "string" ? maybeText : "";
      })
      .join("\n");
    if (text.trim()) return text;
  }
  throw new AiServiceError("The provider did not return any assistant text. Try another model.", 502);
}

async function providerMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: { message?: unknown } | unknown; message?: unknown };
    const nested = body.error && typeof body.error === "object" ? (body.error as { message?: unknown }).message : undefined;
    const value = nested || body.message;
    if (typeof value === "string" && value.trim()) return value.trim().slice(0, 280);
  } catch {
    // Provider errors are often HTML; preserve a safe, useful local message instead.
  }
  return `Provider request failed with HTTP ${response.status}.`;
}

export async function requestAiProposal(
  rawInput: unknown,
  options: { fetchImpl?: FetchLike; env?: RuntimeEnv; timeoutMs?: number } = {},
): Promise<AiProposal> {
  const parsed = AiImproveRequestSchema.safeParse(rawInput);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new AiServiceError(issue?.message || "Invalid AI request.", 400);
  }
  const input = parsed.data;
  const provider = resolveProviderRequest(input, options.env);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 30_000);

  try {
    const response = await (options.fetchImpl || fetch)(provider.endpoint, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "content-type": "application/json",
        Authorization: `Bearer ${provider.apiKey}`,
        ...provider.headers,
      },
      body: JSON.stringify({
        model: provider.model,
        temperature: input.mode === "critique" ? 0.35 : 0.65,
        max_tokens: 1_200,
        messages: [
          {
            role: "system",
            content:
              "You are StoreCanvas, a senior App Store copy strategist. You return concise, truthful campaign recommendations in JSON only.",
          },
          { role: "user", content: buildAiPrompt(input) },
        ],
      }),
    });

    if (!response.ok) {
      throw new AiServiceError(await providerMessage(response), response.status >= 500 ? 502 : response.status);
    }
    const body = await response.json();
    return parseAiProposal(assistantText(body), input.slides.map((slide) => slide.id));
  } catch (error) {
    if (error instanceof AiServiceError) throw error;
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new AiServiceError("The AI request timed out. Try again or choose a faster model.", 504);
    }
    throw new AiServiceError("StoreCanvas could not reach the AI provider. Check the key, model and network, then try again.", 502);
  } finally {
    clearTimeout(timeout);
  }
}
