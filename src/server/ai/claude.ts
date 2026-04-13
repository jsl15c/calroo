// AI client — supports two backends:
//   1. Cloudflare Workers AI binding (env.AI) — no Anthropic key required.
//      Used automatically in production CF Workers via the [ai] binding in wrangler.toml.
//   2. Anthropic API directly (or via CF AI Gateway proxy when CLOUDFLARE_AI_GATEWAY_URL is set).
//      Used for local dev with `next dev` when no CF binding is available.
//
// Priority: CF AI binding > Anthropic API key. At least one must be present per request.

const ANTHROPIC_BASE_URL = "https://api.anthropic.com";
const ANTHROPIC_VERSION = "2023-06-01";
const ANTHROPIC_MODEL = "claude-sonnet-4-6";

// Cloudflare Workers AI model for Anthropic Claude.
// See: https://developers.cloudflare.com/workers-ai/models/
const CF_AI_MODEL = "@cf/anthropic/claude-3-haiku";

// ─── Binding type ─────────────────────────────────────────────────────────────

/**
 * Minimal Cloudflare Workers AI binding interface.
 * Matches the `Ai` class from @cloudflare/workers-types without importing it
 * (avoids conflicts with the `dom` lib in tsconfig).
 */
export type AiBinding = {
  run(
    model: string,
    inputs: {
      messages: Array<{ role: string; content: string }>;
      max_tokens?: number;
      temperature?: number;
      stream?: boolean;
    },
  ): Promise<{ response: string } | ReadableStream<Uint8Array>>;
};

// ─── Call options ─────────────────────────────────────────────────────────────

export type ClaudeMessage = {
  role: "user" | "assistant";
  content: string;
};

export type ClaudeCallOptions = {
  system: string;
  messages: ClaudeMessage[];
  max_tokens?: number;
  temperature?: number;
  stream?: boolean;
  /** Anthropic API key — required unless aiBinding is provided. */
  apiKey: string | null;
  /** Cloudflare Workers AI binding. When present, routes through CF instead of Anthropic. */
  aiBinding?: AiBinding | null;
  /** When set, Anthropic API calls route through the Cloudflare AI Gateway proxy.
   *  Format: https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_name}/anthropic */
  gatewayUrl?: string | null;
};

// ─── Overloads ────────────────────────────────────────────────────────────────

/** Makes a non-streaming call. Returns the full response text and token counts. */
export async function callClaude(
  options: ClaudeCallOptions & { stream: false },
): Promise<{ text: string; inputTokens: number; outputTokens: number }>;

/** Makes a streaming call. Returns a ReadableStream of our SSE bytes. */
export async function callClaude(
  options: ClaudeCallOptions & { stream: true },
): Promise<ReadableStream<Uint8Array>>;

export async function callClaude(
  options: ClaudeCallOptions,
): Promise<
  | { text: string; inputTokens: number; outputTokens: number }
  | ReadableStream<Uint8Array>
