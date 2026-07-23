import { parseArgs as nodeParseArgs } from "node:util";
import { Islo } from "@islo-labs/sdk";
import { existsSync, readFileSync, unlinkSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createRuntime } from "./runtimes/index.js";
import type {
  ClaudeReasoningEffort,
  CodexBudget,
  CodexReasoningEffort,
  Harness,
  ReasoningEffort,
  RuntimeOpts,
} from "./runtimes/types.js";
import {
  loadSession,
  sessionStatePath,
  writeSession,
  type SessionRecord,
} from "./session.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, "..");

type UserKnowledgeLevel = "memory" | "skill" | "rule";
type KnowledgeListRequest = NonNullable<
  Parameters<Islo["knowledge"]["listKnowledge"]>[0]
>;
type SdkKnowledgeLevel = NonNullable<KnowledgeListRequest["level"]>;

interface RuntimeOverrides {
  harness?: Harness;
  model?: string;
  cwd?: string;
  maxTurns?: number;
  maxBudgetUsd?: number;
  rolloutBudgetTokens?: number;
  reasoningEffort?: ReasoningEffort;
}

interface PromptInputs {
  contextFiles: string[];
  vars: Record<string, string>;
  knowledgeRepo?: string;
  knowledgeLevel?: UserKnowledgeLevel;
  knowledgeTag?: string;
  knowledgeQuery?: string;
  knowledgeIds: string[];
}

export interface StartInvocation extends RuntimeOverrides, PromptInputs {
  mode: "start";
  promptPath: string;
  sessionKey?: string;
}

export interface ResumeInvocation extends RuntimeOverrides {
  mode: "resume";
  promptText: string;
  sessionKey: string;
}

export type Invocation = StartInvocation | ResumeInvocation;

export interface ResolvedRunPlan {
  cwd: string;
  runtime: RuntimeOpts;
  resumeSessionId?: string;
}

export function shouldPersistSession(
  mode: Invocation["mode"],
  completed: boolean,
  sessionId: string | undefined,
): boolean {
  return sessionId !== undefined && (mode === "start" || completed);
}

// ── Argument parsing ────────────────────────────────────────────────

function positiveNumber(raw: string | undefined, flag: string): number | undefined {
  if (raw === undefined) return undefined;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) throw new Error(`${flag} must be a positive number`);
  return n;
}

function positiveInteger(raw: string | undefined, flag: string): number | undefined {
  const n = positiveNumber(raw, flag);
  if (n !== undefined && !Number.isInteger(n)) throw new Error(`${flag} must be a positive integer`);
  return n;
}

const CLI_OPTIONS = {
  prompt:                  { type: "string" as const },
  resume:                  { type: "boolean" as const },
  harness:                 { type: "string" as const },
  cwd:                     { type: "string" as const },
  model:                   { type: "string" as const },
  "max-turns":             { type: "string" as const },
  "max-budget":            { type: "string" as const },
  "rollout-budget-tokens": { type: "string" as const },
  "reasoning-effort":      { type: "string" as const },
  "session-key":           { type: "string" as const },
  "context-file":          { type: "string" as const, multiple: true as const },
  "knowledge-repo":        { type: "string" as const },
  "knowledge-level":       { type: "string" as const },
  "knowledge-tag":         { type: "string" as const },
  "knowledge-query":       { type: "string" as const },
  "knowledge-id":          { type: "string" as const, multiple: true as const },
  var:                     { type: "string" as const, multiple: true as const },
};

