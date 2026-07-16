import { Islo } from "@islo-labs/sdk";
import { readFileSync, existsSync, mkdirSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join, resolve } from "path";

import { runClaude } from "./runtimes/claude.js";
import { runCodex } from "./runtimes/codex.js";
import type {
  Harness,
  ReasoningEffort,
  RuntimeCallbacks,
} from "./runtimes/types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, "..");

type UserKnowledgeLevel = "memory" | "skill" | "rule";
type KnowledgeListRequest = NonNullable<
  Parameters<Islo["knowledge"]["listKnowledge"]>[0]
>;
type SdkKnowledgeLevel = NonNullable<KnowledgeListRequest["level"]>;

interface CommonArgs {
  prompt: string;
  cwd: string;
  model: string;
  sessionKey?: string;
  contextFiles: string[];
  vars: Record<string, string>;
  knowledgeRepo?: string;
  knowledgeLevel?: UserKnowledgeLevel;
  knowledgeTag?: string;
  knowledgeQuery?: string;
  knowledgeIds: string[];
}

interface ClaudeArgs extends CommonArgs {
  harness: "claude";
  maxTurns: number;
  maxBudget?: number;
}

interface CodexArgs extends CommonArgs {
  harness: "codex";
  rolloutBudgetTokens?: number;
  reasoningEffort?: ReasoningEffort;
}

export type Args = ClaudeArgs | CodexArgs;

const USAGE =
  "Usage: tsx src/agent.ts --prompt <path> [--harness claude|codex] [--cwd <dir>] [--model <m>] [--max-turns <n>] [--max-budget <n>] [--rollout-budget-tokens <n>] [--reasoning-effort minimal|low|medium|high|xhigh] [--session-key <key>] [--context-file <path>]... [--knowledge-repo <repo>] [--knowledge-level memory|skill|rule] [--knowledge-tag <tag>] [--knowledge-query <q>] [--knowledge-id <slug>]... [--var KEY=VALUE]...";

function optionValue(argv: string[], index: number): string {
  const value = argv[index + 1];
  if (value === undefined || value.startsWith("--")) {
    throw new Error(`Missing value for ${argv[index]}`);
  }
  return value;
}

