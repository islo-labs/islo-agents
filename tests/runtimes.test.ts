import assert from "node:assert/strict";
import test from "node:test";

import { inspectClaudeMessage } from "../src/runtimes/claude.js";
import {
  buildCodexConfig,
  inspectCodexEvent,
  usdToTokens,
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
        reminder_at_remaining_tokens: [20000],
      },
    },
  });
  assert.deepEqual(buildCodexConfig(), {});
});

test("Codex rollout reminders stay below small token budgets", () => {
  assert.deepEqual(buildCodexConfig(1), {
    features: {
      rollout_budget: {
        enabled: true,
        limit_tokens: 1,
        reminder_at_remaining_tokens: [],
      },
    },
  });
  assert.deepEqual(buildCodexConfig(2), {
    features: {
      rollout_budget: {
        enabled: true,
        limit_tokens: 2,
        reminder_at_remaining_tokens: [1],
      },
    },
  });
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
    maxBudgetUsd: 10,
  });

  assert.equal(runtime.harness, "claude");
  assert.match(runtime.describeControls(), /maxTurns=50/);
  assert.match(runtime.describeControls(), /maxBudgetUsd=10/);
});

test("createRuntime passes reasoningEffort to ClaudeRuntime", () => {
  const runtime = createRuntime({
    harness: "claude",
    model: "claude-opus-4-6",
    maxTurns: 50,
    maxBudgetUsd: 15,
    reasoningEffort: "high",
  });

  assert.match(runtime.describeControls(), /effort=high/);
});

test("usdToTokens uses model-specific maximum pricing", () => {
  assert.equal(usdToTokens(1, "gpt-5.6-sol"), 22_222);
  assert.equal(usdToTokens(1, "gpt-5.6-terra"), 44_444);
  assert.equal(usdToTokens(1, "gpt-5.6-luna"), 111_111);
  assert.equal(usdToTokens(1, "kimi-k2.7-code"), 250_000);
  assert.throws(
    () => usdToTokens(1, "unknown-model"),
    /No Codex pricing configured/,
  );
});

test("createRuntime converts an approximate Codex USD budget to rollout tokens", () => {
  const runtime = createRuntime({
    harness: "codex",
    model: "kimi-k2.7-code",
    budget: { kind: "approximate_usd", maxUsd: 10 },
    reasoningEffort: "high",
  });

  assert.equal(runtime.harness, "codex");
  assert.match(runtime.describeControls(), /approxMaxBudgetUsd=10/);
  assert.match(runtime.describeControls(), /rolloutBudgetTokens=2500000/);
  assert.match(runtime.describeControls(), /reasoningEffort=high/);
});

test("createRuntime accepts an explicit Codex rollout-token budget", () => {
  const runtime = createRuntime({
    harness: "codex",
    model: "unknown-model",
    budget: { kind: "rollout_tokens", tokens: 500000 },
  });

  assert.match(runtime.describeControls(), /rolloutBudgetTokens=500000/);
});
