import { query } from "@anthropic-ai/claude-agent-sdk";
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
      "Usage: tsx src/agent.ts --prompt <path> [--cwd <dir>] [--model <m>] [--max-turns <n>] [--max-budget <n>] [--session-key <key>] [--context-file <path>]... [--var KEY=VALUE]..."
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
args.vars["CONTEXT_SECTION"] = contextSection;

for (const [key, value] of Object.entries(args.vars)) {
  promptTemplate = promptTemplate.replaceAll(`{{${key}}}`, value);
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
