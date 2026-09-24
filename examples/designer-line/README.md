# Designer line

Factory line that designs **one UI request** in a retained Storybook sandbox, posts a public share, and parks. Publishing the pull request is a later steer of the same stage, not a second stage.

## Stage

| Stage | Job | Snapshot |
|-------|-----|----------|
| `design` | `designer-design` | `designer` |

**Trigger:** manual. Pass `work_key`, `task`, and `origin` when you start the run.

The sandbox uses `ensure` mode, named `designer-<work_key>`, so a follow-up rejoins the same Storybook. When `design_result` is not `ready`, an agentic transition offers `retry-design`. Cancel stays a reserved line control.

## Before you deploy

### 1. Build snapshot `designer`

See `snapshots/designer/README.md`. The UI checkout lives at `/workspace/app`. `start-storybook.sh` must start Storybook on port 6006 and write `/workspace/design/share.json`.

```bash
islo snapshot save <your-build-sandbox> --name designer
```

### 2. Enable the line routing agent

Blocked design and later "please publish" steers need it:

```bash
islo factory manager status
islo factory manager enable
```

Connect Slack if `origin` is a Slack thread: `islo login --tool slack`.

### 3. Deploy

```bash
islo job deploy --path examples/designer-line/jobs/designer-design/job.toml --dry-run
islo job deploy --path examples/designer-line/jobs/designer-design/job.toml
islo factory line validate examples/designer-line/line.toml
islo factory line deploy examples/designer-line/line.toml --dry-run
islo factory line deploy examples/designer-line/line.toml
```

### 4. Test

```bash
islo factory line run designer-line \
  --param work_key=task-header \
  --param task='Make the empty state match the nearest settings screen.' \
  --param origin='slack:REPLACE_WITH_YOUR_SLACK_CHANNEL_ID:1710000000.000100'
```

`origin` may be empty. Then the share URL is only in the stage outputs.

Inspect the run:

```bash
islo factory line runs designer-line
islo factory line-run events <run-id>
```

Expect `design_result=ready`, a `share_url`, and a Slack note when `origin` is set. `pr_url` stays empty until a publish steer.

### 5. Remove

Delete the deployed line and job from your tenant when you no longer need this example.

## Adoption notes for agents

Read this before copying the line into a tenant.

- One stage. Do not add a publish stage. A human ask to ship is `islo factory line-run` steer of `design` with a `resume_prompt` that says to commit, push, and open the PR. The first visit ignores `resume_prompt`.
- `work_key` names `designer-<work_key>` and the agent session. Pattern: `^[A-Za-z0-9][A-Za-z0-9_-]{0,60}$`. Replace dots in a Slack `thread_ts`. Reusing a key rejoins that design. A second run for the same thread fights the same sandbox.
- `task` is the verbatim request. `origin` is `slack:<channel-id>:<thread-ts>` or empty.
- Happy path parks on `done` after `design_result=ready`. Leave the run succeeded so a later steer can still reach the sandbox. Cancel only when the human wants the work dead.
- The prep step does not clone a repo. Bake `/workspace/app` and `/workspace/scripts/start-storybook.sh` into the snapshot named `designer`. That name is yours. Do not point `snapshot_name` at an internal image.
- The prompt assumes Claude (`claude-sonnet-4-5`) via your connected Claude account. Swap `harness`, `model`, and `model_provider` if you want Islo inference instead.
- `linear_issue_id` and `pr_url` are required outputs and stay empty until a publish resume creates them. Always return them.
