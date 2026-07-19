import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  parseArgs,
  resolveRunPlan,
  shouldPersistSession,
  type ResumeInvocation,
} from "../src/agent.js";
import {
  loadSession,
  sessionStatePath,
  writeSession,
  type SessionRecord,
} from "../src/session.js";

test("parseArgs returns a typed start invocation", () => {
  const invocation = parseArgs([
    "--prompt", "agents/review/prompt.md",
    "--harness", "codex",
    "--model", "gpt-5.6-sol",
    "--max-budget", "10",
    "--reasoning-effort", "high",
  ]);

  assert.equal(invocation.mode, "start");
  assert.equal(invocation.harness, "codex");
  assert.equal(invocation.model, "gpt-5.6-sol");
  assert.equal(invocation.maxBudgetUsd, 10);
  assert.equal(invocation.reasoningEffort, "high");
  if (invocation.mode === "start") {
    assert.equal(invocation.promptPath, "agents/review/prompt.md");
  }
});

test("parseArgs returns a typed resume invocation", () => {
  const invocation = parseArgs([
    "--resume", "--session-key", "review-repo-7",
    "Review the latest changes.",
  ]);

  assert.deepEqual(invocation, {
    mode: "resume",
    sessionKey: "review-repo-7",
    promptText: "Review the latest changes.",
    maxTurns: undefined,
    maxBudgetUsd: undefined,
    rolloutBudgetTokens: undefined,
  });
});

test("parseArgs rejects invalid invocation modes", () => {
  assert.throws(
    () => parseArgs(["Review the latest changes."]),
    /Positional prompt text requires --resume/,
  );
  assert.throws(
    () => parseArgs(["--resume", "Continue."]),
    /--resume requires --session-key/,
  );
  assert.throws(
    () => parseArgs(["--resume", "--session-key", "key"]),
    /--resume requires a positional prompt/,
  );
  assert.throws(
    () =>
      parseArgs([
        "--resume", "--session-key", "key",
        "--prompt", "prompt.md",
        "Continue.",
      ]),
    /not --prompt/,
  );
});

test("parseArgs validates harness, numbers, and effort", () => {
  assert.throws(
    () => parseArgs(["--prompt", "p.md", "--harness", "invalid"]),
    /Unsupported harness/,
  );
  assert.throws(
    () => parseArgs(["--prompt", "p.md", "--max-turns", "1.5"]),
    /positive integer/,
  );
  assert.throws(
    () => parseArgs(["--prompt", "p.md", "--reasoning-effort", "extreme"]),
    /Unsupported reasoning effort/,
  );
});

test("resolveRunPlan applies Claude defaults", () => {
  const plan = resolveRunPlan(parseArgs(["--prompt", "p.md"]));

  assert.deepEqual(plan.runtime, {
    harness: "claude",
    model: "claude-opus-4-6",
    maxTurns: 50,
    maxBudgetUsd: 15,
  });
  assert.equal(plan.resumeSessionId, undefined);
});

test("resolveRunPlan applies Codex defaults", () => {
  const plan = resolveRunPlan(
    parseArgs(["--prompt", "p.md", "--harness", "codex"]),
  );

  assert.deepEqual(plan.runtime, {
    harness: "codex",
    model: "gpt-5.6-sol",
    budget: { kind: "approximate_usd", maxUsd: 15 },
  });
});

test("resolveRunPlan restores a complete stored session", () => {
  const invocation = parseArgs([
    "--resume", "--session-key", "key", "Continue.",
  ]);
  const stored: SessionRecord = {
    sessionKey: "key",
    sessionId: "thread-abc",
    cwd: "/workspace",
    runtime: {
      harness: "codex",
      model: "gpt-5.6-sol",
      budget: { kind: "approximate_usd", maxUsd: 10 },
      reasoningEffort: "high",
    },
  };

  assert.deepEqual(resolveRunPlan(invocation, stored), {
    cwd: "/workspace",
    resumeSessionId: "thread-abc",
    runtime: stored.runtime,
  });
});

test("a CLI USD budget replaces stored rollout tokens", () => {
  const invocation = parseArgs([
    "--resume", "--session-key", "key",
    "--max-budget", "5",
    "Continue.",
  ]);
  const stored: SessionRecord = {
    sessionKey: "key",
    sessionId: "thread-abc",
    cwd: "/workspace",
    runtime: {
      harness: "codex",
      model: "gpt-5.6-sol",
      budget: { kind: "rollout_tokens", tokens: 500_000 },
    },
  };

  const plan = resolveRunPlan(invocation, stored);
  assert.equal(plan.runtime.harness, "codex");
  assert.deepEqual(
    plan.runtime.harness === "codex" ? plan.runtime.budget : undefined,
    { kind: "approximate_usd", maxUsd: 5 },
  );
});

