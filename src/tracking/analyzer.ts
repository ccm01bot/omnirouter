import type Database from "better-sqlite3";
import type { PerformanceStats } from "../config/types.js";

export class Analyzer {
  constructor(private db: Database.Database) {}

  getStats(provider: string, model: string, taskType: string): PerformanceStats | null {
    const row = this.db.prepare(`
      SELECT provider, model, task_type as taskType,
        total_calls as totalCalls, success_count as successCount,
        success_rate as successRate, avg_latency_ms as avgLatencyMs,
        avg_cost_cents as avgCostCents, total_cost_cents as totalCostCents,
        avg_quality as avgQuality, last_failure as lastFailure, last_success as lastSuccess
      FROM model_stats
      WHERE provider = ? AND model = ? AND task_type = ?
    `).get(provider, model, taskType) as PerformanceStats | undefined;
    return row ?? null;
  }

  getAllStats(taskType?: string): PerformanceStats[] {
    if (taskType) {
      return this.db.prepare(`
        SELECT provider, model, task_type as taskType,
          total_calls as totalCalls, success_count as successCount,
          success_rate as successRate, avg_latency_ms as avgLatencyMs,
          avg_cost_cents as avgCostCents, total_cost_cents as totalCostCents,
          avg_quality as avgQuality, last_failure as lastFailure, last_success as lastSuccess
        FROM model_stats WHERE task_type = ? ORDER BY success_rate DESC
      `).all(taskType) as PerformanceStats[];
    }
    return this.db.prepare(`
      SELECT provider, model, task_type as taskType,
        total_calls as totalCalls, success_count as successCount,
        success_rate as successRate, avg_latency_ms as avgLatencyMs,
        avg_cost_cents as avgCostCents, total_cost_cents as totalCostCents,
        avg_quality as avgQuality, last_failure as lastFailure, last_success as lastSuccess
      FROM model_stats ORDER BY total_calls DESC
    `).all() as PerformanceStats[];
  }

  isInCooldown(provider: string, model: string): boolean {
    const row = this.db.prepare(
      "SELECT 1 FROM cooldowns WHERE provider = ? AND model = ? AND until > datetime('now')"
    ).get(provider, model);
    return !!row;
  }

  addCooldown(provider: string, model: string, durationMs: number, reason: string): void {
    const until = new Date(Date.now() + durationMs).toISOString();
    this.db.prepare(`
      INSERT OR REPLACE INTO cooldowns (provider, model, until, reason)
      VALUES (?, ?, ?, ?)
    `).run(provider, model, until, reason);
  }

  getRemainingBudget(period: "daily" | "monthly"): { spent: number; limit: number | null } {
    const key = period === "daily"
      ? new Date().toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 7);
    const row = this.db.prepare(
      "SELECT spent_cents as spent, limit_cents as limit FROM cost_budget WHERE period = ? AND period_key = ?"
    ).get(period, key) as { spent: number; limit: number | null } | undefined;
    return row ?? { spent: 0, limit: null };
  }

  getCostBreakdown(): Array<{ provider: string; model: string; totalCost: number; calls: number }> {
    return this.db.prepare(`
      SELECT provider, model, SUM(cost_cents) as totalCost, COUNT(*) as calls
      FROM call_log WHERE timestamp > datetime('now', '-30 days')
      GROUP BY provider, model ORDER BY totalCost DESC
    `).all() as Array<{ provider: string; model: string; totalCost: number; calls: number }>;
  }
}
