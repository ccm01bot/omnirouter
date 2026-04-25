import { BaseProvider } from "./base.js";
import { MODEL_PROFILES } from "../config/defaults.js";
import type { ProviderResponse, RouteRequest } from "../config/types.js";

export class GrokProvider extends BaseProvider {
  readonly name = "grok";
  readonly models = MODEL_PROFILES.filter((m) => m.provider === "grok");

  isConfigured(): boolean {
    return !!process.env.XAI_API_KEY;
  }

  async complete(model: string, request: RouteRequest): Promise<ProviderResponse> {
    const content = request.context
      ? `${request.task}\n\nContext:\n${request.context}`
      : request.task;

    const response = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.XAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content }],
        max_tokens: 4096,
      }),
    });

    if (!response.ok) {
      throw new Error(`Grok API error: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as {
      choices: Array<{ message: { content: string }; finish_reason: string }>;
      usage?: { prompt_tokens: number; completion_tokens: number };
    };

    return {
      content: data.choices[0]?.message?.content ?? "",
      tokensUsed: {
        input: data.usage?.prompt_tokens ?? 0,
        output: data.usage?.completion_tokens ?? 0,
      },
      finishReason: data.choices[0]?.finish_reason === "stop" ? "stop" : "length",
    };
  }
}