function positiveNumber(value: string, flag: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${flag} must be a positive number`);
  }
  return parsed;
}

function positiveInteger(value: string, flag: string): number {
  const parsed = positiveNumber(value, flag);
  if (!Number.isInteger(parsed)) {
    throw new Error(`${flag} must be a positive integer`);
  }
  return parsed;
}

function isHarness(value: string): value is Harness {
  return value === "claude" || value === "codex";
}

function isKnowledgeLevel(value: string): value is UserKnowledgeLevel {
  return value === "memory" || value === "skill" || value === "rule";
}

function isReasoningEffort(value: string): value is ReasoningEffort {
  return ["minimal", "low", "medium", "high", "xhigh"].includes(value);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function parseArgs(argv: string[] = process.argv.slice(2)): Args {
  let prompt = "";
  let cwd = process.cwd();
  let harness: Harness = "claude";
  let model: string | undefined;
  let maxTurns: number | undefined;
  let maxBudget: number | undefined;
  let rolloutBudgetTokens: number | undefined;
  let reasoningEffort: ReasoningEffort | undefined;
  let sessionKey: string | undefined;
  const contextFiles: string[] = [];
  const vars: Record<string, string> = {};
  let knowledgeRepo: string | undefined;
  let knowledgeLevel: UserKnowledgeLevel | undefined;
  let knowledgeTag: string | undefined;
  let knowledgeQuery: string | undefined;
  const knowledgeIds: string[] = [];

  for (let i = 0; i < argv.length; i++) {
    switch (argv[i]) {
      case "--prompt":
        prompt = optionValue(argv, i++);
        break;
      case "--harness": {
        const value = optionValue(argv, i++);
        if (!isHarness(value)) {
          throw new Error(`Unsupported harness '${value}'`);
        }
        harness = value;
        break;
      }
      case "--cwd":
        cwd = optionValue(argv, i++);
        break;
      case "--model":
        model = optionValue(argv, i++);
        break;
      case "--max-turns":
        maxTurns = positiveInteger(
          optionValue(argv, i++),
          "--max-turns"
        );
        break;
      case "--max-budget":
        maxBudget = positiveNumber(
          optionValue(argv, i++),
          "--max-budget"
        );
        break;
      case "--rollout-budget-tokens":
        rolloutBudgetTokens = positiveInteger(
          optionValue(argv, i++),
          "--rollout-budget-tokens"
        );
        break;
      case "--reasoning-effort": {
        const value = optionValue(argv, i++);
        if (!isReasoningEffort(value)) {
          throw new Error(`Unsupported reasoning effort '${value}'`);
        }
        reasoningEffort = value;
        break;
      }
      case "--session-key":
        sessionKey = optionValue(argv, i++);
        break;
      case "--context-file":
        contextFiles.push(optionValue(argv, i++));
        break;
      case "--knowledge-repo":
        knowledgeRepo = optionValue(argv, i++);
        break;
      case "--knowledge-level": {
        const value = optionValue(argv, i++);
        if (!isKnowledgeLevel(value)) {
          throw new Error(`Unsupported knowledge level '${value}'`);
        }
        knowledgeLevel = value;
        break;
      }
      case "--knowledge-tag":
        knowledgeTag = optionValue(argv, i++);
        break;
      case "--knowledge-query":
        knowledgeQuery = optionValue(argv, i++);
        break;
      case "--knowledge-id":
        knowledgeIds.push(optionValue(argv, i++));
        break;
      case "--var": {
        const eq = optionValue(argv, i++);
        const idx = eq.indexOf("=");
        if (idx <= 0) {
          throw new Error("--var must use KEY=VALUE");
        }
        vars[eq.slice(0, idx)] = eq.slice(idx + 1);
        break;
      }
      default:
        throw new Error(`Unknown argument '${argv[i]}'`);
    }
  }

  if (!prompt) {
    throw new Error(USAGE);
  }

  const common = {
    prompt,
    cwd,
    model: model ?? (harness === "codex" ? "gpt-5.6" : "claude-opus-4-6"),
    contextFiles,
    vars,
    knowledgeIds,
    ...(sessionKey ? { sessionKey } : {}),
    ...(knowledgeRepo ? { knowledgeRepo } : {}),
    ...(knowledgeLevel ? { knowledgeLevel } : {}),
    ...(knowledgeTag ? { knowledgeTag } : {}),
    ...(knowledgeQuery ? { knowledgeQuery } : {}),
  };

  if (harness === "claude") {
    if (rolloutBudgetTokens !== undefined || reasoningEffort !== undefined) {
      throw new Error(
        "--rollout-budget-tokens and --reasoning-effort require --harness codex"
      );
    }
    return {
      ...common,
      harness,
      maxTurns: maxTurns ?? 50,
      ...(maxBudget !== undefined ? { maxBudget } : {}),
    };
  }

  if (maxTurns !== undefined || maxBudget !== undefined) {
    throw new Error("--max-turns and --max-budget require --harness claude");
  }
  return {
    ...common,
    harness,
    ...(rolloutBudgetTokens !== undefined ? { rolloutBudgetTokens } : {}),
    ...(reasoningEffort ? { reasoningEffort } : {}),
  };
}

export function sessionStatePath(key: string, harness: Harness): string {
  const safeKey = key.replace(/[^a-zA-Z0-9_.-]/g, "-");
  const filename =
    harness === "codex" ? `${safeKey}.codex.json` : `${safeKey}.json`;
  return join("/workspace/.islo-agents/sessions", filename);
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
    JSON.stringify({ session_key: key, session_id: sessionId, updated_at: new Date().toISOString() }, null, 2) + "\n"
  );
}

function hasKnowledgeRequest(args: CommonArgs): boolean {
  return Boolean(
    args.knowledgeRepo ||
      args.knowledgeLevel ||
      args.knowledgeTag ||
      args.knowledgeQuery ||
      args.knowledgeIds.length
  );
}

/** Fetch knowledge items via the Islo SDK; dedupe by slug, return merged markdown. */
async function loadKnowledgeMarkdown(args: CommonArgs): Promise<string> {
  if (!hasKnowledgeRequest(args)) return "";

  const client = new Islo();
  const slugs = new Set<string>();

  const filterActive = Boolean(
    args.knowledgeRepo || args.knowledgeLevel || args.knowledgeTag || args.knowledgeQuery
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
        console.error(
          `knowledge get '${slug}' failed: ${errorMessage(error)}`
        );
      }
    })
  );

  if (bodies.length === 0) return "";
  console.log(`Loaded ${bodies.length} knowledge item(s)`);
  return bodies.join("\n\n---\n\n");
}

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

  const hadContextPlaceholder = promptTemplate.includes(
    "{{CONTEXT_SECTION}}"
  );
  const hadKnowledgePlaceholder = promptTemplate.includes(
    "{{KNOWLEDGE_SECTION}}"
  );

  for (const [key, value] of Object.entries(args.vars)) {
    promptTemplate = promptTemplate.replaceAll(`{{${key}}}`, value);
  }

  if (
    knowledgeMarkdown &&
    !hadContextPlaceholder &&
    !hadKnowledgePlaceholder
  ) {
    promptTemplate += `\n\n## Knowledge\n\n${knowledgeMarkdown}\n`;
  }

  return promptTemplate;
}

