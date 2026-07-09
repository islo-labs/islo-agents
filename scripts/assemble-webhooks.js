#!/usr/bin/env node
/**
 * Assemble webhooks/<source>-*.json from agents/<role>/trigger_rules/<source>.json fragments.
 *
 * Usage: node scripts/assemble-webhooks.js
 */
import { readdirSync, readFileSync, writeFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const agentsDir = join(root, "agents");
const webhooksDir = join(root, "webhooks");

const receivers = {
  github: {
    out: "github-events.json",
    shell: {
      name: "github-events",
      auth: { auth_type: "none" },
      target: {
        target_type: "fixed_sandbox_name",
        sandbox_name: "github-events",
      },
      idempotency: { source: "header", name: "X-GitHub-Delivery" },
      status: "active",
    },
  },
  linear: {
    out: "linear-issues.json",
    shell: {
      name: "linear-issues",
      auth: { auth_type: "none" },
      target: {
        target_type: "fixed_sandbox_name",
        sandbox_name: "linear-issues",
      },
      idempotency: { source: "header", name: "Linear-Delivery" },
      status: "active",
    },
  },
};

function collectRules(source) {
  const rules = [];
  const agents = readdirSync(agentsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();

  for (const agent of agents) {
    const path = join(agentsDir, agent, "trigger_rules", `${source}.json`);
    if (!existsSync(path)) continue;
    const fragment = JSON.parse(readFileSync(path, "utf8"));
    if (!Array.isArray(fragment)) {
      throw new Error(`${path} must be a JSON array of webhook rules`);
    }
    rules.push(...fragment);
    console.log(`+ ${agent}/trigger_rules/${source}.json (${fragment.length} rule(s))`);
  }
  return rules;
}

for (const [source, cfg] of Object.entries(receivers)) {
  const rules = collectRules(source);
  const body = { ...cfg.shell, rules };
  const outPath = join(webhooksDir, cfg.out);
  writeFileSync(outPath, JSON.stringify(body, null, 2) + "\n");
  console.log(`wrote ${cfg.out} (${rules.length} rule(s))\n`);
}