export function parseArgs(argv: string[] = process.argv.slice(2)): Invocation {
  const { values, positionals } = nodeParseArgs({
    args: argv,
    options: CLI_OPTIONS,
    allowPositionals: true,
  });

  const promptText = positionals.length > 0 ? positionals.join(" ") : undefined;
  const resume = values.resume === true;

  if (resume && !values["session-key"]) {
    throw new Error("--resume requires --session-key");
  }
  if (resume && !promptText) {
    throw new Error("--resume requires a positional prompt text argument");
  }
  if (resume && values.prompt) {
    throw new Error("--resume accepts positional prompt text, not --prompt");
  }
  if (!resume && promptText) {
    throw new Error("Positional prompt text requires --resume");
  }
  if (!resume && !values.prompt) {
    throw new Error(
      "Usage: tsx src/agent.ts --prompt <path> [--resume] [--session-key <key>] [--harness claude|codex] [--cwd <dir>] [--model <m>] [--max-turns <n>] [--max-budget <n>] [--rollout-budget-tokens <n>] [--reasoning-effort low|medium|high|xhigh|max] [--context-file <path>]... [--var KEY=VALUE]... [\"prompt text\"]",
    );
  }

  const rawHarness = values.harness;
  if (rawHarness !== undefined && rawHarness !== "claude" && rawHarness !== "codex") {
    throw new Error(`Unsupported harness '${rawHarness}'`);
  }

  const knowledgeLevel = values["knowledge-level"];
  if (knowledgeLevel !== undefined && !isKnowledgeLevel(knowledgeLevel)) {
    throw new Error(`Unsupported knowledge level '${knowledgeLevel}'`);
  }

  const reasoningEffort = values["reasoning-effort"];
  if (reasoningEffort !== undefined && !isReasoningEffort(reasoningEffort)) {
    throw new Error(`Unsupported reasoning effort '${reasoningEffort}'`);
  }

  const vars: Record<string, string> = {};
  for (const entry of values.var ?? []) {
    const idx = entry.indexOf("=");
    if (idx <= 0) throw new Error("--var must use KEY=VALUE");
    vars[entry.slice(0, idx)] = entry.slice(idx + 1);
  }

  const runtimeOverrides: RuntimeOverrides = {
    ...(values.cwd ? { cwd: values.cwd } : {}),
    ...(rawHarness ? { harness: rawHarness } : {}),
    ...(values.model ? { model: values.model } : {}),
    maxTurns: positiveInteger(values["max-turns"], "--max-turns"),
    maxBudgetUsd: positiveNumber(values["max-budget"], "--max-budget"),
    rolloutBudgetTokens: positiveInteger(
      values["rollout-budget-tokens"],
      "--rollout-budget-tokens",
    ),
    ...(reasoningEffort ? { reasoningEffort } : {}),
  };

  if (resume) {
    const sessionKey = values["session-key"];
    if (!sessionKey || !promptText) {
      throw new Error("--resume requires --session-key and positional prompt text");
    }
    return {
      mode: "resume",
      promptText,
      sessionKey,
      ...runtimeOverrides,
    };
  }

  const promptPath = values.prompt;
  if (!promptPath) {
    throw new Error("--prompt is required for new sessions");
  }
  return {
    mode: "start",
    promptPath,
    ...(values["session-key"] ? { sessionKey: values["session-key"] } : {}),
    contextFiles: values["context-file"] ?? [],
    vars,
    knowledgeIds: values["knowledge-id"] ?? [],
    ...(values["knowledge-repo"] ? { knowledgeRepo: values["knowledge-repo"] } : {}),
    ...(knowledgeLevel ? { knowledgeLevel } : {}),
    ...(values["knowledge-tag"] ? { knowledgeTag: values["knowledge-tag"] } : {}),
    ...(values["knowledge-query"] ? { knowledgeQuery: values["knowledge-query"] } : {}),
    ...runtimeOverrides,
  };
}

function isKnowledgeLevel(v: string): v is UserKnowledgeLevel {
  return v === "memory" || v === "skill" || v === "rule";
}

function isReasoningEffort(v: string): v is ReasoningEffort {
  return ["minimal", "low", "medium", "high", "xhigh", "max"].includes(v);
}

// ── Run-plan resolution ─────────────────────────────────────────────

function isClaudeEffort(
  effort: ReasoningEffort,
): effort is ClaudeReasoningEffort {
  return effort !== "minimal";
}

function isCodexEffort(
  effort: ReasoningEffort,
): effort is CodexReasoningEffort {
  return effort !== "max";
}

function resolveCodexBudget(
  invocation: Invocation,
  storedBudget: CodexBudget | undefined,
): CodexBudget {
  if (
    invocation.maxBudgetUsd !== undefined &&
    invocation.rolloutBudgetTokens !== undefined
  ) {
    throw new Error(
      "--max-budget and --rollout-budget-tokens are alternative Codex controls; specify only one",
    );
  }
  if (invocation.rolloutBudgetTokens !== undefined) {
    return {
      kind: "rollout_tokens",
      tokens: invocation.rolloutBudgetTokens,
    };
  }
  if (invocation.maxBudgetUsd !== undefined) {
    return { kind: "approximate_usd", maxUsd: invocation.maxBudgetUsd };
  }
  return storedBudget ?? { kind: "approximate_usd", maxUsd: 45 };
}

