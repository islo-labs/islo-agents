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

test("buildRuntimeOpts rejects cross-harness controls", () => {
  assert.throws(
    () => buildRuntimeOpts("codex", undefined, { maxTurns: 10 }),
    /requires --harness claude/,
  );
  assert.throws(
    () => buildRuntimeOpts("claude", undefined, { reasoningEffort: "high" }),
    /require --harness codex/,
  );
});

test("buildRuntimeOpts allows --max-budget for both harnesses", () => {
  const claude = buildRuntimeOpts("claude", undefined, { maxBudget: 5 });
  assert.equal(claude.harness === "claude" && claude.maxBudget, 5);

  const codex = buildRuntimeOpts("codex", undefined, { maxBudget: 10 });
  assert.equal(codex.harness === "codex" && codex.maxBudget, 10);
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

test("resolveRuntime defaults to claude when no CLI or session data", () => {
  const args = parseArgs(["--prompt", "p.md"]);
  const result = resolveRuntime(args, undefined);

  assert.equal(result.harness, "claude");
  assert.equal(result.model, undefined);
  assert.equal(result.resumeSessionId, undefined);
});

test("resolveRuntime reads harness/model from session file", () => {
  const args = parseArgs(["--prompt", "p.md"]);
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

test("resolveRuntime CLI overrides session file", () => {
  const args = parseArgs([
    "--prompt", "p.md",
    "--harness", "claude",
    "--model", "claude-sonnet-4",
  ]);
  const stored: SessionData = {
    sessionId: "thread-abc",
    harness: "codex",
    model: "gpt-5.6",
  };

  const result = resolveRuntime(args, stored);

  assert.equal(result.harness, "claude");
  assert.equal(result.model, "claude-sonnet-4");
  assert.equal(result.resumeSessionId, undefined, "harness mismatch discards session");
});

test("resolveRuntime discards session on harness mismatch", () => {
  const args = parseArgs(["--prompt", "p.md", "--harness", "claude"]);
  const stored: SessionData = {
    sessionId: "thread-abc",
    harness: "codex",
    model: "gpt-5.6",
  };

  const result = resolveRuntime(args, stored);

  assert.equal(result.harness, "claude");
  assert.equal(result.resumeSessionId, undefined);
});

test("resolveRuntime preserves session when harness matches", () => {
  const args = parseArgs(["--prompt", "p.md", "--harness", "codex"]);
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
