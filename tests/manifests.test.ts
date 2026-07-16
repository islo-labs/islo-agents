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

test("review defaults to Codex with GPT-5.6", () => {
  const manifest = readFileSync("agents/review/job.toml", "utf-8");

  assert.match(
    manifest,
    /\[job\.params\.harness\][\s\S]*?default = "codex"/
  );
  assert.match(
    manifest,
    /\[job\.params\.model\][\s\S]*?default = "gpt-5\.6"/
  );
  assert.match(
    manifest,
    /\[job\.params\.rollout_budget_tokens\][\s\S]*?default = 200000/
  );
});