> {
  const {
    system,
    messages,
    max_tokens = 2048,
    temperature = 0.7,
    stream = false,
    apiKey,
    aiBinding,
    gatewayUrl,
  } = options;

  // ── Path 1: Cloudflare Workers AI binding ────────────────────────────────
  if (aiBinding) {
    // CF Workers AI expects the system prompt as a role:"system" message
    const cfMessages: Array<{ role: string; content: string }> = [
      { role: "system", content: system },
      ...messages,
    ];

    if (stream) {
      const result = await aiBinding.run(CF_AI_MODEL, {
        messages: cfMessages,
        max_tokens,
        temperature,
        stream: true,
      });
      if (!(result instanceof ReadableStream)) {
        // Shouldn't happen, but handle gracefully
        throw new ClaudeApiError("CF AI binding did not return a stream", 500);
      }
      return transformCfAiStream(result);
    }

    const result = await aiBinding.run(CF_AI_MODEL, {
      messages: cfMessages,
      max_tokens,
      temperature,
      stream: false,
    });
    if (result instanceof ReadableStream) {
      throw new ClaudeApiError(
        "CF AI binding returned a stream for non-streaming call",
        500,
      );
    }
    return { text: result.response, inputTokens: 0, outputTokens: 0 };
  }

  // ── Path 2: Anthropic API (direct or via CF AI Gateway) ──────────────────
  if (!apiKey) {
    throw new ClaudeApiError(
      "No AI backend available: set ANTHROPIC_API_KEY (for local dev) or configure the CF Workers AI binding (production).",
      500,
    );
  }

  const apiUrl = gatewayUrl
    ? `${gatewayUrl}/v1/messages`
    : `${ANTHROPIC_BASE_URL}/v1/messages`;

  const body = {
    model: ANTHROPIC_MODEL,
    system,
    messages,
    max_tokens,
    temperature,
    stream,
  };

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new ClaudeApiError(
      `Claude API error ${response.status}: ${errorText}`,
      response.status,
    );
  }

  if (!stream) {
    const data = (await response.json()) as ClaudeNonStreamResponse;
    const text = data.content
      .filter((c) => c.type === "text")
      .map((c) => c.text)
      .join("");
    return {
      text,
      inputTokens: data.usage.input_tokens,
      outputTokens: data.usage.output_tokens,
    };
  }

  if (!response.body) {
    throw new ClaudeApiError("No response body for stream", 500);
  }

  return response.body;
}

// ─── Stream transformers ──────────────────────────────────────────────────────

/**
 * Transforms a Claude (Anthropic) SSE stream into our SSE format.
 *
 * Claude emits `content_block_delta` events; we emit `event: token` lines.
 */
export function transformClaudeStream(
  claudeStream: ReadableStream<Uint8Array>,
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  return new ReadableStream({
    async start(controller) {
      const reader = claudeStream.getReader();
      let buffer = "";

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const data = line.slice(6);
            if (data === "[DONE]") continue;

            try {
              const parsed = JSON.parse(data) as {
                type: string;
                delta?: { type: string; text: string };
              };

              if (
                parsed.type === "content_block_delta" &&
                parsed.delta?.type === "text_delta" &&
                parsed.delta.text
              ) {
                const sseEvent = `event: token\ndata: ${JSON.stringify({ text: parsed.delta.text })}\n\n`;
                controller.enqueue(encoder.encode(sseEvent));
              }
            } catch {
              // Skip malformed SSE lines
            }
          }
        }

        controller.enqueue(encoder.encode("event: done\ndata: {}\n\n"));
        controller.close();
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Upstream stream error";
        controller.enqueue(
          encoder.encode(
            `event: error\ndata: ${JSON.stringify({ message })}\n\n`,
          ),
        );
        controller.close();
      }
    },
  });
}

/**
 * Transforms a Cloudflare Workers AI stream into our SSE format.
 *
 * CF Workers AI emits `{"response":"chunk"}` JSON lines; we emit `event: token` lines.
 */
export function transformCfAiStream(
  cfStream: ReadableStream<Uint8Array>,
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  return new ReadableStream({
    async start(controller) {
      const reader = cfStream.getReader();
      let buffer = "";

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const data = line.slice(6).trim();
            if (data === "[DONE]") continue;

            try {
              const parsed = JSON.parse(data) as { response?: string };
              if (parsed.response) {
                const sseEvent = `event: token\ndata: ${JSON.stringify({ text: parsed.response })}\n\n`;
                controller.enqueue(encoder.encode(sseEvent));
              }
            } catch {
              // Skip malformed lines
            }
          }
        }

        controller.enqueue(encoder.encode("event: done\ndata: {}\n\n"));
        controller.close();
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "CF AI stream error";
        controller.enqueue(
          encoder.encode(
            `event: error\ndata: ${JSON.stringify({ message })}\n\n`,
          ),
        );
        controller.close();
      }
    },
  });
}

// ─── Internal types ───────────────────────────────────────────────────────────

type ClaudeNonStreamResponse = {
  content: Array<{ type: string; text: string }>;
  usage: { input_tokens: number; output_tokens: number };
};

// ─── Error type ───────────────────────────────────────────────────────────────

export class ClaudeApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ClaudeApiError";
    this.status = status;
  }
}
