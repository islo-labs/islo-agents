# Cutover: public template → internal production pack

After the public starter pack is merged and `islo-agents-internal` is synced/forked from it.

## Prerequisites

- Public `islo-agents` on `main` with split job steps, `agents_git_ref` (default `main`), and generic example triggers.
- Internal pack at `islo-labs/islo-agents-internal` (visibility: **internal**) with:
  - Job clone URLs pointing at `islo-agents-internal.git`
  - Org-specific babysit workflow allowlist and Linear label UUID
  - Assembled `webhooks/*.json` matching those fragments
  - Remotes: `origin` = internal, `upstream` = `islo-labs/islo-agents`

## Deploy from internal

1. From an internal checkout, deploy each job (copy into `jobs/<name>/` as usual):

   ```bash
   for pair in islo-review:review islo-babysit:babysit islo-verify:verify linear-implementor:implementor delegator:delegator; do
     name="${pair%%:*}"; dir="${pair##*:}"
     mkdir -p "jobs/$name"
     cp "agents/$dir/job.toml" "jobs/$name/job.toml"
     islo job deploy "$name"
   done
   ```

2. Confirm manifests clone `islo-agents-internal` and default `agents_git_ref=main`. Pin with `--param agents_git_ref=<tag-or-sha>` when needed.

## Webhooks

1. `npm run assemble-webhooks` in the internal pack.
2. Create or update receivers from internal assembled JSON:

   ```bash
   # create github-events if missing; otherwise update
   islo webhook incoming create --request-json @webhooks/github-events.json
   islo webhook incoming update <linear-issues-id> --request-json @webhooks/linear-issues.json
   ```

3. Re-apply HMAC secrets after any update that resets `auth` to `none`.
4. Point the GitHub org webhook at the shared `github-events` receiver URL (events: `pull_request`, `issue_comment`, `workflow_run`).
5. Point Linear at `linear-issues` (Issues).

## Retire old paths (only after verifying no double-fire)

1. Disable obsolete Islo receivers: `github-mentions`, `github-pr-review-opened` (and any other superseded agent receivers).
2. Disable/remove per-repo GHA `islo-*` workflows that the webhook now covers.
3. Keep unrelated receivers (e.g. `gh-runner-alien-local-qa`) untouched.

## Public pack

- Customers fork/copy `islo-agents` and edit example triggers.
- Do not deploy Islo Labs prod from the public repo once internal is live.
