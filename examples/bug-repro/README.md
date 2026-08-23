# Bug repro line

Factory line that turns a **bug report posted in Slack** into a **pull request with committed evidence**. It reacts `:eyes:` to acknowledge, reproduces the bug as a failing test, fixes it, reviews the fix, runs your repository's own checks, opens the pull request, and reacts `:white_check_mark:`.

The line loops back to implementation when review or verification rejects the fix, and it stops early with `:x:` when the report cannot be turned into a failing check.

## Stages

| Stage | Job | What it decides |
|-------|-----|-----------------|
| `react-eyes` | `bug-repro-slack-react` | Nothing. Acknowledges the report with `:eyes:` so the reporter knows it was picked up |
| `reproduce` | `bug-repro-reproduce` | `reproduced`. True only when a new test fails for the reported reason |
| `react-fail` | `bug-repro-slack-react` | Nothing. Reacts `:x:` and ends the run when `reproduced` is false |
| `implement` | `bug-repro-implement` | Nothing. Commits the fix on the working branch |
| `review` | `bug-repro-review` | `review_result`. `approved` sends the fix to verification, `needs_changes` sends it back to `implement` |
| `verify` | `bug-repro-verify` | `verdict`. `approved` sends the fix to the pull request, `needs_work` sends it back to `implement` |
| `open-pr` | `bug-repro-open-pr` | `pr_url`. The pull request it pushed and opened |
| `react-success` | `bug-repro-slack-react` | Nothing. Reacts `:white_check_mark:` on the original message |

You deploy `bug-repro-slack-react` once. Three stages use it, each passing a different `emoji` literal.

The two back edges are bounded in `line.toml`. `review` returns to `implement` at most 3 times, `verify` at most 2. `[limits].max_iterations = 12` caps the whole run.

## The shared sandbox

> **Warning.** All six jobs declare an identical `[run.sandbox]` with `mode = "ensure"` and `name = "bug-repro-{{work_key}}"`. This is load bearing. Every stage after `reproduce` works on the branch `fix/{{work_key}}` that `reproduce` created, and that branch only exists inside that one sandbox. If you change the sandbox `name`, `image`, `snapshot_name`, or any other field in one job and not in the other five, the line will not fail loudly. A later stage will land in a different sandbox, find no working branch, and the run will die somewhere confusing.

Change `[run.sandbox]` in all six manifests or in none of them. The same rule applies to the `checkout-repo` step, which is also identical in all six.

`work_key` is the Slack `event_id`, so the sandbox name is stable for the whole run and unique per report.

## How your prompts and scripts get into the sandbox

Nothing here is published to Islo Knowledge. The prompt bodies in `prompts/` and the harness scripts in `harness/` are meant to live in **your** repository, and every job reads them fresh from a git checkout at run time. Your repository stays the single source of truth, and editing a prompt takes a commit rather than a redeploy.

The first step of every job is `checkout-repo`. It configures git credentials from the gateway-injected `GH_TOKEN`, then clones your repository into `/workspace/REPLACE_WITH_REPOSITORY` if it is not already there, or fetches if it is.

> That step deliberately fetches without checking anything out. The working branch `fix/{{work_key}}` belongs to the run, and a step that reset the working tree to the remote head would silently throw away the failing test and the fix. Only `reproduce` creates the branch, and only the per stage `checkout-branch` step moves onto it.

Per-run scratch state lives at `/workspace/.islo-line/bug-repro/{{work_key}}/`, outside the checkout, so it survives every stage without dirtying your working tree.

| Scratch path | Written by | Read by |
|--------------|-----------|---------|
| `slack/` | `reproduce` | `reproduce` |
| `review.md` | `review` | `implement` |
| `verify.log`, `verify.status` | `verify` | `implement` |

## Placeholders

Replace all three before you deploy. They appear in the manifests and in the paths inside them.

| Placeholder | Where | Set it to |
|-------------|-------|-----------|
| `REPLACE_WITH_OWNER` | the `repo` param default and the clone URL in every job | your GitHub organisation or user |
| `REPLACE_WITH_REPOSITORY` | the `repo` param default, the clone URL, and every `/workspace/` path in every job | your repository name |
| `REPLACE_WITH_YOUR_SLACK_CHANNEL_ID` | `[trigger.selector].channels` in `line.toml` | the Slack channel ID your team reports bugs in, for example `C01234ABCDE` |

`REPLACE_WITH_REPOSITORY` is the one to be careful with. It is both the repository name and the checkout directory name, so it appears in the clone URL, in every prompt path, and in every harness path.

## Trigger

```toml
[trigger]
type = "integration_trigger"
provider = "slack"
name = "message.received"
```

