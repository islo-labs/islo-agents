import { parseArgs as nodeParseArgs } from "node:util";
import { Islo } from "@islo-labs/sdk";
import { readFileSync, existsSync, mkdirSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join, resolve } from "path";

import { createRuntime } from "./runtimes/index.js";
import type { Harness, ReasoningEffort, RuntimeOpts } from "./runtimes/types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, "..");

type UserKnowledgeLevel = "memory" | "skill" | "rule";
type KnowledgeListRequest = NonNullable<
  Parameters<Islo["knowledge"]["listKnowledge"]>[0]
>;
type SdkKnowledgeLevel = NonNullable<KnowledgeListRequest["level"]>;

export interface Args {
  prompt?: string;
  promptText?: string;
  resume: boolean;
  cwd: string;
  sessionKey?: string;
  contextFiles: string[];
  vars: Record<string, string>;
  knowledgeRepo?: string;
  knowledgeLevel?: UserKnowledgeLevel;
  knowledgeTag?: string;
  knowledgeQuery?: string;
  knowledgeIds: string[];
  harness?: Harness;
  model?: string;
  maxTurns?: number;
  maxBudget?: number;
  rolloutBudgetTokens?: number;
  reasoningEffort?: ReasoningEffort;
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

export function parseArgs(argv: string[] = process.argv.slice(2)): Args {
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
  if (!values.prompt && !promptText) {
    throw new Error(
      "Usage: tsx src/agent.ts --prompt <path> [--resume] [--session-key <key>] [--harness claude|codex] [--cwd <dir>] [--model <m>] [--max-turns <n>] [--max-budget <n>] [--rollout-budget-tokens <n>] [--reasoning-effort low|medium|high|xhigh|max] [--context-file <path>]... [--var KEY=VALUE]... [\"prompt text\"]",
    );
  }

  const rawHarness = values.harness as string | undefined;
  if (rawHarness !== undefined && rawHarness !== "claude" && rawHarness !== "codex") {
    throw new Error(`Unsupported harness '${rawHarness}'`);
  }

  const knowledgeLevel = values["knowledge-level"];
  if (knowledgeLevel !== undefined && !isKnowledgeLevel(knowledgeLevel)) {
    throw new Error(`Unsupported knowledge level '${knowledgeLevel}'`);
  }

  const reasoningEffort = values["reasoning-effort"] as string | undefined;
  if (reasoningEffort !== undefined && !isReasoningEffort(reasoningEffort)) {
    throw new Error(`Unsupported reasoning effort '${reasoningEffort}'`);
  }

  const vars: Record<string, string> = {};
  for (const entry of values.var ?? []) {
    const idx = entry.indexOf("=");
    if (idx <= 0) throw new Error("--var must use KEY=VALUE");
    vars[entry.slice(0, idx)] = entry.slice(idx + 1);
  }

  return {
    ...(values.prompt ? { prompt: values.prompt } : {}),
    ...(promptText ? { promptText } : {}),
    resume,
    cwd: values.cwd ?? process.cwd(),
    contextFiles: values["context-file"] ?? [],
    vars,
    knowledgeIds: values["knowledge-id"] ?? [],
    ...(values["session-key"] ? { sessionKey: values["session-key"] } : {}),
    ...(values["knowledge-repo"] ? { knowledgeRepo: values["knowledge-repo"] } : {}),
    ...(knowledgeLevel ? { knowledgeLevel } : {}),
    ...(values["knowledge-tag"] ? { knowledgeTag: values["knowledge-tag"] } : {}),
    ...(values["knowledge-query"] ? { knowledgeQuery: values["knowledge-query"] } : {}),
    ...(rawHarness ? { harness: rawHarness as Harness } : {}),
    ...(values.model ? { model: values.model } : {}),
    maxTurns: positiveInteger(values["max-turns"] as string | undefined, "--max-turns"),
    maxBudget: positiveNumber(values["max-budget"] as string | undefined, "--max-budget"),
    rolloutBudgetTokens: positiveInteger(
      values["rollout-budget-tokens"] as string | undefined,
      "--rollout-budget-tokens",
    ),
    ...(reasoningEffort ? { reasoningEffort: reasoningEffort as ReasoningEffort } : {}),
  };
}

export function buildRuntimeOpts(
  harness: Harness,
  model: string | undefined,
  args: Pick<Args, "maxTurns" | "maxBudget" | "rolloutBudgetTokens" | "reasoningEffort">,
): RuntimeOpts {
  if (harness === "claude") {
    if (args.rolloutBudgetTokens !== undefined) {
      throw new Error("--rollout-budget-tokens requires --harness codex");
    }
    return {
      harness,
      model: model ?? "claude-opus-4-6",
      maxTurns: args.maxTurns ?? 50,
      maxBudget: args.maxBudget ?? 15,
      ...(args.reasoningEffort ? { reasoningEffort: args.reasoningEffort } : {}),
    };
  }

  if (args.maxTurns !== undefined) {
    throw new Error("--max-turns requires --harness claude");
  }
  return {
    harness,
    model: model ?? "gpt-5.6",
    maxBudget: args.maxBudget ?? 15,
    ...(args.rolloutBudgetTokens !== undefined ? { rolloutBudgetTokens: args.rolloutBudgetTokens } : {}),
    ...(args.reasoningEffort ? { reasoningEffort: args.reasoningEffort } : {}),
  };
}

function isKnowledgeLevel(v: string): v is UserKnowledgeLevel {
  return v === "memory" || v === "skill" || v === "rule";
}

function isReasoningEffort(v: string): v is ReasoningEffort {
  return ["minimal", "low", "medium", "high", "xhigh", "max"].includes(v);
}

// ── Session state ───────────────────────────────────────────────────

export interface SessionData {
  sessionId: string;
  harness: Harness;
  model: string | undefined;
}

export function sessionStatePath(key: string): string {
  const safeKey = key.replace(/[^a-zA-Z0-9_.-]/g, "-");
  return join("/workspace/.islo-agents/sessions", `${safeKey}.session.json`);
}

export function readSession(path: string): SessionData | undefined {
  if (!existsSync(path)) return undefined;
  try {
    const parsed = JSON.parse(readFileSync(path, "utf-8"));
    if (typeof parsed.session_id !== "string") return undefined;
    return {
      sessionId: parsed.session_id,
      harness: parsed.harness === "codex" ? "codex" : "claude",
      model: typeof parsed.model === "string" && parsed.model ? parsed.model : undefined,
    };
  } catch {
    return undefined;
  }
}

function writeSession(
  path: string,
  sessionId: string,
  key: string,
  harness: Harness,
  model: string,
): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(
    path,
    JSON.stringify(
      { session_key: key, session_id: sessionId, harness, model, updated_at: new Date().toISOString() },
      null,
      2,
    ) + "\n",
  );
}

