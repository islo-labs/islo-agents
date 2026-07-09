# Webhooks

Assembled Islo incoming receivers. One file per external source (GitHub, Linear, …).

Files under `webhooks/` are assembled create/update bodies built from this pack’s trigger fragments. Edit `agents/*/trigger-rules/*.json` (e.g. Linear label UUID), reassemble, then deploy to your tenant.

**Trigger rule fragments live with the agent** that should wake up:

```text
agents/<role>/trigger-rules/<source>.json   # array of IncomingWebhookRule
webhooks/<source>-….json                    # full create/update body (assembled)
```

## Assemble

After editing any `agents/*/trigger-rules/*.json`:

```bash
npm run assemble-webhooks
```

That rebuilds:

| Output | Fragments |
|--------|-----------|
| `github-events.json` | `agents/*/trigger-rules/github.json` |
| `linear-issues.json` | `agents/*/trigger-rules/linear.json` |

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

Point the GitHub org/repo webhook at the `receiver_url`, content type `application/json`, events: **Pull requests**, **Issue comments**, **Workflow runs**.

### Linear HMAC

Same pattern with `Linear-Signature` / hex encoding (no `sha256=` prefix). Enable **Issues** only on the Linear webhook.

## Adding a trigger rule

1. Add or edit `agents/<role>/trigger-rules/<source>.json` (JSON array of rules).
2. Run `npm run assemble-webhooks`.
3. `islo webhook incoming update <id> --request-json @webhooks/<file>.json`.
4. Re-apply HMAC if the update body resets `auth` to `none`.
