# Feature delivery line

Factory line that **implements**, **reviews**, and **verifies** one Linear issue across its complete pull-request set, with loops back to implementation when review or verification fails.

## Stages

| Stage | Job | Snapshot |
|-------|-----|----------|
| `implement` | `feature-delivery-implement` | `feature-delivery-code` |
| `review` | `feature-delivery-review` | `feature-delivery-code` |
| `verify` | `feature-delivery-verify` | `feature-delivery-platform` |

**Trigger:** Linear `issue.updated` when your label is added or changed (default placeholder `REPLACE_WITH_YOUR_LINEAR_LABEL_NAME` in `line.toml`).

Sandboxes use `ensure` mode per issue so implement/review/verify can resume across iterations. When a stage returns `blocked`, agentic transitions offer `retry` or `cancel-run` (requires the line routing agent, see step 4).

## Before you deploy

### 1. Connect Linear

Install the Islo Linear integration and select the teams/issues this line should watch.

### 2. Commit the prompts into your own repository

Nothing here goes into Islo Knowledge. Copy this example's `prompts/` directory into your own repository under `.islo/prompts/`, on the branch each job clones:

```bash
mkdir -p .islo/prompts
cp <this-repo>/examples/feature-delivery/prompts/*.md .islo/prompts/
git add .islo && git commit -m "Add feature-delivery line prompts" && git push
```

Your repository then contains `.islo/prompts/{implement,review,verify,integrations,platform-env}.md`. `implement.md`, `review.md` and `verify.md` are the three stage prompts. `integrations.md` and `platform-env.md` are reference notes the stage prompts read from the same directory, replacing what used to be ambient knowledge items.

Every job clones that repository into `/workspace/.islo-prompts/REPLACE_WITH_REPOSITORY` in a `checkout-prompts` step, then hands the agent a one-line prompt naming the file to read. The agent reads the prompt body fresh on every run, so editing a prompt in your repository changes the next run with no job redeploy, and your repository stays the single source of truth.

The clone needs no extra wiring. `gateway_profile = "default"` injects `GH_TOKEN`, which the step uses, so private repositories work.

> The checkout deliberately lands in `/workspace/.islo-prompts/`, not in `/workspace/REPLACE_WITH_REPOSITORY`. The snapshots pre-clone your working repositories directly under `/workspace/`, and if your prompts live in one of those repositories, a shared directory would let the prompt refresh discard the feature branch the agent is building.

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

Fill in all three before you deploy.

| Placeholder | Where | Set it to |
|-------------|-------|-----------|
| `REPLACE_WITH_OWNER` | the clone URL in all three job manifests | the GitHub organisation or user that owns the repository holding your `.islo/prompts/` |
| `REPLACE_WITH_REPOSITORY` | the clone URL, the checkout path, and every prompt path in all three job manifests | that repository's name |
| `REPLACE_WITH_YOUR_LINEAR_LABEL_NAME` | `[trigger.selector].labels` in `line.toml` | the Linear label that starts a delivery loop, for example `factory-loop` |

`REPLACE_WITH_REPOSITORY` is the one to be careful with. It is both the repository name and the checkout directory name, so it appears in the clone URL and in every `/workspace/.islo-prompts/` path.

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

## Compared to PR review

[`pr-review`](../pr-review/) is **review-only** on newly opened GitHub PRs. This line is the full **implement → review → verify** loop driven by Linear.
