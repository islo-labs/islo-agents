import { query } from "@anthropic-ai/claude-agent-sdk";
import { spawnSync } from "child_process";
import { readFileSync, existsSync, mkdirSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join, resolve } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, "..");

interface Args {
  prompt: string;
  cwd: string;
  model: string;
  maxTurns: number;
  maxBudget?: number;
  sessionKey?: string;
  contextFiles: string[];
  vars: Record<string, string>;
  knowledgeRepo?: string;
  knowledgeLevel?: string;
  knowledgeTag?: string;
  knowledgeQuery?: string;
  knowledgeIds: string[];
}

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const args: Args = {
    prompt: "",
    cwd: process.cwd(),
    model: "claude-opus-4-6",
    maxTurns: 50,
    contextFiles: [],
    vars: {},
    knowledgeIds: [],
  };

  for (let i = 0; i < argv.length; i++) {
    switch (argv[i]) {
      case "--prompt":
        args.prompt = argv[++i];
        break;
      case "--cwd":
        args.cwd = argv[++i];
        break;
      case "--model":
        args.model = argv[++i];
        break;
      case "--max-turns":
        args.maxTurns = parseInt(argv[++i], 10);
        break;
      case "--max-budget":
        args.maxBudget = parseFloat(argv[++i]);
        break;
      case "--session-key":
        args.sessionKey = argv[++i];
        break;
      case "--context-file":
        args.contextFiles.push(argv[++i]);
        break;
      case "--knowledge-repo":
        args.knowledgeRepo = argv[++i];
        break;
      case "--knowledge-level":
        args.knowledgeLevel = argv[++i];
        break;
      case "--knowledge-tag":
        args.knowledgeTag = argv[++i];
        break;
      case "--knowledge-query":
        args.knowledgeQuery = argv[++i];
        break;
      case "--knowledge-id":
        args.knowledgeIds.push(argv[++i]);
        break;
      case "--var": {
        const eq = argv[++i];
        const idx = eq.indexOf("=");
        if (idx > 0) {
          args.vars[eq.slice(0, idx)] = eq.slice(idx + 1);
        }
        break;
      }
    }
  }

  if (!args.prompt) {
    console.error(
      "Usage: tsx src/agent.ts --prompt <path> [--cwd <dir>] [--model <m>] [--max-turns <n>] [--max-budget <n>] [--session-key <key>] [--context-file <path>]... [--knowledge-repo <repo>] [--knowledge-level memory|skill|rule] [--knowledge-tag <tag>] [--knowledge-query <q>] [--knowledge-id <slug>]... [--var KEY=VALUE]..."
    );
    process.exit(1);
  }

  return args;
}

