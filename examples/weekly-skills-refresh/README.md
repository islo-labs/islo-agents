# Weekly skills refresh line

Scheduled Factory line that scans **product repos in a snapshot**, decides whether agent-facing skill docs are stale, and opens a PR (or commits) to your skills repository.

## Stage

| Stage | Job | Snapshot |
|-------|-----|----------|
| `refresh` | `weekly-skills-refresh` | `skills-refresh` |

## Before you deploy

### 1. Publish prompt

```bash
islo knowledge create weekly-skills-refresh-prompt --level skill --body @examples/weekly-skills-refresh/prompts/refresh.md
```

### 2. Build snapshot `skills-refresh`

Bake product repos under `/workspace/` per `snapshots/skills-refresh/snapshot-src/README.md`, then:

```bash
islo snapshot save <your-build-sandbox> --name skills-refresh
```

### 3. Configure the job

Edit `jobs/weekly-skills-refresh/job.toml` params as needed:

| Param | Default | Purpose |
|-------|---------|---------|
| `skills_repo` | `your-org/agent-skills` | GitHub `owner/repo` to update |
| `since` | `7 days ago` | Commit lookback window |
| `publish_mode` | `pr` | `pr`, `commit`, or `report` |
| `branch_prefix` | `factory/skills-refresh` | PR branch prefix |
| `skills_globs` | `**` | Globs the agent may edit under the skills repo |
| `commit_message` | `chore: refresh agent skills from product changes` | Git commit message |

Ensure the sandbox has `gh` available. GitHub credentials are injected by the gateway at sandbox create. Do not bake tokens into the snapshot.

### 4. Deploy

```bash
islo job deploy --path examples/weekly-skills-refresh/jobs/weekly-skills-refresh/job.toml --dry-run
islo job deploy --path examples/weekly-skills-refresh/jobs/weekly-skills-refresh/job.toml
islo factory line validate examples/weekly-skills-refresh/line.toml
islo factory line deploy examples/weekly-skills-refresh/line.toml --dry-run
islo factory line deploy examples/weekly-skills-refresh/line.toml
```

### 5. Verify

After the scheduled run or a manual line run:

```bash
islo factory line runs weekly-skills-refresh
islo factory line-run events <run-id>
```

With `publish_mode = pr`, expect a PR on your skills repo. With `report`, expect a summary output only.

### 6. Remove

Delete the deployed line and job from your tenant when you no longer need this example.
