import { query } from "@anthropic-ai/claude-agent-sdk";

import type { AgentRuntime, ClaudeRuntimeOpts, RunRequest } from "./types.js";

interface ClaudeMessageInspection {
  progress: boolean;
  sessionId?: string;
}

export function inspectClaudeMessage(
  message: unknown,
): ClaudeMessageInspection {
  if (typeof message !== "object" || message === null || !("type" in message)) {
    return { progress: false };
  }

  const type = message.type;
  const sessionId =
    "session_id" in message && typeof message.session_id === "string"
      ? message.session_id
      : undefined;

  if (
    type === "system" &&
    "subtype" in message &&
    message.subtype === "init"
  ) {
    return { progress: false, ...(sessionId ? { sessionId } : {}) };
  }

  if (type === "result") {
    return { progress: false, ...(sessionId ? { sessionId } : {}) };
  }

  return { progress: type === "assistant" };
}

export class ClaudeRuntime implements AgentRuntime {
  readonly harness = "claude" as const;

  constructor(private readonly opts: ClaudeRuntimeOpts) {}

  describeControls(): string {
    return [
      `maxTurns=${this.opts.maxTurns}`,
      `maxBudgetUsd=${this.opts.maxBudgetUsd}`,
      ...(this.opts.reasoningEffort
        ? [`effort=${this.opts.reasoningEffort}`]
        : []),
    ].join(", ");
  }

  async run(request: RunRequest): Promise<void> {
    for await (const message of query({
      prompt: request.prompt,
      options: {
        cwd: request.cwd,
        permissionMode: "bypassPermissions",
        allowDangerouslySkipPermissions: true,
        maxTurns: this.opts.maxTurns,
        model: this.opts.model,
        maxBudgetUsd: this.opts.maxBudgetUsd,
        ...(this.opts.reasoningEffort
          ? { effort: this.opts.reasoningEffort }
          : {}),
        ...(request.resumeSessionId
          ? { resume: request.resumeSessionId }
          : {}),
      },
    })) {
      const inspection = inspectClaudeMessage(message);
      if (inspection.sessionId) {
        request.callbacks.onSessionId(inspection.sessionId);
      }
      if (inspection.progress) {
        request.callbacks.onProgress();
      }
    }
  }
}
