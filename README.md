# islo-agents

Composite GitHub Actions and Islo Job manifests for automated PR review, CI babysitting, E2E verification, and task execution. All workflows share a single generic agent harness (`src/agent.ts`) that loads a prompt template, substitutes variables, and runs the Claude Agent SDK.

## Structure

```
src/agent.ts          — generic harness (prompt + vars → Claude Agent SDK)
review/               — PR code review (job + action + prompt)
babysit/              — CI failure fixer (job + action + prompt)
verify/               — E2E verification (job + action + prompt)
mention-handler/      — persistent handler for human @islo mentions
task/                 — integration-triggered tasks
  prompt.md           — shared "implement this issue" prompt
  linear/             — Linear agent integration (activity emissions)
```

## Quick Start

Add an `ISLO_API_KEY` secret to your repo, deploy the relevant job(s) in Islo, then add workflow files.

### PR Review

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
      - uses: islo-labs/islo-agents/review@v1
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

Each workflow has a `job.toml` manifest. Deploy once per Islo account:

```bash
islo job deploy islo-review    # from review/job.toml
islo job deploy islo-babysit   # from babysit/job.toml
islo job deploy islo-verify    # from verify/job.toml
islo job deploy linear-task    # from task/linear/job.toml
islo job deploy mention-handler # from mention-handler/job.toml
```

## Worker sandbox names

Linear implementation work uses issue-scoped sandboxes and session keys:

```text
implement-ISL-646
```

Review, verify, and babysit jobs use issue-scoped names when a PR title or branch includes an issue ID:

```text
review-ISL-646
verify-ISL-646
babysit-ISL-646
```

They keep their existing PR-scoped fallback names for PRs without a Linear issue ID.

## Customizing Review Context

Create a `REVIEW.md` at your repo root to inject extra context into review/babysit prompts. For verify, also add a `VERIFY.md`.

## Migration from islo-reviewer

Replace action references in your workflow files:

```diff
-- uses: islo-labs/islo-reviewer/review@v1
+- uses: islo-labs/islo-agents/review@v1
```

All inputs are backward-compatible.
