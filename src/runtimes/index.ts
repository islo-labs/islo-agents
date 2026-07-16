import type { EffortLevel } from "@anthropic-ai/claude-agent-sdk";

import { ClaudeRuntime } from "./claude.js";
import { CodexRuntime } from "./codex.js";
import type { AgentRuntime, RuntimeOpts } from "./types.js";

export type { AgentRuntime } from "./types.js";

export function createRuntime(opts: RuntimeOpts): AgentRuntime {
  if (opts.harness === "claude") {
    const effort = opts.reasoningEffort !== "minimal"
      ? opts.reasoningEffort as EffortLevel | undefined
      : undefined;
    return new ClaudeRuntime(opts.model, opts.maxTurns, opts.maxBudget, effort);
  }
  return new CodexRuntime(
    opts.model,
    opts.maxBudget,
    opts.rolloutBudgetTokens,
    opts.reasoningEffort,
  );
}
