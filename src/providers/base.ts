import type { ModelProfile, ProviderResponse, RouteRequest } from "../config/types.js";

export abstract class BaseProvider {
  abstract readonly name: string;
  abstract readonly models: ModelProfile[];

  abstract complete(model: string, request: RouteRequest): Promise<ProviderResponse>;
  abstract isConfigured(): boolean;

  estimateCost(model: string, inputTokens: number, outputTokens: number): number {
    const profile = this.models.find((m) => m.model === model);
    if (!profile) return 0;
    return (
      (inputTokens / 1000) * profile.costPer1kInput +
      (outputTokens / 1000) * profile.costPer1kOutput
    );
  }

  getModels(): ModelProfile[] {
    return this.models;
  }
}
