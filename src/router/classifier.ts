import type { TaskType } from "../config/types.js";

const PATTERNS: Array<[TaskType, RegExp]> = [
  ["image_gen", /\b(generate image|create image|draw|illustration|picture of|photo of|make.*image|design.*logo)\b/i],
  ["coding", /\b(code|function|implement|debug|refactor|typescript|python|javascript|rust|bug|fix|class|api|endpoint|compile|syntax|algorithm|regex|script|program|html|css|sql|git)\b/i],
  ["math_reasoning", /\b(prove|calculate|equation|integral|derivative|theorem|probability|solve.*math|compute|formula|arithmetic|algebra|calculus|statistics)\b/i],
  ["translation", /\b(translate|translation|in spanish|in french|in chinese|in german|in japanese|to english|auf deutsch|en fran[cç]ais)\b/i],
  ["data_extraction", /\b(extract|parse|structured|json from|csv|table from|scrape|pull.*data|convert.*to.*json|normalize)\b/i],
  ["summarization", /\b(summarize|summary|tldr|brief|condense|key points|shorten|digest|overview of)\b/i],
  ["research", /\b(research|find out|search|look up|what is|who is|latest|news|current|trending|tell me about|explain.*history)\b/i],
  ["creative_writing", /\b(write a story|poem|essay|creative|narrative|fiction|blog post|article|copywriting|tagline|slogan|screenplay)\b/i],
  ["analysis", /\b(analyze|analysis|compare|evaluate|assess|review|critique|examine|investigate|pros and cons|trade.?offs)\b/i],
];

export function classifyTask(task: string): TaskType {
  for (const [type, pattern] of PATTERNS) {
    if (pattern.test(task)) return type;
  }
  return "analysis"; // default fallback
}
