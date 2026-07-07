# Mention Handler

Handle human mentions like `@islo please update this PR`.

The mention handler is a persistent sandbox that receives conversational events from GitHub, Linear, and later Slack. It routes requests to worker sandboxes, answers simple standalone questions, asks for clarification when routing is unclear, or ignores noise.

## Architecture

```
GitHub @islo comment -> incoming webhook -> mention-handler job -> mention-handler sandbox
```

Deterministic events stay direct:

- Linear `islo` label triggers `linear-task`.
- Review, verify, and babysit jobs keep their explicit triggers.
- CI failure events still go to babysit.

Mention events go to the handler because a human message needs interpretation.

## Sandbox

The handler runs in one stable sandbox:

```text
mention-handler
```

It uses the `islo-stack` snapshot so it has the repos available for context.

Each webhook delivery gets its own run directory under `/workspace/.islo-agents/mention-handler/runs/`. The sandbox reuses one shared `islo-agents` checkout, guarded by a lock so concurrent deliveries do not mutate it at the same time.

## Behavior

The handler can:

- Delegate requests into a matching worker sandbox.
- Answer simple standalone questions directly when they are unrelated to prior work.
- Ask one clarification question.
- Ignore noise.

The handler should list accessible sandboxes and choose the best candidate from PR metadata, possible Linear issue IDs, and current sandbox state:

```bash
islo ls --all --status running --status paused --output json
```

Before delegating, it should inspect the selected sandbox's agent sessions so it can continue the existing context:

```bash
islo logs <sandbox> --type agent --output json
islo logs <sandbox> <session-id> --output json
```

For Claude Code workers, it should resume the selected `session_name` instead of starting a fresh session:

```bash
islo use <sandbox> -- bash -lc 'cd <session-cwd-or-repo> && claude --resume <session_name> --model sonnet "<handoff prompt>"'
```

The handoff should be brief: include the source PR/thread and the exact user mention, then ask the worker to inspect the thread and continue. The handler should avoid rewriting review comments into its own task list. If no relevant Claude session exists, it should start a new one with Sonnet by default.

## Worker Sandbox Discovery

The implementation worker uses an issue-scoped name:

```text
implement-ISL-646
```

Review, verify, and babysit workers may use their current PR-scoped names or future issue-scoped names. The handler should treat names as hints and prefer any running or paused sandbox that clearly matches the repo, PR, issue ID, or requested intent.

## Deploy

From the repo root:

```bash
islo job deploy mention-handler
```

Verify:

```bash
islo job get mention-handler
```

## Create the Incoming Webhook

Create or update the Islo incoming webhook:

```bash
islo webhook incoming create --request-json @mention-handler/github-issue-comment-webhook-rule.json
```

Or update an existing webhook:

```bash
islo webhook incoming update <webhook-id> \
  --request-json @mention-handler/github-issue-comment-webhook-rule.json
```

Use the returned webhook URL as the GitHub webhook URL.

## GitHub Webhook Setup

In the GitHub organization or repository webhook settings:

- Payload URL: `https://<webhook-id>.ca.webhook.islo.dev`
- Content type: `application/json`
- Events: issue comments

The Islo webhook rule filters to PR comments where the body mentions `@islo`.

## Test

1. Comment on a PR:

   ```text
   @islo what would you do here?
   ```

2. Confirm the `mention-handler` job ran.
3. Confirm the same `mention-handler` sandbox is reused.
4. Confirm it posts an answer or delegates to the matching worker sandbox.

## Notes

- The handler uses GitHub credentials through the existing gateway integration.
- PR titles should include the Linear issue ID, for example `ISL-646: fix sandbox routing`.
