import type Database from "better-sqlite3";
import type { CallRecord } from "../config/types.js";

export class Recorder {
  private insertStmt: Database.Statement;
  private refreshStmt: Database.Statement;

  constructor(private db: Database.Database) {
    this.insertStmt = db.prepare(`
      INSERT INTO call_log (provider, model, task_type, success, error_type, latency_ms, cost_cents, tokens_in, tokens_out, cascade_depth, quality_rating, task_hash)
      VALUES (@provider, @model, @taskType, @success, @errorType, @latencyMs, @costCents, @tokensIn, @tokensOut, @cascadeDepth, @qualityRating, @taskHash)
    `);

    this.refreshStmt = db.prepare(`
      INSERT OR REPLACE INTO model_stats (provider, model, task_type, total_calls, success_count, success_rate, avg_latency_ms, avg_cost_cents, total_cost_cents, avg_quality, last_failure, last_success)
      SELECT
        provider, model, task_type,
        COUNT(*) as total_calls,
        SUM(success) as success_count,
        CAST(SUM(success) AS REAL) / COUNT(*) as success_rate,
        AVG(CASE WHEN success = 1 THEN latency_ms END) as avg_latency_ms,
        AVG(cost_cents) as avg_cost_cents,
        SUM(COALESCE(cost_cents, 0)) as total_cost_cents,
        AVG(quality_rating) as avg_quality,
        MAX(CASE WHEN success = 0 THEN timestamp END) as last_failure,
        MAX(CASE WHEN success = 1 THEN timestamp END) as last_success
      FROM call_log
      WHERE provider = @provider AND model = @model AND task_type = @taskType
        AND timestamp > datetime('now', '-30 days')
    `);
  }

  record(rec: CallRecord): number {
    const result = this.insertStmt.run({
      provider: rec.provider,
      model: rec.model,
      taskType: rec.taskType,
      success: rec.success ? 1 : 0,
      errorType: rec.errorType ?? null,
      latencyMs: rec.latencyMs ?? null,
      costCents: rec.costCents ?? null,
      tokensIn: rec.tokensIn ?? null,
      tokensOut: rec.tokensOut ?? null,
      cascadeDepth: rec.cascadeDepth,
      qualityRating: rec.qualityRating ?? null,
      taskHash: rec.taskHash ?? null,
    });

    // Refresh stats for this model/task combo
    this.refreshStmt.run({
      provider: rec.provider,
      model: rec.model,
      taskType: rec.taskType,
    });

    return Number(result.lastInsertRowid);
  }

  addFeedback(callId: number, rating: number): void {
    this.db.prepare("UPDATE call_log SET quality_rating = ? WHERE id = ?").run(rating, callId);
    const row = this.db.prepare("SELECT provider, model, task_type FROM call_log WHERE id = ?").get(callId) as { provider: string; model: string; task_type: string } | undefined;
    if (row) {
      this.refreshStmt.run({ provider: row.provider, model: row.model, taskType: row.task_type });
    }
  }

  trackCost(costCents: number): void {
    const today = new Date().toISOString().slice(0, 10);
    const month = today.slice(0, 7);

    const upsert = this.db.prepare(`
      INSERT INTO cost_budget (period, period_key, spent_cents)
      VALUES (?, ?, ?)
      ON CONFLICT(period, period_key) DO UPDATE SET spent_cents = spent_cents + ?
    `);
    upsert.run("daily", today, costCents, costCents);
    upsert.run("monthly", month, costCents, costCents);
  }
}
