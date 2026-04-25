#!/usr/bin/env npx tsx
import { Command } from "commander";
import { loadConfig } from "../src/config/loader.js";
import { getDb, closeDb } from "../src/tracking/db.js";
import { Recorder } from "../src/tracking/recorder.js";
import { Analyzer } from "../src/tracking/analyzer.js";
import { ProviderRegistry } from "../src/providers/registry.js";
import { OmniRouter } from "../src/router/core.js";
import { MODEL_PROFILES } from "../src/config/defaults.js";
import { TASK_TYPES, type TaskType } from "../src/config/types.js";

const program = new Command();

program
  .name("omnirouter")
  .description("Dynamic AI model router — always picks the best tool for the job")
  .version("0.1.0");

program
  .command("route")
  .description("Route a task to the best AI model")
  .argument("<task>", "The task or prompt to route")
  .option("-t, --type <type>", `Task type: ${TASK_TYPES.join(", ")}`)
  .option("-c, --max-cost <cents>", "Maximum cost in cents")
  .option("-p, --prefer <provider>", "Preferred provider")
  .option("-x, --exclude <providers>", "Exclude providers (comma-separated)")
  .option("-j, --json", "Output as JSON")
  .action(async (task: string, opts) => {
    try {
      const config = loadConfig();
      const db = getDb(config.dbPath);
      const registry = new ProviderRegistry();
      const analyzer = new Analyzer(db);
      const recorder = new Recorder(db);
      const router = new OmniRouter(registry, analyzer, recorder);

      const result = await router.route({
        task,
        taskType: opts.type as TaskType | undefined,
        constraints: {
          maxCostCents: opts.maxCost ? parseFloat(opts.maxCost) : undefined,
          preferProvider: opts.prefer,
          excludeProviders: opts.exclude?.split(","),
        },
      });

      if (opts.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(`\n┌─ ${result.provider}/${result.model}`);
        console.log(`├─ ${result.routingReason}`);
        console.log(`├─ ${result.latencyMs}ms | $${(result.costCents / 100).toFixed(4)} | ${result.tokensUsed.input}→${result.tokensUsed.output} tokens`);
        console.log(`├─ Call ID: ${result.callId} (use 'omnirouter feedback ${result.callId} <1-5>' to rate)`);
        console.log(`└─────────────────────────────\n`);
        console.log(result.response);
      }

      closeDb();
    } catch (err) {
      console.error(`Error: ${err instanceof Error ? err.message : err}`);
      process.exit(1);
    }
  });

program
  .command("providers")
  .description("List configured providers and their models")
  .action(() => {
    const config = loadConfig();
    const registry = new ProviderRegistry();
    const configured = registry.getConfiguredProviders();

    console.log("\nConfigured providers:\n");
    for (const name of configured) {
      const models = MODEL_PROFILES.filter((m) => m.provider === name);
      console.log(`  ● ${name}`);
      for (const m of models) {
        const cost = `$${m.costPer1kInput}/$${m.costPer1kOutput} per 1k tokens`;
        console.log(`    └─ ${m.model} (${m.tier}) | ${(m.contextWindow / 1000).toFixed(0)}K ctx | ${cost}`);
      }
    }

    const unconfigured = ["anthropic", "openai", "gemini", "grok", "deepseek", "mistral", "perplexity", "groq", "together", "cohere", "moonshot", "zai"].filter(
      (p) => !configured.includes(p)
    );
    if (unconfigured.length) {
      console.log(`\n  ○ Not configured: ${unconfigured.join(", ")}`);
      console.log("    Add API keys to .env to enable these providers.");
    }
    console.log();
  });

program
  .command("stats")
  .description("Show performance statistics")
  .option("-t, --task-type <type>", "Filter by task type")
  .option("-p, --provider <provider>", "Filter by provider")
  .action((opts) => {
    const config = loadConfig();
    const db = getDb(config.dbPath);
    const analyzer = new Analyzer(db);
    let stats = analyzer.getAllStats(opts.taskType);

    if (opts.provider) {
      stats = stats.filter((s) => s.provider === opts.provider);
    }

    if (stats.length === 0) {
      console.log("\nNo performance data yet. Run some tasks first!\n");
      closeDb();
      return;
    }

    console.log("\nPerformance Stats (last 30 days):\n");
    console.log(
      "Provider/Model".padEnd(35) +
        "Task Type".padEnd(18) +
        "Calls".padEnd(8) +
        "Success".padEnd(10) +
        "Avg ms".padEnd(10) +
        "Avg Cost".padEnd(10) +
        "Quality"
    );
    console.log("─".repeat(98));

    for (const s of stats) {
      console.log(
        `${s.provider}/${s.model}`.padEnd(35) +
          s.taskType.padEnd(18) +
          String(s.totalCalls).padEnd(8) +
          `${(s.successRate * 100).toFixed(0)}%`.padEnd(10) +
          `${s.avgLatencyMs?.toFixed(0) ?? "—"}`.padEnd(10) +
          `$${((s.avgCostCents ?? 0) / 100).toFixed(4)}`.padEnd(10) +
          (s.avgQuality ? `${s.avgQuality.toFixed(1)}/5` : "—")
      );
    }
    console.log();
    closeDb();
  });

program
  .command("feedback")
  .description("Rate a past response (1-5)")
  .argument("<call-id>", "Call ID from a previous route")
  .argument("<rating>", "Quality rating (1-5)")
  .action((callId: string, rating: string) => {
    const r = parseInt(rating);
    if (r < 1 || r > 5) {
      console.error("Rating must be between 1 and 5");
      process.exit(1);
    }
    const config = loadConfig();
    const db = getDb(config.dbPath);
    const recorder = new Recorder(db);
    recorder.addFeedback(parseInt(callId), r);
    console.log(`Recorded rating ${r}/5 for call #${callId}`);
    closeDb();
  });

program
  .command("cost")
  .description("Show cost breakdown")
  .option("-p, --period <period>", "Period: daily or monthly", "daily")
  .action((opts) => {
    const config = loadConfig();
    const db = getDb(config.dbPath);
    const analyzer = new Analyzer(db);

    const budget = analyzer.getRemainingBudget(opts.period);
    const breakdown = analyzer.getCostBreakdown();

    console.log(`\nCost (${opts.period}): $${(budget.spent / 100).toFixed(4)}`);
    if (budget.limit) {
      console.log(`Budget: $${(budget.limit / 100).toFixed(2)} | Remaining: $${((budget.limit - budget.spent) / 100).toFixed(2)}`);
    }

    if (breakdown.length) {
      console.log("\nBreakdown (last 30 days):\n");
      for (const b of breakdown) {
        console.log(`  ${b.provider}/${b.model}: $${(b.totalCost / 100).toFixed(4)} (${b.calls} calls)`);
      }
    }
    console.log();
    closeDb();
  });

program.parse();
