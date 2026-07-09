# Webhooks

Assembled Islo incoming receivers. One file per external source (GitHub, Linear, …).

**Trigger rule fragments live with the agent** that should wake up:

```text
agents/<role>/trigger_rules/<source>.json   # array of IncomingWebhookRule
webhooks/<source>-….json                    # full create/update body (assembled)
```

## Assemble

After editing any `agents/*/trigger_rules/*.json`:

```bash
node scripts/assemble-webhooks.js
```

That rebuilds:

| Output | Fragments |
|--------|-----------|
| `github-events.json` | `agents/*/trigger_rules/github.json` |
| `linear-issues.json` | `agents/*/trigger_rules/linear.json` |

## Deploy

```bash
# create
islo webhook incoming create --request-json @webhooks/github-events.json
islo webhook incoming create --request-json @webhooks/linear-issues.json

# update rules on an existing receiver
islo webhook incoming update <webhook-id> \
  --request-json @webhooks/github-events.json
```

Auth secrets are applied after create (do not commit them). See HMAC notes below.

### GitHub HMAC

```bash
openssl rand -hex 32   # do not commit

islo webhook incoming update <webhook-id> --request-json '{
  "auth": {
    "auth_type": "hmac",
    "algorithm": "sha256",
    "secret": { "name": "github-events-webhook-secret", "value": "<secret>" },
    "signature": { "source": "header", "name": "X-Hub-Signature-256" },
    "signed_payload": { "type": "raw_body" },
    "encoding": "hex",
    "prefix": "sha256="
  }
}'
```

Point the GitHub org/repo webhook at the `receiver_url`, content type `application/json`, events: **Pull requests**, **Issue comments**.

### Linear HMAC

Same pattern with `Linear-Signature` / hex encoding (no `sha256=` prefix). Enable **Issues** only on the Linear webhook.

## Adding a trigger rule

1. Add or edit `agents/<role>/trigger_rules/<source>.json` (JSON array of rules).
2. Run `node scripts/assemble-webhooks.js`.
3. `islo webhook incoming update <id> --request-json @webhooks/<file>.json`.
4. Re-apply HMAC if the update body resets `auth` to `none`.
