import { loadConfig } from "./config/loader.js";
import { getDb } from "./tracking/db.js";
import { Recorder } from "./tracking/recorder.js";
import { Analyzer } from "./tracking/analyzer.js";
import { ProviderRegistry } from "./providers/registry.js";
import { OmniRouter } from "./router/core.js";
import type { RouteRequest, RouteResult, PerformanceStats } from "./config/types.js";

export type { RouteRequest, RouteResult, PerformanceStats };

let _router: OmniRouter | null = null;
let _analyzer: Analyzer | null = null;
let _recorder: Recorder | null = null;
let _registry: ProviderRegistry | null = null;

function init() {
  if (_router) return { router: _router, analyzer: _analyzer!, recorder: _recorder!, registry: _registry! };
  const config = loadConfig();
  const db = getDb(config.dbPath);
  _recorder = new Recorder(db);
  _analyzer = new Analyzer(db);
  _registry = new ProviderRegistry();
  _router = new OmniRouter(_registry, _analyzer, _recorder);
  return { router: _router, analyzer: _analyzer, recorder: _recorder, registry: _registry };
}

export async function route(request: RouteRequest): Promise<RouteResult> {
  const { router } = init();
  return router.route(request);
}

export function getStats(taskType?: string): PerformanceStats[] {
  const { analyzer } = init();
  return analyzer.getAllStats(taskType);
}

export function getProviders(): string[] {
  const { registry } = init();
  return registry.getConfiguredProviders();
}

export function addFeedback(callId: number, rating: number): void {
  const { recorder } = init();
  recorder.addFeedback(callId, rating);
}
