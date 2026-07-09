# islo-agents

Reusable agent templates for Islo jobs. Each template owns a prompt, an Islo job file, and any integration-specific launchers when they are useful. All templates share `src/agent.ts`, a generic runner that loads a prompt, substitutes variables, and runs the Claude Agent SDK.

## Structure

```
src/agent.ts          — generic harness (prompt + vars → Claude Agent SDK)
agents/               — reusable agent templates
  review/github/      — GitHub PR reviewer (job + prompt)
  babysit/            — CI failure fixer (job + action + prompt)
  verify/             — E2E verification (job + action + prompt)
  task/               — integration-triggered tasks
    prompt.md         — shared "implement this issue" prompt
    linear/           — Linear agent integration (activity emissions)
webhooks/             — shared Islo incoming webhooks that fan out to multiple jobs
  github-events.json  — GitHub PR review + @islo mentions
```

## Quick Start

Deploy the relevant job manifest in Islo, then connect your trigger through Islo webhooks, schedules, manual runs, or a wrapper that launches the same job.

### PR Review

Use `agents/review/github/job.toml` and `agents/review/github/prompt.md`.

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
      - uses: islo-labs/islo-agents/agents/babysit@v1
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
      - uses: islo-labs/islo-agents/agents/verify@v1
        with:
          pr_number: ${{ github.event.pull_request.number }}
        env:
          ISLO_API_KEY: ${{ secrets.ISLO_API_KEY }}
```

## Deploying Jobs

Each template has a colocated `job.toml` manifest. The current Islo CLI deploy command reads manifests from `jobs/<name>/job.toml`, so put the chosen template manifest at that path before deploying.

```bash
mkdir -p jobs/islo-review
cp agents/review/github/job.toml jobs/islo-review/job.toml
islo job deploy islo-review --dry-run
islo job deploy islo-review
```

Repeat the same pattern for other templates such as `agents/babysit/job.toml`, `agents/verify/job.toml`, and `agents/task/linear/job.toml`.

## Customizing Review Context

Create a `REVIEW.md` at your repo root to inject extra context into review and babysit prompts. For verify, also add a `VERIFY.md`.

