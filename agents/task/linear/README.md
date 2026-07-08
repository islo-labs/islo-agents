# Linear Task Integration

Trigger an Islo agent by adding the `islo` label to a Linear issue. The agent implements the issue (potentially across multiple repos), creates PR(s), and posts a comment with the result.

## Architecture

```
Add "islo" label → Linear Issue webhook → bear-agent (webhook-level filter) → TriggerJob → Claude Agent → PR(s) + Linear comment
```

- **Trigger**: Issue update webhook with compound `when` conditions — only fires when the "islo" label is specifically just added
- **Agent**: Generic `src/agent.ts` with `agents/task/linear/prompt.md`
- **Sandbox**: Uses the `islo-stack` snapshot with all repos pre-cloned in `/workspace/`
- **Output**: Creates GitHub PR(s) and posts a comment on the Linear issue

## Setup

### Prerequisites

- `islo` CLI installed and authenticated (`islo login`)
- Admin access to the Linear workspace (for webhook creation)
- The Islo gateway Linear integration configured (Descope outbound-apps OAuth token)

### Step 0: Create the "islo" label in Linear

Go to your Linear workspace and create a label named `islo` (workspace-level or team-level). Note the label's UUID — you'll need it in the webhook rule.

### Step 1: Deploy the job

```bash
# From the islo-agents repo root
mkdir -p jobs/linear-task
cp agents/task/linear/job.toml jobs/linear-task/job.toml
islo job deploy linear-task
```

Verify:

```bash
islo job get linear-task
```

### Step 2: Create (or update) the incoming webhook

**Important:** Update the label ID in `webhook-rule.json` if your "islo" label UUID differs from the one hardcoded in the file.

If creating fresh:

```bash
islo webhook incoming create --request-json @agents/task/linear/webhook-rule.json
```

If updating the existing webhook:

```bash
islo webhook incoming update <webhook-id> \
  --request-json @agents/task/linear/webhook-rule.json
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
    "signed_payload": { "type": "raw_body" },
    "encoding": "hex",
    "prefix": null
  }
}'
```

### Step 5: Test

1. Go to any issue in your Linear workspace
2. Add the `islo` label
3. Check: `islo job runs linear-task`

## How the Webhook Filter Works

The webhook rule uses compound `when` conditions to filter at the bear-agent level — no sandbox is created for non-matching events. The conditions check:

1. **`action == "update"`** — only issue updates, not creates or deletes
2. **`updatedFrom.labelIds` exists** — a label change actually happened
3. **`data.labelIds` contains the islo label ID** — the label is on the issue now
4. **`updatedFrom.labelIds` does NOT contain the islo label ID** — it wasn't there before (just added)

Only when all four conditions match does the webhook trigger a job run. Other issue updates (title changes, status changes, unrelated label changes) are silently dropped.

## Re-triggering

To re-trigger the agent on the same issue, remove the `islo` label and add it again.

## Updating

After modifying `agents/task/linear/job.toml`, redeploy:

```bash
cp agents/task/linear/job.toml jobs/linear-task/job.toml
islo job deploy linear-task
```

After modifying `agents/task/linear/webhook-rule.json`, update the webhook:

```bash
islo webhook incoming update <webhook-id> \
  --request-json @agents/task/linear/webhook-rule.json
```
