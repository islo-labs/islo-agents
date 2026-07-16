import assert from "node:assert/strict";
import test from "node:test";

import { inspectClaudeMessage } from "../src/runtimes/claude.js";
import {
  buildCodexConfig,
  inspectCodexEvent,
  usdToTokens,
  CODEX_TOKENS_PER_USD,
} from "../src/runtimes/codex.js";
import { createRuntime } from "../src/runtimes/index.js";

test("Claude messages expose progress and resumable session IDs", () => {
  assert.deepEqual(
    inspectClaudeMessage({
      type: "system",
      subtype: "init",
      session_id: "claude-session",
    }),
    { progress: false, sessionId: "claude-session" },
  );
  assert.deepEqual(inspectClaudeMessage({ type: "assistant" }), {
    progress: true,
  });
});

test("Codex rollout budget maps to CLI configuration", () => {
  assert.deepEqual(buildCodexConfig(200000), {
    features: {
      rollout_budget: {
        enabled: true,
        limit_tokens: 200000,
      },
    },
  });
  assert.deepEqual(buildCodexConfig(), {});
});

test("Codex events expose thread IDs, progress, and failures", () => {
  assert.deepEqual(
    inspectCodexEvent({
      type: "thread.started",
      thread_id: "codex-thread",
    }),
    { progress: false, sessionId: "codex-thread" },
  );
  assert.deepEqual(
    inspectCodexEvent({
      type: "item.completed",
      item: { type: "agent_message", text: "done" },
    }),
    { progress: true },
  );

  const failure = inspectCodexEvent({
    type: "turn.failed",
    error: { message: "budget exhausted" },
  });
  assert.equal(failure.progress, false);
  assert.equal(failure.error?.message, "budget exhausted");
});

test("createRuntime returns ClaudeRuntime for claude opts", () => {
  const runtime = createRuntime({
    harness: "claude",
    model: "claude-opus-4-6",
    maxTurns: 50,
    maxBudget: 10,
  });

  assert.equal(runtime.harness, "claude");
  assert.equal(runtime.sessionSuffix, ".json");
  assert.match(runtime.describeControls(), /maxTurns=50/);
  assert.match(runtime.describeControls(), /maxBudgetUsd=10/);
});

test("usdToTokens converts using the constant rate", () => {
  assert.equal(usdToTokens(10), 10 * CODEX_TOKENS_PER_USD);
  assert.equal(usdToTokens(1), CODEX_TOKENS_PER_USD);
});

test("createRuntime converts Codex maxBudget to rollout tokens", () => {
  const runtime = createRuntime({
    harness: "codex",
    model: "gpt-5.6",
    maxBudget: 10,
    reasoningEffort: "high",
  });

  assert.equal(runtime.harness, "codex");
  assert.equal(runtime.sessionSuffix, ".codex.json");
  assert.match(runtime.describeControls(), /maxBudgetUsd=10/);
  assert.match(runtime.describeControls(), /rolloutBudgetTokens=200000/);
  assert.match(runtime.describeControls(), /reasoningEffort=high/);
});

test("createRuntime lets rolloutBudgetTokens override maxBudget", () => {
  const runtime = createRuntime({
    harness: "codex",
    model: "gpt-5.6",
    maxBudget: 10,
    rolloutBudgetTokens: 500000,
  });

  assert.match(runtime.describeControls(), /rolloutBudgetTokens=500000/);
});
