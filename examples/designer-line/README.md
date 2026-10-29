# Designer line

Factory line that designs **one UI request** in a retained Storybook sandbox, posts a public share, and parks. Publishing the pull request is a later steer of the same stage, not a second stage.

## Stage

| Stage | Job | Snapshot |
|-------|-----|----------|
| `design` | `designer-design` | `designer` |

**Trigger:** manual. Pass `task` when you start the run.

The sandbox uses `ensure` mode, named `designer-<line-run-id>`, so a follow-up on the same line run rejoins the same Storybook while a new run gets a fresh sandbox. When `design_result` is not `ready`, an agentic transition offers `retry-design`. Cancel stays a reserved line control.

## Before you deploy

### 1. Build snapshot `designer`

See `snapshots/designer/README.md`. The UI checkout lives at `/workspace/app`. `start-storybook.sh` must start Storybook on port 6006 and write `/workspace/design/share.json`.

```bash
islo snapshot save <your-build-sandbox> --name designer
```

### 2. Prepare the Manager Agent

Create the Manager Machine from a repository you control. Complete any Machine build setup questions, then wait until `islo factory machine get` shows a successful latest build before creating the Agent. If you already have a ready Machine in this Factory, set `machine` in `manager-agent.toml` to its name and skip the create command:

```bash
islo schema agent
islo factory machine create designer-line-manager --repo <your-repository-url>
islo factory machine get designer-line-manager
islo agent validate examples/designer-line/manager-agent.toml
islo agent create examples/designer-line/manager-agent.toml
islo agent get designer-line-manager
```

### 3. Deploy

```bash
islo job deploy --path examples/designer-line/jobs/designer-design/job.toml --dry-run
islo job deploy --path examples/designer-line/jobs/designer-design/job.toml
islo factory line validate examples/designer-line/line.toml
islo factory line deploy examples/designer-line/line.toml --dry-run
islo factory line deploy examples/designer-line/line.toml
```

Job and line versions are immutable. This job manifest is version `1.3.0`; redeploy it before redeploying the line. Existing runs keep their pinned older version and should be allowed to finish rather than being rewritten in place.

### 4. Test

```bash
islo factory line run designer-line \
  --param task='Make the empty state match the nearest settings screen.'
```

Inspect the run:

```bash
islo factory line runs designer-line
islo factory line-run events <run-id>
```

Expect `design_result=ready` and a `share_url`. `pr_url` stays empty until a publish steer.

For a run started from a trusted Slack interaction, the stage agent uploads reviewed PNG, MP4, and WebM evidence to the originating thread when Slack is connected. The backend still sends all text, progress, final responses, and questions. Manual runs have no trusted conversational origin, so they return the share URL without uploading files.

### 5. Remove

Delete the deployed line and job from your tenant when you no longer need this example.

## Adoption notes for agents

Read this before copying the line into a tenant.

- One stage. Do not add a publish stage. A human ask to ship is `islo factory line-run` steer of `design` with a `resume_prompt` that says to commit, push, and open the PR. The first visit ignores `resume_prompt`.
- The sandbox and named session use `designer-{{line_run_id}}`. Steering or retrying the same line run rejoins that design; starting another run for the same request gets a fresh sandbox and conversation.
- `task` is the verbatim request.
- Happy path parks on `done` after `design_result=ready`. Leave the run succeeded so a later steer can still reach the sandbox. Cancel only when the human wants the work dead.
- The prep step does not clone a repo. Bake `/workspace/app` and `/workspace/scripts/start-storybook.sh` into the snapshot named `designer`. That name is yours. Do not point `snapshot_name` at an internal image.
- The prompt assumes Claude (`claude-sonnet-4-5`) via your connected Claude account. Swap `harness`, `model`, and `model_provider` if you want Islo inference instead.
- `linear_issue_id` and `pr_url` are required outputs and stay empty until a publish resume creates them. Always return them.
- `summary` is a required output: what was designed, where to see it, and any open question. The run chat shows it as the reply.
- Visual delivery is a narrow Slack-only exception to centralized interaction delivery. The agent resolves the backend-stamped origin from its own Line Run and uploads reviewed files without an `initial_comment`; it never accepts a destination from the task and never posts text or GitHub comments directly.
