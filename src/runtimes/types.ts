export type Harness = "claude" | "codex";

export type ReasoningEffort = "minimal" | "low" | "medium" | "high" | "xhigh";

export interface RuntimeCallbacks {
  onProgress(): void;
  onSessionId(sessionId: string): void;
}

interface RuntimeRequestBase {
  prompt: string;
  cwd: string;
  model: string;
  resumeSessionId?: string;
  callbacks: RuntimeCallbacks;
}

export interface ClaudeRuntimeRequest extends RuntimeRequestBase {
  harness: "claude";
  maxTurns: number;
  maxBudgetUsd?: number;
}

export interface CodexRuntimeRequest extends RuntimeRequestBase {
  harness: "codex";
  rolloutBudgetTokens?: number;
  reasoningEffort?: ReasoningEffort;
}

export type RuntimeRequest = ClaudeRuntimeRequest | CodexRuntimeRequest;
