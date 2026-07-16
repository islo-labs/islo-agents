import { Codex, type ThreadOptions } from "@openai/codex-sdk";

import type { CodexRuntimeRequest } from "./types.js";

type CodexOptions = NonNullable<ConstructorParameters<typeof Codex>[0]>;
type CodexConfig = NonNullable<CodexOptions["config"]>;

interface CodexEventInspection {
  progress: boolean;
  sessionId?: string;
  error?: Error;
}

export function buildCodexConfig(rolloutBudgetTokens?: number): CodexConfig {
  if (rolloutBudgetTokens === undefined) {
    return {};
  }

  return {
    features: {
      rollout_budget: {
        enabled: true,
        limit_tokens: rolloutBudgetTokens,
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

export async function runCodex(request: CodexRuntimeRequest): Promise<void> {
  const codex = new Codex({
    config: buildCodexConfig(request.rolloutBudgetTokens),
  });
  const threadOptions: ThreadOptions = {
    model: request.model,
    workingDirectory: request.cwd,
    skipGitRepoCheck: true,
    sandboxMode: "danger-full-access",
    approvalPolicy: "never",
    ...(request.reasoningEffort
      ? { modelReasoningEffort: request.reasoningEffort }
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
