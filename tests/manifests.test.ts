import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
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

test("review defaults to Thesean Ship Claude Opus 5", () => {
  const manifest = readFileSync("agents/review/job.toml", "utf-8");

  assert.match(
    manifest,
    /\[job\.params\.harness\][\s\S]*?default = "claude"/,
  );
  assert.match(
    manifest,
    /\[job\.params\.model\][\s\S]*?default = "ship-like\/claude-opus-5"/,
  );
  assert.match(
    manifest,
    /\[job\.params\.max_budget_usd\][\s\S]*?default = 30/,
  );
  assert.match(
    manifest,
    /\[job\.params\.model_provider\][\s\S]*?default = "islo_inference"/,
  );
});

test("only review creation excludes pull requests from the Islo app", () => {
  const rules = readFileSync(
    "agents/review/trigger-rules/github.toml",
    "utf-8",
  );
  const ruleBlocks = rules.split("[[rules]]").slice(1);
  const appExclusion =
    /op = "not"\s+\[rules\.when\.conditions\.condition\]\s+op = "equals"\s+json_path = "\$\.pull_request\.user\.login"\s+value = "islo-labs\[bot\]"/;

  assert.match(ruleBlocks[0] ?? "", appExclusion);
  for (const rule of ruleBlocks.slice(1)) {
    assert.doesNotMatch(rule, appExclusion);
  }
});