export function resolveRuntime(
  args: Args,
  stored: SessionData | undefined,
): { harness: Harness; model: string | undefined; resumeSessionId: string | undefined } {
  const harness = args.harness ?? stored?.harness ?? "claude";
  const model = args.model ?? stored?.model ?? undefined;
  const resumeSessionId = stored?.sessionId;
  return { harness, model, resumeSessionId };
}

// ── Knowledge loading ───────────────────────────────────────────────

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function hasKnowledgeRequest(args: Args): boolean {
  return Boolean(
    args.knowledgeRepo ||
      args.knowledgeLevel ||
      args.knowledgeTag ||
      args.knowledgeQuery ||
      args.knowledgeIds.length,
  );
}

async function loadKnowledgeMarkdown(args: Args): Promise<string> {
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

async function renderPrompt(args: Args): Promise<string> {
  const promptPath = resolve(PROJECT_ROOT, args.prompt!);
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
  args.vars["KNOWLEDGE_SECTION"] = knowledgeMarkdown;
  if (knowledgeMarkdown) {
    contextSection = contextSection
      ? `${contextSection}\n${knowledgeMarkdown}\n`
      : `${knowledgeMarkdown}\n`;
  }
  args.vars["CONTEXT_SECTION"] = contextSection;

  const hadContextPlaceholder = promptTemplate.includes("{{CONTEXT_SECTION}}");
  const hadKnowledgePlaceholder = promptTemplate.includes("{{KNOWLEDGE_SECTION}}");

  for (const [key, value] of Object.entries(args.vars)) {
    promptTemplate = promptTemplate.replaceAll(`{{${key}}}`, value);
  }

  if (knowledgeMarkdown && !hadContextPlaceholder && !hadKnowledgePlaceholder) {
    promptTemplate += `\n\n## Knowledge\n\n${knowledgeMarkdown}\n`;
  }

  return promptTemplate;
}

// ── Main ────────────────────────────────────────────────────────────

export async function main(argv: string[] = process.argv.slice(2)): Promise<void> {
  const args = parseArgs(argv);
  const sessionPath = args.sessionKey ? sessionStatePath(args.sessionKey) : undefined;

  let prompt: string;
  let resolved: ReturnType<typeof resolveRuntime>;

  if (args.resume) {
    const stored = sessionPath ? readSession(sessionPath) : undefined;
    if (!stored) {
      throw new Error(
        `Session '${args.sessionKey}' not found. Remove --resume to start a new session.`,
      );
    }
    if (args.harness && args.harness !== stored.harness) {
      throw new Error(
        `Cannot resume: session uses ${stored.harness} but --harness ${args.harness} was specified.`,
      );
    }
    resolved = resolveRuntime(args, stored);
    prompt = args.promptText!;
    console.log(`Resuming ${stored.harness} session ${stored.sessionId}`);
  } else {
    if (sessionPath && existsSync(sessionPath)) {
      const existing = readSession(sessionPath);
      if (existing) {
        throw new Error(
          `Session '${args.sessionKey}' already exists. Use --resume to continue it.`,
        );
      }
      console.warn(`Corrupt session file at ${sessionPath}; overwriting with new session`);
    }
    if (!args.prompt) {
      throw new Error("--prompt is required for new sessions");
    }
    resolved = resolveRuntime(args, undefined);
    prompt = await renderPrompt(args);
  }

  const runtimeOpts = buildRuntimeOpts(resolved.harness, resolved.model, args);
  const runtime = createRuntime(runtimeOpts);
  let sessionId = resolved.resumeSessionId;

  const controls = runtime.describeControls();
  console.log(
    `Running ${runtime.harness} harness with model ${runtimeOpts.model}${
      controls ? ` (${controls})` : ""
    }`,
  );
  if (args.prompt) console.log(`Prompt: ${args.prompt}`);

  try {
    await runtime.run({
      prompt,
      cwd: args.cwd,
      resumeSessionId: resolved.resumeSessionId,
      callbacks: {
        onProgress: () => process.stdout.write("."),
        onSessionId: (next) => { sessionId = next; },
      },
    });
  } finally {
    if (sessionId && sessionPath && args.sessionKey) {
      writeSession(sessionPath, sessionId, args.sessionKey, runtime.harness, runtimeOpts.model);
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
