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
  prompt: string;
  cwd: string;
  sessionKey?: string;
  contextFiles: string[];
  vars: Record<string, string>;
  knowledgeRepo?: string;
  knowledgeLevel?: UserKnowledgeLevel;
  knowledgeTag?: string;
  knowledgeQuery?: string;
  knowledgeIds: string[];
  runtimeOpts: RuntimeOpts;
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
  harness:                 { type: "string" as const, default: "claude" },
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
  const { values } = nodeParseArgs({ args: argv, options: CLI_OPTIONS, strict: true });

  if (!values.prompt) {
    throw new Error(
      "Usage: tsx src/agent.ts --prompt <path> [--harness claude|codex] [--cwd <dir>] [--model <m>] [--max-turns <n>] [--max-budget <n>] [--rollout-budget-tokens <n>] [--reasoning-effort minimal|low|medium|high|xhigh] [--session-key <key>] [--context-file <path>]... [--var KEY=VALUE]...",
    );
  }

  const harness = values.harness as string;
  if (harness !== "claude" && harness !== "codex") {
    throw new Error(`Unsupported harness '${harness}'`);
  }

  const knowledgeLevel = values["knowledge-level"];
  if (knowledgeLevel !== undefined && !isKnowledgeLevel(knowledgeLevel)) {
    throw new Error(`Unsupported knowledge level '${knowledgeLevel}'`);
  }

  const vars: Record<string, string> = {};
  for (const entry of values.var ?? []) {
    const idx = entry.indexOf("=");
    if (idx <= 0) throw new Error("--var must use KEY=VALUE");
    vars[entry.slice(0, idx)] = entry.slice(idx + 1);
  }

  const runtimeOpts = buildRuntimeOpts(harness, values);

  return {
    prompt: values.prompt,
    cwd: values.cwd ?? process.cwd(),
    contextFiles: values["context-file"] ?? [],
    vars,
    knowledgeIds: values["knowledge-id"] ?? [],
    ...(values["session-key"] ? { sessionKey: values["session-key"] } : {}),
    ...(values["knowledge-repo"] ? { knowledgeRepo: values["knowledge-repo"] } : {}),
    ...(knowledgeLevel ? { knowledgeLevel } : {}),
    ...(values["knowledge-tag"] ? { knowledgeTag: values["knowledge-tag"] } : {}),
    ...(values["knowledge-query"] ? { knowledgeQuery: values["knowledge-query"] } : {}),
    runtimeOpts,
  };
}

function buildRuntimeOpts(
  harness: Harness,
  values: Record<string, string | boolean | string[] | undefined>,
): RuntimeOpts {
  const maxTurns = positiveInteger(values["max-turns"] as string | undefined, "--max-turns");
  const maxBudget = positiveNumber(values["max-budget"] as string | undefined, "--max-budget");
  const rolloutBudgetTokens = positiveInteger(
    values["rollout-budget-tokens"] as string | undefined,
    "--rollout-budget-tokens",
  );
  const reasoningEffort = values["reasoning-effort"] as string | undefined;
  const model = values.model as string | undefined;

  if (reasoningEffort !== undefined && !isReasoningEffort(reasoningEffort)) {
    throw new Error(`Unsupported reasoning effort '${reasoningEffort}'`);
  }

  if (harness === "claude") {
    if (rolloutBudgetTokens !== undefined || reasoningEffort !== undefined) {
      throw new Error("--rollout-budget-tokens and --reasoning-effort require --harness codex");
    }
    return {
      harness,
      model: model ?? "claude-opus-4-6",
      maxTurns: maxTurns ?? 50,
      ...(maxBudget !== undefined ? { maxBudget } : {}),
    };
  }

  if (maxTurns !== undefined || maxBudget !== undefined) {
    throw new Error("--max-turns and --max-budget require --harness claude");
  }
  return {
    harness,
    model: model ?? "gpt-5.6",
    ...(rolloutBudgetTokens !== undefined ? { rolloutBudgetTokens } : {}),
    ...(reasoningEffort ? { reasoningEffort } : {}),
  };
}

function isKnowledgeLevel(v: string): v is UserKnowledgeLevel {
  return v === "memory" || v === "skill" || v === "rule";
}

function isReasoningEffort(v: string): v is ReasoningEffort {
  return ["minimal", "low", "medium", "high", "xhigh"].includes(v);
}

// ── Session state ───────────────────────────────────────────────────

export function sessionStatePath(key: string, suffix: string): string {
  const safeKey = key.replace(/[^a-zA-Z0-9_.-]/g, "-");
  return join("/workspace/.islo-agents/sessions", `${safeKey}${suffix}`);
}

function readSessionId(path: string): string | undefined {
  if (!existsSync(path)) return undefined;
  try {
    const parsed = JSON.parse(readFileSync(path, "utf-8"));
    return typeof parsed.session_id === "string" ? parsed.session_id : undefined;
  } catch {
    return undefined;
  }
}

function writeSessionId(path: string, sessionId: string, key: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(
    path,
    JSON.stringify(
      { session_key: key, session_id: sessionId, updated_at: new Date().toISOString() },
      null,
      2,
    ) + "\n",
  );
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
  const promptPath = resolve(PROJECT_ROOT, args.prompt);
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
  const runtime = createRuntime(args.runtimeOpts);

  const prompt = await renderPrompt(args);
  const sessionPath = args.sessionKey
    ? sessionStatePath(args.sessionKey, runtime.sessionSuffix)
    : undefined;
  const previousSessionId = sessionPath ? readSessionId(sessionPath) : undefined;
  let sessionId = previousSessionId;

  if (previousSessionId) {
    console.log(`Resuming ${runtime.harness} session ${previousSessionId}`);
  }

  const controls = runtime.describeControls();
  console.log(
    `Running ${runtime.harness} harness with model ${args.runtimeOpts.model}${
      controls ? ` (${controls})` : ""
    }`,
  );
  console.log(`Prompt: ${args.prompt}`);

  try {
    await runtime.run({
      prompt,
      cwd: args.cwd,
      resumeSessionId: previousSessionId,
      callbacks: {
        onProgress: () => process.stdout.write("."),
        onSessionId: (next) => { sessionId = next; },
      },
    });
  } finally {
    if (sessionId && sessionPath && args.sessionKey) {
      writeSessionId(sessionPath, sessionId, args.sessionKey);
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
