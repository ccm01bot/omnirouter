import OpenAI from "openai";
import { BaseProvider } from "./base.js";
import { MODEL_PROFILES } from "../config/defaults.js";
import type { ProviderResponse, RouteRequest } from "../config/types.js";

export class OpenAIProvider extends BaseProvider {
  readonly name = "openai";
  readonly models = MODEL_PROFILES.filter((m) => m.provider === "openai");
  private client: OpenAI | null = null;

  isConfigured(): boolean {
    return !!process.env.OPENAI_API_KEY;
  }

  private getClient(): OpenAI {
    if (!this.client) {
      this.client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    }
    return this.client;
  }

  async complete(model: string, request: RouteRequest): Promise<ProviderResponse> {
    const client = this.getClient();
    const content = request.context
      ? `${request.task}\n\nContext:\n${request.context}`
      : request.task;

    if (model === "dall-e-3") {
      const response = await client.images.generate({
        model: "dall-e-3",
        prompt: content,
        n: 1,
        size: "1024x1024",
      });
      return {
        content: response.data[0]?.url ?? "",
        tokensUsed: { input: 0, output: 0 },
        finishReason: "stop",
      };
    }

    const response = await client.chat.completions.create({
      model,
      messages: [{ role: "user", content }],
      max_tokens: 4096,
    });

    const choice = response.choices[0];
    return {
      content: choice?.message?.content ?? "",
      tokensUsed: {
        input: response.usage?.prompt_tokens ?? 0,
        output: response.usage?.completion_tokens ?? 0,
      },
      finishReason: choice?.finish_reason === "stop" ? "stop" : "length",
    };
  }
}
