# Linear Task Integration

Trigger an Islo agent by adding the `islo` label to a Linear issue. The agent implements the issue, creates a PR, and posts a comment with the result.

## Architecture

```
Add "islo" label → Linear Issue webhook → bear-agent → TriggerJob → label guard → Claude Agent → PR + Linear comment
```

- **Trigger**: Issue update webhook, filtered by `action == "update"`
- **Guard**: Job's first step checks that the "islo" label was specifically just added (not merely present). Exits cleanly for all other issue updates.
- **Agent**: Generic `src/agent.ts` with `task/linear/prompt.md`
- **Output**: Creates a GitHub PR and posts a comment on the Linear issue with the link

## Setup

### Prerequisites

- `islo` CLI installed and authenticated (`islo login`)
- Admin access to the Linear workspace (for webhook creation)
- The Islo gateway Linear integration configured (Descope outbound-apps OAuth token)

### Step 0: Create the "islo" label in Linear

Go to your Linear workspace and create a label named `islo` (workspace-level or team-level).

### Step 1: Deploy the job

```bash
# From the islo-agents repo root
mkdir -p jobs/linear-task
cp task/linear/job.toml jobs/linear-task/job.toml
islo job deploy linear-task
```

Verify:

```bash
islo job get linear-task
```

### Step 2: Create (or update) the incoming webhook

If creating fresh:

```bash
islo webhook incoming create --request-json @task/linear/webhook-rule.json
```

If updating the existing webhook:

```bash
islo webhook incoming update wh-in-z96joqiawthen9j21yjthf8eb \
  --request-json @task/linear/webhook-rule.json
```

Note the webhook **ID** and **URL** from the output.

### Step 3: Create the Linear webhook

1. Open **Settings > Administration > API > Webhooks**
2. Click **New webhook**
3. Set the URL to `https://<webhook-id>.ca.webhook.islo.dev`
4. Enable **Issues** only (disable everything else)
5. Save and copy the **signing secret**

### Step 4: Enable HMAC verification

```bash
islo webhook incoming update <webhook-id> --request-json '{
  "auth": {
    "auth_type": "hmac",
    "algorithm": "sha256",
    "secret": {
      "name": "linear-webhook-secret",
      "value": "<signing-secret-from-linear>"
    },
    "signature": {
      "source": "header",
      "name": "Linear-Signature"
    },
    "signed_payload": "raw_body",
    "encoding": "hex",
    "prefix": null
  }
}'
```

### Step 5: Test

1. Go to any issue in your Linear workspace
2. Add the `islo` label
3. Check: `islo job runs linear-task`

## How the Label Guard Works

Every issue update in the workspace triggers a webhook. The job's `label-guard` step filters out irrelevant updates:

1. **Not a label change?** `updatedFrom` won't have `labelIds` — exit.
2. **"islo" not on the issue?** No matching label in `data.labels` — exit.
3. **"islo" was already there?** Its ID is in `updatedFrom.labelIds` — exit (this is an unrelated label change on an issue that already had "islo").

Only proceeds if "islo" was specifically just added. Cost of a skipped run: one job creation + immediate exit (~1 second).

## Webhook Payload Reference

Linear sends this for issue updates:

```json
{
  "action": "update",
  "type": "Issue",
  "actor": { "id": "...", "type": "user", "name": "Alice" },
  "data": {
    "id": "issue-uuid",
    "title": "Fix the login bug",
    "description": "...",
    "identifier": "ENG-123",
    "labelIds": ["label-1", "label-2", "islo-label-id"],
    "labels": [
      { "id": "label-1", "name": "bug", "color": "#..." },
      { "id": "islo-label-id", "name": "islo", "color": "#..." }
    ]
  },
  "updatedFrom": {
    "labelIds": ["label-1"]
  },
  "url": "https://linear.app/team/issue/ENG-123",
  "createdAt": "2026-07-07T...",
  "organizationId": "...",
  "webhookTimestamp": 1720350000000,
  "webhookId": "..."
}
```

## Re-triggering

To re-trigger the agent on the same issue, remove the `islo` label and add it again.

## Updating the Job

After modifying `task/linear/job.toml`, redeploy:

```bash
cp task/linear/job.toml jobs/linear-task/job.toml
islo job deploy linear-task
```

## Future Improvements

- **Webhook-level filtering**: Add RFC 9535 JSONPath support to bear-agent's `when` conditions to avoid creating job runs for non-label updates.
- **Follow-up comments**: Once the agent creates a PR, conversation continues on GitHub. A future version could monitor Linear comments on labeled issues.
