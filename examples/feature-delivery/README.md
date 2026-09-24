# Feature delivery line

Factory line that **implements**, **reviews**, and **verifies** one Linear issue or one standalone task across its complete pull-request set, with loops back to implementation when review or verification fails.

## Stages

| Stage | Job | Snapshot |
|-------|-----|----------|
| `implement` | `feature-delivery-implement` | `feature-delivery-code` |
| `review` | `feature-delivery-review` | `feature-delivery-code` |
| `verify` | `feature-delivery-verify` | `feature-delivery-platform` |

**Trigger:** Linear `issue.updated` when your label is added or changed (default placeholder `REPLACE_WITH_YOUR_LINEAR_LABEL_NAME` in `line.toml`).

Sandboxes use `ensure` mode per `work_key` so implement/review/verify can resume across iterations. When no conditional transition matches, an agentic transition offers `retry-stage`. Cancel stays a reserved line control (requires the line routing agent, see step 4).

## Before you deploy

### 1. Connect Linear

Install the Islo Linear integration and select the teams/issues this line should watch.

### 2. Supporting prompt files in the snapshots

Stage briefs live in each job's `run_agent` prompt so a prompt edit is a new job version. Supporting notes live only under `snapshots/*/snapshot-src/workspace/prompts/` (`integrations.md` in both snapshots, `platform-env.md` in `feature-delivery-platform`). Bake those into `/workspace/prompts/` when you save the snapshot.

### 3. Build snapshots

- **Code** (`feature-delivery-code`). Clone repos under `/workspace/`. See `snapshots/feature-delivery-code/README.md`.
- **Platform** (`feature-delivery-platform`). Full stack plus `boot-stack.sh`. See `snapshots/feature-delivery-platform/README.md`.

```bash
islo snapshot save <your-code-build-sandbox> --name feature-delivery-code
islo snapshot save <your-platform-build-sandbox> --name feature-delivery-platform
```

### 4. Enable the line routing agent

When a stage returns `blocked`, agentic transitions route via the line routing agent:

```bash
islo factory manager status
islo factory manager enable
```

### 5. Replace placeholders

| Placeholder | Where | Set it to |
|-------------|-------|-----------|
| `REPLACE_WITH_YOUR_LINEAR_LABEL_NAME` | `[trigger.selector].labels` in `line.toml` | the Linear label that starts a delivery loop, for example `factory-loop` |

### 6. Deploy

```bash
for job in feature-delivery-implement feature-delivery-review feature-delivery-verify; do
  islo job deploy --path "examples/feature-delivery/jobs/${job}/job.toml" --dry-run
  islo job deploy --path "examples/feature-delivery/jobs/${job}/job.toml"
done
islo factory line validate examples/feature-delivery/line.toml
islo factory line deploy examples/feature-delivery/line.toml --dry-run
islo factory line deploy examples/feature-delivery/line.toml
```

### 7. Test

Add or toggle your label on a Linear issue. Inspect the run:

```bash
islo factory line runs feature-delivery
islo factory line-run events <run-id>
```

Expect: Linear comment → PR(s) → review comments → verification report on PRs → `done` when verification passes.

### 8. Remove

Delete the deployed line and jobs from your tenant when you no longer need this example.

## Adoption notes for agents

Read this before copying the line into a tenant.

- `work_key` names the sandbox and the agent session. It is identity only. Never treat it as the requirement. Pattern: `^[A-Za-z0-9][A-Za-z0-9_-]{0,60}$`. Dots are rejected, so a Slack `thread_ts` must be rewritten (for example `slack-C123-1710000000-000100`).
- Ticket-backed runs set `issue_id` and `work_key` from the Linear identifier. Standalone runs leave `issue_id` empty, put the verbatim request in `task`, and set `origin` to `slack:<channel-id>:<thread-ts>`. Exactly one of `issue_id` or `task` is the requirements source.
- Start a standalone run with `islo factory line run feature-delivery --param work_key=task-slug --param task='...' --param origin=slack:C123:1710000000.000100`. Those params are line inputs. Later stages only see them because the transitions bind `type = "input"`.
- Implement must return `acceptance_criteria`. Verify treats every non-empty row as a mandatory scenario.
- The first visit of a stage ignores `resume_prompt`. Steering must pass the full instruction as `--param resume_prompt='...'`. A blocked implement retry receives the `pull_requests` that entered the stage, not a list invented by the failed attempt.
- Jobs use Codex on Islo inference (`openai/gpt-6-sol`). To use a connected Claude account instead, set `harness = "claude"`, `model = "claude-sonnet-4-5"`, and remove `model_provider`.
- Snapshot names `feature-delivery-code` and `feature-delivery-platform` are names you create. Do not point them at someone else's snapshot.

## Compared to PR review

[`pr-review`](../pr-review/) is **review-only** on newly opened GitHub PRs. This line is the full **implement → review → verify** loop driven by Linear.
