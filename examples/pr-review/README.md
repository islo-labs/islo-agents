# PR review line

Factory line that reviews **newly opened** GitHub pull requests and posts one advisory review comment.

## What you get

- GitHub `pull_request.opened` starts one line run.
- One agent stage reviews the diff and posts a comment.
- Typed outputs: `review_result`, `summary`, `reviewed_head_sha`.

This line does not implement fixes, run verification loops, or mutate branches.

## Before you deploy

### 1. Connect GitHub

Install and authorize the Islo GitHub integration for your organization. Select the repositories this line should watch.

### 2. Edit the repository selector

In `line.toml`, replace `REPLACE_WITH_OWNER/REPLACE_WITH_REPOSITORY` with your repository (for example `my-org/my-service`).

Scope the selector to repositories you trust. The agent runs with gateway-injected GitHub credentials in a rooted sandbox and reads PR diff content, so treat fork PR bodies and changed files as untrusted input.

### 3. Deploy job, then line

```bash
islo job deploy --path examples/pr-review/jobs/pr-review/job.toml --dry-run
islo job deploy --path examples/pr-review/jobs/pr-review/job.toml
islo factory line validate examples/pr-review/line.toml
islo factory line deploy examples/pr-review/line.toml --dry-run
islo factory line deploy examples/pr-review/line.toml
```

### 4. Test

Open a pull request in the selected repository. Inspect the run:

```bash
islo factory line runs pr-review
islo factory line-run events <run-id>
```

You should see one review comment on the PR and `review_result` in the stage output.

### 5. Customize

Edit the prompt literal in `jobs/pr-review/job.toml` to match your team's review standards.

### 6. Remove

Delete the deployed line and job from your tenant when you no longer need this example.

## Adoption notes for agents

Read this before copying the line into a tenant.

- This is the one-stage line. It reviews a newly opened PR and stops. It does not implement, re-review, or share a sandbox with feature-delivery.
- Replace `REPLACE_WITH_OWNER/REPLACE_WITH_REPOSITORY` in `line.toml`. The selector is the trust boundary. Fork PR text is untrusted input.
- The prompt is a literal in `jobs/pr-review/job.toml`. Edit that file and redeploy the job before the line picks up new review rules.
- Harness is Claude (`claude-sonnet-4-5`) through your connected Claude account. Change `harness` and `model` if you want a different provider. Do not point the job at a private snapshot name.

## Limitations

- Only `pull_request.opened` is wired. Reopened or updated PRs do not retrigger this line until you extend the trigger.
