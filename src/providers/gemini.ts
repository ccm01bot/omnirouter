import { GoogleGenerativeAI } from "@google/generative-ai";
import { BaseProvider } from "./base.js";
import { MODEL_PROFILES } from "../config/defaults.js";
import type { ProviderResponse, RouteRequest } from "../config/types.js";

export class GeminiProvider extends BaseProvider {
  readonly name = "gemini";
  readonly models = MODEL_PROFILES.filter((m) => m.provider === "gemini");
  private client: GoogleGenerativeAI | null = null;

  isConfigured(): boolean {
    return !!process.env.GEMINI_API_KEY;
  }

  private getClient(): GoogleGenerativeAI {
    if (!this.client) {
      this.client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
    }
    return this.client;
  }

  async complete(model: string, request: RouteRequest): Promise<ProviderResponse> {
    const client = this.getClient();
    const genModel = client.getGenerativeModel({ model });
    const content = request.context
      ? `${request.task}\n\nContext:\n${request.context}`
      : request.task;

    const result = await genModel.generateContent(content);
    const response = result.response;
    const text = response.text();
    const usage = response.usageMetadata;

    return {
      content: text,
      tokensUsed: {
        input: usage?.promptTokenCount ?? 0,
        output: usage?.candidatesTokenCount ?? 0,
      },
      finishReason: "stop",
    };
  }
}
