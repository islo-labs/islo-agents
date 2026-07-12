# Webhooks

Assembled Islo incoming receivers. One file per external source (GitHub, Linear, …).

Files under `webhooks/` are assembled create/update bodies built from this pack's trigger fragments. Edit `agents/*/trigger-rules/*.toml` (e.g. Linear label UUID), reassemble, then deploy to your tenant.

**Trigger rule fragments live with the agent** that should wake up:

```text
agents/<role>/trigger-rules/<source>.toml   # [[rules]] array of IncomingWebhookRule
webhooks/<source>-….toml                    # full create/update body (assembled)
```

## Assemble

After editing any `agents/*/trigger-rules/*.toml`:

```bash
npm run assemble-webhooks
```

That rebuilds:

| Output | Fragments |
|--------|-----------|
| `github-events.toml` | `agents/*/trigger-rules/github.toml` |
| `linear-issues.toml` | `agents/*/trigger-rules/linear.toml` |

## Deploy

```bash
# create
islo webhook incoming create --request-toml @webhooks/github-events.toml
islo webhook incoming create --request-toml @webhooks/linear-issues.toml

# update rules on an existing receiver
islo webhook incoming update <webhook-id> \
  --request-toml @webhooks/github-events.toml
```

Auth secrets are applied after create (do not commit them). See HMAC notes below.

### GitHub HMAC

```bash
openssl rand -hex 32   # do not commit

islo webhook incoming update <webhook-id> --request-toml - <<'EOF'
[auth]
auth_type = "hmac"
algorithm = "sha256"
encoding = "hex"
prefix = "sha256="

[auth.secret]
name = "github-events-webhook-secret"
value = "<secret>"

[auth.signature]
source = "header"
name = "X-Hub-Signature-256"

[auth.signed_payload]
type = "raw_body"
EOF
```

Point the GitHub org/repo webhook at the `receiver_url`, content type `application/json`, events: **Pull requests**, **Issue comments**, **Workflow runs**.

### Linear HMAC

Same pattern with `Linear-Signature` / hex encoding (no `sha256=` prefix). Enable **Issues** only on the Linear webhook.

## Adding a trigger rule

1. Add or edit `agents/<role>/trigger-rules/<source>.toml` (`[[rules]]` array).
2. Run `npm run assemble-webhooks`.
3. `islo webhook incoming update <id> --request-toml @webhooks/<file>.toml`.
4. Re-apply HMAC if the update body resets `auth` to `none`.
