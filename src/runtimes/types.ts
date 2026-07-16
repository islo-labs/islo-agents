export type Harness = "claude" | "codex";

export type ReasoningEffort = "minimal" | "low" | "medium" | "high" | "xhigh";

export interface RuntimeCallbacks {
  onProgress(): void;
  onSessionId(sessionId: string): void;
}

export interface RunRequest {
  prompt: string;
  cwd: string;
  resumeSessionId?: string;
  callbacks: RuntimeCallbacks;
}

export interface AgentRuntime {
  readonly harness: Harness;
  readonly sessionSuffix: string;
  describeControls(): string;
  run(request: RunRequest): Promise<void>;
}

export interface ClaudeRuntimeOpts {
  harness: "claude";
  model: string;
  maxTurns: number;
  maxBudget?: number;
}

export interface CodexRuntimeOpts {
  harness: "codex";
  model: string;
  rolloutBudgetTokens?: number;
  reasoningEffort?: ReasoningEffort;
}

export type RuntimeOpts = ClaudeRuntimeOpts | CodexRuntimeOpts;
