import { query } from "@anthropic-ai/claude-agent-sdk";
import { readFileSync, existsSync, mkdirSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join, resolve } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, "../..");

const LINEAR_API = "https://api.linear.app/graphql";

interface Args {
  prompt: string;
  cwd: string;
  model: string;
  maxTurns: number;
  maxBudget?: number;
  sessionId: string;
  sessionKey?: string;
  vars: Record<string, string>;
}

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const args: Args = {
    prompt: "",
    cwd: process.cwd(),
    model: "claude-opus-4-6",
    maxTurns: 100,
    sessionId: "",
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
      case "--session-id":
        args.sessionId = argv[++i];
        break;
      case "--session-key":
        args.sessionKey = argv[++i];
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

  if (!args.prompt || !args.sessionId) {
    console.error(
      "Usage: tsx task/linear/agent.ts --prompt <path> --session-id <id> [--cwd <dir>] [--model <m>] [--max-turns <n>] [--max-budget <n>] [--session-key <key>] [--var KEY=VALUE]..."
    );
    process.exit(1);
  }

  return args;
}

async function graphql(queryStr: string, variables: Record<string, unknown>): Promise<unknown> {
  const res = await fetch(LINEAR_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: queryStr, variables }),
  });
  if (!res.ok) {
    throw new Error(`Linear API error: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

async function emitActivity(sessionId: string, type: string, content: string): Promise<void> {
  const mutation = `
    mutation EmitAgentActivity($sessionId: String!, $type: String!, $content: String!) {
      agentSessionEmitActivity(sessionId: $sessionId, type: $type, content: $content) {
        success
      }
    }
  `;
  try {
    await graphql(mutation, { sessionId, type, content });
  } catch (err) {
    console.error(`Failed to emit ${type} activity:`, err);
  }
}

function sessionStatePath(key: string): string {
  return join("/workspace/.islo-agents/sessions", `${key.replace(/[^a-zA-Z0-9_.-]/g, "-")}.json`);
}

function readAgentSessionId(path: string): string | undefined {
  if (!existsSync(path)) return undefined;
  try {
    const parsed = JSON.parse(readFileSync(path, "utf-8"));
    return typeof parsed.session_id === "string" ? parsed.session_id : undefined;
  } catch {
    return undefined;
  }
}

function writeAgentSessionId(path: string, agentSessionId: string, key: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(
    path,
    JSON.stringify({ session_key: key, session_id: agentSessionId, updated_at: new Date().toISOString() }, null, 2) + "\n"
  );
}

const args = parseArgs();

const promptPath = resolve(PROJECT_ROOT, args.prompt);
if (!existsSync(promptPath)) {
  console.error(`Prompt file not found: ${promptPath}`);
  process.exit(1);
}

let promptTemplate = readFileSync(promptPath, "utf-8");

for (const [key, value] of Object.entries(args.vars)) {
  promptTemplate = promptTemplate.replaceAll(`{{${key}}}`, value);
}

// Emit initial "thinking" activity immediately
await emitActivity(args.sessionId, "thought", "Analyzing the task and planning implementation...");
console.log("Emitted initial thinking activity to Linear");

// Resume previous agent session if available
const sessionPath = args.sessionKey ? sessionStatePath(args.sessionKey) : undefined;
const previousAgentSessionId = sessionPath ? readAgentSessionId(sessionPath) : undefined;
let agentSessionId = previousAgentSessionId;

if (previousAgentSessionId) {
  console.log(`Resuming agent session ${previousAgentSessionId}`);
}

console.log(`Running Linear task agent with prompt: ${args.prompt}`);

let lastThoughtTime = Date.now();
const THOUGHT_INTERVAL_MS = 30_000;

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
      ...(previousAgentSessionId ? { resume: previousAgentSessionId } : {}),
    },
  })) {
    if (
      message.type === "system" &&
      message.subtype === "init" &&
      typeof message.session_id === "string"
    ) {
      agentSessionId = message.session_id;
    }
    if (message.type === "result" && typeof message.session_id === "string") {
      agentSessionId = message.session_id;
    }

    if (message.type === "assistant") {
      process.stdout.write(".");

      const now = Date.now();
      if (now - lastThoughtTime >= THOUGHT_INTERVAL_MS) {
        await emitActivity(args.sessionId, "thought", "Working on implementation...");
        lastThoughtTime = now;
      }
    }
  }

  await emitActivity(args.sessionId, "response", "Task completed. Check the repository for the created pull request.");
  console.log("\nLinear task complete — emitted response activity.");
} catch (err) {
  const errorMsg = err instanceof Error ? err.message : String(err);
  await emitActivity(args.sessionId, "error", `Agent failed: ${errorMsg}`);
  console.error("\nAgent failed:", errorMsg);
  process.exit(1);
} finally {
  if (agentSessionId && sessionPath && args.sessionKey) {
    writeAgentSessionId(sessionPath, agentSessionId, args.sessionKey);
  }
}
