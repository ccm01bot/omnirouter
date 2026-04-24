---
name: route
description: Route a task to the best AI model. Use when the user wants to compare AI models, get the best response for a specific task type (coding, research, writing, analysis, image gen, translation, summarization, data extraction, math), or wants intelligent model selection with automatic fallback. Trigger on "/route" or when the user says "use the best AI for this" or "which AI should I use".
---

# OmniRouter — Intelligent AI Model Router

Routes tasks to the optimal AI model based on task type, performance history, cost, and latency. Learns from every call and gets smarter over time.

## Usage

Run via CLI from the omnirouter directory:

```bash
cd ~/omnirouter && npx tsx bin/omnirouter.ts route "<task>" [--type <type>] [--max-cost <cents>] [--prefer <provider>] [--json]
```

### Task Types
`coding`, `research`, `creative_writing`, `analysis`, `image_gen`, `translation`, `summarization`, `data_extraction`, `math_reasoning`

If `--type` is omitted, OmniRouter auto-detects the task type from the prompt.

### Examples
```bash
# Best model for coding
npx tsx bin/omnirouter.ts route "Implement a binary search in Rust" --type coding

# Best model for research (routes to Perplexity)
npx tsx bin/omnirouter.ts route "What are the latest developments in quantum computing?"

# Budget-constrained
npx tsx bin/omnirouter.ts route "Summarize this article" --max-cost 1

# View stats
npx tsx bin/omnirouter.ts stats
npx tsx bin/omnirouter.ts providers
npx tsx bin/omnirouter.ts cost
```

### How It Works
1. Classifies the task type (auto or explicit)
2. Scores all available models using learned performance data + static affinities
3. Calls the top-ranked model
4. On failure, cascades to the next best model (up to 3 attempts)
5. Records outcome to improve future routing

### Providers
Anthropic (Claude), OpenAI (GPT-4o, DALL-E), Google (Gemini), Perplexity (Sonar), Moonshot (Kimi), Z.AI (GLM). Configure via `.env` file.
