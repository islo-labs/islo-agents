import { Codex, type ThreadOptions } from "@openai/codex-sdk";

import type { AgentRuntime, ReasoningEffort, RunRequest } from "./types.js";

type CodexOptions = NonNullable<ConstructorParameters<typeof Codex>[0]>;
type CodexConfig = NonNullable<CodexOptions["config"]>;

interface CodexEventInspection {
  progress: boolean;
  sessionId?: string;
  error?: Error;
}

/**
 * Highest published per-million-token price for each model, including the
 * long-context output surcharge. Using the most expensive token category
 * makes the USD-to-rollout-token conversion conservative regardless of the
 * eventual input/output/cache mix.
 */
export const CODEX_MAX_TOKEN_PRICE_PER_MILLION_USD: Readonly<Record<string, number>> = {
  "gpt-5.6": 45,
  "gpt-5.6-sol": 45,
  "gpt-5.6-terra": 22.5,
  "gpt-5.6-luna": 9,
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
  private readonly effectiveTokens?: number;

  constructor(
    private readonly model: string,
    private readonly maxBudgetUsd?: number,
    rolloutBudgetTokens?: number,
    private readonly reasoningEffort?: ReasoningEffort,
  ) {
    this.effectiveTokens =
      rolloutBudgetTokens ??
      (maxBudgetUsd !== undefined ? usdToTokens(maxBudgetUsd, model) : undefined);
  }

  describeControls(): string {
    return [
      ...(this.maxBudgetUsd !== undefined
        ? [`maxBudgetUsd=${this.maxBudgetUsd}`]
        : []),
      ...(this.effectiveTokens !== undefined
        ? [`rolloutBudgetTokens=${this.effectiveTokens}`]
        : []),
      ...(this.reasoningEffort
        ? [`reasoningEffort=${this.reasoningEffort}`]
        : []),
    ].join(", ");
  }

  async run(request: RunRequest): Promise<void> {
    const codex = new Codex({
      config: buildCodexConfig(this.effectiveTokens),
    });
    const threadOptions: ThreadOptions = {
      model: this.model,
      workingDirectory: request.cwd,
      skipGitRepoCheck: true,
      sandboxMode: "danger-full-access",
      approvalPolicy: "never",
      ...(this.reasoningEffort && this.reasoningEffort !== "max"
        ? { modelReasoningEffort: this.reasoningEffort }
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
