import { Codex, type ThreadOptions } from "@openai/codex-sdk";

import type { AgentRuntime, CodexRuntimeOpts, RunRequest } from "./types.js";

type CodexOptions = NonNullable<ConstructorParameters<typeof Codex>[0]>;
type CodexConfig = NonNullable<CodexOptions["config"]>;

interface CodexEventInspection {
  progress: boolean;
  sessionId?: string;
  error?: Error;
}

/**
 * Highest published per-million-token price for each model, including the
 * long-context output surcharge. This converts a USD input into an approximate
 * rollout limit. Codex 0.144.5 excludes billed cached input from rollout
 * accounting, so this is not a hard spending cap.
 */
export const CODEX_MAX_TOKEN_PRICE_PER_MILLION_USD: Readonly<Record<string, number>> = {
  "gpt-5.6": 45,
  "gpt-5.6-sol": 45,
  "gpt-5.6-terra": 22.5,
  "gpt-5.6-luna": 9,
  "kimi-k2.7-code": 4,
  "kimi-k2.7-code-fast": 8,
  "minimax-m3": 1.2,
  "qwen3.7-plus": 1.6,
};

export function usdToTokens(usd: number, model: string): number {
  const pricePerMillion = CODEX_MAX_TOKEN_PRICE_PER_MILLION_USD[model];
  if (pricePerMillion === undefined) {
    throw new Error(
      `No Codex pricing configured for model '${model}'. ` +
        "Use --rollout-budget-tokens or add the model to the pricing map.",
    );
  }
  return Math.max(1, Math.floor((usd * 1_000_000) / pricePerMillion));
}

export function buildCodexConfig(rolloutBudgetTokens?: number): CodexConfig {
  if (rolloutBudgetTokens === undefined) {
    return {};
  }

  const reminderAtRemainingTokens =
    rolloutBudgetTokens > 1
      ? [
          Math.min(
            Math.max(1, Math.round(rolloutBudgetTokens * 0.1)),
            rolloutBudgetTokens - 1,
          ),
        ]
      : [];

  return {
    features: {
      rollout_budget: {
        enabled: true,
        limit_tokens: rolloutBudgetTokens,
        reminder_at_remaining_tokens: reminderAtRemainingTokens,
      },
    },
  };
}

export function inspectCodexEvent(event: unknown): CodexEventInspection {
  if (typeof event !== "object" || event === null || !("type" in event)) {
    return { progress: false };
  }

  if (
    event.type === "thread.started" &&
    "thread_id" in event &&
    typeof event.thread_id === "string"
  ) {
    return { progress: false, sessionId: event.thread_id };
  }

  if (event.type === "turn.failed" && "error" in event) {
    const message =
      typeof event.error === "object" &&
      event.error !== null &&
      "message" in event.error &&
      typeof event.error.message === "string"
        ? event.error.message
        : "Codex turn failed";
    return { progress: false, error: new Error(message) };
  }

  if (
    event.type === "error" &&
    "message" in event &&
    typeof event.message === "string"
  ) {
    return { progress: false, error: new Error(event.message) };
  }

  const progress =
    event.type === "item.completed" &&
    "item" in event &&
    typeof event.item === "object" &&
    event.item !== null &&
    "type" in event.item &&
    event.item.type === "agent_message";

  return { progress };
}

export class CodexRuntime implements AgentRuntime {
  readonly harness = "codex" as const;
  private readonly effectiveTokens: number;

  constructor(private readonly opts: CodexRuntimeOpts) {
    this.effectiveTokens =
      opts.budget.kind === "rollout_tokens"
        ? opts.budget.tokens
        : usdToTokens(opts.budget.maxUsd, opts.model);
  }

  describeControls(): string {
    return [
      ...(this.opts.budget.kind === "approximate_usd"
        ? [`approxMaxBudgetUsd=${this.opts.budget.maxUsd}`]
        : []),
      `rolloutBudgetTokens=${this.effectiveTokens}`,
      ...(this.opts.reasoningEffort
        ? [`reasoningEffort=${this.opts.reasoningEffort}`]
        : []),
    ].join(", ");
  }

  async run(request: RunRequest): Promise<void> {
    const codex = new Codex({
      config: { model_provider: "islo_inference", ...buildCodexConfig(this.effectiveTokens) },
    });
    const threadOptions: ThreadOptions = {
      model: this.opts.model,
      workingDirectory: request.cwd,
      skipGitRepoCheck: true,
      sandboxMode: "danger-full-access",
      approvalPolicy: "never",
      ...(this.opts.reasoningEffort
        ? { modelReasoningEffort: this.opts.reasoningEffort }
        : {}),
    };
    const thread = request.resumeSessionId
      ? codex.resumeThread(request.resumeSessionId, threadOptions)
      : codex.startThread(threadOptions);

    const { events } = await thread.runStreamed(request.prompt);
    for await (const event of events) {
      const inspection = inspectCodexEvent(event);
      if (inspection.sessionId) {
        request.callbacks.onSessionId(inspection.sessionId);
      }
      if (inspection.progress) {
        request.callbacks.onProgress();
      }
      if (inspection.error) {
        throw inspection.error;
      }
    }

    if (thread.id) {
      request.callbacks.onSessionId(thread.id);
    }
  }
}
