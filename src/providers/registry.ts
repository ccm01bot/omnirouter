import type { BaseProvider } from "./base.js";
import type { ModelProfile } from "../config/types.js";
import { AnthropicProvider } from "./anthropic.js";
import { OpenAIProvider } from "./openai.js";
import { GeminiProvider } from "./gemini.js";
import { PerplexityProvider } from "./perplexity.js";
import { MoonshotProvider } from "./moonshot.js";
import { ZaiProvider } from "./zai.js";

export class ProviderRegistry {
  private providers: Map<string, BaseProvider> = new Map();

  constructor() {
    const all: BaseProvider[] = [
      new AnthropicProvider(),
      new OpenAIProvider(),
      new GeminiProvider(),
      new PerplexityProvider(),
      new MoonshotProvider(),
      new ZaiProvider(),
    ];

    for (const provider of all) {
      if (provider.isConfigured()) {
        this.providers.set(provider.name, provider);
      }
    }
  }

  getProvider(name: string): BaseProvider | undefined {
    return this.providers.get(name);
  }

  getAllModels(): ModelProfile[] {
    const models: ModelProfile[] = [];
    for (const provider of this.providers.values()) {
      models.push(...provider.getModels());
    }
    return models;
  }

  getConfiguredProviders(): string[] {
    return Array.from(this.providers.keys());
  }

  isProviderConfigured(name: string): boolean {
    return this.providers.has(name);
  }
}
