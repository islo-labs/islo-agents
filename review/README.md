# Islo PR Review

This directory owns the reusable PR review template. Users can run it as-is or fork `islo-agents` and change the job, prompt, or harness behavior.

## Data shape

```text
GitHub pull_request event
-> Islo incoming webhook filter or wrapper
-> islo-review job params
-> stable PR-scoped sandbox
-> src/agent.ts with review/prompt.md
-> GitHub PR review
```

## Ownership

- `review/job.toml` owns durable job params, sandbox mode, lifecycle, and steps.
- `review/prompt.md` owns review behavior and GitHub PR review instructions.
- `src/agent.ts` owns prompt loading, variable substitution, session reuse, and Claude Agent SDK execution.
- `review/validate-job.mjs` owns deployed job compatibility checks.
- `review/action.yml` is a GitHub wrapper for users who choose that integration path. Keep Islo incoming webhooks as the preferred event path when the user wants Islo to own the trigger.

## Webhook and job boundary

The webhook decides whether to run the job. Put event filtering in webhook target filters or rules, not in the agent prompt or job script.

For pull request review, prefer these triggers:

- `pull_request.opened`
- `pull_request.reopened`
- `pull_request.review_requested`
- `pull_request.labeled` when the label is `islo-review`

Include `pull_request.ready_for_review` only when the user asks for draft-to-ready review.

Use multiple webhook rules when multiple conditions are needed unless the current Islo schema explicitly supports list or `in` matching.

## Job params

Keep job params small. Pass stable identifiers and let the wrapper, webhook, job, or harness derive the rest.

The current review job expects:

- `repo`
- `pr_number`
- `head_ref`
- `base_ref`
- `sandbox_name`
- `agents_ref`
- `model`
- `max_turns`
- `max_budget_usd`

## Sandbox lifecycle

Use `[run.sandbox] mode = "ensure"` with a stable PR sandbox name. `ensure` creates the sandbox when missing and resumes an existing paused sandbox. Do not add a separate resume step.

The template keeps PR review sandboxes reusable:

- `[run.sandbox.lifecycle] pause_after_idle = 1800`
- `[run.sandbox.lifecycle] delete_after = 604800`

The checked-in job also has an explicit pause step, so it pauses as soon as the review finishes. If a fork should pause only after idle time, remove that pause step and rely on the lifecycle block.

Use object or table init shape:

```toml
init = { type = "full" }
```

or:

```toml
[run.sandbox.init]
type = "full"
```

Do not use `init = "full"`.

## Agent execution

Do not run PR review jobs by calling the sandbox Claude CLI directly. This template runs:

```bash
npx tsx src/agent.ts --prompt review/prompt.md ...
```

`src/agent.ts` uses the Claude Agent SDK. That keeps review behavior in this repo and avoids depending on the sandbox `claude` binary path.

## Review output

The primary review output belongs on GitHub as a PR review with inline comments and a summary. Sandbox files such as `/workspace/reviews/*.md` are optional debug artifacts only.

## Setup checklist

When asked to set up webhook-driven review, do the full setup unless the user narrows the scope:

1. Run `islo job deploy islo-review --dry-run`.
2. Deploy `islo-review`.
3. Generate an HMAC secret, for example with `openssl rand -hex 32`.
4. Create the Islo incoming webhook.
5. Register the GitHub repo webhook with `gh api` after confirming the token has repo-hook permissions.
6. Verify a real delivery or job run.
