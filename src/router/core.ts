import type { ModelProfile, PerformanceStats, RouteRequest, RouteResult, TaskType } from "../config/types.js";
import { DEFAULT_AFFINITIES } from "../config/defaults.js";
import { ProviderRegistry } from "../providers/registry.js";
import { Analyzer } from "../tracking/analyzer.js";
import { Recorder } from "../tracking/recorder.js";
import { classifyTask } from "./classifier.js";
import { classifyError, getCooldownDuration } from "./cascade.js";
import { createHash } from "crypto";

const MAX_CASCADE_DEPTH = 3;

export class OmniRouter {
  private registry: ProviderRegistry;
  private analyzer: Analyzer;
  private recorder: Recorder;

  constructor(registry: ProviderRegistry, analyzer: Analyzer, recorder: Recorder) {
    this.registry = registry;
    this.analyzer = analyzer;
    this.recorder = recorder;
  }

  async route(request: RouteRequest): Promise<RouteResult> {
    const taskType = request.taskType ?? classifyTask(request.task);
    const candidates = this.selectCandidates({ ...request, taskType });

    const scored = candidates
      .map((model) => {
        const history = this.analyzer.getStats(model.provider, model.model, taskType);
        return { model, score: this.scoreModel(model, taskType, request, history) };
      })
      .filter((s) => s.score >= 0)
      .sort((a, b) => b.score - a.score);

    if (scored.length === 0) {
      throw new Error(`No available models for task type "${taskType}". Check your .env configuration.`);
    }

    const taskHash = createHash("sha256").update(request.task).digest("hex").slice(0, 16);
    const errors: Array<{ model: string; error: string }> = [];
    const attempts = Math.min(MAX_CASCADE_DEPTH, scored.length);

    for (let i = 0; i < attempts; i++) {
      const candidate = scored[i];
      const provider = this.registry.getProvider(candidate.model.provider);
      if (!provider) continue;

      try {
        const start = Date.now();
        const response = await provider.complete(candidate.model.model, { ...request, taskType });
        const latencyMs = Date.now() - start;

        if (!response.content) {
          throw new Error("Empty response from model");
        }

        const costCents = provider.estimateCost(
          candidate.model.model,
          response.tokensUsed.input,
          response.tokensUsed.output
        );

        const callId = this.recorder.record({
          provider: candidate.model.provider,
          model: candidate.model.model,
          taskType,
          success: true,
          latencyMs,
          costCents,
          tokensIn: response.tokensUsed.input,
          tokensOut: response.tokensUsed.output,
          cascadeDepth: i,
          taskHash,
        });

        this.recorder.trackCost(costCents);

        return {
          provider: candidate.model.provider,
          model: candidate.model.model,
          response: response.content,
          latencyMs,
          costCents,
          tokensUsed: response.tokensUsed,
          cascadeDepth: i,
          routingReason:
            i === 0
              ? `Best match: ${candidate.model.provider}/${candidate.model.model} (score: ${candidate.score.toFixed(3)})`
              : `Fallback #${i}: ${candidate.model.provider}/${candidate.model.model} after ${i} failure(s)`,
          callId,
        };
      } catch (err) {
        const errorType = classifyError(err);
        errors.push({
          model: `${candidate.model.provider}/${candidate.model.model}`,
          error: err instanceof Error ? err.message : String(err),
        });

        this.recorder.record({
          provider: candidate.model.provider,
          model: candidate.model.model,
          taskType,
          success: false,
          errorType,
          cascadeDepth: i,
          taskHash,
        });

        if (errorType === "rate_limit") {
          const cooldown = getCooldownDuration(errorType, i);
          this.analyzer.addCooldown(candidate.model.provider, candidate.model.model, cooldown, "rate_limit");
        }

        if (errorType === "auth") {
          // Skip all models from this provider for the rest of this cascade
          for (let j = i + 1; j < scored.length; j++) {
            if (scored[j].model.provider === candidate.model.provider) {
              scored[j].score = -1;
            }
          }
        }
      }
    }

    throw new Error(
      `All ${attempts} candidates failed:\n${errors.map((e) => `  - ${e.model}: ${e.error}`).join("\n")}`
    );
  }

  private selectCandidates(request: RouteRequest & { taskType: TaskType }): ModelProfile[] {
    return this.registry
      .getAllModels()
      .filter((m) => m.capabilities.includes(request.taskType))
      .filter((m) => {
        if (request.constraints?.excludeProviders?.includes(m.provider)) return false;
        if (request.constraints?.minContextWindow && m.contextWindow < request.constraints.minContextWindow) return false;
        if (this.analyzer.isInCooldown(m.provider, m.model)) return false;
        return true;
      });
  }

  private scoreModel(
    model: ModelProfile,
    taskType: TaskType,
    request: RouteRequest,
    history: PerformanceStats | null
  ): number {
    // Static affinity
    const affinities = DEFAULT_AFFINITIES[taskType] ?? {};
    const affinityScore = affinities[model.model] ?? 0.5;

    // Historical performance
    let historyScore = 0.5;
    let historyWeight = 0;
    if (history && history.totalCalls >= 5) {
      const successComponent = history.successRate * 0.6;
      const qualityComponent = history.avgQuality
        ? ((history.avgQuality - 1) / 4) * 0.3 // normalize 1-5 to 0-1
        : 0.15; // neutral if no ratings
      const latencyComponent = history.avgLatencyMs
        ? (1 - Math.min(history.avgLatencyMs / 30000, 1)) * 0.1
        : 0.05;
      historyScore = successComponent + qualityComponent + latencyComponent;
      historyWeight = Math.min(0.5, history.totalCalls / 100);

      // Penalty for low success rate
      if (history.totalCalls >= 20 && history.successRate < 0.5) {
        historyScore *= 0.5;
      }
    }

    // Cost efficiency
    const estimatedInputTokens = Math.ceil(request.task.length / 4);
    const estimatedOutputTokens = 1000;
    const estimatedCost =
      (estimatedInputTokens / 1000) * model.costPer1kInput +
      (estimatedOutputTokens / 1000) * model.costPer1kOutput;

    if (request.constraints?.maxCostCents && estimatedCost > request.constraints.maxCostCents) {
      return -1; // eliminate
    }

    // Normalize cost: cheaper = higher score. Cap at 10 cents for normalization.
    const costScore = 1 - Math.min(estimatedCost / 10, 1);

    // Latency estimate
    const latencyEstimate = history?.avgLatencyMs ?? (model.tier === "budget" ? 800 : model.tier === "standard" ? 2000 : 4000);
    const latencyScore = 1 - Math.min(latencyEstimate / 30000, 1);

    if (request.constraints?.maxLatencyMs && latencyEstimate > request.constraints.maxLatencyMs * 1.5) {
      return -1;
    }

    // Provider preference
    const prefBonus = model.provider === request.constraints?.preferProvider ? 1.0 : 0.0;

    // Context fit
    const inputTokens = estimatedInputTokens + (request.context ? Math.ceil(request.context.length / 4) : 0);
    const contextFit = inputTokens > model.contextWindow * 0.8 ? 0.0 : inputTokens > model.contextWindow * 0.5 ? 0.5 : 1.0;

    // Compose final score
    const staticWeight = 1.0 - historyWeight;
    const affinityWeight = history && history.totalCalls >= 5 ? 0.15 : 0.40;

    return (
      affinityScore * affinityWeight * staticWeight +
      historyScore * historyWeight +
      costScore * 0.20 * staticWeight +
      latencyScore * 0.15 * staticWeight +
      prefBonus * 0.05 * staticWeight +
      contextFit * 0.05 * staticWeight
    );
  }
}
