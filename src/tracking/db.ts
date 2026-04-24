import Database from "better-sqlite3";
import { mkdirSync, existsSync } from "fs";
import { dirname } from "path";

let db: Database.Database | null = null;

export function getDb(dbPath: string): Database.Database {
  if (db) return db;

  const dir = dirname(dbPath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  migrate(db);
  return db;
}

function migrate(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS call_log (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp     TEXT NOT NULL DEFAULT (datetime('now')),
      provider      TEXT NOT NULL,
      model         TEXT NOT NULL,
      task_type     TEXT NOT NULL,
      success       INTEGER NOT NULL,
      error_type    TEXT,
      latency_ms    INTEGER,
      cost_cents    REAL,
      tokens_in     INTEGER,
      tokens_out    INTEGER,
      cascade_depth INTEGER NOT NULL DEFAULT 0,
      quality_rating INTEGER,
      task_hash     TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_call_log_lookup
      ON call_log(provider, model, task_type);

    CREATE INDEX IF NOT EXISTS idx_call_log_time
      ON call_log(timestamp);

    CREATE TABLE IF NOT EXISTS model_stats (
      provider        TEXT NOT NULL,
      model           TEXT NOT NULL,
      task_type       TEXT NOT NULL,
      total_calls     INTEGER NOT NULL DEFAULT 0,
      success_count   INTEGER NOT NULL DEFAULT 0,
      success_rate    REAL NOT NULL DEFAULT 0,
      avg_latency_ms  REAL,
      avg_cost_cents  REAL,
      total_cost_cents REAL NOT NULL DEFAULT 0,
      avg_quality     REAL,
      last_failure    TEXT,
      last_success    TEXT,
      updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (provider, model, task_type)
    );

    CREATE TABLE IF NOT EXISTS cooldowns (
      provider    TEXT NOT NULL,
      model       TEXT NOT NULL,
      until       TEXT NOT NULL,
      reason      TEXT,
      PRIMARY KEY (provider, model)
    );

    CREATE TABLE IF NOT EXISTS cost_budget (
      period      TEXT NOT NULL,
      period_key  TEXT NOT NULL,
      spent_cents REAL NOT NULL DEFAULT 0,
      limit_cents REAL,
      PRIMARY KEY (period, period_key)
    );
  `);
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}
