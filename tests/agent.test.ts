import assert from "node:assert/strict";
import test from "node:test";

import { parseArgs, sessionStatePath } from "../src/agent.js";

test("parseArgs preserves Claude defaults", () => {
  const args = parseArgs(["--prompt", "agents/review/prompt.md"]);

  assert.equal(args.harness, "claude");
  assert.equal(args.model, "claude-opus-4-6");
  assert.equal(args.maxTurns, 50);
});

test("parseArgs accepts Codex-specific controls", () => {
  const args = parseArgs([
    "--prompt",
    "agents/review/prompt.md",
    "--harness",
    "codex",
    "--model",
    "gpt-5.6",
    "--rollout-budget-tokens",
    "200000",
    "--reasoning-effort",
    "high",
  ]);

  assert.equal(args.harness, "codex");
  assert.equal(args.model, "gpt-5.6");
  assert.equal(args.rolloutBudgetTokens, 200000);
  assert.equal(args.reasoningEffort, "high");
});

test("parseArgs rejects controls from the wrong harness", () => {
  assert.throws(
    () =>
      parseArgs([
        "--prompt",
        "agents/review/prompt.md",
        "--harness",
        "codex",
        "--max-turns",
        "10",
      ]),
    /require --harness claude/
  );
  assert.throws(
    () =>
      parseArgs([
        "--prompt",
        "agents/review/prompt.md",
        "--rollout-budget-tokens",
        "1000",
      ]),
    /require --harness codex/
  );
});

test("sessionStatePath isolates Codex without moving Claude sessions", () => {
  assert.equal(
    sessionStatePath("owner/repo-42", "claude"),
    "/workspace/.islo-agents/sessions/owner-repo-42.json"
  );
  assert.equal(
    sessionStatePath("owner/repo-42", "codex"),
    "/workspace/.islo-agents/sessions/owner-repo-42.codex.json"
  );
});
