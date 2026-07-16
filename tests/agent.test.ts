import assert from "node:assert/strict";
import test from "node:test";

import {
  parseArgs,
  buildRuntimeOpts,
  sessionStatePath,
  readSession,
  resolveRuntime,
  type SessionData,
} from "../src/agent.js";

// ── parseArgs ───────────────────────────────────────────────────────

test("parseArgs returns undefined harness/model when not passed", () => {
  const args = parseArgs(["--prompt", "agents/review/prompt.md"]);

  assert.equal(args.harness, undefined);
  assert.equal(args.model, undefined);
  assert.equal(args.resume, false);
});

test("parseArgs returns explicit harness and model", () => {
  const args = parseArgs([
    "--prompt", "p.md",
    "--harness", "codex",
    "--model", "gpt-5.6",
  ]);

  assert.equal(args.harness, "codex");
  assert.equal(args.model, "gpt-5.6");
});

test("parseArgs captures harness-specific controls as raw values", () => {
  const args = parseArgs([
    "--prompt", "p.md",
    "--harness", "codex",
    "--max-budget", "10",
    "--reasoning-effort", "high",
  ]);

  assert.equal(args.maxBudget, 10);
  assert.equal(args.reasoningEffort, "high");
  assert.equal(args.maxTurns, undefined);
});

test("parseArgs captures Claude controls", () => {
  const args = parseArgs([
    "--prompt", "p.md",
    "--harness", "claude",
    "--max-turns", "25",
    "--max-budget", "5",
  ]);

  assert.equal(args.maxTurns, 25);
  assert.equal(args.maxBudget, 5);
});

test("parseArgs rejects invalid harness", () => {
  assert.throws(
    () => parseArgs(["--prompt", "p.md", "--harness", "invalid"]),
    /Unsupported harness/,
  );
});

test("parseArgs captures positional text as promptText", () => {
  const args = parseArgs([
    "--prompt", "p.md",
    "Continue your work",
  ]);

  assert.equal(args.prompt, "p.md");
  assert.equal(args.promptText, "Continue your work");
});

test("parseArgs accepts positional text without --prompt", () => {
  const args = parseArgs(["Review the latest changes"]);

  assert.equal(args.prompt, undefined);
  assert.equal(args.promptText, "Review the latest changes");
});

test("parseArgs captures --resume as boolean", () => {
  const args = parseArgs([
    "--resume", "--session-key", "test-key",
    "Continue.",
  ]);

  assert.equal(args.resume, true);
  assert.equal(args.sessionKey, "test-key");
  assert.equal(args.promptText, "Continue.");
});

test("parseArgs errors when neither --prompt nor positional given", () => {
  assert.throws(
    () => parseArgs(["--harness", "claude"]),
    /Usage:/,
  );
});

test("parseArgs errors when --resume without --session-key", () => {
  assert.throws(
    () => parseArgs(["--resume", "Continue."]),
    /--resume requires --session-key/,
  );
});

test("parseArgs errors when --resume without positional text", () => {
  assert.throws(
    () => parseArgs(["--resume", "--session-key", "test-key"]),
    /--resume requires a positional prompt/,
  );
});

// ── buildRuntimeOpts ────────────────────────────────────────────────

test("buildRuntimeOpts fills Claude defaults", () => {
  const opts = buildRuntimeOpts("claude", undefined, {});

  assert.equal(opts.harness, "claude");
  assert.equal(opts.model, "claude-opus-4-6");
  assert.equal(opts.harness === "claude" && opts.maxTurns, 50);
});

test("buildRuntimeOpts fills Codex defaults", () => {
  const opts = buildRuntimeOpts("codex", undefined, {});

  assert.equal(opts.harness, "codex");
  assert.equal(opts.model, "gpt-5.6");
});

test("buildRuntimeOpts defaults maxBudget to 15", () => {
  const claude = buildRuntimeOpts("claude", undefined, {});
  assert.equal(claude.maxBudget, 15);

  const codex = buildRuntimeOpts("codex", undefined, {});
  assert.equal(codex.maxBudget, 15);
});

