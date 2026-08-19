# Feature delivery line

Factory line that **implements**, **reviews**, and **verifies** one Linear issue across its complete pull-request set, with loops back to implementation when review or verification fails.

## Stages

| Stage | Job | Snapshot |
|-------|-----|----------|
| `implement` | `feature-delivery-implement` | `feature-delivery-code` |
| `review` | `feature-delivery-review` | `feature-delivery-code` |
| `verify` | `feature-delivery-verify` | `feature-delivery-platform` |

**Trigger:** Linear `issue.updated` when your label is added or changed (default placeholder `REPLACE_WITH_YOUR_LINEAR_LABEL_NAME` in `line.toml`).

Sandboxes use `ensure` mode per issue so implement/review/verify can resume across iterations. Blocked stages pause for Factory Manager decisions (`retry-stage` or `cancel`).

## Before you deploy

### 1. Connect Linear

Install the Islo Linear integration and select the teams/issues this line should watch.

### 2. Publish prompts and knowledge

```bash
islo knowledge create feature-delivery-implement-prompt --level skill --body @examples/feature-delivery/prompts/implement.md
islo knowledge create feature-delivery-review-prompt --level skill --body @examples/feature-delivery/prompts/review.md
islo knowledge create feature-delivery-verify-prompt --level skill --body @examples/feature-delivery/prompts/verify.md
islo knowledge create feature-delivery-integrations --level skill --body @examples/feature-delivery/prompts/integrations.md
islo knowledge create feature-delivery-platform-env --level skill --body @examples/feature-delivery/prompts/platform-env.md
```

### 3. Build snapshots

- **Code** (`feature-delivery-code`) — clone repos under `/workspace/`. See `snapshots/feature-delivery-code/README.md`.
- **Platform** (`feature-delivery-platform`) — full stack + `boot-stack.sh`. See `snapshots/feature-delivery-platform/README.md`.

```bash
islo snapshot save <your-code-build-sandbox> --name feature-delivery-code
islo snapshot save <your-platform-build-sandbox> --name feature-delivery-platform
```

### 4. Enable Factory Manager

This line uses manager decisions when a stage returns `blocked`:

```bash
islo factory manager status
islo factory manager enable
```

### 5. Replace placeholders

In `line.toml`, set `REPLACE_WITH_YOUR_LINEAR_LABEL_NAME` to the Linear label that starts a delivery loop (for example `factory-loop`).

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