export function resolveRunPlan(
  invocation: Invocation,
  stored?: SessionRecord,
): ResolvedRunPlan {
  if (invocation.mode === "resume" && stored === undefined) {
    throw new Error("A stored session is required to resume");
  }
  if (invocation.mode === "start" && stored !== undefined) {
    throw new Error("A new run cannot reuse an existing session");
  }
  if (
    stored &&
    invocation.harness &&
    invocation.harness !== stored.runtime.harness
  ) {
    throw new Error(
      `Cannot resume: session uses ${stored.runtime.harness} but --harness ${invocation.harness} was specified.`,
    );
  }

  const harness = stored?.runtime.harness ?? invocation.harness ?? "claude";
  const cwd = invocation.cwd ?? stored?.cwd ?? process.cwd();
  const resumeSessionId =
    invocation.mode === "resume" ? stored?.sessionId : undefined;

  if (harness === "claude") {
    if (invocation.rolloutBudgetTokens !== undefined) {
      throw new Error("--rollout-budget-tokens requires --harness codex");
    }
    const storedRuntime =
      stored?.runtime.harness === "claude" ? stored.runtime : undefined;
    const effort =
      invocation.reasoningEffort ?? storedRuntime?.reasoningEffort;
    if (effort !== undefined && !isClaudeEffort(effort)) {
      throw new Error(
        `Reasoning effort '${effort}' is not supported by the claude harness`,
      );
    }
    return {
      cwd,
      runtime: {
        harness,
        model:
          invocation.model ?? storedRuntime?.model ?? "claude-opus-4-6",
        maxTurns: invocation.maxTurns ?? storedRuntime?.maxTurns ?? 150,
        maxBudgetUsd:
          invocation.maxBudgetUsd ?? storedRuntime?.maxBudgetUsd ?? 45,
        ...(effort ? { reasoningEffort: effort } : {}),
      },
      ...(resumeSessionId ? { resumeSessionId } : {}),
    };
  }

  if (invocation.maxTurns !== undefined) {
    throw new Error("--max-turns requires --harness claude");
  }
  const storedRuntime =
    stored?.runtime.harness === "codex" ? stored.runtime : undefined;
  const effort = invocation.reasoningEffort ?? storedRuntime?.reasoningEffort;
  if (effort !== undefined && !isCodexEffort(effort)) {
    throw new Error(
      `Reasoning effort '${effort}' is not supported by the codex harness`,
    );
  }
  return {
    cwd,
    runtime: {
      harness,
      model: invocation.model ?? storedRuntime?.model ?? "kimi-k2.7-code",
      budget: resolveCodexBudget(invocation, storedRuntime?.budget),
      ...(effort ? { reasoningEffort: effort } : {}),
    },
    ...(resumeSessionId ? { resumeSessionId } : {}),
  };
}

// ── Knowledge loading ───────────────────────────────────────────────

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function hasKnowledgeRequest(args: StartInvocation): boolean {
  return Boolean(
    args.knowledgeRepo ||
      args.knowledgeLevel ||
      args.knowledgeTag ||
      args.knowledgeQuery ||
      args.knowledgeIds.length,
  );
}

async function loadKnowledgeMarkdown(args: StartInvocation): Promise<string> {
  if (!hasKnowledgeRequest(args)) return "";

  const client = new Islo();
  const slugs = new Set<string>();

  const filterActive = Boolean(
    args.knowledgeRepo || args.knowledgeLevel || args.knowledgeTag || args.knowledgeQuery,
  );
  if (filterActive) {
    try {
      let cursor: string | undefined;
      do {
        const result = await client.knowledge.listKnowledge({
          ...(args.knowledgeLevel
            ? { level: args.knowledgeLevel as SdkKnowledgeLevel }
            : {}),
          ...(args.knowledgeTag ? { tag: args.knowledgeTag } : {}),
          ...(args.knowledgeRepo ? { repository: args.knowledgeRepo } : {}),
          ...(args.knowledgeQuery ? { q: args.knowledgeQuery } : {}),
          ...(cursor ? { cursor } : {}),
        });
        for (const item of result.items) slugs.add(item.slug);
        cursor = result.next_cursor ?? undefined;
      } while (cursor);
    } catch (error: unknown) {
      console.error(`knowledge list failed: ${errorMessage(error)}`);
    }
  }

  for (const id of args.knowledgeIds) slugs.add(id);
  if (slugs.size === 0) return "";

  const bodies: string[] = [];
  await Promise.all(
    [...slugs].map(async (slug) => {
      try {
        const item = await client.knowledge.getKnowledge({ identifier: slug });
        if (item.body) bodies.push(item.body);
        else console.error(`knowledge item '${slug}' has empty body; skipping`);
      } catch (error: unknown) {
        console.error(`knowledge get '${slug}' failed: ${errorMessage(error)}`);
      }
    }),
  );

  if (bodies.length === 0) return "";
  console.log(`Loaded ${bodies.length} knowledge item(s)`);
  return bodies.join("\n\n---\n\n");
}

// ── Prompt rendering ────────────────────────────────────────────────