test("buildRuntimeOpts explicit --max-budget overrides default", () => {
  const claude = buildRuntimeOpts("claude", undefined, { maxBudget: 5 });
  assert.equal(claude.maxBudget, 5);

  const codex = buildRuntimeOpts("codex", undefined, { maxBudget: 25 });
  assert.equal(codex.maxBudget, 25);
});

test("buildRuntimeOpts rejects cross-harness controls", () => {
  assert.throws(
    () => buildRuntimeOpts("codex", undefined, { maxTurns: 10 }),
    /requires --harness claude/,
  );
  assert.throws(
    () => buildRuntimeOpts("claude", undefined, { rolloutBudgetTokens: 100000 }),
    /requires --harness codex/,
  );
});

test("buildRuntimeOpts accepts reasoningEffort for Claude", () => {
  const opts = buildRuntimeOpts("claude", undefined, { reasoningEffort: "high" });
  assert.equal(opts.harness, "claude");
  assert.equal(opts.harness === "claude" && opts.reasoningEffort, "high");
});

test("parseArgs accepts max reasoning effort level", () => {
  const args = parseArgs([
    "--prompt", "p.md",
    "--reasoning-effort", "max",
  ]);
  assert.equal(args.reasoningEffort, "max");
});

// ── sessionStatePath ────────────────────────────────────────────────

test("sessionStatePath uses unified .session.json suffix", () => {
  assert.equal(
    sessionStatePath("owner/repo-42"),
    "/workspace/.islo-agents/sessions/owner-repo-42.session.json",
  );
  assert.equal(
    sessionStatePath("review-myrepo-7"),
    "/workspace/.islo-agents/sessions/review-myrepo-7.session.json",
  );
});

// ── resolveRuntime ──────────────────────────────────────────────────

test("resolveRuntime defaults to claude when no session data", () => {
  const args = parseArgs(["--prompt", "p.md"]);
  const result = resolveRuntime(args, undefined);

  assert.equal(result.harness, "claude");
  assert.equal(result.model, undefined);
  assert.equal(result.resumeSessionId, undefined);
});

test("resolveRuntime reads harness/model from session file", () => {
  const args = parseArgs(["--resume", "--session-key", "k", "Continue."]);
  const stored: SessionData = {
    sessionId: "thread-abc",
    harness: "codex",
    model: "gpt-5.6",
  };

  const result = resolveRuntime(args, stored);

  assert.equal(result.harness, "codex");
  assert.equal(result.model, "gpt-5.6");
  assert.equal(result.resumeSessionId, "thread-abc");
});

test("resolveRuntime CLI model overrides stored model", () => {
  const args = parseArgs([
    "--resume", "--session-key", "k",
    "--model", "gpt-5.6-sol",
    "Continue.",
  ]);
  const stored: SessionData = {
    sessionId: "thread-abc",
    harness: "codex",
    model: "gpt-5.6",
  };

  const result = resolveRuntime(args, stored);

  assert.equal(result.harness, "codex");
  assert.equal(result.model, "gpt-5.6-sol");
  assert.equal(result.resumeSessionId, "thread-abc");
});

test("resolveRuntime preserves session when harness matches", () => {
  const args = parseArgs([
    "--resume", "--session-key", "k", "--harness", "codex",
    "Continue.",
  ]);
  const stored: SessionData = {
    sessionId: "thread-abc",
    harness: "codex",
    model: "gpt-5.6",
  };

  const result = resolveRuntime(args, stored);

  assert.equal(result.harness, "codex");
  assert.equal(result.model, "gpt-5.6");
  assert.equal(result.resumeSessionId, "thread-abc");
});

test("resolveRuntime treats empty stored model as undefined", () => {
  const args = parseArgs(["--prompt", "p.md"]);
  const stored: SessionData = {
    sessionId: "thread-abc",
    harness: "claude",
    model: undefined,
  };

  const result = resolveRuntime(args, stored);
  assert.equal(result.model, undefined, "empty model should fall through to undefined");
});
