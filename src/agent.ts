import { query } from "@anthropic-ai/claude-agent-sdk";
import { Islo } from "@islo-labs/sdk";
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

/** Fetch knowledge items via the Islo SDK; dedupe by slug, return merged markdown. */
async function loadKnowledgeMarkdown(args: Args): Promise<string> {
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
          ...(args.knowledgeLevel ? { level: args.knowledgeLevel as any } : {}),
          ...(args.knowledgeTag ? { tag: args.knowledgeTag } : {}),
          ...(args.knowledgeRepo ? { repository: args.knowledgeRepo } : {}),
          ...(args.knowledgeQuery ? { q: args.knowledgeQuery } : {}),
          ...(cursor ? { cursor } : {}),
        });
        for (const item of result.items) slugs.add(item.slug);
        cursor = result.next_cursor ?? undefined;
      } while (cursor);
    } catch (e: any) {
      console.error(`knowledge list failed: ${e.message ?? e}`);
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
      } catch (e: any) {
        console.error(`knowledge get '${slug}' failed: ${e.message ?? e}`);
      }
    })
  );

  if (bodies.length === 0) return "";
  console.log(`Loaded ${bodies.length} knowledge item(s)`);
  return bodies.join("\n\n---\n\n");
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
