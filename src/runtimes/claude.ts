import { query } from "@anthropic-ai/claude-agent-sdk";

import type { AgentRuntime, ClaudeRuntimeOpts, RunRequest } from "./types.js";

const ISLO_INFERENCE_BASE_URLS: Readonly<Record<string, string>> = {
  islo_inference: "https://gateway.islo.dev/inference/anthropic",
};

export const CLAUDE_INFERENCE_CATALOG_MODELS: ReadonlySet<string> = new Set([
  "kimi-k2.7-code",
  "kimi-k2.7-code-fast",
  "minimax-m3",
  "qwen3.7-plus",
  "ship-like/claude-opus-5",
]);

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

  private buildEnv(): Record<string, string | undefined> | undefined {
    if (!this.opts.modelProvider) return undefined;
    const baseUrl = ISLO_INFERENCE_BASE_URLS[this.opts.modelProvider];
    if (!baseUrl) {
      throw new Error(
        `Unknown Claude model provider '${this.opts.modelProvider}'. ` +
          `Supported: ${Object.keys(ISLO_INFERENCE_BASE_URLS).join(", ")}`,
      );
    }
    return {
      ...process.env,
      ANTHROPIC_BASE_URL: baseUrl,
    };
  }

  async run(request: RunRequest): Promise<void> {
    const env = this.buildEnv();
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
        ...(env ? { env } : {}),
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
