# islo-agents

Reusable agent templates for Islo jobs. Each template owns a prompt, an Islo job file, and any thin wrapper needed to launch the same job. All templates share `src/agent.ts`, a generic runner that loads a prompt, substitutes variables, and runs the Claude Agent SDK.

## Structure

```
src/agent.ts          — generic harness (prompt + vars → Claude Agent SDK)
reviewer/             — code review agents
  github/             — GitHub PR reviewer (job + optional action + prompt)
babysit/              — CI failure fixer (job + action + prompt)
verify/               — E2E verification (job + action + prompt)
task/                 — integration-triggered tasks
  prompt.md           — shared "implement this issue" prompt
  linear/             — Linear agent integration (activity emissions)
```

## Quick Start

Add an `ISLO_API_KEY` secret to your repo, deploy the relevant job(s) in Islo, then add workflow files.

### PR Review

See `reviewer/github/README.md` for Islo incoming webhook setup, trigger rules, sandbox lifecycle, and review output behavior.

```yaml
name: PR Review
on:
  pull_request:
    types: [opened, reopened]
jobs:
  review:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: islo-labs/islo-agents/reviewer/github@v1
        with:
          pr_number: ${{ github.event.pull_request.number }}
        env:
          ISLO_API_KEY: ${{ secrets.ISLO_API_KEY }}
```

### CI Babysit

```yaml
name: Babysit CI
on:
  workflow_run:
    workflows: ["CI"]
    types: [completed]
jobs:
  babysit:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    if: github.event.workflow_run.conclusion == 'failure'
    steps:
      - uses: islo-labs/islo-agents/babysit@v1
        with:
          run_id: ${{ github.event.workflow_run.id }}
        env:
          ISLO_API_KEY: ${{ secrets.ISLO_API_KEY }}
```

### E2E Verification

```yaml
name: Verify
on:
  pull_request:
    types: [labeled]
jobs:
  verify:
    if: github.event.label.name == 'islo-verify'
    runs-on: ubuntu-latest
    timeout-minutes: 45
    steps:
      - uses: islo-labs/islo-agents/verify@v1
        with:
          pr_number: ${{ github.event.pull_request.number }}
        env:
          ISLO_API_KEY: ${{ secrets.ISLO_API_KEY }}
```

## Deploying Jobs

Each template has a colocated `job.toml` manifest. The current Islo CLI deploy command reads manifests from `jobs/<name>/job.toml`, so put the chosen template manifest at that path before deploying.

```bash
mkdir -p jobs/islo-review
cp reviewer/github/job.toml jobs/islo-review/job.toml
islo job deploy islo-review --dry-run
islo job deploy islo-review
```

Repeat the same pattern for other templates such as `babysit/job.toml`, `verify/job.toml`, and `task/linear/job.toml`.

## Customizing Review Context

Create a `REVIEW.md` at your repo root to inject extra context into reviewer and babysit prompts. For verify, also add a `VERIFY.md`.

## Migration from islo-reviewer

Replace action references in your workflow files:

```diff
-- uses: islo-labs/islo-reviewer/review@v1
+- uses: islo-labs/islo-agents/reviewer/github@v1
```

The required `pr_number` input remains compatible. Model, turn, and budget defaults now live in `reviewer/github/job.toml`; fork the template to change them.
