import assert from "node:assert/strict";
import test from "node:test";

import { inspectClaudeMessage } from "../src/runtimes/claude.js";
import {
  buildCodexConfig,
  inspectCodexEvent,
} from "../src/runtimes/codex.js";

test("Claude messages expose progress and resumable session IDs", () => {
  assert.deepEqual(
    inspectClaudeMessage({
      type: "system",
      subtype: "init",
      session_id: "claude-session",
    }),
    { progress: false, sessionId: "claude-session" }
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
    { progress: false, sessionId: "codex-thread" }
  );
  assert.deepEqual(
    inspectCodexEvent({
      type: "item.completed",
      item: { type: "agent_message", text: "done" },
    }),
    { progress: true }
  );

  const failure = inspectCodexEvent({
    type: "turn.failed",
    error: { message: "budget exhausted" },
  });
  assert.equal(failure.progress, false);
  assert.equal(failure.error?.message, "budget exhausted");
});
