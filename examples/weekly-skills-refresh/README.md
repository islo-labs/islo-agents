# Weekly skills refresh line

Scheduled Factory line that scans **product repos in a snapshot**, decides whether agent-facing skill docs are stale, and opens a PR (or commits) to your skills repository. Checkout, change collection, the edit, and publish are separate steps. The agent does not publish.

## Stage

| Stage | Job | Snapshot |
|-------|-----|----------|
| `refresh` | `weekly-skills-refresh` | `skills-refresh` |

## Before you deploy

### 1. Build snapshot `skills-refresh`

Bake product repos under `/workspace/` per `snapshots/skills-refresh/snapshot-src/README.md`, then:

```bash
islo snapshot save <your-build-sandbox> --name skills-refresh
```

### 2. Configure the job

Edit `jobs/weekly-skills-refresh/job.toml` params as needed:

| Param | Default | Purpose |
|-------|---------|---------|
| `org` | `your-org` | GitHub org that owns the product repos in the snapshot |
| `repos` | `auto` | Scans git repos already in the snapshot |
| `skills_repo` | `your-org/agent-skills` | GitHub `owner/repo` to update |
| `since` | `7 days ago` | Commit lookback window |
| `publish_mode` | `pr` | `pr`, `commit`, or `report` |
| `branch_prefix` | `factory/skills-refresh` | PR branch prefix |
| `skills_globs` | `skills/**` | Globs the agent may edit under the skills repo. Narrow this. |
| `commit_message` | `chore: refresh agent skills from product changes` | Git commit message used by the publish step |

Ensure the sandbox has `gh` available. GitHub credentials are injected by the gateway at sandbox create. Do not bake tokens into the snapshot.

### 3. Deploy

```bash
islo job deploy --path examples/weekly-skills-refresh/jobs/weekly-skills-refresh/job.toml --dry-run
islo job deploy --path examples/weekly-skills-refresh/jobs/weekly-skills-refresh/job.toml
islo factory line validate examples/weekly-skills-refresh/line.toml
islo factory line deploy examples/weekly-skills-refresh/line.toml --dry-run
islo factory line deploy examples/weekly-skills-refresh/line.toml
```

### 4. Verify

After the scheduled run or a manual line run:

```bash
islo factory line runs weekly-skills-refresh
islo factory line-run events <run-id>
```

With `publish_mode = pr`, expect a PR on your skills repo when the agent edited files. With `report`, expect a summary and no push.

## Adoption notes for agents

Read this before copying the line into a tenant.

- The agent must not commit or open the PR. The `publish` step does that from `publish_mode` and `commit_message`. If you put publish back into the prompt, a partial agent failure can push a bad branch.
- `changes.json` is built from commits already in the snapshot. Rebake `skills-refresh` when you want a newer lookback. The collect step does not contact the remote.
- `skills_globs` is the allowlist. The default `skills/**` is a starting point. Point it at the paths agents actually read.
- `org` and `skills_repo` default to `your-org/...`. Change them. Do not hardcode a vendor org.
- Snapshot name `skills-refresh` is one you create. Product checkouts live under `/workspace/`. The skills repo is cloned at runtime into `/workspace/skills`.

### 5. Remove

Delete the deployed line and job from your tenant when you no longer need this example.