function appliedControls(args: Args): string {
  if (args.harness === "claude") {
    return [
      `maxTurns=${args.maxTurns}`,
      ...(args.maxBudget !== undefined
        ? [`maxBudgetUsd=${args.maxBudget}`]
        : []),
    ].join(", ");
  }

  return [
    ...(args.rolloutBudgetTokens !== undefined
      ? [`rolloutBudgetTokens=${args.rolloutBudgetTokens}`]
      : []),
    ...(args.reasoningEffort
      ? [`reasoningEffort=${args.reasoningEffort}`]
      : []),
  ].join(", ");
}

export async function main(
  argv: string[] = process.argv.slice(2)
): Promise<void> {
  const args = parseArgs(argv);
  const prompt = await renderPrompt(args);
  const sessionPath = args.sessionKey
    ? sessionStatePath(args.sessionKey, args.harness)
    : undefined;
  const previousSessionId = sessionPath ? readSessionId(sessionPath) : undefined;
  let sessionId = previousSessionId;

  if (previousSessionId) {
    console.log(`Resuming ${args.harness} session ${previousSessionId}`);
  }

  const controls = appliedControls(args);
  console.log(
    `Running ${args.harness} harness with model ${args.model}${
      controls ? ` (${controls})` : ""
    }`
  );
  console.log(`Prompt: ${args.prompt}`);

  const callbacks: RuntimeCallbacks = {
    onProgress: () => process.stdout.write("."),
    onSessionId: (nextSessionId) => {
      sessionId = nextSessionId;
    },
  };

  try {
    if (args.harness === "claude") {
      await runClaude({
        harness: args.harness,
        prompt,
        cwd: args.cwd,
        model: args.model,
        maxTurns: args.maxTurns,
        callbacks,
        ...(args.maxBudget !== undefined
          ? { maxBudgetUsd: args.maxBudget }
          : {}),
        ...(previousSessionId ? { resumeSessionId: previousSessionId } : {}),
      });
    } else {
      await runCodex({
        harness: args.harness,
        prompt,
        cwd: args.cwd,
        model: args.model,
        callbacks,
        ...(args.rolloutBudgetTokens !== undefined
          ? { rolloutBudgetTokens: args.rolloutBudgetTokens }
          : {}),
        ...(args.reasoningEffort
          ? { reasoningEffort: args.reasoningEffort }
          : {}),
        ...(previousSessionId ? { resumeSessionId: previousSessionId } : {}),
      });
    }
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
