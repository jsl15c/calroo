// Claude API wrapper — non-streaming (JSON) and SSE streaming.
// Uses native fetch only — Cloudflare Workers compatible.

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const DEFAULT_MODEL = "claude-sonnet-4-6";

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
  apiKey: string;
};

export type ClaudeNonStreamResponse = {
  content: Array<{ type: string; text: string }>;
  usage: { input_tokens: number; output_tokens: number };
};

/** Makes a non-streaming Claude API call. Returns the full response text and token counts. */
export async function callClaude(
  options: ClaudeCallOptions & { stream: false },
): Promise<{ text: string; inputTokens: number; outputTokens: number }>;

/** Makes a streaming Claude API call. Returns a ReadableStream of SSE bytes. */
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
  } = options;

  const body = {
    model: DEFAULT_MODEL,
    system,
    messages,
    max_tokens,
    temperature,
    stream,
  };

  const response = await fetch(ANTHROPIC_API_URL, {
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

  // Streaming: pass through the response body directly
  if (!response.body) {
    throw new ClaudeApiError("No response body for stream", 500);
  }

  return response.body;
}

/**
 * Transforms a Claude SSE stream into our own SSE format.
 *
 * Our SSE event types:
 *   event: token  — streamed text delta
 *   event: done   — stream complete
 *   event: error  — error message
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
                const sseEvent =
                  `event: token\ndata: ${JSON.stringify({ text: parsed.delta.text })}\n\n`;
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

// ─── Error type ───────────────────────────────────────────

export class ClaudeApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ClaudeApiError";
    this.status = status;
  }
}
