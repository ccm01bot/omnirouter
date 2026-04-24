import { config } from "dotenv";
import { resolve, dirname } from "path";
import { existsSync } from "fs";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, "../..");

export interface OmniRouterConfig {
  keys: {
    anthropic?: string;
    openai?: string;
    gemini?: string;
    perplexity?: string;
    moonshot?: string;
    zai?: string;
  };
  budget: {
    dailyLimitCents?: number;
    monthlyLimitCents?: number;
  };
  dbPath: string;
}

export function loadConfig(): OmniRouterConfig {
  // Load .env from project root
  const envPath = resolve(PROJECT_ROOT, ".env");
  if (existsSync(envPath)) {
    config({ path: envPath });
  } else {
    config(); // try default locations
  }

  return {
    keys: {
      anthropic: process.env.ANTHROPIC_API_KEY || undefined,
      openai: process.env.OPENAI_API_KEY || undefined,
      gemini: process.env.GEMINI_API_KEY || undefined,
      perplexity: process.env.PERPLEXITY_API_KEY || undefined,
      moonshot: process.env.MOONSHOT_API_KEY || undefined,
      zai: process.env.ZAI_API_KEY || undefined,
    },
    budget: {
      dailyLimitCents: process.env.OMNIROUTER_DAILY_BUDGET
        ? parseInt(process.env.OMNIROUTER_DAILY_BUDGET)
        : undefined,
      monthlyLimitCents: process.env.OMNIROUTER_MONTHLY_BUDGET
        ? parseInt(process.env.OMNIROUTER_MONTHLY_BUDGET)
        : undefined,
    },
    dbPath: resolve(PROJECT_ROOT, "data", "omnirouter.db"),
  };
}
