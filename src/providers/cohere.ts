import { BaseProvider } from "./base.js";
import { MODEL_PROFILES } from "../config/defaults.js";
import type { ProviderResponse, RouteRequest } from "../config/types.js";

export class CohereProvider extends BaseProvider {
  readonly name = "cohere";
  readonly models = MODEL_PROFILES.filter((m) => m.provider === "cohere");

  isConfigured(): boolean {
    return !!process.env.COHERE_API_KEY;
  }

  async complete(model: string, request: RouteRequest): Promise<ProviderResponse> {
    const content = request.context
      ? `${request.task}\n\nContext:\n${request.context}`
      : request.task;

    const response = await fetch("https://api.cohere.com/v2/chat", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.COHERE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content }],
        max_tokens: 4096,
      }),
    });

    if (!response.ok) {
      throw new Error(`Cohere API error: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as {
      message?: { content?: Array<{ text: string }> };
      usage?: { billed_units?: { input_tokens: number; output_tokens: number } };
    };

    const text = data.message?.content?.map((c) => c.text).join("\n") ?? "";

    return {
      content: text,
      tokensUsed: {
        input: data.usage?.billed_units?.input_tokens ?? 0,
        output: data.usage?.billed_units?.output_tokens ?? 0,
      },
      finishReason: "stop",
    };
  }
}
