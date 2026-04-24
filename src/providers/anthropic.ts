import Anthropic from "@anthropic-ai/sdk";
import { BaseProvider } from "./base.js";
import { MODEL_PROFILES } from "../config/defaults.js";
import type { ProviderResponse, RouteRequest } from "../config/types.js";

export class AnthropicProvider extends BaseProvider {
  readonly name = "anthropic";
  readonly models = MODEL_PROFILES.filter((m) => m.provider === "anthropic");
  private client: Anthropic | null = null;

  isConfigured(): boolean {
    return !!process.env.ANTHROPIC_API_KEY;
  }

  private getClient(): Anthropic {
    if (!this.client) {
      this.client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    }
    return this.client;
  }

  async complete(model: string, request: RouteRequest): Promise<ProviderResponse> {
    const client = this.getClient();
    const content = request.context
      ? `${request.task}\n\nContext:\n${request.context}`
      : request.task;

    const response = await client.messages.create({
      model,
      max_tokens: 4096,
      messages: [{ role: "user", content }],
    });

    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("\n");

    return {
      content: text,
      tokensUsed: {
        input: response.usage.input_tokens,
        output: response.usage.output_tokens,
      },
      finishReason: response.stop_reason === "end_turn" ? "stop" : "length",
    };
  }
}