The line starts on any message in the selected channels.

**`[trigger.selector]`** limits that to `scope = "selected"` with an explicit `channels` list. Keep the list explicit. A wider scope means every message in every channel the integration can see starts a run.

**`[[trigger.filters]]`** carries one entry:

```toml
[[trigger.filters]]
op = "missing"
operand = { type = "trigger", path = "$.event.subtype" }
```

Slack sends `message.received` for far more than a person typing a bug report. Edits, deletions, channel joins and leaves, pinned items, and bot posts all arrive as `message.received` with a `subtype` field set. A plain human message has no `subtype`. This filter drops everything else. Without it, every join notice starts a sandbox and every edit of a report starts a second run against the same bug.

**`[trigger.outputs]`** are the values the line passes into stages.

| Output | Slack path | What it is for |
|--------|-----------|----------------|
| `work_key` | `trigger.raw.event_id` | Names the shared sandbox and the working branch. Slack event IDs are stable per event, so a redelivery of the same event reuses the same sandbox and branch instead of starting a parallel attempt |
| `report` | `trigger.raw.event.text` | The bug report text. Handed to `reproduce`, `implement`, `review` and `verify` |
| `slack_channel` | `trigger.raw.event.channel` | Where to react, and where to fetch attachments from |
| `slack_ts` | `trigger.raw.event.ts` | Which message to react to and fetch attachments from |
| `slack_user` | `trigger.raw.event.user` | The reporter, passed through for attribution |

## Job parameters

`work_key` is required in all six jobs and constrained to `^[a-zA-Z0-9][a-zA-Z0-9._-]{0,62}$`, because it becomes a sandbox name and a git branch name.

| Job | Param | Required | Default | Purpose |
|-----|-------|----------|---------|---------|
| `bug-repro-slack-react` | `slack_channel` | yes | | Channel of the message to react to |
| | `slack_ts` | yes | | Timestamp of the message to react to |
| | `emoji` | yes | | Reaction name without colons. The three stages pass `eyes`, `x`, `white_check_mark` |
| | `work_key` | yes | | Shared sandbox name |
| | `report` | no | `""` | Passthrough, so the line can bind the same inputs to every stage |
| | `slack_user` | no | `""` | Passthrough |
| `bug-repro-reproduce` | `repo` | no | `REPLACE_WITH_OWNER/REPLACE_WITH_REPOSITORY` | Repository in `owner/name` form |
| | `base_branch` | no | `main` | Branch the fix branches off |
| | `report` | yes | | The bug report text |
| | `work_key` | yes | | Shared sandbox and working branch name |
| | `slack_channel` | yes | | Channel to fetch attachments from |
| | `slack_ts` | yes | | Message to fetch attachments from |
| `bug-repro-implement` | `repo` | no | as above | Repository in `owner/name` form |
| | `base_branch` | no | `main` | Branch the whole-branch diff is read against before committing |
| | `report` | no | | The bug report text |
| | `work_key` | yes | | Shared sandbox and working branch name |
| `bug-repro-review` | `repo` | no | as above | Repository in `owner/name` form |
| | `base_branch` | no | `main` | Branch the diff is read against |
| | `report` | no | | The bug report text |
| | `work_key` | yes | | Shared sandbox and working branch name |
| `bug-repro-verify` | `repo` | no | as above | Repository in `owner/name` form |
| | `report` | no | | The bug report text |
| | `work_key` | yes | | Shared sandbox and working branch name |
| `bug-repro-open-pr` | `repo` | no | as above | Repository the pull request opens in |
| | `base_branch` | no | `main` | Pull request base |
| | `work_key` | yes | | Shared sandbox and working branch name |
| | `report` | no | | Quoted in the pull request body |
| | `recording_path` | no | `evidence/{{work_key}}` | Repository relative path of the evidence `verify` committed. The line binds the real value from the `verify` stage output, so this default only applies when you run the job by hand, and it names the directory rather than the artifact |

`base_branch` defaults to `main` in the four jobs that use it, and no transition binds it. It is a manifest level knob, not a run time input. If your default branch is not `main`, change it in all four.

## Job outputs

| Job | Output | Type | Purpose |
|-----|--------|------|---------|
| `bug-repro-reproduce` | `reproduced` | boolean | Routes to `implement` when true, to `react-fail` when false |
| | `failing_test` | string | Path and name of the test that captures the bug |
| `bug-repro-review` | `review_result` | string | `approved` or `needs_changes` |
| | `summary` | string | The review findings |
| `bug-repro-verify` | `verdict` | string | `approved` or `needs_work` |
| | `summary` | string | The check results |
| | `recording_path` | string | Repository relative path of the committed evidence artifact |
| `bug-repro-open-pr` | `pr_url` | string | The pull request URL |

