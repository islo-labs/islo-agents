import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { parse } from "smol-toml";

const roles = ["review", "implementer", "verify", "babysit", "delegator"];

test("job manifests parse and deployment copies match", () => {
  for (const role of roles) {
    const canonical = readFileSync(`agents/${role}/job.toml`, "utf-8");
    const deployed = readFileSync(`jobs/${role}/job.toml`, "utf-8");

    assert.doesNotThrow(() => parse(canonical), `${role} manifest must parse`);
    assert.equal(deployed, canonical, `${role} deployment copy must match`);
    assert.match(canonical, /\[job\.params\.harness\]/);
    assert.match(canonical, /--harness "\$\{HARNESS\}"/);
  }
});

test("review defaults to Codex with GPT-5.6 Sol", () => {
  const manifest = readFileSync("agents/review/job.toml", "utf-8");

  assert.match(
    manifest,
    /\[job\.params\.harness\][\s\S]*?default = "codex"/,
  );
  assert.match(
    manifest,
    /\[job\.params\.model\][\s\S]*?default = "gpt-5\.6-sol"/,
  );
  assert.match(
    manifest,
    /\[job\.params\.max_budget_usd\][\s\S]*?default = 10/,
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
    assert.match(manifest, /--max-budget "{{max_budget_usd}}"/,
      `${role} must pass --max-budget outside the case`);
  }
});
