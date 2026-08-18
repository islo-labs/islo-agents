#!/usr/bin/env node
/**
 * Embed agent prompt.md files into template job.toml run_agent.prompt literals.
 * Run before tests so deployed manifests match prompt sources.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { parse, stringify } from "smol-toml";

const mappings = [
  {
    jobPath: "agents/weekly-skills-refresh/job.toml",
    updates: [{ task: "refresh", step: "refresh", prompt: "agents/weekly-skills-refresh/prompt.md" }],
  },
  {
    jobPath: "agents/red-team-cli-trust-boundaries/job.toml",
    removeSteps: ["prepare"],
    updates: [
      {
        task: "review",
        step: "trust-boundaries-review",
        prompt: "agents/red-team-cli-trust-boundaries/prompt.md",
      },
    ],
  },
  {
    jobPath: "agents/red-team-cli-input-abuse/job.toml",
    removeSteps: ["prepare"],
    updates: [
      {
        task: "review",
        step: "input-abuse-review",
        prompt: "agents/red-team-cli-input-abuse/prompt.md",
      },
    ],
  },
  {
    jobPath: "agents/red-team-cli-black-box/job.toml",
    updates: [
      {
        task: "black-box",
        step: "black-box-attack",
        prompt: "agents/red-team-cli-black-box/prompt.md",
      },
    ],
  },
  {
    jobPath: "agents/red-team-cli-report/job.toml",
    removeSteps: ["prepare"],
    updates: [
      {
        task: "report",
        step: "validate-and-report",
        prompt: "agents/red-team-cli-report/prompt.md",
      },
    ],
  },
  {
    jobPath: "agents/fullstack-qa/job.toml",
    updates: [
      {
        task: "qa-agent-web-core",
        step: "explore",
        prompt: "agents/fullstack-qa/prompt-web-core.md",
      },
      {
        task: "qa-agent-web-platform",
        step: "explore",
        prompt: "agents/fullstack-qa/prompt-web-platform.md",
      },
      {
        task: "qa-agent-cli-cross",
        step: "explore",
        prompt: "agents/fullstack-qa/prompt-cli-cross.md",
      },
    ],
  },
];

function readPrompt(path) {
  return readFileSync(path, "utf8").replace(/\r\n/g, "\n").trimEnd() + "\n";
}

for (const { jobPath, updates, removeSteps = [] } of mappings) {
  const doc = parse(readFileSync(jobPath, "utf8"));

  for (const task of doc.run.tasks) {
    task.steps = task.steps.filter((step) => !removeSteps.includes(step.name));
  }

  for (const { task: taskName, step: stepName, prompt } of updates) {
    const task = doc.run.tasks.find((t) => t.name === taskName);
    if (!task) {
      throw new Error(`${jobPath}: missing task ${taskName}`);
    }
    const step = task.steps.find((s) => s.name === stepName);
    if (!step?.run_agent) {
      throw new Error(`${jobPath}: missing run_agent step ${stepName}`);
    }
    step.run_agent.prompt = { type: "literal", value: readPrompt(prompt) };
  }

  writeFileSync(jobPath, stringify(doc));
  console.log(`synced prompts → ${jobPath}`);
}