function sessionStatePath(key: string): string {
  return join("/workspace/.islo-agents/sessions", `${key.replace(/[^a-zA-Z0-9_.-]/g, "-")}.json`);
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

function hasKnowledgeRequest(args: Args): boolean {
  return Boolean(
    args.knowledgeRepo ||
      args.knowledgeLevel ||
      args.knowledgeTag ||
      args.knowledgeQuery ||
      args.knowledgeIds.length
  );
}

function runIsloJson(argv: string[]): unknown | undefined {
  const result = spawnSync("islo", argv, {
    encoding: "utf-8",
    maxBuffer: 10 * 1024 * 1024,
  });
  if (result.error) {
    console.error(`islo ${argv.join(" ")}: ${result.error.message}`);
    return undefined;
  }
  if (result.status !== 0) {
    const err = (result.stderr || result.stdout || "").trim();
    console.error(`islo ${argv.join(" ")} failed (exit ${result.status})${err ? `: ${err}` : ""}`);
    return undefined;
  }
  try {
    return JSON.parse(result.stdout);
  } catch (e) {
    console.error(`islo ${argv.join(" ")}: invalid JSON (${e})`);
    return undefined;
  }
}

function itemKey(item: Record<string, unknown>): string | undefined {
  const key = item.identifier ?? item.slug;
  return typeof key === "string" && key.length > 0 ? key : undefined;
}

function itemBody(item: Record<string, unknown>): string | undefined {
  return typeof item.body === "string" && item.body.length > 0 ? item.body : undefined;
}

/** Fetch knowledge via one optional filter query and/or explicit IDs; dedupe by slug. */
function loadKnowledgeMarkdown(args: Args): string {
  if (!hasKnowledgeRequest(args)) return "";

  const byId = new Map<string, string>();

  const filterActive = Boolean(
    args.knowledgeRepo || args.knowledgeLevel || args.knowledgeTag || args.knowledgeQuery
  );
  if (filterActive) {
    const renderArgs = ["knowledge", "render", "-o", "json"];
    if (args.knowledgeRepo) renderArgs.push("--repo", args.knowledgeRepo);
    if (args.knowledgeLevel) renderArgs.push("--level", args.knowledgeLevel);
    if (args.knowledgeTag) renderArgs.push("--tag", args.knowledgeTag);
    if (args.knowledgeQuery) renderArgs.push("--query", args.knowledgeQuery);

    const rendered = runIsloJson(renderArgs);
    if (Array.isArray(rendered)) {
      for (const entry of rendered) {
        if (!entry || typeof entry !== "object") continue;
        const item = entry as Record<string, unknown>;
        const key = itemKey(item);
        const body = itemBody(item);
        if (key && body) byId.set(key, body);
      }
    } else if (rendered !== undefined) {
      console.error("islo knowledge render -o json: expected an array");
    }
  }

  for (const id of args.knowledgeIds) {
    const got = runIsloJson(["knowledge", "get", id, "-o", "json"]);
    if (!got || typeof got !== "object") continue;
    const item = got as Record<string, unknown>;
    const key = itemKey(item) ?? id;
    const body = itemBody(item);
    if (body) byId.set(key, body);
    else console.error(`knowledge item '${id}' has empty body; skipping`);
  }

  if (byId.size === 0) return "";
  console.log(`Loaded ${byId.size} knowledge item(s)`);
  return Array.from(byId.values()).join("\n\n---\n\n");
}

const args = parseArgs();

const promptPath = resolve(PROJECT_ROOT, args.prompt);
if (!existsSync(promptPath)) {
  console.error(`Prompt file not found: ${promptPath}`);
  process.exit(1);
}

let promptTemplate = readFileSync(promptPath, "utf-8");

let contextSection = "";
for (const cf of args.contextFiles) {
  const cfPath = resolve(cf);
  if (existsSync(cfPath)) {
    contextSection += readFileSync(cfPath, "utf-8") + "\n";
  }
}

const knowledgeMarkdown = loadKnowledgeMarkdown(args);
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

if (
  knowledgeMarkdown &&
  !hadContextPlaceholder &&
  !hadKnowledgePlaceholder
) {
  promptTemplate += `\n\n## Knowledge\n\n${knowledgeMarkdown}\n`;
}

const sessionPath = args.sessionKey ? sessionStatePath(args.sessionKey) : undefined;
const previousSessionId = sessionPath ? readSessionId(sessionPath) : undefined;
let sessionId = previousSessionId;

if (previousSessionId) {
  console.log(`Resuming session ${previousSessionId}`);
}

console.log(`Running agent with prompt: ${args.prompt}`);

try {
  for await (const message of query({
    prompt: promptTemplate,
    options: {
      cwd: args.cwd,
      permissionMode: "bypassPermissions",
      allowDangerouslySkipPermissions: true,
      maxTurns: args.maxTurns,
      model: args.model,
      ...(args.maxBudget ? { maxBudgetUsd: args.maxBudget } : {}),
      ...(previousSessionId ? { resume: previousSessionId } : {}),
    },
  })) {
    if (
      message.type === "system" &&
      message.subtype === "init" &&
      typeof message.session_id === "string"
    ) {
      sessionId = message.session_id;
    }
    if (message.type === "result" && typeof message.session_id === "string") {
      sessionId = message.session_id;
    }
    if (message.type === "assistant") {
      process.stdout.write(".");
    }
  }
} finally {
  if (sessionId && sessionPath && args.sessionKey) {
    writeSessionId(sessionPath, sessionId, args.sessionKey);
  }
}

console.log("\nAgent complete.");
