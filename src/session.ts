import {
  mkdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";

import type {
  ClaudeReasoningEffort,
  ClaudeRuntimeOpts,
  CodexBudget,
  CodexReasoningEffort,
  CodexRuntimeOpts,
  RuntimeOpts,
} from "./runtimes/types.js";

const SESSION_VERSION = 2;
const SESSION_DIRECTORY = "/workspace/.islo-agents/sessions";

export interface SessionRecord {
  sessionKey: string;
  sessionId: string;
  cwd: string;
  runtime: RuntimeOpts;
}

export type SessionLoadResult =
  | { status: "missing" }
  | { status: "invalid"; reason: string }
  | { status: "loaded"; session: SessionRecord };

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPositiveNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function isPositiveInteger(value: unknown): value is number {
  return isPositiveNumber(value) && Number.isInteger(value);
}

function isClaudeEffort(value: unknown): value is ClaudeReasoningEffort {
  return (
    value === "low" ||
    value === "medium" ||
    value === "high" ||
    value === "xhigh" ||
    value === "max"
  );
}

function isCodexEffort(value: unknown): value is CodexReasoningEffort {
  return (
    value === "minimal" ||
    value === "low" ||
    value === "medium" ||
    value === "high" ||
    value === "xhigh"
  );
}

function parseClaudeRuntime(value: JsonRecord): ClaudeRuntimeOpts | undefined {
  if (
    typeof value.model !== "string" ||
    value.model.length === 0 ||
    !isPositiveInteger(value.max_turns) ||
    !isPositiveNumber(value.max_budget_usd) ||
    (value.reasoning_effort !== undefined &&
      !isClaudeEffort(value.reasoning_effort))
  ) {
    return undefined;
  }

  return {
    harness: "claude",
    model: value.model,
    maxTurns: value.max_turns,
    maxBudgetUsd: value.max_budget_usd,
    ...(value.reasoning_effort
      ? { reasoningEffort: value.reasoning_effort }
      : {}),
  };
}

function parseCodexBudget(value: unknown): CodexBudget | undefined {
  if (!isRecord(value)) return undefined;
  if (value.kind === "approximate_usd" && isPositiveNumber(value.max_usd)) {
    return { kind: "approximate_usd", maxUsd: value.max_usd };
  }
  if (value.kind === "rollout_tokens" && isPositiveInteger(value.tokens)) {
    return { kind: "rollout_tokens", tokens: value.tokens };
  }
  return undefined;
}

function parseCodexRuntime(value: JsonRecord): CodexRuntimeOpts | undefined {
  const budget = parseCodexBudget(value.budget);
  if (
    typeof value.model !== "string" ||
    value.model.length === 0 ||
    budget === undefined ||
    (value.reasoning_effort !== undefined &&
      !isCodexEffort(value.reasoning_effort))
  ) {
    return undefined;
  }

  return {
    harness: "codex",
    model: value.model,
    budget,
    ...(value.reasoning_effort
      ? { reasoningEffort: value.reasoning_effort }
      : {}),
  };
}

function parseRuntime(value: unknown): RuntimeOpts | undefined {
  if (!isRecord(value)) return undefined;
  if (value.harness === "claude") return parseClaudeRuntime(value);
  if (value.harness === "codex") return parseCodexRuntime(value);
  return undefined;
}

function parseSession(value: unknown): SessionRecord | undefined {
  if (!isRecord(value) || value.version !== SESSION_VERSION) return undefined;
  const runtime = parseRuntime(value.runtime);
  if (
    typeof value.session_key !== "string" ||
    value.session_key.length === 0 ||
    typeof value.session_id !== "string" ||
    value.session_id.length === 0 ||
    typeof value.cwd !== "string" ||
    value.cwd.length === 0 ||
    runtime === undefined
  ) {
    return undefined;
  }
  return {
    sessionKey: value.session_key,
    sessionId: value.session_id,
    cwd: value.cwd,
    runtime,
  };
}

function isFileNotFoundError(error: unknown): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    error.code === "ENOENT"
  );
}

export function sessionStatePath(key: string): string {
  const safeKey = key.replace(/[^a-zA-Z0-9_.-]/g, "-");
  return join(SESSION_DIRECTORY, `${safeKey}.session.json`);
}

export function loadSession(path: string): SessionLoadResult {
  let raw: string;
  try {
    raw = readFileSync(path, "utf-8");
  } catch (error: unknown) {
    if (isFileNotFoundError(error)) return { status: "missing" };
    throw error;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { status: "invalid", reason: "invalid JSON" };
  }

  const session = parseSession(parsed);
  return session
    ? { status: "loaded", session }
    : { status: "invalid", reason: "unsupported session schema" };
}

function runtimeJson(runtime: RuntimeOpts): JsonRecord {
  if (runtime.harness === "claude") {
    return {
      harness: runtime.harness,
      model: runtime.model,
      max_turns: runtime.maxTurns,
      max_budget_usd: runtime.maxBudgetUsd,
      ...(runtime.reasoningEffort
        ? { reasoning_effort: runtime.reasoningEffort }
        : {}),
    };
  }

  return {
    harness: runtime.harness,
    model: runtime.model,
    budget:
      runtime.budget.kind === "approximate_usd"
        ? {
            kind: runtime.budget.kind,
            max_usd: runtime.budget.maxUsd,
          }
        : {
            kind: runtime.budget.kind,
            tokens: runtime.budget.tokens,
          },
    ...(runtime.reasoningEffort
      ? { reasoning_effort: runtime.reasoningEffort }
      : {}),
  };
}

export function writeSession(path: string, session: SessionRecord): void {
  mkdirSync(dirname(path), { recursive: true });
  const temporaryPath = `${path}.${process.pid}.${Date.now()}.tmp`;
  try {
    writeFileSync(
      temporaryPath,
      `${JSON.stringify(
        {
          version: SESSION_VERSION,
          session_key: session.sessionKey,
          session_id: session.sessionId,
          cwd: session.cwd,
          runtime: runtimeJson(session.runtime),
          updated_at: new Date().toISOString(),
        },
        null,
        2,
      )}\n`,
    );
    renameSync(temporaryPath, path);
  } finally {
    try {
      unlinkSync(temporaryPath);
    } catch (error: unknown) {
      if (!isFileNotFoundError(error)) throw error;
    }
  }
}
