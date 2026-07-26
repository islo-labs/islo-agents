import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { parse } from "smol-toml";

const roles = ["review", "implementer", "verify", "babysit", "delegator"];

test("agent job manifests parse", () => {
  for (const role of roles) {
    const canonical = readFileSync(`agents/${role}/job.toml`, "utf-8");

    assert.doesNotThrow(() => parse(canonical), `${role} manifest must parse`);
    assert.match(canonical, /\[job\.params\.harness\]/);
    assert.match(canonical, /--harness "\$\{HARNESS\}"/);
  }
});

test("review defaults to Claude with Opus 5", () => {
  const manifest = readFileSync("agents/review/job.toml", "utf-8");

  assert.match(
    manifest,
    /\[job\.params\.harness\][\s\S]*?default = "claude"/,
  );
  assert.match(
    manifest,
    /\[job\.params\.model\][\s\S]*?default = "claude-opus-5"/,
  );
  assert.match(
    manifest,
    /\[job\.params\.max_budget_usd\][\s\S]*?default = 30/,
  );
  assert.match(
    manifest,
    /\[job\.params\.model_provider\][\s\S]*?default = ""/,
  );
});

test("reused PR sandboxes handle force-pushed branches by role", () => {
  const review = readFileSync("agents/review/job.toml", "utf-8");
  const babysit = readFileSync("agents/babysit/job.toml", "utf-8");

  assert.match(
    review,
    /gh pr checkout "\$\{PR_NUMBER\}" --repo "\$\{REPO\}" --detach/,
  );
  assert.match(
    babysit,
    /gh pr checkout "\$\{PR_NUMBER\}" --repo "\$\{REPO\}" --force/,
  );
});

test("all jobs have shared budget and harness-specific params", () => {
  for (const role of roles) {
    const manifest = readFileSync(`agents/${role}/job.toml`, "utf-8");

    assert.match(manifest, /\[job\.params\.max_budget_usd\]/,
      `${role} must have max_budget_usd`);
    assert.match(manifest, /\[job\.params\.max_turns\]/,
      `${role} must have max_turns`);
    assert.match(manifest, /\[job\.params\.reasoning_effort\]/,
      `${role} must have reasoning_effort`);
    assert.match(manifest, /\[job\.params\.model_provider\]/,
      `${role} must have model_provider`);
    assert.match(manifest, /--max-budget "{{max_budget_usd}}"/,
      `${role} must pass --max-budget outside the case`);
  }
});

test("durable worker resumes rely only on stored configuration", () => {
  for (const role of ["review", "implementer", "verify"]) {
    const manifest = readFileSync(`agents/${role}/job.toml`, "utf-8");
    const resumeBranch = manifest.match(
      /if \[ -f "\$SESSION_FILE" \]; then([\s\S]*?)else/,
    )?.[1];

    assert.ok(resumeBranch, `${role} must have a resume branch`);
    assert.match(resumeBranch, /--resume --session-key/);
    assert.doesNotMatch(resumeBranch, /--cwd|--max-budget|--max-turns|--reasoning-effort/);
  }
});

test("delegator starts a worker when a matching sandbox has no session", () => {
  const prompt = readFileSync("agents/delegator/prompt.md", "utf-8");

  assert.match(
    prompt,
    /has no session file[\s\S]*start a new[\s\S]*session in that worker sandbox/,
  );
  assert.match(prompt, /Prefer re-running the role's[\s\S]*durable job/);
});