test("GitHub webhook does not trigger the delegator", () => {
  const webhook = readFileSync("webhooks/github-events.toml", "utf-8");

  assert.doesNotMatch(webhook, /job_name = "delegator"/);
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

test("durable worker sandboxes expire after two days", () => {
  for (const role of ["review", "implementer", "verify"]) {
    const manifest = readFileSync(`agents/${role}/job.toml`, "utf-8");

    assert.match(
      manifest,
      /\[run\.sandbox\.lifecycle\][\s\S]*?delete_after = 172800/,
      `${role} must delete its sandbox after two days`,
    );
  }
});

test("babysit tears down its sandbox after completion", () => {
  const manifest = readFileSync("agents/babysit/job.toml", "utf-8");

  assert.match(manifest, /teardown_on_complete = true/);
  assert.doesNotMatch(manifest, /name = "pause-sandbox"[\s\S]*?pause = true/);
  assert.match(
    manifest,
    /\[run\.sandbox\.lifecycle\][\s\S]*?delete_after = 172800/,
    "babysit must retain a two-day cleanup fallback",
  );
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

const factoryRoles = ["factory-implement", "factory-review", "factory-verify"];

test("factory jobs use one native agent and compatible PR list contracts", () => {
  for (const role of factoryRoles) {
    const manifest = readFileSync(`agents/${role}/job.toml`, "utf-8");
    const prompt = readFileSync(`agents/${role}/prompt.md`, "utf-8");

    assert.doesNotThrow(() => parse(manifest), `${role} manifest must parse`);
    assert.equal(
      (manifest.match(/\[run\.tasks\.steps\.run_agent\]/g) ?? []).length,
      1,
      `${role} must define exactly one native run_agent step`,
    );
    assert.match(manifest, /fanout = false/);
    assert.doesNotMatch(manifest, /ISLO_(JOB|AGENT)_RESULT|AGENT_OUTPUT=/);
    assert.doesNotMatch(prompt, /ISLO_(JOB|AGENT)_RESULT|AGENT_OUTPUT=/);
    assert.match(
      manifest,
      /\[(?:job\.params|outputs)\.pull_requests\][\s\S]*?type = "array"[\s\S]*?items = "string"/,
      `${role} must use string-list PR contracts`,
    );
  }
  const implement = readFileSync("agents/factory-implement/job.toml", "utf-8");
  assert.match(
    implement,
    /\[job\.params\.pull_requests\][\s\S]*?default = \[\]/,
  );
});

test("factory prompts place every declared param themselves", () => {
  for (const role of factoryRoles) {
    const manifest = readFileSync(`agents/${role}/job.toml`, "utf-8");
    const prompt = readFileSync(`agents/${role}/prompt.md`, "utf-8");
    const params = [...manifest.matchAll(/^\[job\.params\.([^\]]+)\]$/gm)]
      .flatMap((match) => match[1] ? [match[1]] : []);

    for (const param of params) {
      assert.match(
        prompt,
        new RegExp(`\\{\\{${param}\\}\\}`),
        `${role} prompt must interpolate ${param}`,
      );
    }
  }
});

test("factory review and verification require all-PR aggregate verdicts", () => {
  const review = readFileSync("agents/factory-review/prompt.md", "utf-8");
  const verify = readFileSync("agents/factory-verify/prompt.md", "utf-8");

  assert.match(review, /Return `approved` only when every PR passes/);
  assert.match(verify, /Return `passed` only after every PR/);
});

test("factory review and verification post to GitHub before their verdict", () => {
  const review = readFileSync("agents/factory-review/prompt.md", "utf-8");
  const verify = readFileSync("agents/factory-verify/prompt.md", "utf-8");

  assert.match(review, /gh pr review <pr-url> --comment/);
  assert.match(verify, /gh pr comment <pr-url>/);

  for (const role of factoryRoles) {
    const manifest = readFileSync(`agents/${role}/job.toml`, "utf-8");
    const prompt = readFileSync(`agents/${role}/prompt.md`, "utf-8");

    assert.doesNotMatch(
      `${manifest}\n${prompt}`,
      /--(add|remove)-label/,
      `${role} must not drive islo-loop labels; the line owns orchestration`,
    );
  }
});

test("factory sandboxes survive rounds and expire after two days", () => {
  for (const role of factoryRoles) {
    const manifest = readFileSync(`agents/${role}/job.toml`, "utf-8");

    assert.match(manifest, /teardown_on_complete = false/, `${role} must not delete its sandbox`);
    assert.match(
      manifest,
      new RegExp(`mode = "ensure"\\nname = "${role}-\\{\\{issue_id\\}\\}"`),
      `${role} must key its sandbox on the issue so rounds share one`,
    );
    assert.match(
      manifest,
      /delete_after = 172800/,
      `${role} must delete its sandbox after two days`,
    );
    assert.match(
      manifest,
      /name = "pause-sandbox"\npause = true/,
      `${role} must pause rather than leave the sandbox running`,
    );
  }
});

test("every stage that needs the issue gets it routed in", () => {
  const line = readFileSync("lines/feature-delivery/line.toml", "utf-8");
  const needsIssue = factoryRoles.filter((role) =>
    readFileSync(`agents/${role}/job.toml`, "utf-8").includes("[job.params.issue_id]"),
  );

  assert.deepEqual(needsIssue, factoryRoles);
  // Sandbox names interpolate issue_id, so an unmapped transition would name a
  // sandbox after a blank and collapse separate issues into one.
  assert.equal(
    (
      line.match(
        /issue_id = \{ type = "input", name = "issue_id" \}/g,
      ) ?? []
    ).length,
    5,
  );
  assert.match(
    line,
    /from = "trigger"\nto = "implement"\nwhen = "true"/,
  );
});

test("feature-delivery maps implement PRs through both feedback loops", () => {
  const line = readFileSync("lines/feature-delivery/line.toml", "utf-8");
  assert.doesNotThrow(() => parse(line));
  assert.doesNotMatch(line, /job_version_id/);
  assert.equal(
    (
      line.match(
        /pull_requests = \{ type = "output", stage = "implement", name = "pull_requests" \}/g,
      ) ?? []
    ).length,
    4,
  );
  assert.match(
    line,
    /issue_id = \{ type = "input", name = "issue_id" \}/,
  );
});

test("feature-delivery uses typed tenant Manager instructions", () => {
  const line = readFileSync("lines/feature-delivery/line.toml", "utf-8");

  assert.doesNotThrow(() => parse(line));
  assert.doesNotMatch(line, /^\[manager\]$/m);
  assert.match(
    line,
    /\[manager\.instructions\][\s\S]*type = "literal"[\s\S]*value = """[\s\S]*Retry the current stage only when the blocker is transient/,
  );
  for (const stage of ["implement", "review", "verify"]) {
    assert.match(
      line,
      new RegExp(
        `after_stage = "${stage}"[\\s\\S]*?when = "true"[\\s\\S]*?allowed_actions = \\["retry-stage", "cancel"\\]`,
      ),
    );
  }
});

test("factory deployment does not own the platform manager template", () => {
  const workflow = readFileSync(".github/workflows/deploy.yml", "utf-8");
  const jobStep = workflow.indexOf("Deploy modified jobs");
  const lineStep = workflow.indexOf("Deploy modified lines");

  assert.ok(jobStep < lineStep);
  assert.doesNotMatch(workflow, /Deploy modified managers/);
  assert.doesNotMatch(workflow, /Validate modified manager templates/);
  assert.doesNotMatch(
    workflow,
    /deploy_factory_manifest\.py\s+\\?\s*manager/,
  );
  assert.doesNotMatch(workflow, /managers\/\*\*\/manager\.toml/);
  assert.match(workflow, /lines\/\*\*\/line\.toml/);
  assert.match(
    workflow,
    /Install Islo CLI[\s\S]*?outputs\.lines != '\[\]'[\s\S]*?Deploy modified jobs/,
  );
  assert.match(workflow, /islo factory line deploy/);
  assert.doesNotMatch(workflow, /deploy_factory_manifest\.py/);
});

const templateJobs = [
  "fullstack-qa",
  "fullstack-qa-collector",
  "red-team-cli-trust-boundaries",
  "red-team-cli-input-abuse",
  "red-team-cli-black-box",
  "red-team-cli-report",
  "red-team-cli-slack-notify",
  "weekly-skills-refresh",
];

const templateLines = ["fullstack-qa-line", "red-team-cli", "weekly-skills-refresh"];

const forbiddenWorkspaceIds =
  /02cad9f0-86c4-4cb5-8cbc-24265895608c|C0B0H5Z3V7X|P397XkCwssNLDTHXJifN0SaFJYSZ/;

test("template job and line manifests parse", () => {
  for (const job of templateJobs) {
    const manifest = readFileSync(`agents/${job}/job.toml`, "utf-8");
    assert.doesNotThrow(() => parse(manifest), `${job} must parse`);
    assert.doesNotMatch(manifest, forbiddenWorkspaceIds, `${job} must not embed workspace IDs`);
    assert.match(
      manifest,
      /image = "docker\.io\/library\/islo-runner:latest"/,
      `${job} must use the public runner image`,
    );
  }
  for (const line of templateLines) {
    const manifest = readFileSync(`lines/${line}/line.toml`, "utf-8");
    assert.doesNotThrow(() => parse(manifest), `${line} must parse`);
    assert.doesNotMatch(manifest, forbiddenWorkspaceIds, `${line} must not embed workspace IDs`);
  }
});

test("template job params declare a type", () => {
  for (const job of templateJobs) {
    const manifest = readFileSync(`agents/${job}/job.toml`, "utf-8");
    const paramBlocks = manifest.match(/\[job\.params\.[^\]]+\][\s\S]*?(?=\n\[|$)/g) ?? [];
    for (const block of paramBlocks) {
      const name = block.match(/\[job\.params\.([^\]]+)\]/)?.[1] ?? job;
      assert.match(block, /type = /, `${job} param ${name} must declare type`);
    }
  }
});

test("template jobs do not interpolate params inside shell exec strings", () => {
  for (const job of templateJobs) {
    const manifest = readFileSync(`agents/${job}/job.toml`, "utf-8");
    const execBlocks = manifest.match(/exec = \[[\s\S]*?\]/g) ?? [];
    for (const block of execBlocks) {
      assert.doesNotMatch(
        block,
        /\{\{[^}]+\}\}/,
        `${job} must pass job params through sandbox env, not shell exec`,
      );
    }
  }
});

test("template jobs do not embed harness scripts in job.toml", () => {
  for (const job of templateJobs) {
    const manifest = readFileSync(`agents/${job}/job.toml`, "utf-8");
    assert.doesNotMatch(manifest, /<<'?EOF'?/, `${job} must not use heredoc bootstrap`);
    assert.doesNotMatch(manifest, /<<'?PY'?/, `${job} must not embed inline Python`);
    assert.doesNotMatch(manifest, /python3 -/, `${job} must call snapshot scripts by path`);
    for (const block of manifest.match(/exec = \[[\s\S]*?\]/g) ?? []) {
      assert.ok(
        block.length < 400,
        `${job} exec step is too large — move harness to snapshot-src`,
      );
    }
  }
});

test("template jobs reference shipped snapshot contracts", () => {
  for (const job of templateJobs) {
    const manifest = readFileSync(`agents/${job}/job.toml`, "utf-8");
    const snapshot = manifest.match(/snapshot_name = "([^"]+)"/)?.[1];
    assert.ok(snapshot, `${job} must set snapshot_name`);
    assert.ok(
      existsSync(`snapshots/${snapshot}/README.md`),
      `${job} snapshot ${snapshot} must have snapshots/${snapshot}/README.md`,
    );
    assert.ok(
      existsSync(`snapshots/${snapshot}/snapshot-src`),
      `${job} snapshot ${snapshot} must have snapshots/${snapshot}/snapshot-src/`,
    );
  }
});

const templatePromptBindings: Record<
  string,
  { slug: string; source: string } | Array<{ slug: string; source: string }>
> = {
  "weekly-skills-refresh": {
    slug: "weekly-skills-refresh-prompt",
    source: "agents/weekly-skills-refresh/prompt.md",
  },
  "red-team-cli-trust-boundaries": {
    slug: "red-team-cli-trust-boundaries-prompt",
    source: "agents/red-team-cli-trust-boundaries/prompt.md",
  },
  "red-team-cli-input-abuse": {
    slug: "red-team-cli-input-abuse-prompt",
    source: "agents/red-team-cli-input-abuse/prompt.md",
  },
  "red-team-cli-black-box": {
    slug: "red-team-cli-black-box-prompt",
    source: "agents/red-team-cli-black-box/prompt.md",
  },
  "red-team-cli-report": {
    slug: "red-team-cli-report-prompt",
    source: "agents/red-team-cli-report/prompt.md",
  },
  "fullstack-qa": [
    {
      slug: "fullstack-qa-web-core-prompt",
      source: "agents/fullstack-qa/prompt-web-core.md",
    },
    {
      slug: "fullstack-qa-web-platform-prompt",
      source: "agents/fullstack-qa/prompt-web-platform.md",
    },
    {
      slug: "fullstack-qa-cli-cross-prompt",
      source: "agents/fullstack-qa/prompt-cli-cross.md",
    },
  ],
};

test("template run_agent prompts use knowledge slugs with agents/ sources", () => {
  for (const [job, bindings] of Object.entries(templatePromptBindings)) {
    const manifest = readFileSync(`agents/${job}/job.toml`, "utf-8");
    const doc = parse(manifest) as {
      run: {
        tasks: Array<{
          steps: Array<{ run_agent?: { prompt?: { type?: string; slug?: string } } }>;
        }>;
      };
    };
    const slugs = doc.run.tasks
      .flatMap((task) => task.steps)
      .map((step) => step.run_agent?.prompt)
      .filter(
        (prompt): prompt is { type: string; slug: string } =>
          prompt?.type === "knowledge" && typeof prompt.slug === "string",
      )
      .map((prompt) => prompt.slug);

    const bindingList = Array.isArray(bindings) ? bindings : [bindings];

    for (const binding of bindingList) {
      assert.ok(
        existsSync(binding.source),
        `${job} must keep prompt source at ${binding.source}`,
      );
      assert.ok(
        slugs.includes(binding.slug),
        `${job} job.toml must bind run_agent.prompt to knowledge slug ${binding.slug}`,
      );
    }

    assert.doesNotMatch(
      manifest,
      /\/opt\/[^"\n]*\/prompts\//,
      `${job} must not point run_agent at snapshot prompt paths`,
    );
    assert.doesNotMatch(manifest, /prepare\.py/, `${job} must not call prepare.py`);
    assert.doesNotMatch(
      manifest,
      /\[run\.tasks\.steps\.run_agent\.prompt\][\s\S]*?type = "literal"/,
      `${job} must not embed prompt literals in job.toml`,
    );
  }
});
