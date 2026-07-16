import { ClaudeRuntime } from "./claude.js";
import { CodexRuntime } from "./codex.js";
import type { AgentRuntime, RuntimeOpts } from "./types.js";

export type { AgentRuntime } from "./types.js";

export function createRuntime(opts: RuntimeOpts): AgentRuntime {
  if (opts.harness === "claude") {
    return new ClaudeRuntime(opts.model, opts.maxTurns, opts.maxBudget);
  }
  return new CodexRuntime(
    opts.model,
    opts.rolloutBudgetTokens,
    opts.reasoningEffort,
  );
}