async function renderPrompt(args: StartInvocation): Promise<string> {
  const promptPath = resolve(PROJECT_ROOT, args.promptPath);
  if (!existsSync(promptPath)) {
    throw new Error(`Prompt file not found: ${promptPath}`);
  }

  let promptTemplate = readFileSync(promptPath, "utf-8");
  let contextSection = "";
  for (const contextFile of args.contextFiles) {
    const contextPath = resolve(contextFile);
    if (existsSync(contextPath)) {
      contextSection += `${readFileSync(contextPath, "utf-8")}\n`;
    }
  }

  const knowledgeMarkdown = await loadKnowledgeMarkdown(args);
  if (knowledgeMarkdown) {
    contextSection = contextSection
      ? `${contextSection}\n${knowledgeMarkdown}\n`
      : `${knowledgeMarkdown}\n`;
  }
  const vars = {
    ...args.vars,
    KNOWLEDGE_SECTION: knowledgeMarkdown,
    CONTEXT_SECTION: contextSection,
  };

  const hadContextPlaceholder = promptTemplate.includes("{{CONTEXT_SECTION}}");
  const hadKnowledgePlaceholder = promptTemplate.includes("{{KNOWLEDGE_SECTION}}");

  for (const [key, value] of Object.entries(vars)) {
    promptTemplate = promptTemplate.replaceAll(`{{${key}}}`, value);
  }

  if (knowledgeMarkdown && !hadContextPlaceholder && !hadKnowledgePlaceholder) {
    promptTemplate += `\n\n## Knowledge\n\n${knowledgeMarkdown}\n`;
  }

  return promptTemplate;
}

// ── Main ────────────────────────────────────────────────────────────

export async function main(argv: string[] = process.argv.slice(2)): Promise<void> {
  const invocation = parseArgs(argv);
  const sessionPath = invocation.sessionKey
    ? sessionStatePath(invocation.sessionKey)
    : undefined;

  let prompt: string;
  let plan: ResolvedRunPlan;

  if (invocation.mode === "resume") {
    const resumePath = sessionStatePath(invocation.sessionKey);
    const loaded = loadSession(resumePath);
    if (loaded.status === "missing") {
      throw new Error(
        `Session '${invocation.sessionKey}' not found. Remove --resume to start a new session.`,
      );
    }
    if (loaded.status === "invalid") {
      unlinkSync(resumePath);
      throw new Error(
        `Session '${invocation.sessionKey}' was invalid (${loaded.reason}) and has been removed. ` +
        `Retry the job — next run will start a fresh session.`,
      );
    }
    if (loaded.session.sessionKey !== invocation.sessionKey) {
      throw new Error(
        `Session key collision: '${invocation.sessionKey}' resolved to a file owned by '${loaded.session.sessionKey}'`,
      );
    }
    plan = resolveRunPlan(invocation, loaded.session);
    prompt = invocation.promptText;
    console.log(
      `Resuming ${loaded.session.runtime.harness} session ${loaded.session.sessionId}`,
    );
  } else {
    if (sessionPath) {
      const loaded = loadSession(sessionPath);
      if (loaded.status === "loaded") {
        throw new Error(
          `Session '${invocation.sessionKey}' already exists. Use --resume to continue it.`,
        );
      }
      if (loaded.status === "invalid") {
        console.warn(
          `Invalid session file at ${sessionPath} (${loaded.reason}); overwriting with new session`,
        );
      }
    }
    plan = resolveRunPlan(invocation);
    prompt = await renderPrompt(invocation);
  }

  const runtime = createRuntime(plan.runtime);
  let sessionId = plan.resumeSessionId;
  let completed = false;

  const controls = runtime.describeControls();
  console.log(
    `Running ${runtime.harness} harness with model ${plan.runtime.model}${
      controls ? ` (${controls})` : ""
    }`,
  );
  if (invocation.mode === "start") {
    console.log(`Prompt: ${invocation.promptPath}`);
  }

  try {
    await runtime.run({
      prompt,
      cwd: plan.cwd,
      resumeSessionId: plan.resumeSessionId,
      callbacks: {
        onProgress: () => process.stdout.write("."),
        onSessionId: (next) => { sessionId = next; },
      },
    });
    completed = true;
  } finally {
    if (
      shouldPersistSession(invocation.mode, completed, sessionId) &&
      sessionId &&
      sessionPath &&
      invocation.sessionKey
    ) {
      writeSession(sessionPath, {
        sessionKey: invocation.sessionKey,
        sessionId,
        cwd: plan.cwd,
        runtime: plan.runtime,
      });
    }
  }

  console.log("\nAgent complete.");
}

if (
  process.argv[1] !== undefined &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main().catch((error: unknown) => {
    console.error(`\nAgent failed: ${errorMessage(error)}`);
    process.exitCode = 1;
  });
}
