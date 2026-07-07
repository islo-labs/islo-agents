# Mention Handler

Handle human mentions like `@islo please update this PR`.

The mention handler is a persistent sandbox that receives conversational events from GitHub, Linear, and later Slack. It can answer directly, ask for clarification, ignore noise, or identify a worker sandbox for follow-up work.

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

## Phase 1

Phase 1 is dry-run for delegation.

The handler can:

- Answer simple questions directly.
- Ask one clarification question.
- Ignore noise.
- Explain which worker sandbox it would delegate to and why.

It does not run `islo use` while `dry_run` is `true`.

## Phase 2

After compute-plane self-auth lands, set `dry_run` to `false`.

The handler should inspect the target sandbox session state before delegating:

```bash
islo use implement-ISL-646 -- bash -lc 'ls -la /workspace/.islo-agents/sessions && cat /workspace/.islo-agents/sessions/implement-ISL-646.json 2>/dev/null || true'
```

Then it can delegate with:

```bash
islo use implement-ISL-646 -- bash -lc '<run follow-up agent command>'
```

## Worker Sandbox Names

Worker sandboxes are role and issue scoped:

```text
implement-ISL-646
review-ISL-646
verify-ISL-646
babysit-ISL-646
```

Review and verify jobs can keep their existing PR-scoped names as fallback when no Linear issue ID is available.

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
4. Confirm it posts an answer or dry-run delegation comment.

## Notes

- The handler uses GitHub credentials through the existing gateway integration.
- The handler should not invent hidden routing metadata.
- PR titles should include the Linear issue ID, for example `ISL-646: fix sandbox routing`.
