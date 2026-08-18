# `weekly-skills-refresh` template

Scheduled Factory line that scans **product repos in a snapshot**, decides whether agent-facing skill docs are stale, and opens a PR (or commits) to your skills repository.

## Stage

| Stage | Job | Snapshot |
|-------|-----|----------|
| `refresh` | `weekly-skills-refresh` | `skills-refresh` |

## Before you deploy

### 1. Snapshot `skills-refresh`

Bake product repos under `/workspace/`, copy `snapshots/skills-refresh/snapshot-src/`
per `snapshots/skills-refresh/README.md`, then `islo snapshot save skills-refresh`.

### 2. Configure the job

Edit `agents/weekly-skills-refresh/job.toml` params as needed. The agent handles git checkout, change discovery, edits, and publish — there are no harness exec steps.

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
