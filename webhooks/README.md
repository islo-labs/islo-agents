# Webhooks

Shared Islo incoming-webhook configs that route provider events to jobs.

Agent-specific triggers that only serve one integration can stay next to that
agent (for example `agents/implementor/linear/webhook-rule.json`). Cross-cutting
ingress that fans out to multiple jobs lives here.

## `github-events`

One GitHub → Islo receiver for PR review and `@islo` mention routing.

| GitHub event | Rule | Job |
|--------------|------|-----|
| `pull_request` opened / reopened | PR exists + action | `islo-review` |
| `pull_request` labeled `islo-review` | PR exists + label | `islo-review` |
| `issue_comment` created with `@islo` on a PR | comment filter | `delegator` |

Do **not** put runner / `deliver_to_port` traffic on this webhook. Keep
`gh-runner-*` receivers separate.

### Create

```bash
islo webhook incoming create --request-json @webhooks/github-events.json
```

Note the webhook **ID** and **receiver_url** from the output.

### Enable GitHub HMAC

Generate a secret (do not commit it):

```bash
openssl rand -hex 32
```

```bash
islo webhook incoming update <webhook-id> --request-json '{
  "auth": {
    "auth_type": "hmac",
    "algorithm": "sha256",
    "secret": {
      "name": "github-events-webhook-secret",
      "value": "<secret>"
    },
    "signature": {
      "source": "header",
      "name": "X-Hub-Signature-256"
    },
    "signed_payload": { "type": "raw_body" },
    "encoding": "hex",
    "prefix": "sha256="
  }
}'
```

### Point GitHub at it

Create (or update) an org/repo webhook:

- **Payload URL**: the `receiver_url` from create (for example `https://wh-in-….ca.webhook.islo.dev`)
- **Content type**: `application/json`
- **Secret**: the same HMAC secret
- **Events**: `Pull requests`, `Issue comments`

After cutover, disable the old `github-mentions` and `github-pr-review-opened`
Islo receivers so you do not double-fire jobs.

### Update rules

```bash
islo webhook incoming update <webhook-id> \
  --request-json @webhooks/github-events.json
```

Re-apply HMAC auth afterward if the update body resets `auth` to `none`.
