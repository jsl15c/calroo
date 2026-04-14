// AI client — OpenRouter.
// Simple HTTP API, OpenAI-compatible. Works in any environment (next dev, wrangler dev, production).
// Get a key at https://openrouter.ai/keys

const OR_BASE_URL = "https://openrouter.ai/api/v1/chat/completions";

// Change to any model on https://openrouter.ai/models
export const OR_MODEL = "anthropic/claude-haiku-4.5";

// ─── Types ────────────────────────────────────────────────────────────────────

export type OpenRouterMessage = {
  role: "user" | "assistant";
  content: string;
};

export type OpenRouterCallOptions = {
  system: string;
  messages: OpenRouterMessage[];
  max_tokens?: number;
  temperature?: number;
  stream?: boolean;
  apiKey: string;
};

// ─── Overloads ────────────────────────────────────────────────────────────────

/** Non-streaming call — returns the full response text. */
export async function callClaude(
  options: OpenRouterCallOptions & { stream: false },
): Promise<{ text: string }>;

/** Streaming call — returns the raw OpenRouter SSE stream. */
export async function callClaude(
  options: OpenRouterCallOptions & { stream: true },
): Promise<ReadableStream<Uint8Array>>;

export async function callClaude(
  options: OpenRouterCallOptions,
): Promise<{ text: string } | ReadableStream<Uint8Array>> {
  const {
    system,
    messages,
    max_tokens = 800,
    temperature = 0.7,
    stream = false,
    apiKey,
  } = options;

  const response = await fetch(OR_BASE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "X-Title": "CalRoo",
    },
    body: JSON.stringify({
      model: OR_MODEL,
      messages: [{ role: "system", content: system }, ...messages],
      max_tokens,
      temperature,
      stream,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new AIError(
      `OpenRouter error ${response.status}: ${errorText}`,
      response.status,
    );
  }

  if (stream) {
    if (!response.body) throw new AIError("No response body for stream", 500);
    return response.body;
  }

  const data = (await response.json()) as {
    choices: Array<{ message: { content: string } }>;
  };
  return { text: data.choices[0]?.message?.content ?? "" };
}

// ─── Stream transformer ───────────────────────────────────────────────────────

/**
 * Transforms a raw OpenRouter SSE stream into our SSE format.
 *
 * OpenRouter emits OpenAI-compatible deltas:
 *   data: {"choices":[{"delta":{"content":"chunk"}}]}
 *   data: [DONE]
 *
 * We emit:
 *   event: token  →  data: {"text":"chunk"}
 *   event: done   →  data: {}
 *   event: error  →  data: {"message":"..."}
 */
export function transformOpenRouterStream(
  orStream: ReadableStream<Uint8Array>,
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  return new ReadableStream({
    async start(controller) {
      const reader = orStream.getReader();
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
              const parsed = JSON.parse(data) as {
                choices: Array<{ delta?: { content?: string } }>;
              };
              const text = parsed.choices[0]?.delta?.content;
              if (text) {
                controller.enqueue(
                  encoder.encode(
                    `event: token\ndata: ${JSON.stringify({ text })}\n\n`,
                  ),
                );
              }
            } catch {
              // skip malformed lines
            }
          }
        }

        controller.enqueue(encoder.encode("event: done\ndata: {}\n\n"));
        controller.close();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Stream error";
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

/** Extracts concatenated text content from a raw OpenRouter SSE buffer. */
export function extractTextFromStream(sseData: string): string {
  const texts: string[] = [];
  for (const line of sseData.split("\n")) {
    if (!line.startsWith("data: ")) continue;
    const data = line.slice(6).trim();
    if (data === "[DONE]") continue;
    try {
      const parsed = JSON.parse(data) as {
        choices: Array<{ delta?: { content?: string } }>;
      };
      const text = parsed.choices[0]?.delta?.content;
      if (text) texts.push(text);
    } catch {
      // skip
    }
  }
  return texts.join("");
}

// ─── Error type ───────────────────────────────────────────────────────────────

export class AIError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "AIError";
    this.status = status;
  }
}
