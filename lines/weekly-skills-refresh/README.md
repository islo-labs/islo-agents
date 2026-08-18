# `weekly-skills-refresh` template

Scheduled Factory line that scans **product repos in a snapshot**, decides whether agent-facing skill docs are stale, and opens a PR (or commits) to your skills repository.

## Stage

| Stage | Job | Snapshot |
|-------|-----|----------|
| `refresh` | `weekly-skills-refresh` | `skills-refresh` |

## Before you deploy

### 1. Snapshot `skills-refresh`

Bake a snapshot with your product repositories under `/workspace/` (each with a `.git` directory) plus the harness from `snapshots/skills-refresh/`.

### 2. Configure the job

Edit `agents/weekly-skills-refresh/job.toml`:

| Param / env | Default | Purpose |
|-------------|---------|---------|
| `skills_repo` | `your-org/agent-skills` | GitHub `owner/repo` to update |
| `since` | `7 days ago` | Commit lookback window |
| `publish_mode` | `pr` | `pr`, `commit`, or `report` |
| `branch_prefix` | `factory/skills-refresh` | PR branch prefix |
| `skills_globs` | `**` | Globs the agent may edit under the skills repo |
| `commit_message` | `chore: refresh agent skills from product changes` | Git commit message |
| `GIT_COMMITTER_*` | placeholder noreply email | Git author for commits |

Ensure the sandbox has `gh` authenticated (`gh auth login` in snapshot or gateway-injected token).

### 3. Deploy

```bash
islo job deploy weekly-skills-refresh --dry-run && islo job deploy weekly-skills-refresh
islo factory line deploy lines/weekly-skills-refresh/line.toml --dry-run
islo factory line deploy lines/weekly-skills-refresh/line.toml
```
