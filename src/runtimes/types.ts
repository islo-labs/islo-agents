export type Harness = "claude" | "codex";

export type SharedReasoningEffort = "low" | "medium" | "high" | "xhigh";
export type ClaudeReasoningEffort = SharedReasoningEffort | "max";
export type CodexReasoningEffort = "minimal" | SharedReasoningEffort;
export type ReasoningEffort = ClaudeReasoningEffort | CodexReasoningEffort;

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
  describeControls(): string;
  run(request: RunRequest): Promise<void>;
}

export interface ClaudeRuntimeOpts {
  harness: "claude";
  model: string;
  maxTurns: number;
  maxBudgetUsd: number;
  reasoningEffort?: ClaudeReasoningEffort;
}

export type CodexBudget =
  | { kind: "approximate_usd"; maxUsd: number }
  | { kind: "rollout_tokens"; tokens: number };

export interface CodexRuntimeOpts {
  harness: "codex";
  model: string;
  budget: CodexBudget;
  reasoningEffort?: CodexReasoningEffort;
}

export type RuntimeOpts = ClaudeRuntimeOpts | CodexRuntimeOpts;
