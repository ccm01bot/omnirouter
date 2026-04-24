export const TASK_TYPES = [
  "coding",
  "research",
  "creative_writing",
  "analysis",
  "image_gen",
  "translation",
  "summarization",
  "data_extraction",
  "math_reasoning",
] as const;

export type TaskType = (typeof TASK_TYPES)[number];

export interface RouteRequest {
  task: string;
  taskType?: TaskType;
  context?: string;
  constraints?: {
    maxCostCents?: number;
    maxLatencyMs?: number;
    preferProvider?: string;
    excludeProviders?: string[];
    minContextWindow?: number;
  };
  metadata?: Record<string, unknown>;
}

export interface RouteResult {
  provider: string;
  model: string;
  response: string;
  latencyMs: number;
  costCents: number;
  tokensUsed: { input: number; output: number };
  cascadeDepth: number;
  routingReason: string;
  callId: number;
}

export interface ProviderResponse {
  content: string;
  tokensUsed: { input: number; output: number };
  finishReason: "stop" | "length" | "content_filter" | "error";
}

export interface ModelProfile {
  provider: string;
  model: string;
  capabilities: TaskType[];
  contextWindow: number;
  costPer1kInput: number;
  costPer1kOutput: number;
  tier: "budget" | "standard" | "premium";
}

export interface PerformanceStats {
  provider: string;
  model: string;
  taskType: string;
  totalCalls: number;
  successCount: number;
  successRate: number;
  avgLatencyMs: number | null;
  avgCostCents: number | null;
  totalCostCents: number;
  avgQuality: number | null;
  lastFailure: string | null;
  lastSuccess: string | null;
}

export type ErrorType =
  | "rate_limit"
  | "timeout"
  | "auth"
  | "server"
  | "content_filter"
  | "empty_response"
  | "unknown";

export interface CallRecord {
  provider: string;
  model: string;
  taskType: string;
  success: boolean;
  errorType?: ErrorType;
  latencyMs?: number;
  costCents?: number;
  tokensIn?: number;
  tokensOut?: number;
  cascadeDepth: number;
  qualityRating?: number;
  taskHash?: string;
}
