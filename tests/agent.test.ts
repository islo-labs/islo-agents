import assert from "node:assert/strict";
import test from "node:test";

import { parseArgs, sessionStatePath } from "../src/agent.js";

test("parseArgs preserves Claude defaults", () => {
  const args = parseArgs(["--prompt", "agents/review/prompt.md"]);

  assert.equal(args.runtimeOpts.harness, "claude");
  assert.equal(args.runtimeOpts.model, "claude-opus-4-6");
  assert.equal(args.runtimeOpts.harness === "claude" && args.runtimeOpts.maxTurns, 50);
});

test("parseArgs accepts Codex-specific controls", () => {
  const args = parseArgs([
    "--prompt",
    "agents/review/prompt.md",
    "--harness",
    "codex",
    "--model",
    "gpt-5.6",
    "--max-budget",
    "10",
    "--reasoning-effort",
    "high",
  ]);

  assert.equal(args.runtimeOpts.harness, "codex");
  assert.equal(args.runtimeOpts.model, "gpt-5.6");
  assert.equal(
    args.runtimeOpts.harness === "codex" && args.runtimeOpts.maxBudget,
    10,
  );
  assert.equal(
    args.runtimeOpts.harness === "codex" && args.runtimeOpts.reasoningEffort,
    "high",
  );
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
    /requires --harness claude/,
  );
  assert.throws(
    () =>
      parseArgs([
        "--prompt",
        "agents/review/prompt.md",
        "--rollout-budget-tokens",
        "1000",
      ]),
    /require --harness codex/,
  );
});

test("parseArgs allows --max-budget for both harnesses", () => {
  const claude = parseArgs(["--prompt", "p.md", "--max-budget", "5"]);
  assert.equal(claude.runtimeOpts.harness, "claude");
  assert.equal(claude.runtimeOpts.harness === "claude" && claude.runtimeOpts.maxBudget, 5);

  const codex = parseArgs(["--prompt", "p.md", "--harness", "codex", "--max-budget", "10"]);
  assert.equal(codex.runtimeOpts.harness, "codex");
  assert.equal(codex.runtimeOpts.harness === "codex" && codex.runtimeOpts.maxBudget, 10);
});

test("sessionStatePath isolates runtimes by suffix", () => {
  assert.equal(
    sessionStatePath("owner/repo-42", ".json"),
    "/workspace/.islo-agents/sessions/owner-repo-42.json",
  );
  assert.equal(
    sessionStatePath("owner/repo-42", ".codex.json"),
    "/workspace/.islo-agents/sessions/owner-repo-42.codex.json",
  );
});