test("resolveRunPlan rejects ambiguous and cross-harness controls", () => {
  assert.throws(
    () =>
      resolveRunPlan(
        parseArgs([
          "--prompt", "p.md",
          "--harness", "codex",
          "--max-budget", "5",
          "--rollout-budget-tokens", "1000",
        ]),
      ),
    /alternative Codex controls/,
  );
  assert.throws(
    () =>
      resolveRunPlan(
        parseArgs([
          "--prompt", "p.md",
          "--harness", "codex",
          "--max-turns", "10",
        ]),
      ),
    /requires --harness claude/,
  );
  assert.throws(
    () =>
      resolveRunPlan(
        parseArgs([
          "--prompt", "p.md",
          "--harness", "claude",
          "--rollout-budget-tokens", "1000",
        ]),
      ),
    /requires --harness codex/,
  );
});

test("resolveRunPlan enforces provider-specific effort levels", () => {
  assert.throws(
    () =>
      resolveRunPlan(
        parseArgs([
          "--prompt", "p.md",
          "--harness", "claude",
          "--reasoning-effort", "minimal",
        ]),
      ),
    /not supported by the claude/,
  );
  assert.throws(
    () =>
      resolveRunPlan(
        parseArgs([
          "--prompt", "p.md",
          "--harness", "codex",
          "--reasoning-effort", "max",
        ]),
      ),
    /not supported by the codex/,
  );
});

test("resolveRunPlan rejects a resume harness mismatch", () => {
  const invocation = parseArgs([
    "--resume", "--session-key", "key",
    "--harness", "claude",
    "Continue.",
  ]);
  const stored: SessionRecord = {
    sessionKey: "key",
    sessionId: "thread-abc",
    cwd: "/workspace",
    runtime: {
      harness: "codex",
      model: "gpt-5.6-sol",
      budget: { kind: "approximate_usd", maxUsd: 10 },
    },
  };

  assert.throws(
    () => resolveRunPlan(invocation, stored),
    /session uses codex/,
  );
});

test("sessionStatePath uses the unified session suffix", () => {
  assert.equal(
    sessionStatePath("owner/repo-42"),
    "/workspace/.islo-agents/sessions/owner-repo-42.session.json",
  );
});

test("session codec round-trips both runtime variants atomically", () => {
  const dir = mkdtempSync(join(tmpdir(), "islo-agent-session-"));
  try {
    const sessions: SessionRecord[] = [
      {
        sessionKey: "claude-key",
        sessionId: "claude-session",
        cwd: "/workspace",
        runtime: {
          harness: "claude",
          model: "claude-opus-4-6",
          maxTurns: 100,
          maxBudgetUsd: 10,
          reasoningEffort: "max",
        },
      },
      {
        sessionKey: "codex-key",
        sessionId: "codex-session",
        cwd: "/workspace",
        runtime: {
          harness: "codex",
          model: "gpt-5.6-sol",
          budget: { kind: "rollout_tokens", tokens: 222_222 },
          reasoningEffort: "minimal",
        },
      },
    ];

    sessions.forEach((session, index) => {
      const path = join(dir, `${index}.session.json`);
      writeSession(path, session);
      assert.deepEqual(loadSession(path), { status: "loaded", session });
    });
    assert.equal(
      readdirSync(dir).some((name) => name.endsWith(".tmp")),
      false,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("session loader distinguishes missing and invalid files", () => {
  const dir = mkdtempSync(join(tmpdir(), "islo-agent-session-"));
  try {
    const path = join(dir, "session.json");
    assert.deepEqual(loadSession(path), { status: "missing" });
    writeFileSync(path, "{");
    assert.deepEqual(loadSession(path), {
      status: "invalid",
      reason: "invalid JSON",
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("session loader rejects provider-incompatible persisted settings", () => {
  const dir = mkdtempSync(join(tmpdir(), "islo-agent-session-"));
  const path = join(dir, "session.json");
  try {
    writeFileSync(
      path,
      JSON.stringify({
        version: 1,
        session_key: "key",
        session_id: "session",
        cwd: "/workspace",
        runtime: {
          harness: "claude",
          model: "claude-opus-4-6",
          max_turns: 50,
          max_budget_usd: 15,
          reasoning_effort: "minimal",
        },
      }),
    );
    assert.deepEqual(loadSession(path), {
      status: "invalid",
      reason: "unsupported session schema",
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("failed starts preserve discovered sessions but failed resumes keep stored config", () => {
  assert.equal(shouldPersistSession("start", false, "new-session"), true);
  assert.equal(shouldPersistSession("resume", false, "stored-session"), false);
  assert.equal(shouldPersistSession("resume", true, "stored-session"), true);
  assert.equal(shouldPersistSession("start", true, undefined), false);
});

test("resume invocation type requires its session identity", () => {
  const invocation: ResumeInvocation = {
    mode: "resume",
    sessionKey: "key",
    promptText: "Continue.",
  };
  assert.equal(invocation.sessionKey, "key");
});
