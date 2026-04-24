import type { ErrorType } from "../config/types.js";

export function classifyError(error: unknown): ErrorType {
  const msg = error instanceof Error ? error.message : String(error);
  const lower = msg.toLowerCase();

  if (lower.includes("rate") || lower.includes("429") || lower.includes("too many")) {
    return "rate_limit";
  }
  if (lower.includes("timeout") || lower.includes("timed out") || lower.includes("etimedout")) {
    return "timeout";
  }
  if (lower.includes("401") || lower.includes("403") || lower.includes("auth") || lower.includes("api key") || lower.includes("unauthorized")) {
    return "auth";
  }
  if (lower.includes("content") && (lower.includes("filter") || lower.includes("policy") || lower.includes("blocked") || lower.includes("refused"))) {
    return "content_filter";
  }
  if (lower.includes("500") || lower.includes("502") || lower.includes("503") || lower.includes("504") || lower.includes("server")) {
    return "server";
  }
  return "unknown";
}

export function getCooldownDuration(errorType: ErrorType, cascadeDepth: number): number {
  const base = errorType === "rate_limit" ? 60_000 : 30_000;
  return base * Math.pow(2, cascadeDepth); // exponential backoff
}