## Before you deploy

### 1. Connect Slack

Install the Islo Slack integration and grant it the channel your team reports bugs in. The harness scripts and the reactions use the gateway-injected `SLACK_TOKEN`, so there is nothing else to wire.

The gateway profile `default` also injects `GH_TOKEN` and `GITHUB_TOKEN`, which is what the clone, the push, and `gh pr create` use.

### 2. Commit the prompts and the harness into your repository

The jobs read both from the checkout, so they must exist on your default branch before the first run.

```bash
mkdir -p .islo/prompts .islo/harness
cp <this-repo>/examples/bug-repro/prompts/*.md .islo/prompts/
cp <this-repo>/examples/bug-repro/harness/*.py .islo/harness/
git add .islo && git commit -m "Add bug-repro line prompts and harness" && git push
```

Your repository then contains:

```text
.islo/prompts/{reproduce,implement,review,verify,open-pr}.md
.islo/harness/{slack_react,download_slack_attachments}.py
```

These are yours to specialise. The generic prompts tell the agent to discover your test conventions. Once you edit them to name your actual test layout, commands, and evidence format, the line gets sharper with no redeploy.

### 3. Replace the placeholders

Fill in all three placeholders from the table above, across all six job manifests and `line.toml`.

### 4. Deploy the jobs, then the line

Deploy order matters. The line pins a job version per stage at deploy time, so all six jobs must exist first. Deploying the line before the jobs, or changing a job without redeploying the line, leaves the line pinned to a version that is not what you just wrote.

```bash
for j in slack-react reproduce implement review verify open-pr; do
  islo job deploy "bug-repro-$j" --path "examples/bug-repro/jobs/bug-repro-$j/job.toml" --dry-run
  islo job deploy "bug-repro-$j" --path "examples/bug-repro/jobs/bug-repro-$j/job.toml"
done

islo factory line validate examples/bug-repro/line.toml
islo factory line deploy examples/bug-repro/line.toml --dry-run
islo factory line deploy examples/bug-repro/line.toml
```

`islo factory line validate` resolves every stage's `job` against what is deployed on your tenant. Before the six jobs are deployed it fails with `references unknown job`. That is expected and it is why the jobs go first.

### 5. Test with one real Slack report

Post one message with a screenshot attached in the configured channel. Describe a real, small, reproducible bug.

Confirm these four things, in order:

1. The message gets `:eyes:`, within a minute or so.
2. Every stage reports the **same** sandbox name, `bug-repro-<slack-event-id>`. This is the shared-sandbox invariant. If two stages report different sandbox names, stop and diff `[run.sandbox]` across the six manifests.
3. The pull request contains the evidence artifact under `evidence/<slack-event-id>/`, and the failing test that `reproduce` added.
4. The message gets `:white_check_mark:`.

Watch it run:

```bash
islo factory line runs bug-repro
islo factory line-run events <run-id>
```

The events stream is where you see the sandbox name per stage and the stage outputs (`reproduced`, `review_result`, `verdict`, `pr_url`).

**If no run appears at all**, the message never reached the line. Check the trigger side before you look at any job:

```bash
islo factory manager status
islo factory triggers list --with-status
```

In that order. `manager status` tells you the line routing agent is running at all. `triggers list --with-status` tells you whether the Slack trigger is registered, enabled, and receiving deliveries. The usual causes are the Slack integration not granted the channel, a channel ID left as `REPLACE_WITH_YOUR_SLACK_CHANNEL_ID`, or a message that the `subtype` filter correctly dropped, which includes anything posted by a bot.

### 6. Remove

Delete the deployed line and the six jobs from your tenant when you no longer need this example.

## If runs are slow

This example ships no snapshot. Every run clones your repository and installs dependencies from scratch, which is the slowest possible first stage and the price of a template that works on any repository.

To fix that, bake a sandbox with your dependencies prebuilt, save it with `islo snapshot save <sandbox> --name <your-snapshot>`, and set `snapshot_name = "<your-snapshot>"` in `[run.sandbox]`.

Set it in **all six** job manifests. `snapshot_name` is part of the shared sandbox spec, and a snapshot set in five jobs out of six is exactly the drift the warning above describes.

## Compared to feature delivery

[`feature-delivery`](../feature-delivery/) runs the same implement, review, verify loop from a Linear label on a planned issue. This line starts from an unplanned bug report in Slack, and it adds the two stages that a bug needs and a feature does not: a reproduction gated on a genuinely failing test, and a Slack reaction thread so the reporter can see it being worked.
